import { describe, expect, it } from "vitest";
import { crearIcs } from "@/shared/ics";

describe("crearIcs", () => {
  it("crea un evento de día completo con el día siguiente como fin", () => {
    const ics = crearIcs({ fecha: "2026-12-31", titulo: "Almuerzo; élderes, centro" });
    const lineas = ics.split("\r\n");
    expect(lineas).toContain("DTSTART;VALUE=DATE:20261231");
    expect(lineas).toContain("DTEND;VALUE=DATE:20270101");
    expect(lineas).toContain("SUMMARY:Almuerzo\\; élderes\\, centro");
    expect(lineas[0]).toBe("BEGIN:VCALENDAR");
    expect(lineas.find((l) => l.startsWith("DTSTAMP:"))).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
  });
});
