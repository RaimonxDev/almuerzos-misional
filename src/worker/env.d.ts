/** Secretos del Worker, que `wrangler types` no conoce sin `.dev.vars`. Mismo tipo `string` que generaría él. */
interface Env {
  /** Secreto de Better Auth: `.dev.vars` en local, `bunx wrangler secret put BETTER_AUTH_SECRET` en producción. */
  BETTER_AUTH_SECRET: string;
  /**
   * Firma los tokens de los misioneros (HMAC del barrio y su código). Aparte de Better Auth: rotarlo
   * saca a todos los misioneros sin tocar las sesiones de los admins. `bunx wrangler secret put SECRETO_MISIONEROS`.
   */
  SECRETO_MISIONEROS: string;
  /** URL pública del sitio (opcional: sin ella Better Auth la deduce de la request). */
  BETTER_AUTH_URL?: string;
  /** API key de Resend (opcional: sin ella `enviarCorreo` escribe el correo en la consola). */
  RESEND_API_KEY?: string;
  /** Remitente, ej. `Almuerzo Misional <hola@dominio>` (opcional: por defecto `onboarding@resend.dev`). */
  CORREO_REMITENTE?: string;
  /**
   * Secreto de Turnstile para `/api/solicitudes`. En desarrollo, la clave de prueba de Cloudflare
   * que siempre valida: `1x0000000000000000000000000000000AA`.
   */
  TURNSTILE_SECRET_KEY: string;
  /** Correo(s) del super admin para avisar solicitudes nuevas, separados por coma (opcional: si falta, a los usuarios con rol `admin`). */
  CORREO_SUPER_ADMIN?: string;
}
