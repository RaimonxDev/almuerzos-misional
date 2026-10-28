import { describe, expect, it } from "vitest";
import { grillaDelMes } from "@/app/calendario";

describe("grillaDelMes", () => {
  it("ubica el día 1 en su columna (semana desde el domingo)", () => {
    expect(grillaDelMes("2026-11").celdas.indexOf("2026-11-01") % 7).toBe(0); // domingo
    expect(grillaDelMes("2026-08").celdas.indexOf("2026-08-01") % 7).toBe(6); // sábado
    expect(grillaDelMes("2026-04").celdas.indexOf("2026-04-01") % 7).toBe(3); // miércoles
  });

  it("un mes de 31 días que parte en sábado necesita 6 filas", () => {
    const g = grillaDelMes("2026-08");
    expect(g.filas).toBe(6);
    expect(g.celdas).toHaveLength(42);
    expect(g.celdas.at(-1)).toBe(null);
    expect(g.celdas.filter(Boolean)).toHaveLength(31);
  });

  it("usa 5 filas como mínimo, aunque el mes quepa en 4 (febrero que parte en domingo)", () => {
    const g = grillaDelMes("2026-02");
    expect(g.filas).toBe(5);
    expect(g.celdas).toHaveLength(35);
    expect(g.celdas.filter(Boolean)).toHaveLength(28);
  });

  it("rellena con null antes y después", () => {
    const g = grillaDelMes("2026-04");
    expect(g.celdas.slice(0, 3)).toEqual([null, null, null]);
    expect(g.celdas[3]).toBe("2026-04-01");
  });
});
