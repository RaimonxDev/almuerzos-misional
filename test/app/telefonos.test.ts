import { describe, expect, it } from "vitest";
import { enlaceWhatsApp, numeroWhatsApp } from "@/shared/telefonos";

describe("numeroWhatsApp", () => {
  it("deja solo los dígitos de un número internacional", () => {
    expect(numeroWhatsApp("+56 9 1234 5678")).toBe("56912345678");
    expect(numeroWhatsApp("+56 (9) 1234-5678")).toBe("56912345678");
    expect(numeroWhatsApp(" +55 11 91234-5678 ")).toBe("5511912345678");
    expect(numeroWhatsApp("0056 9 1234 5678")).toBe("56912345678");
  });

  it("agrega el código del país del barrio a un número local", () => {
    expect(numeroWhatsApp("9 1234 5678", "America/Santiago")).toBe("56912345678");
    expect(numeroWhatsApp("912345678", "America/Santiago")).toBe("56912345678");
    expect(numeroWhatsApp("(11) 91234-5678", "America/Sao_Paulo")).toBe("5511912345678");
    expect(numeroWhatsApp("011 91234-5678", "America/Sao_Paulo")).toBe("5511912345678");
    expect(numeroWhatsApp("(21) 3456-7890", "America/Sao_Paulo")).toBe("552134567890");
  });

  it("no repite el código si ya venía sin el signo +", () => {
    expect(numeroWhatsApp("56 9 1234 5678", "America/Santiago")).toBe("56912345678");
    expect(numeroWhatsApp("55 11 91234 5678", "America/Sao_Paulo")).toBe("5511912345678");
  });

  it("reconoce un número de otro país conocido aunque venga sin +", () => {
    expect(numeroWhatsApp("56912345678", "America/Sao_Paulo")).toBe("56912345678");
    expect(numeroWhatsApp("56 9 1234 5678", "America/Sao_Paulo")).toBe("56912345678");
  });

  it("en una zona desconocida deja los dígitos como vienen", () => {
    expect(numeroWhatsApp("612 345 678", "Europe/Madrid")).toBe("612345678");
    expect(numeroWhatsApp("612 345 678")).toBe("612345678");
  });

  it("descarta lo que no parece un teléfono", () => {
    expect(numeroWhatsApp("")).toBeNull();
    expect(numeroWhatsApp("123")).toBeNull();
    expect(numeroWhatsApp("sin número")).toBeNull();
  });
});

describe("enlaceWhatsApp", () => {
  it("arma el enlace a wa.me con el mensaje codificado", () => {
    expect(enlaceWhatsApp("+56 9 1234-5678", "America/Santiago", "¡Hola, Hna. Pérez!")).toBe(
      "https://wa.me/56912345678?text=%C2%A1Hola%2C%20Hna.%20P%C3%A9rez!",
    );
    expect(enlaceWhatsApp("+56 9 1234 5678", "America/Santiago")).toBe("https://wa.me/56912345678");
  });

  it("sin un número usable no hay enlace", () => {
    expect(enlaceWhatsApp("12", "America/Santiago", "Hola")).toBeNull();
  });
});
