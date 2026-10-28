import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderizarApp, simularApi } from "./utilidades";

const COMPANERISMOS = [
  { id: "c-e", tipo: "elderes", nombre: "Élderes", activo: true, orden: 0 },
  { id: "c-h", tipo: "hermanas", nombre: "Hermanas", activo: true, orden: 1 },
];
const turno = (id: string, fecha: string, companerismoId: string, extra: object = {}) => ({
  id, fecha, companerismoId, bloqueado: false, motivoBloqueo: null, inscripcion: null, ...extra,
});

function simular() {
  return simularApi({
    "/api/admin/yo": {
      json: { usuario: { id: "u", email: "p@e.cl", nombre: "P", superAdmin: false }, barrios: [{ slug: "centro", nombre: "Barrio Centro", cargo: null }] },
    },
    "/api/admin/barrios/centro/meses/2099-04": {
      json: {
        mes: {
          periodo: "2099-04", anio: 2099, mes: 4, estado: "abierto", imagenKey: null,
          escritura: "En cuanto lo hicisteis a uno de estos", escrituraRef: "Mateo 25:40", mensaje: "Gracias por todo", plantilla: "dorado",
        },
        companerismos: COMPANERISMOS,
        turnos: [
          turno("1e", "2099-04-01", "c-e", { inscripcion: { id: "i", nombre: "Hna. Pérez" } }),
          turno("1h", "2099-04-01", "c-h"),
          turno("2e", "2099-04-02", "c-e", { bloqueado: true, motivoBloqueo: "Conferencia de estaca" }),
          turno("2h", "2099-04-02", "c-h", { bloqueado: true, motivoBloqueo: "Conferencia de estaca" }),
        ],
      },
    },
    "/api/admin/barrios/centro": {
      json: {
        barrio: { slug: "centro", nombre: "Barrio Centro", idioma: "es", zonaHoraria: "America/Santiago", tokenMisioneros: "t", notaParaCocinar: null, contactoNombre: "Presidenta Ana", contactoTelefono: "+56 9 1111 2222" },
        companerismos: COMPANERISMOS,
      },
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("Imprimir", () => {
  it("muestra nombres, motivo de bloqueo, escritura y contacto", async () => {
    simular();
    renderizarApp("/admin/centro/2099-04/imprimir");
    expect(await screen.findByText("Hna. Pérez")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Calendario de almuerzos" })).toBeInTheDocument();
    expect(screen.getByText("Conferencia de estaca")).toBeInTheDocument();
    expect(screen.getByText(/En cuanto lo hicisteis/)).toBeInTheDocument();
    expect(screen.getByText("Mateo 25:40")).toBeInTheDocument();
    expect(screen.getByText("Coordina: Presidenta Ana · +56 9 1111 2222")).toBeInTheDocument();
    expect(screen.getByText("Abril 2099")).toBeInTheDocument();
  });

  it("Imprimir / PDF llama a window.print y volver lleva al panel del mes", async () => {
    simular();
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => {});
    renderizarApp("/admin/centro/2099-04/imprimir");
    await screen.findByText("Hna. Pérez");
    await userEvent.click(screen.getByRole("button", { name: "Imprimir / PDF" }));
    expect(imprimir).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Volver al panel" })).toHaveAttribute("href", "/admin/centro?mes=2099-04");
  });
});
