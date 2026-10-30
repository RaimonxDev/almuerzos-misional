import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderizarApp, simularApi } from "./utilidades";

const RUTA = "/api/admin/barrios/centro";

const usuario = (superAdmin: boolean) => ({
  usuario: { id: "u-1", email: "a@ejemplo.cl", nombre: "Ana", superAdmin },
  barrios: [{ slug: "centro", nombre: "Barrio Centro", cargo: null }],
});

const barrio = (extra: object = {}) => ({
  barrio: {
    slug: "centro",
    nombre: "Barrio Centro",
    idioma: "es",
    zonaHoraria: "America/Santiago",
    codigoMisioneros: "K7PM2X",
    notaParaCocinar: null,
    contactoNombre: null,
    contactoTelefono: null,
    eliminacionSolicitadaEn: null,
    motivoEliminacion: null,
    ...extra,
  },
  companerismos: [],
});

const PEDIDA = { eliminacionSolicitadaEn: "2099-01-05T15:00:00.000Z", motivoEliminacion: "Ya no la usamos" };

function simular(superAdmin: boolean, datos = barrio()) {
  let eliminado = false;
  return simularApi({
    // Como la API: el barrio borrado ya no viene en la lista.
    "/api/admin/yo": () => ({ json: { ...usuario(superAdmin), barrios: eliminado ? [] : usuario(superAdmin).barrios } }),
    "/api/admin/solicitudes": { json: { solicitudes: [], pendientes: 0, eliminaciones: [] } },
    [`${RUTA}/meses`]: { json: { meses: [] } },
    [`${RUTA}/admins`]: { json: { admins: [] } },
    [`${RUTA}/solicitud-eliminacion`]: { json: { solicitada: true } },
    [`${RUTA}/resumen-eliminacion`]: {
      json: { inscripciones: 5, inscripcionesFuturas: 2, cuentasQueSeBorran: ["pres@ejemplo.cl"] },
    },
    [RUTA]: (init) => {
      if (init?.method === "DELETE") eliminado = true;
      return { json: datos };
    },
  });
}

const llamadas = (api: ReturnType<typeof simularApi>, metodo: string, url: string) =>
  api.mock.calls
    .filter(([entrada, init]) => (init?.method ?? "GET") === metodo && String(entrada).endsWith(url))
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined));

describe("presidenta", () => {
  it("pide eliminar el barrio con un motivo", async () => {
    const api = simular(false);
    renderizarApp("/admin/centro");

    await userEvent.click(await screen.findByRole("button", { name: "Pedir eliminar el barrio" }));
    const dialogo = await screen.findByRole("dialog");
    await userEvent.type(within(dialogo).getByLabelText("Motivo (opcional)"), "Ya no la usamos");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Enviar pedido" }));

    await waitFor(() =>
      expect(llamadas(api, "POST", `${RUTA}/solicitud-eliminacion`)).toEqual([{ motivo: "Ya no la usamos" }]),
    );
  });

  it("no puede borrar el barrio directamente", async () => {
    simular(false);
    renderizarApp("/admin/centro");
    await screen.findByRole("heading", { name: "Dejar de usar la app" });
    expect(screen.queryByRole("button", { name: "Eliminar barrio" })).not.toBeInTheDocument();
  });

  it("ve su pedido y puede retirarlo", async () => {
    const api = simular(false, barrio(PEDIDA));
    renderizarApp("/admin/centro");

    expect(await screen.findByText(/Se pidió eliminar este barrio el 5 de enero de 2099/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pedir eliminar el barrio" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retirar el pedido" }));

    await waitFor(() => expect(llamadas(api, "DELETE", `${RUTA}/solicitud-eliminacion`)).toHaveLength(1));
  });
});

describe("super admin", () => {
  const abrirDialogo = async () => {
    renderizarApp("/admin/centro");
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar barrio" }));
    return screen.findByRole("dialog");
  };

  it("muestra lo que se pierde y exige escribir el nombre exacto", async () => {
    const api = simular(true);
    const dialogo = await abrirDialogo();

    expect(await within(dialogo).findByText("5 inscripciones (2 de hoy en adelante)")).toBeInTheDocument();
    expect(within(dialogo).getByText(/pres@ejemplo\.cl/)).toBeInTheDocument();

    const confirmar = within(dialogo).getByRole("button", { name: "Eliminar para siempre" });
    const campo = within(dialogo).getByLabelText("Para confirmar, escribe Barrio Centro");
    await userEvent.type(campo, "barrio centro");
    expect(confirmar).toBeDisabled();

    await userEvent.clear(campo);
    await userEvent.type(campo, "Barrio Centro");
    await userEvent.click(confirmar);

    await waitFor(() => expect(llamadas(api, "DELETE", RUTA)).toEqual([{ confirmacion: "Barrio Centro" }]));
    // Sale del barrio borrado: /admin ya no lo tiene en la lista.
    expect(await screen.findByText(/todavía no administra ningún barrio/i)).toBeInTheDocument();
  });

  it("ve el motivo de un pedido", async () => {
    simular(true, barrio(PEDIDA));
    renderizarApp("/admin/centro");
    expect(await screen.findByText("Ya no la usamos")).toBeInTheDocument();
  });

  it("lista los pedidos en Solicitudes y los suma al contador", async () => {
    simularApi({
      "/api/admin/yo": { json: usuario(true) },
      "/api/admin/solicitudes": {
        json: {
          solicitudes: [],
          pendientes: 0,
          eliminaciones: [
            { slug: "centro", nombre: "Barrio Centro", motivo: "Ya no la usamos", solicitadaEn: "2099-01-05T15:00:00.000Z" },
          ],
        },
      },
    });
    renderizarApp("/admin/solicitudes");

    expect(await screen.findByRole("heading", { name: "Pedidos de eliminación" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Barrio Centro" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver el panel del barrio" })).toHaveAttribute("href", "/admin/centro");
    expect(await screen.findByLabelText("1 pendiente")).toBeInTheDocument();
  });
});
