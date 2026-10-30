import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { user } from "@/db/auth-schema";
import type { Solicitud } from "@/db/schema";
import { enviarCorreo } from "./correo";
import { armarCorreo } from "./correos";

/**
 * A quién avisar de una solicitud nueva: `CORREO_SUPER_ADMIN` (separados por coma) si está
 * puesto; si no, los usuarios con rol `admin`. Ningún correo está escrito en el código.
 */
async function correosDelSuperAdmin(db: Db, env: Env): Promise<string[]> {
  const configurados = (env.CORREO_SUPER_ADMIN ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (configurados.length > 0) return configurados;
  const admins = await db.select({ email: user.email }).from(user).where(eq(user.role, "admin"));
  return admins.map((a) => a.email);
}

/**
 * Los dos correos de una solicitud recién guardada: aviso al super admin (en español, que es el
 * idioma de quien la revisa) y acuse a quien pidió, en su idioma. Nunca lanza: la solicitud ya
 * está guardada y el correo es solo un aviso.
 */
export async function avisarSolicitudNueva(db: Db, env: Env, origen: string, s: Solicitud) {
  try {
    const aviso = armarCorreo("es", "solicitudNueva", {
      nombre: s.nombre,
      email: s.email,
      barrio: s.barrio,
      ciudad: s.ciudad,
      pais: s.pais,
      mensaje: s.mensaje,
      enlace: `${origen}/admin/solicitudes`,
    });
    const acuse = armarCorreo(s.idioma, "solicitudRecibida", { nombre: s.nombre, barrio: s.barrio });
    const destinatarios = await correosDelSuperAdmin(db, env);
    await Promise.all([
      ...destinatarios.map((para) => enviarCorreo(env, { para, ...aviso })),
      enviarCorreo(env, { para: s.email, ...acuse }),
    ]);
  } catch (e) {
    console.error("[correo] No se pudieron mandar los avisos de la solicitud:", e);
  }
}

/** Aviso amable a quien pidió, con el motivo si se escribió. Nunca lanza. */
export async function avisarSolicitudRechazada(env: Env, s: Pick<Solicitud, "nombre" | "email" | "barrio" | "idioma">, motivo: string | null) {
  try {
    const correo = armarCorreo(s.idioma, "solicitudRechazada", { nombre: s.nombre, barrio: s.barrio, motivo });
    await enviarCorreo(env, { para: s.email, ...correo });
  } catch (e) {
    console.error("[correo] No se pudo avisar el rechazo de la solicitud:", e);
  }
}
