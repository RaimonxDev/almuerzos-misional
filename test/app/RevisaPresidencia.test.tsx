import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderizarApp, simularApi } from "./utilidades";

const RUTA = "/api/admin/barrios/centro";
const COMPANERISMOS = [{ id: "c-e", tipo: "elderes", nombre: "Élderes", activo: true, orden: 0 }];
const BARRIO = {
  slug: "centro",
  nombre: "Barrio Centro",
  idioma: "es",
  zonaHoraria: "America/Santiago",
  codigoMisioneros: "K7PM2X",
  notaParaCocinar: null,
  contactoNombre: null,
  contactoTelefono: null,
};

/** La API simulada guarda el estado, como el Worker: marcarla la apaga y una recarga la sigue viendo apagada. */
function simular(inicial: { pendiente: boolean; rol?: "presidenta" | "equipo" }) {
  const estado = { pendiente: inicial.pendiente };
  const mock = simularApi({
    "/api/admin/yo": {
      json: {
        usuario: { id: "u-1", email: "p@ejemplo.cl", nombre: "Presidenta", superAdmin: false },
        barrios: [{ slug: "centro", nombre: "Barrio Centro", cargo: null, rol: inicial.rol ?? "presidenta" }],
      },
    },
    [`${RUTA}/admins`]: { json: { admins: [] } },
    [`${RUTA}/meses`]: { json: { meses: [] } },
    [`${RUTA}/presidencia/revisada`]: () => {
      estado.pendiente = false;
      return { json: { revisionPresidenciaPendiente: false } };
    },
    // Como el Worker: solo la presidenta recibe `true`.
    [RUTA]: () => ({
      json: { barrio: BARRIO, companerismos: COMPANERISMOS, revisionPresidenciaPendiente: estado.pendiente && inicial.rol !== "equipo" },
    }),
  });
  return mock;
}

const tarjeta = () => screen.queryByRole("region", { name: "Revisa tu presidencia" });

describe("Panel: revisa tu presidencia", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("aparece tras un traspaso, con sus tres pasos", async () => {
    simular({ pendiente: true });
    renderizarApp("/admin/centro");
    expect(await screen.findByRole("region", { name: "Revisa tu presidencia" })).toBeInTheDocument();
    for (const nombre of [/Revisar el equipo y quitar/, /Cambiar el código de los misioneros/, /Actualizar el contacto/]) {
      expect(screen.getByRole("button", { name: nombre })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Marcar como revisada" })).toBeInTheDocument();
  });

  it("no aparece en un barrio sin traspaso", async () => {
    simular({ pendiente: false });
    renderizarApp("/admin/centro");
    await screen.findByRole("heading", { name: "Administradores" });
    expect(tarjeta()).not.toBeInTheDocument();
  });

  it("no aparece para el equipo", async () => {
    simular({ pendiente: true, rol: "equipo" });
    renderizarApp("/admin/centro");
    await screen.findByRole("heading", { name: "Administradores" });
    expect(tarjeta()).not.toBeInTheDocument();
  });

  it("cada paso hace scroll a su sección", async () => {
    const user = userEvent.setup();
    simular({ pendiente: true });
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderizarApp("/admin/centro");
    await screen.findByRole("region", { name: "Revisa tu presidencia" });
    const destinos = [
      [/Revisar el equipo/, "administradores"],
      [/Cambiar el código/, "enlaces"],
      [/Actualizar el contacto/, "datos-barrio"],
    ] as const;
    for (const [nombre, id] of destinos) {
      scroll.mockClear();
      await user.click(screen.getByRole("button", { name: nombre }));
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll.mock.contexts[0]).toBe(document.getElementById(id));
    }
  });

  it("al marcarla desaparece y, como el estado vive en el Worker, sigue oculta al recargar", async () => {
    const user = userEvent.setup();
    const api = simular({ pendiente: true });
    const { unmount } = renderizarApp("/admin/centro");
    await user.click(await screen.findByRole("button", { name: "Marcar como revisada" }));
    await waitFor(() => expect(tarjeta()).not.toBeInTheDocument());
    expect(api.mock.calls.some(([u, i]) => String(u).endsWith("/presidencia/revisada") && i?.method === "POST")).toBe(true);
    expect(localStorage.length).toBe(0);

    unmount();
    renderizarApp("/admin/centro");
    await screen.findByRole("heading", { name: "Administradores" });
    expect(tarjeta()).not.toBeInTheDocument();
  });

  it("un traspaso nuevo la vuelve a mostrar", async () => {
    const user = userEvent.setup();
    simular({ pendiente: true });
    const { unmount } = renderizarApp("/admin/centro");
    await user.click(await screen.findByRole("button", { name: "Marcar como revisada" }));
    await waitFor(() => expect(tarjeta()).not.toBeInTheDocument());
    unmount();

    simular({ pendiente: true }); // otro traspaso: el Worker vuelve a mandar `true`
    renderizarApp("/admin/centro");
    expect(await screen.findByRole("region", { name: "Revisa tu presidencia" })).toBeInTheDocument();
  });
});
