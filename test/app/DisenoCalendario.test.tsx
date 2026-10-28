import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MAX_ESCRITURA } from "@/shared/personalizacion";
import { renderizarApp, simularApi } from "./utilidades";

const COMPANERISMOS = [
  { id: "c-e", tipo: "elderes", nombre: "Élderes", activo: true, orden: 0 },
  { id: "c-h", tipo: "hermanas", nombre: "Hermanas", activo: true, orden: 1 },
];
const RUTA = "/api/admin/barrios/centro";
const PERSONALIZACION = { imagenKey: null, escritura: null, escrituraRef: null, mensaje: null, plantilla: "azul" };

function simular(extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    "/api/admin/yo": {
      json: { usuario: { id: "u", email: "p@e.cl", nombre: "P", superAdmin: false }, barrios: [{ slug: "centro", nombre: "Barrio Centro", cargo: null }] },
    },
    [`${RUTA}/meses/2099-04`]: {
      json: {
        mes: { periodo: "2099-04", anio: 2099, mes: 4, estado: "abierto", ...PERSONALIZACION },
        companerismos: COMPANERISMOS,
        turnos: [{ id: "1e", fecha: "2099-04-01", companerismoId: "c-e", bloqueado: false, motivoBloqueo: null, inscripcion: null }],
      },
    },
    [`${RUTA}/meses`]: {
      json: { meses: [{ periodo: "2099-04", anio: 2099, mes: 4, estado: "abierto", turnos: 2, tomados: 0, bloqueados: 0 }] },
    },
    [RUTA]: {
      json: {
        barrio: { slug: "centro", nombre: "Barrio Centro", idioma: "es", zonaHoraria: "America/Santiago", tokenMisioneros: "t", notaParaCocinar: null, contactoNombre: null, contactoTelefono: null },
        companerismos: COMPANERISMOS,
      },
    },
    ...extra,
  });
}

/** Llamadas con ese método a una URL que termina así. */
const llamadas = (api: ReturnType<typeof simularApi>, metodo: string, url: string) =>
  api.mock.calls.filter(([entrada, init]) => (init?.method ?? "GET") === metodo && String(entrada).endsWith(url));

async function abrir() {
  renderizarApp("/admin/centro?mes=2099-04");
  return screen.findByRole("region", { name: "Diseño del calendario" });
}

describe("Panel: diseño del calendario", () => {
  it("elegir una plantilla y guardar manda solo la plantilla", async () => {
    const user = userEvent.setup();
    const api = simular({ [`${RUTA}/meses/2099-04/personalizacion`]: { json: { personalizacion: { ...PERSONALIZACION, plantilla: "dorado" } } } });
    const seccion = await abrir();

    expect(within(seccion).getByRole("radio", { name: "Azul sereno" })).toBeChecked();
    expect(within(seccion).getByRole("button", { name: "Guardar diseño" })).toBeDisabled();

    await user.click(within(seccion).getByRole("radio", { name: "Dorado cálido" }));
    await user.click(within(seccion).getByRole("button", { name: "Guardar diseño" }));

    await waitFor(() => expect(llamadas(api, "PATCH", "/meses/2099-04/personalizacion")).toHaveLength(1));
    const [, init] = llamadas(api, "PATCH", "/meses/2099-04/personalizacion")[0]!;
    expect(JSON.parse(String(init!.body))).toEqual({ plantilla: "dorado" });
  });

  it("manda los textos que cambiaron, sin la plantilla", async () => {
    const user = userEvent.setup();
    const api = simular({ [`${RUTA}/meses/2099-04/personalizacion`]: { json: { personalizacion: PERSONALIZACION } } });
    const seccion = await abrir();

    await user.type(within(seccion).getByLabelText("Escritura"), "Amaos unos a otros");
    await user.type(within(seccion).getByLabelText("Referencia"), "Juan 13:34");
    await user.click(within(seccion).getByRole("button", { name: "Guardar diseño" }));

    await waitFor(() => expect(llamadas(api, "PATCH", "/meses/2099-04/personalizacion")).toHaveLength(1));
    const [, init] = llamadas(api, "PATCH", "/meses/2099-04/personalizacion")[0]!;
    expect(JSON.parse(String(init!.body))).toEqual({ escritura: "Amaos unos a otros", escrituraRef: "Juan 13:34" });
  });

  it("no deja escribir más del máximo en la escritura", async () => {
    const user = userEvent.setup();
    simular();
    const seccion = await abrir();
    const campo = within(seccion).getByLabelText("Escritura");
    expect(campo).toHaveAttribute("maxlength", String(MAX_ESCRITURA));
    await user.click(campo);
    await user.paste("a".repeat(MAX_ESCRITURA + 50));
    expect((campo as HTMLTextAreaElement).value).toHaveLength(MAX_ESCRITURA);
  });

  it("un archivo de tipo no permitido muestra el error sin llamar a la API", async () => {
    const api = simular();
    const seccion = await abrir();
    const entrada = within(seccion).getByLabelText("Subir imagen del mes");
    fireEvent.change(entrada, { target: { files: [new File(["x"], "doc.pdf", { type: "application/pdf" })] } });

    expect(await within(seccion).findByText(/Esa imagen no se puede usar/)).toBeInTheDocument();
    expect(llamadas(api, "PUT", "/meses/2099-04/imagen")).toHaveLength(0);
  });

  it("un archivo de más de 5 MB muestra el error sin llamar a la API", async () => {
    const api = simular();
    const seccion = await abrir();
    const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.png", { type: "image/png" });
    fireEvent.change(within(seccion).getByLabelText("Subir imagen del mes"), { target: { files: [grande] } });

    expect(await within(seccion).findByText(/La imagen es muy pesada/)).toBeInTheDocument();
    expect(llamadas(api, "PUT", "/meses/2099-04/imagen")).toHaveLength(0);
  });

  it("sube una imagen válida con el Content-Type del archivo", async () => {
    const user = userEvent.setup();
    const api = simular({
      [`${RUTA}/meses/2099-04/imagen`]: { json: { personalizacion: { ...PERSONALIZACION, imagenKey: "centro/2099-04/x.png" } } },
    });
    const seccion = await abrir();
    const archivo = new File(["datos"], "foto.png", { type: "image/png" });
    await user.upload(within(seccion).getByLabelText("Subir imagen del mes"), archivo);

    await waitFor(() => expect(llamadas(api, "PUT", "/meses/2099-04/imagen")).toHaveLength(1));
    const [, init] = llamadas(api, "PUT", "/meses/2099-04/imagen")[0]!;
    expect(new Headers(init!.headers).get("Content-Type")).toBe("image/png");
  });

  it("quita la imagen del mes", async () => {
    const user = userEvent.setup();
    const conImagen = { json: { mes: { periodo: "2099-04", anio: 2099, mes: 4, estado: "abierto", ...PERSONALIZACION, imagenKey: "centro/2099-04/x.png" }, companerismos: COMPANERISMOS, turnos: [] } };
    const api = simular({
      [`${RUTA}/meses/2099-04`]: conImagen,
      [`${RUTA}/meses/2099-04/imagen`]: { json: { personalizacion: PERSONALIZACION } },
    });
    const seccion = await abrir();
    await user.click(await within(seccion).findByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(llamadas(api, "DELETE", "/meses/2099-04/imagen")).toHaveLength(1));
  });

  it("la vista previa muestra lo escrito sin guardar y la plantilla elegida", async () => {
    const user = userEvent.setup();
    const api = simular();
    const seccion = await abrir();
    await user.type(within(seccion).getByLabelText("Escritura"), "Texto sin guardar");
    await user.click(within(seccion).getByRole("radio", { name: "Cielo claro" }));
    await user.click(within(seccion).getByRole("button", { name: "Vista previa" }));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/Texto sin guardar/)).toBeInTheDocument();
    expect(within(dialogo).getByRole("link", { name: "Ir al imprimible" })).toHaveAttribute("href", "/admin/centro/2099-04/imprimir");
    expect(llamadas(api, "PATCH", "/meses/2099-04/personalizacion")).toHaveLength(0);
  });
});
