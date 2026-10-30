interface ImportMetaEnv {
  /** Clave pública de Cloudflare Turnstile. Obligatoria en `vite build`; en desarrollo, sin ella, la de prueba. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}
