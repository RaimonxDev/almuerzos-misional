import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderizarApp, simularApi } from "./utilidades";

const SUPER = {
  usuario: { id: "u-0", email: "super@ejemplo.cl", nombre: "Super", superAdmin: true },
  barrios: [{ slug: "centro", nombre: "Barrio Centro", cargo: null }],
};
const PRESIDENTA = { ...SUPER, usuario: { ...SUPER.usuario, superAdmin: false } };

const SOLICITUD = {
  id: "s-1",
  nombre: "Ana Rojas",
  email: "ana@ejemplo.cl",
  telefono: "9 1234 5678",
  barrio: "Barrio Ñuñoa Norte",
  estaca: "Estaca Santiago",
  ciudad: "Santiago",
  pais: "Chile",
  idioma: "pt",
  zonaHoraria: "America/Santiago",
  mensaje: "Somos un barrio nuevo",
  estado: "pendiente",
  motivoRechazo: null,
  resueltaEn: null,
  resueltaPorUserId: null,
  barrioId: null,
  creadoEn: "2099-01-05T10:00:00.000Z",
  companerismos: ["hermanas"],
  barrioSlug: null,
};

const lista = (solicitudes: unknown[], pendientes = solicitudes.length, eliminaciones: unknown[] = []) => ({
  json: { solicitudes, pendientes, eliminaciones },
});

const cuerpos = (api: ReturnType<typeof simularApi>, url: string) =>
  api.mock.calls.filter(([e, init]) => init?.method === "POST" && String(e).endsWith(url)).map(([, init]) => JSON.parse(String(init!.body)));

describe("Solicitudes", () => {
  it("el super admin ve la lista y la cantidad pendiente en el encabezado", async () => {
    simularApi({ "/api/admin/yo": { json: SUPER }, "/api/admin/solicitudes": lista([SOLICITUD]) });
    renderizarApp("/admin/solicitudes");

    expect(await screen.findByText("Barrio Ñuñoa Norte")).toBeInTheDocument();
    expect(screen.getByText("Somos un barrio nuevo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ana@ejemplo.cl" })).toHaveAttribute("href", "mailto:ana@ejemplo.cl");
    const wa = screen.getByRole("link", { name: /WhatsApp/ });
    expect(wa).toHaveAttribute("href", "https://wa.me/56912345678");
    expect(wa).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(within(screen.getByRole("link", { name: /Solicitudes/ })).getByText("1")).toBeInTheDocument();
  });

  it("una presidenta no ve el enlace y en la ruta ve 'sin permiso'", async () => {
    const api = simularApi({ "/api/admin/yo": { json: PRESIDENTA }, "/api/admin/solicitudes": lista([]) });
    renderizarApp("/admin/solicitudes");

    expect(await screen.findByText("No tienes permiso para hacer esto.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Solicitudes/ })).not.toBeInTheDocument();
    expect(api.mock.calls.some(([e]) => String(e).includes("/api/admin/solicitudes"))).toBe(false);
  });

  it("Aprobar llena el formulario con la solicitud y manda lo editado", async () => {
    const user = userEvent.setup();
    const api = simularApi({
      "/api/admin/yo": { json: SUPER },
      "/api/admin/solicitudes": lista([SOLICITUD]),
      "/api/admin/solicitudes/s-1/aprobar": {
        status: 201,
        json: {
          barrio: { slug: "barrio-nunoa-norte", nombre: "Barrio Ñuñoa Norte", idioma: "pt", zonaHoraria: "America/Santiago", codigoMisioneros: "K7PM2X" },
          companerismos: [],
          presidenta: { email: "ana@ejemplo.cl", nombre: "Ana Rojas", cargo: null, cuentaNueva: true, correoEnviado: true, passwordTemporal: null },
          solicitud: { id: "s-1", estado: "aprobada" },
        },
      },
      "/api/admin/barrios/barrio-nunoa-norte/meses": { json: { meses: [] } },
      "/api/admin/barrios/barrio-nunoa-norte/admins": { json: { admins: [] } },
      "/api/admin/barrios/barrio-nunoa-norte": {
        json: {
          barrio: { slug: "barrio-nunoa-norte", nombre: "Barrio Ñuñoa Norte", idioma: "pt", zonaHoraria: "America/Santiago", codigoMisioneros: "K7PM2X", notaParaCocinar: null, contactoNombre: null, contactoTelefono: null },
          companerismos: [],
        },
      },
    });
    renderizarApp("/admin/solicitudes");
    await user.click(await screen.findByRole("link", { name: "Aprobar" }));

    await screen.findByRole("heading", { level: 1, name: "Aprobar solicitud" });
    expect(screen.getByLabelText("Nombre del barrio")).toHaveValue("Barrio Ñuñoa Norte");
    expect(screen.getByLabelText("Enlace")).toHaveValue("barrio-nunoa-norte");
    expect(screen.getByLabelText("Zona horaria")).toHaveValue("America/Santiago");
    expect(screen.getByLabelText("Correo de la presidenta")).toHaveValue("ana@ejemplo.cl");
    expect(screen.getByLabelText("Nombre de la presidenta")).toHaveValue("Ana Rojas");
    expect(screen.getByRole("checkbox", { name: "Sísteres" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Élderes" })).not.toBeChecked();

    await user.clear(screen.getByLabelText("Enlace"));
    await user.type(screen.getByLabelText("Enlace"), "nunoa-norte");
    await user.click(screen.getByRole("button", { name: "Aprobar y crear barrio" }));

    await waitFor(() =>
      expect(cuerpos(api, "/api/admin/solicitudes/s-1/aprobar")).toEqual([
        {
          nombre: "Barrio Ñuñoa Norte",
          slug: "nunoa-norte",
          idioma: "pt",
          zonaHoraria: "America/Santiago",
          companerismos: [{ tipo: "hermanas", nombre: "Sísteres" }],
          presidenta: { email: "ana@ejemplo.cl", nombre: "Ana Rojas", cargo: null },
        },
      ]),
    );
    expect(await screen.findByText("Cuenta de la presidenta creada")).toBeInTheDocument();
  });

  it("Rechazar manda el motivo y la solicitud pasa a Rechazadas", async () => {
    const user = userEvent.setup();
    let rechazada = false;
    const api2 = simularApi({
      "/api/admin/yo": { json: SUPER },
      "/api/admin/solicitudes": () =>
        // Pendientes hasta que se rechaza; después la lista de pendientes queda vacía.
        ({ json: { solicitudes: rechazada ? [] : [SOLICITUD], pendientes: rechazada ? 0 : 1, eliminaciones: [] } }),
      "/api/admin/solicitudes/s-1/rechazar": () => {
        rechazada = true;
        return { json: { solicitud: { id: "s-1", estado: "rechazada", motivoRechazo: "Ya hay un barrio" } } };
      },
    });
    renderizarApp("/admin/solicitudes");
    await user.click(await screen.findByRole("button", { name: "Rechazar" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Motivo (opcional)"), "Ya hay un barrio");
    await user.click(within(dialogo).getByRole("button", { name: "Rechazar solicitud" }));

    await waitFor(() => expect(cuerpos(api2, "/api/admin/solicitudes/s-1/rechazar")).toEqual([{ motivo: "Ya hay un barrio" }]));
    await waitFor(() => expect(screen.queryByText("Barrio Ñuñoa Norte")).not.toBeInTheDocument());
    expect(screen.getByText("No hay solicitudes pendientes.")).toBeInTheDocument();
  });
});
