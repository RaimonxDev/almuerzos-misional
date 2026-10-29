import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { renderizarApp, simularApi } from "./utilidades";

const SUPER = {
  usuario: { id: "u-0", email: "super@ejemplo.cl", nombre: "Super", superAdmin: true },
  barrios: [{ slug: "centro", nombre: "Barrio Centro", cargo: null }],
};
const PRESIDENTA = { ...SUPER, usuario: { ...SUPER.usuario, superAdmin: false } };

const CREADO = {
  barrio: { slug: "barrio-norte", nombre: "Barrio Norte", idioma: "es", zonaHoraria: "America/Santiago", tokenMisioneros: "t" },
  companerismos: [{ id: "c-1", tipo: "hermanas", nombre: "Hermanas", activo: true, orden: 0 }],
};

const llamadas = (api: ReturnType<typeof simularApi>, metodo: string, url: string) =>
  api.mock.calls
    .filter(([entrada, init]) => (init?.method ?? "GET") === metodo && String(entrada).endsWith(url))
    .map(([, init]) => JSON.parse(String(init!.body)));

const abrir = async () => {
  renderizarApp("/admin/nuevo-barrio");
  await screen.findByRole("heading", { level: 1, name: "Nuevo barrio" });
};

describe("Nuevo barrio", () => {
  it("crea el barrio con un solo compañerismo y lleva a su panel", async () => {
    const user = userEvent.setup();
    const api = simularApi({
      "/api/admin/yo": { json: SUPER },
      "/api/admin/barrios": { status: 201, json: CREADO },
      "/api/admin/barrios/barrio-norte/meses": { json: { meses: [] } },
      "/api/admin/barrios/barrio-norte/admins": { json: { admins: [] } },
      "/api/admin/barrios/barrio-norte": { json: { barrio: { ...CREADO.barrio, notaParaCocinar: null, contactoNombre: null, contactoTelefono: null }, companerismos: CREADO.companerismos } },
    });
    await abrir();

    await user.type(screen.getByLabelText("Nombre del barrio"), "Barrio Norte");
    // El enlace se sugiere desde el nombre.
    expect(screen.getByLabelText("Enlace")).toHaveValue("barrio-norte");
    await user.clear(screen.getByLabelText("Zona horaria"));
    await user.type(screen.getByLabelText("Zona horaria"), "America/Santiago");
    // Solo hermanas en este barrio.
    await user.click(screen.getByRole("checkbox", { name: "Élderes" }));
    await user.click(screen.getByRole("button", { name: "Crear barrio" }));

    await waitFor(() =>
      expect(llamadas(api, "POST", "/api/admin/barrios")).toEqual([
        {
          nombre: "Barrio Norte",
          slug: "barrio-norte",
          idioma: "es",
          zonaHoraria: "America/Santiago",
          companerismos: [{ tipo: "hermanas", nombre: "Hermanas" }],
        },
      ]),
    );
    expect(await screen.findByText("Todavía no hay meses. Crea el primero para empezar.")).toBeInTheDocument();
  });

  it("con presidenta nueva y el correo enviado, el diálogo lo dice y no muestra contraseña", async () => {
    const user = userEvent.setup();
    simularApi({
      "/api/admin/yo": { json: SUPER },
      "/api/admin/barrios": {
        status: 201,
        json: {
          ...CREADO,
          presidenta: { email: "rojas@ejemplo.cl", nombre: "Hna. Rojas", cargo: null, cuentaNueva: true, correoEnviado: true, passwordTemporal: null },
        },
      },
      "/api/admin/barrios/barrio-norte/meses": { json: { meses: [] } },
      "/api/admin/barrios/barrio-norte/admins": { json: { admins: [] } },
      "/api/admin/barrios/barrio-norte": { json: { barrio: { ...CREADO.barrio, notaParaCocinar: null, contactoNombre: null, contactoTelefono: null }, companerismos: CREADO.companerismos } },
    });
    await abrir();

    await user.type(screen.getByLabelText("Nombre del barrio"), "Barrio Norte");
    await user.type(screen.getByLabelText("Correo de la presidenta"), "rojas@ejemplo.cl");
    await user.type(screen.getByLabelText("Nombre de la presidenta"), "Hna. Rojas");
    await user.click(screen.getByRole("button", { name: "Crear barrio" }));

    const dialogo = await screen.findByRole("dialog", { name: "Cuenta de la presidenta creada" });
    expect(within(dialogo).getByText(/Le enviamos un correo a rojas@ejemplo\.cl/)).toBeInTheDocument();
    expect(within(dialogo).queryByText("Contraseña")).not.toBeInTheDocument();
    expect(within(dialogo).queryByRole("button", { name: "Copiar datos" })).not.toBeInTheDocument();

    await user.click(within(dialogo).getByRole("button", { name: "Ir al panel del barrio" }));
    expect(await screen.findByText("Todavía no hay meses. Crea el primero para empezar.")).toBeInTheDocument();
  });

  it("con presidenta nueva y el correo sin salir, muestra su contraseña temporal antes de ir al panel", async () => {
    const user = userEvent.setup();
    const api = simularApi({
      "/api/admin/yo": { json: SUPER },
      "/api/admin/barrios": {
        status: 201,
        json: {
          ...CREADO,
          presidenta: { email: "rojas@ejemplo.cl", nombre: "Hna. Rojas", cargo: null, cuentaNueva: true, correoEnviado: false, passwordTemporal: "temporal-abc-123" },
        },
      },
      "/api/admin/barrios/barrio-norte/meses": { json: { meses: [] } },
      "/api/admin/barrios/barrio-norte/admins": { json: { admins: [] } },
      "/api/admin/barrios/barrio-norte": { json: { barrio: { ...CREADO.barrio, notaParaCocinar: null, contactoNombre: null, contactoTelefono: null }, companerismos: CREADO.companerismos } },
    });
    await abrir();

    await user.type(screen.getByLabelText("Nombre del barrio"), "Barrio Norte");
    await user.type(screen.getByLabelText("Correo de la presidenta"), "rojas@ejemplo.cl");
    await user.type(screen.getByLabelText("Nombre de la presidenta"), "Hna. Rojas");
    await user.click(screen.getByRole("button", { name: "Crear barrio" }));

    await waitFor(() =>
      expect(llamadas(api, "POST", "/api/admin/barrios")[0].presidenta).toEqual({ email: "rojas@ejemplo.cl", nombre: "Hna. Rojas", cargo: null }),
    );
    const dialogo = await screen.findByRole("dialog", { name: "Cuenta de la presidenta creada" });
    expect(within(dialogo).getByText(/No pudimos enviarle el correo/)).toBeInTheDocument();
    expect(within(dialogo).getByText("temporal-abc-123")).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Copiar datos" })).toBeInTheDocument();
    expect(within(dialogo).getByText("rojas@ejemplo.cl")).toBeInTheDocument();

    await user.click(within(dialogo).getByRole("button", { name: "Ir al panel del barrio" }));
    expect(await screen.findByText("Todavía no hay meses. Crea el primero para empezar.")).toBeInTheDocument();
  });

  it("presidenta con cuenta y el aviso sin salir: lo advierte para que le avise a mano", async () => {
    const user = userEvent.setup();
    const advertencia = vi.spyOn(toast, "warning");
    simularApi({
      "/api/admin/yo": { json: SUPER },
      "/api/admin/barrios": {
        status: 201,
        json: {
          ...CREADO,
          presidenta: { email: "rojas@ejemplo.cl", nombre: "Hna. Rojas", cargo: null, cuentaNueva: false, correoEnviado: false, passwordTemporal: null },
        },
      },
      "/api/admin/barrios/barrio-norte/meses": { json: { meses: [] } },
      "/api/admin/barrios/barrio-norte/admins": { json: { admins: [] } },
      "/api/admin/barrios/barrio-norte": { json: { barrio: { ...CREADO.barrio, notaParaCocinar: null, contactoNombre: null, contactoTelefono: null }, companerismos: CREADO.companerismos } },
    });
    await abrir();

    await user.type(screen.getByLabelText("Nombre del barrio"), "Barrio Norte");
    await user.type(screen.getByLabelText("Correo de la presidenta"), "rojas@ejemplo.cl");
    await user.type(screen.getByLabelText("Nombre de la presidenta"), "Hna. Rojas");
    await user.click(screen.getByRole("button", { name: "Crear barrio" }));

    await waitFor(() => expect(advertencia).toHaveBeenCalledWith(expect.stringContaining("No pudimos avisarle por correo a rojas@ejemplo.cl")));
  });

  it("presidenta a medias (correo sin nombre) → pide el nombre", async () => {
    const user = userEvent.setup();
    const api = simularApi({ "/api/admin/yo": { json: SUPER } });
    await abrir();

    await user.type(screen.getByLabelText("Nombre del barrio"), "Barrio Norte");
    await user.type(screen.getByLabelText("Correo de la presidenta"), "rojas@ejemplo.cl");
    await user.click(screen.getByRole("button", { name: "Crear barrio" }));

    expect(await screen.findByText("Escribe el correo y el nombre de la presidenta, o deja ambos vacíos.")).toBeInTheDocument();
    expect(llamadas(api, "POST", "/api/admin/barrios")).toEqual([]);
  });

  it("pide al menos un compañerismo", async () => {
    const user = userEvent.setup();
    const api = simularApi({ "/api/admin/yo": { json: SUPER } });
    await abrir();

    await user.type(screen.getByLabelText("Nombre del barrio"), "Barrio Norte");
    await user.click(screen.getByRole("checkbox", { name: "Élderes" }));
    await user.click(screen.getByRole("checkbox", { name: "Hermanas" }));
    await user.click(screen.getByRole("button", { name: "Crear barrio" }));

    expect(await screen.findByText("Elige al menos un compañerismo.")).toBeInTheDocument();
    expect(llamadas(api, "POST", "/api/admin/barrios")).toEqual([]);
  });

  it("enlace repetido → mensaje del 409", async () => {
    const user = userEvent.setup();
    simularApi({
      "/api/admin/yo": { json: SUPER },
      "/api/admin/barrios": { status: 409, json: { error: "SLUG_EXISTENTE" } },
    });
    await abrir();

    await user.type(screen.getByLabelText("Nombre del barrio"), "Centro");
    await user.click(screen.getByRole("button", { name: "Crear barrio" }));
    expect(await screen.findByText("Ya existe un barrio con ese enlace.")).toBeInTheDocument();
  });

  it("solo el super admin: una presidenta ve que no tiene permiso", async () => {
    simularApi({ "/api/admin/yo": { json: PRESIDENTA } });
    renderizarApp("/admin/nuevo-barrio");
    expect(await screen.findByText("No tienes permiso para hacer esto.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear barrio" })).not.toBeInTheDocument();
  });

  it("el panel enlaza a la pantalla solo para el super admin", async () => {
    const meses = { json: { meses: [] } };
    const barrio = {
      json: {
        barrio: { slug: "centro", nombre: "Barrio Centro", idioma: "es", zonaHoraria: "America/Santiago", tokenMisioneros: "t", notaParaCocinar: null, contactoNombre: null, contactoTelefono: null },
        companerismos: [],
      },
    };
    simularApi({
      "/api/admin/yo": { json: SUPER },
      "/api/admin/barrios/centro/meses": meses,
      "/api/admin/barrios/centro/admins": { json: { admins: [] } },
      "/api/admin/barrios/centro": barrio,
    });
    const { unmount } = renderizarApp("/admin/centro");
    expect(await screen.findByRole("link", { name: "Nuevo barrio" })).toHaveAttribute("href", "/admin/nuevo-barrio");
    unmount();

    simularApi({ "/api/admin/yo": { json: PRESIDENTA }, "/api/admin/barrios/centro/meses": meses, "/api/admin/barrios/centro": barrio });
    renderizarApp("/admin/centro");
    await screen.findByText("Todavía no hay meses. Crea el primero para empezar.");
    expect(screen.queryByRole("link", { name: "Nuevo barrio" })).not.toBeInTheDocument();
  });
});
