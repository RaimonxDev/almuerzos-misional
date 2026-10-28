/**
 * Códigos de error que devuelve la API como `{ error: CodigoError }`.
 * La API nunca devuelve textos para el usuario: el frontend traduce cada código.
 */
export const CODIGOS_ERROR = [
  "TURNO_TOMADO", // 409: alguien se adelantó al anotarse
  "TURNO_BLOQUEADO",
  "MES_NO_ABIERTO",
  "NO_ENCONTRADO",
  "TOKEN_INVALIDO",
  "DATOS_INVALIDOS",
  "NO_AUTORIZADO",
  "ERROR_INTERNO",
] as const;

export type CodigoError = (typeof CODIGOS_ERROR)[number];

export type RespuestaError = { error: CodigoError };
