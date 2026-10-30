import { encode, QrCodeDataType } from "uqr";

export type MatrizQr = { tamano: number; oscuro: boolean[][]; alineacionAlCentro: boolean };

/**
 * Módulos del QR, sin borde (el margen lo pone quien lo dibuja). Corrección `H` (30 %): aguanta el
 * sello del centro y que los puntos sean redondos. `alineacionAlCentro` (versión 7 en adelante, enlaces
 * largos): hay un patrón de alineación justo al medio y el sello no puede taparlo.
 */
export function matrizQr(texto: string): MatrizQr {
  const { size, data, types } = encode(texto, { ecc: "H", border: 0 });
  const medio = Math.floor(size / 2);
  return { tamano: size, oscuro: data, alineacionAlCentro: types[medio][medio] === QrCodeDataType.Alignment };
}

/** Si el módulo es parte de uno de los tres ojos (7×7) de las esquinas, que se dibujan aparte. */
export const esOjo = (fila: number, col: number, tamano: number) =>
  (fila < 7 && col < 7) || (fila < 7 && col >= tamano - 7) || (fila >= tamano - 7 && col < 7);

export const nombreArchivoQr = (slug: string, para: "hermanas" | "misioneros") =>
  para === "hermanas" ? `qr-${slug}.png` : `qr-${slug}-misioneros.png`;
