/**
 * Código de acceso de los misioneros: 6 caracteres por barrio que la presidenta les dicta o manda,
 * y que puede rotar cuando cambian los misioneros. Compartido por el Worker y la app.
 */

/** Sin caracteres que se confunden al dictarlo (0/O, 1/I/L). 31^6 ≈ 887 millones de códigos. */
export const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LARGO_CODIGO = 6;

export function nuevoCodigo(): string {
  let codigo = "";
  while (codigo.length < LARGO_CODIGO) {
    for (const b of crypto.getRandomValues(new Uint8Array(LARGO_CODIGO))) {
      // 248 = el mayor múltiplo de 31 bajo 256: descartar el resto evita que unas letras salgan más.
      if (b < 248 && codigo.length < LARGO_CODIGO) codigo += ALFABETO_CODIGO[b % ALFABETO_CODIGO.length];
    }
  }
  return codigo;
}

/** Lo que escribió la persona, sin espacios ni guiones y en mayúsculas: "k7p m2x" → "K7PM2X". */
export const normalizarCodigo = (texto: string) => texto.toUpperCase().replace(/[\s-]/g, "");

/** Para mostrarlo y dictarlo: "K7PM2X" → "K7P-M2X". */
export const formatearCodigo = (codigo: string) => `${codigo.slice(0, 3)}-${codigo.slice(3)}`;
