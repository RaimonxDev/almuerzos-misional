const URL_VERIFICACION = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * ¿Validó Turnstile? Pregunta a Cloudflare con el secreto y el token que mandó el formulario.
 * Cualquier fallo (red, respuesta rara) cuenta como no validado: el formulario es público y mejor
 * pedir que lo reintenten que dejar pasar un bot.
 */
export async function verificarTurnstile(env: Pick<Env, "TURNSTILE_SECRET_KEY">, token: string, ip?: string) {
  try {
    const cuerpo = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    if (ip) cuerpo.set("remoteip", ip);
    const respuesta = await fetch(URL_VERIFICACION, { method: "POST", body: cuerpo });
    if (!respuesta.ok) return false;
    return ((await respuesta.json()) as { success?: boolean }).success === true;
  } catch (e) {
    console.error("[turnstile]", e);
    return false;
  }
}
