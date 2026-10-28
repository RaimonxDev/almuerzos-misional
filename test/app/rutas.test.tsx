import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderizarApp, simularApi } from "./utilidades";

/** Módulos de admin que se cargaron: el mock anota el nombre cuando alguien los importa. */
const cargados = vi.hoisted(() => new Set<string>());

vi.mock("@/app/pantallas/Login", async (original) => {
  cargados.add("Login");
  return original();
});
vi.mock("@/app/pantallas/admin/Panel", async (original) => {
  cargados.add("Panel");
  return original();
});
vi.mock("@/app/pantallas/admin/Imprimir", async (original) => {
  cargados.add("Imprimir");
  return original();
});

describe("carga diferida de admin", () => {
  it("las rutas públicas renderizan sin cargar módulos de admin", async () => {
    simularApi({
      "/api/barrios/centro/meses": { json: { mes: { anio: 2099, mes: 4, estado: "abierto" }, companerismos: [], turnos: [], hoy: "2099-04-01" } },
      "/api/barrios/centro": {
        json: {
          barrio: { slug: "centro", nombre: "Barrio Centro", idioma: "es", zonaHoraria: "America/Santiago", notaParaCocinar: null },
          mesesAbiertos: [{ anio: 2099, mes: 4 }],
          hoy: "2099-04-01",
        },
      },
    });
    renderizarApp("/centro");
    expect(await screen.findByRole("heading", { name: "Barrio Centro" })).toBeInTheDocument();
    expect([...cargados]).toEqual([]);
  });

  it("el login se carga al entrar a su ruta", async () => {
    simularApi({ "/api/admin/yo": { status: 401, json: { error: "NO_AUTORIZADO" } } });
    renderizarApp("/admin/login");
    expect(await screen.findByLabelText("Contraseña")).toBeInTheDocument();
    expect(cargados.has("Login")).toBe(true);
    expect(cargados.has("Panel")).toBe(false);
  });
});
