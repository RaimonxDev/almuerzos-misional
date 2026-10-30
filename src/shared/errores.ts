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
  "CODIGO_INVALIDO", // 404: código de misioneros incorrecto (o barrio inexistente: la misma respuesta)
  "DATOS_INVALIDOS",
  "NO_AUTORIZADO", // 401: sin sesión
  "SIN_PERMISO", // 403: con sesión pero sin acceso a ese barrio o acción
  "SLUG_EXISTENTE", // 409
  "CORREO_EXISTENTE", // 409: corregir el correo de un admin con uno que ya tiene otra cuenta
  "CUENTA_EN_USO", // 422: el admin ya eligió su contraseña; su correo y contraseña son suyos
  "MES_EXISTENTE", // 409
  "TRANSICION_INVALIDA", // 422: cambio de estado del mes no permitido
  "CREDENCIALES_INVALIDAS", // lo traduce el frontend desde el error de Better Auth
  "CUENTA_BLOQUEADA", // login de un usuario bloqueado con el plugin admin
  "CONTRASENA_INCORRECTA", // cambiar la contraseña: la actual no es (Better Auth: INVALID_PASSWORD)
  "CONTRASENA_CORTA", // menos de PASSWORD_MIN (Better Auth: PASSWORD_TOO_SHORT); también lo valida el cliente
  "CONTRASENAS_DISTINTAS", // solo en el cliente: la nueva y la repetida no coinciden
  "DEMASIADOS_INTENTOS", // 429: límite de intentos del login (Better Auth), de inscripciones o del código de misioneros por IP
  "IMAGEN_INVALIDA", // 400: tipo de imagen no permitido
  "IMAGEN_MUY_GRANDE", // 413
  "SOLICITUD_PENDIENTE", // 409: ese correo ya tiene una solicitud de acceso sin resolver
  "SOLICITUD_RESUELTA", // 409: aprobar o rechazar una solicitud que ya estaba aprobada o rechazada
  "VERIFICACION_FALLIDA", // 400: Turnstile no validó (o falta su token)
  "CONFIRMACION_INCORRECTA", // 422: borrar un barrio sin escribir su nombre tal cual
  "PEDIDO_CAMBIO", // 409: el pedido de eliminación cambió desde que se abrió el panel
  "ERROR_INTERNO",
] as const;

export type CodigoError = (typeof CODIGOS_ERROR)[number];

/** `campos` solo viene con DATOS_INVALIDOS: los nombres de los campos que fallaron. */
export type RespuestaError = { error: CodigoError; campos?: string[] };
