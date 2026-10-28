/** Secretos del Worker, que `wrangler types` no conoce sin `.dev.vars`. Mismo tipo `string` que generaría él. */
interface Env {
  /** Secreto de Better Auth: `.dev.vars` en local, `bunx wrangler secret put BETTER_AUTH_SECRET` en producción. */
  BETTER_AUTH_SECRET: string;
  /** URL pública del sitio (opcional: sin ella Better Auth la deduce de la request). */
  BETTER_AUTH_URL?: string;
}
