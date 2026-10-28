/**
 * Códigos de error que devuelve la API como `{ error: CodigoError }`.
 * La API nunca devuelve textos para el usuario: el frontend traduce cada código.
 */
export const CODIGOS_ERROR = [
  "TURNO_TOMADO", // 409: alguien se adelantó al anotarse
  "TURNO_BLOQUEADO",
  "TURNO_PASADO",
  "MES_NO_ABIERTO",
  "NO_ENCONTRADO",
  "TOKEN_INVALIDO",
  "DATOS_INVALIDOS",
  "NO_AUTORIZADO",
  "ERROR_INTERNO",
] as const;

export type CodigoError = (typeof CODIGOS_ERROR)[number];

/** `campos` solo viene con DATOS_INVALIDOS: los nombres de los campos que fallaron. */
export type RespuestaError = { error: CodigoError; campos?: string[] };
