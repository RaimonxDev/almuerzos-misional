import { describe, expect, it } from "vitest";
import { leerPeriodo, mesInicial, textoPeriodo } from "@/app/periodos";
import { rutaAnotarse, rutaCalendario, rutaMiTurno } from "@/app/rutas";

const oct = { anio: 2026, mes: 10 };
const nov = { anio: 2026, mes: 11 };
const dic = { anio: 2026, mes: 12 };

describe("periodos", () => {
  it("formatea y lee YYYY-MM", () => {
    expect(textoPeriodo({ anio: 2026, mes: 3 })).toBe("2026-03");
    expect(leerPeriodo("2026-11")).toEqual(nov);
    for (const malo of [null, "", "2026-13", "2026-00", "2026-1", "nov"]) expect(leerPeriodo(malo)).toBeNull();
  });

  it("mesInicial elige el abierto de hoy, si no el próximo, si no el último", () => {
    expect(mesInicial([oct, nov], "2026-10-28")).toEqual(oct);
    expect(mesInicial([nov, dic], "2026-10-28")).toEqual(nov);
    expect(mesInicial([oct], "2026-12-02")).toEqual(oct);
    expect(mesInicial([], "2026-10-28")).toBeNull();
  });
});

describe("rutas", () => {
  it("arma las URLs del frontend", () => {
    expect(rutaCalendario("centro")).toBe("/centro");
    expect(rutaCalendario("centro", "2026-11-09")).toBe("/centro?mes=2026-11");
    expect(rutaAnotarse("centro", "t1")).toBe("/centro/anotarse/t1");
    expect(rutaMiTurno("centro", "i1")).toBe("/centro/mi-turno/i1");
  });
});
