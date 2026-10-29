import type { Idioma } from "@/shared/idiomas";
import { enlaceRestablecer, obtenerAuth } from "./auth";
import { enviarCorreo } from "./correo";
import { armarCorreo } from "./correos";

/** Vencimiento del enlace de la bienvenida (el de "¿Olvidaste tu contraseña?" es de 1 hora). */
export const DIAS_INVITACION = 7;

const ALFANUMERICO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Como `generateId(24)` de Better Auth: 24 letras y números al azar (sin sesgo de módulo). */
function tokenAleatorio(largo = 24) {
  let token = "";
  while (token.length < largo) {
    for (const b of crypto.getRandomValues(new Uint8Array(largo * 2))) {
      // 248 = 62 × 4: lo que queda por encima sesgaría las primeras letras.
      if (b < 248 && token.length < largo) token += ALFANUMERICO[b % 62];
    }
  }
  return token;
}

/**
 * Token de restablecer contraseña con vencimiento propio. Better Auth tiene uno solo global
 * (`resetPasswordTokenExpiresIn`, 1 hora): este se guarda igual que el suyo
 * (`reset-password:<token>` → id del usuario), así sirve con `POST /api/auth/reset-password` y la
 * pantalla `/admin/restablecer`, y `onPasswordReset` apaga `debeCambiarPassword`.
 */
export async function tokenDeInvitacion(env: Env, userId: string) {
  const ctx = await obtenerAuth(env).$context;
  const token = tokenAleatorio();
  await ctx.internalAdapter.createVerificationValue({
    value: userId,
    identifier: `reset-password:${token}`,
    expiresAt: new Date(Date.now() + DIAS_INVITACION * 86_400_000),
  });
  return token;
}

export interface Invitado {
  id: string;
  email: string;
  name: string;
  /** Todavía no elige su contraseña: recibe la bienvenida con el enlace para crearla. */
  debeCambiarPassword: boolean | null;
}

/**
 * Avisa a un admin que tiene un barrio: la bienvenida con enlace para crear la contraseña (7 días)
 * si aún no la eligió, o el aviso de asignación si ya entra con la suya. En el idioma del barrio.
 *
 * Devuelve si el correo **salió de verdad**: sin `RESEND_API_KEY` (desarrollo) `enviarCorreo` solo
 * lo escribe en la consola y aquí cuenta como no enviado, así el panel muestra la contraseña
 * temporal y se puede entrar igual.
 */
export async function avisarAdmin(
  env: Env,
  origen: string,
  persona: Invitado,
  barrio: { slug: string; nombre: string; idioma: Idioma },
): Promise<boolean> {
  const panel = `${origen}/admin/${barrio.slug}`;
  const correo = persona.debeCambiarPassword
    ? armarCorreo(barrio.idioma, "bienvenidaPresidenta", {
        nombre: persona.name,
        barrio: barrio.nombre,
        enlace: enlaceRestablecer(origen, await tokenDeInvitacion(env, persona.id)),
        panel,
        dias: DIAS_INVITACION,
      })
    : armarCorreo(barrio.idioma, "barrioAsignado", { nombre: persona.name, barrio: barrio.nombre, enlace: panel });
  const resultado = await enviarCorreo(env, { para: persona.email, ...correo });
  return resultado.ok && Boolean(env.RESEND_API_KEY);
}
