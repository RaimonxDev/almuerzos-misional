import { describe, expect, it } from "vitest";
import { esOjo, matrizQr, nombreArchivoQr } from "@/app/qr";

const URL_BARRIO = "https://almuerzo.ramonmartinez.dev/centro-k7m2x";

describe("matrizQr", () => {
  it("devuelve una matriz cuadrada sin borde, con los tres ojos en sus esquinas", () => {
    const { tamano, oscuro } = matrizQr(URL_BARRIO);
    expect((tamano - 21) % 4).toBe(0);
    expect(oscuro).toHaveLength(tamano);
    expect(oscuro.every((fila) => fila.length === tamano)).toBe(true);
    // Borde exterior y centro de cada ojo, oscuros; el anillo blanco entre ellos, claro.
    for (const [f, c] of [[0, 0], [0, tamano - 7], [tamano - 7, 0]]) {
      expect(oscuro[f][c]).toBe(true);
      expect(oscuro[f + 3][c + 3]).toBe(true);
      expect(oscuro[f + 1][c + 1]).toBe(false);
    }
  });

  it("es la misma para el mismo enlace y cambia con otro enlace", () => {
    expect(matrizQr(URL_BARRIO)).toEqual(matrizQr(URL_BARRIO));
    expect(matrizQr(URL_BARRIO).oscuro).not.toEqual(matrizQr(`${URL_BARRIO}/m`).oscuro);
  });
});

describe("matrizQr: alineación al centro", () => {
  it("la marca en enlaces largos (versión 7+), donde el sello taparía el patrón del medio", () => {
    expect(matrizQr(URL_BARRIO).alineacionAlCentro).toBe(false);
    expect(matrizQr(`https://almuerzo.ramonmartinez.dev/${"a".repeat(30)}-k7m2x/m`).alineacionAlCentro).toBe(true);
  });
});

describe("esOjo", () => {
  it("marca solo los tres cuadros de 7×7 de las esquinas (no el de abajo a la derecha)", () => {
    expect(esOjo(0, 0, 33)).toBe(true);
    expect(esOjo(6, 32, 33)).toBe(true);
    expect(esOjo(32, 6, 33)).toBe(true);
    expect(esOjo(7, 7, 33)).toBe(false);
    expect(esOjo(32, 32, 33)).toBe(false);
  });
});

describe("nombreArchivoQr", () => {
  it("distingue el de las hermanas y el de los misioneros", () => {
    expect(nombreArchivoQr("centro", "hermanas")).toBe("qr-centro.png");
    expect(nombreArchivoQr("centro", "misioneros")).toBe("qr-centro-misioneros.png");
  });
});
