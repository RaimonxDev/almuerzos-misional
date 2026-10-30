import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calcularPasos } from "@/app/primeros-pasos";
import { renderizarApp, simularApi } from "./utilidades";

const YO = {
  usuario: { id: "u-1", email: "presidenta@ejemplo.cl", nombre: "Presidenta", superAdmin: false },
  barrios: [{ slug: "centro", nombre: "Barrio Centro", cargo: null }],
};
const RUTA = "/api/admin/barrios/centro";
const COMPANERISMOS = [{ id: "c-e", tipo: "elderes", nombre: "Élderes", activo: true, orden: 0 }];

const barrio = (notaParaCocinar: string | null) => ({
  barrio: {
    slug: "centro",
    nombre: "Barrio Centro",
    idioma: "es",
    zonaHoraria: "America/Santiago",
    codigoMisioneros: "K7PM2X",
    notaParaCocinar,
    contactoNombre: null,
    contactoTelefono: null,
  },
  companerismos: COMPANERISMOS,
});

const resumen = (periodo: string, estado: string, tomados = 0) => ({
  periodo,
  anio: 2099,
  mes: Number(periodo.slice(5)),
  estado,
  turnos: 2,
  tomados,
  bloqueados: 0,
});
const mes = (periodo: string, estado: string) => ({
  mes: { ...resumen(periodo, estado), imagenKey: null, escritura: null, escrituraRef: null, mensaje: null, plantilla: "azul" },
  companerismos: COMPANERISMOS,
  turnos: [],
});

function simular(meses: ReturnType<typeof resumen>[], nota: string | null = null) {
  const rutas: Parameters<typeof simularApi>[0] = {
    "/api/admin/yo": { json: YO },
    [`${RUTA}/meses`]: { json: { meses } },
    [RUTA]: { json: barrio(nota) },
  };
  for (const m of meses) rutas[`${RUTA}/meses/${m.periodo}`] = { json: mes(m.periodo, m.estado) };
  return simularApi(rutas);
}

const tarjeta = () => screen.queryByRole("region", { name: "Primeros pasos" });
const paso = (nombre: RegExp) => screen.getByRole("button", { name: nombre });

describe("calcularPasos", () => {
  it("deduce nota, crear y abrir desde los datos", () => {
    const g = { misioneros: false, compartido: false };
    expect(calcularPasos({ notaParaCocinar: "  ", meses: [] }, g).map((p) => p.hecho)).toEqual([false, false, false, false, false]);
    expect(
      calcularPasos({ notaParaCocinar: "Sin maní", meses: [{ estado: "borrador" }] }, g).map((p) => p.hecho),
    ).toEqual([false, true, true, false, false]);
    expect(calcularPasos({ notaParaCocinar: null, meses: [{ estado: "cerrado" }] }, { misioneros: true, compartido: true }).map((p) => p.hecho)).toEqual([
      true,
      false,
      true,
      true,
      true,
    ]);
  });
});

describe("Panel: primeros pasos", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("sin meses, 'Crear el primer mes' está pendiente", async () => {
    simular([]);
    renderizarApp("/admin/centro");
    await screen.findByText("0 de 5");
    expect(paso(/Crear el primer mes.*pendiente/)).toBeInTheDocument();
    expect(paso(/Abrir el mes.*pendiente/)).toBeInTheDocument();
  });

  it("con un mes abierto, crear y abrir aparecen hechos", async () => {
    simular([resumen("2099-04", "abierto")], "Sin maní");
    renderizarApp("/admin/centro?mes=2099-04");
    await screen.findByText("3 de 5");
    expect(paso(/Crear el primer mes.*hecho/)).toBeInTheDocument();
    expect(paso(/Abrir el mes.*hecho/)).toBeInTheDocument();
    expect(paso(/alergias.*hecho/)).toBeInTheDocument();
    expect(paso(/Compartir el enlace.*pendiente/)).toBeInTheDocument();
  });

  it("copiar el enlace de las hermanas marca ese paso", async () => {
    const user = userEvent.setup();
    simular([resumen("2099-04", "abierto")]);
    renderizarApp("/admin/centro?mes=2099-04");
    await screen.findByText("2 de 5");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    await user.click(screen.getByRole("button", { name: "Copiar el enlace para las hermanas" }));

    await waitFor(() => expect(paso(/Compartir el enlace.*hecho/)).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/centro$/));
    expect(await screen.findByText("3 de 5")).toBeInTheDocument();
  });

  it("revisar misioneros se marca al ir a esa sección", async () => {
    const user = userEvent.setup();
    simular([]);
    renderizarApp("/admin/centro");
    await screen.findByText("0 de 5");
    await user.click(paso(/Revisar los misioneros/));
    expect(await screen.findByText("1 de 5")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("almuerzo-misional:primeros-pasos:centro")!)).toMatchObject({ misioneros: true });
  });

  it("se puede ocultar y no vuelve a aparecer", async () => {
    const user = userEvent.setup();
    simular([]);
    const { unmount } = renderizarApp("/admin/centro");
    await screen.findByText("0 de 5");
    await user.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(tarjeta()).not.toBeInTheDocument();
    unmount();

    renderizarApp("/admin/centro");
    await screen.findByText("Todavía no hay meses. Crea el primero para empezar.");
    expect(tarjeta()).not.toBeInTheDocument();
  });

  it("con todo hecho la tarjeta no aparece", async () => {
    localStorage.setItem("almuerzo-misional:primeros-pasos:centro", JSON.stringify({ misioneros: true, compartido: true }));
    simular([resumen("2099-04", "abierto")], "Sin maní");
    renderizarApp("/admin/centro?mes=2099-04");
    await screen.findByRole("heading", { level: 1, name: "Abril 2099" });
    expect(tarjeta()).not.toBeInTheDocument();
  });

  it("un barrio que ya funciona (con inscripciones o un mes cerrado) no la ve", async () => {
    simular([resumen("2099-04", "abierto", 1)]);
    renderizarApp("/admin/centro?mes=2099-04");
    await screen.findByRole("heading", { level: 1, name: "Abril 2099" });
    expect(tarjeta()).not.toBeInTheDocument();
  });
});
