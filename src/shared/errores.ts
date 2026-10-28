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
  "NO_AUTORIZADO", // 401: sin sesión
  "SIN_PERMISO", // 403: con sesión pero sin acceso a ese barrio o acción
  "SLUG_EXISTENTE", // 409
  "MES_EXISTENTE", // 409
  "TRANSICION_INVALIDA", // 422: cambio de estado del mes no permitido
  "CREDENCIALES_INVALIDAS", // lo traduce el frontend desde el error de Better Auth
  "CUENTA_BLOQUEADA", // login de un usuario bloqueado con el plugin admin
  "DEMASIADOS_INTENTOS", // 429 del límite de intentos de Better Auth
  "IMAGEN_INVALIDA", // 400: tipo de imagen no permitido
  "IMAGEN_MUY_GRANDE", // 413
  "ERROR_INTERNO",
] as const;

export type CodigoError = (typeof CODIGOS_ERROR)[number];

/** `campos` solo viene con DATOS_INVALIDOS: los nombres de los campos que fallaron. */
export type RespuestaError = { error: CodigoError; campos?: string[] };
