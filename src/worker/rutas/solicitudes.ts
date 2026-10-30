import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { solicitudes } from "@/db/schema";
import { esquemaNuevaSolicitud } from "@/shared/solicitudes";
import { avisarSolicitudNueva } from "../avisos-solicitudes";
import type { AppEnv } from "../contexto";
import { esViolacionUnica, fallar, limitarPorIp, origenDe, validar } from "../http";
import { verificarTurnstile } from "../turnstile";

/** Pedir acceso para un barrio: público, con Turnstile y límite por IP. */
export const rutasSolicitudes = new Hono<AppEnv>().post(
  "/",
  // Antes de validar: cuentan también los intentos inválidos.
  limitarPorIp((env) => env.LIMITE_SOLICITUDES),
  validar("json", esquemaNuevaSolicitud),
  async (c) => {
    const { db } = c.var;
    const { turnstileToken, companerismos, ...datos } = c.req.valid("json");

    if (!(await verificarTurnstile(c.env, turnstileToken, c.req.header("cf-connecting-ip")))) {
      return fallar(c, "VERIFICACION_FALLIDA", 400);
    }

    const pendiente = await db
      .select({ id: solicitudes.id })
      .from(solicitudes)
      .where(and(eq(solicitudes.email, datos.email), eq(solicitudes.estado, "pendiente")))
      .get();
    if (pendiente) return fallar(c, "SOLICITUD_PENDIENTE", 409);

    let solicitud;
    try {
      [solicitud] = await db
        .insert(solicitudes)
        .values({
          ...datos,
          tieneElderes: companerismos.includes("elderes"),
          tieneHermanas: companerismos.includes("hermanas"),
        })
        .returning();
    } catch (err) {
      // Dos envíos a la vez con el mismo correo: el índice único parcial frena el segundo.
      if (esViolacionUnica(err)) return fallar(c, "SOLICITUD_PENDIENTE", 409);
      throw err;
    }

    // En segundo plano: el correo no demora la respuesta ni la afecta si falla.
    c.executionCtx.waitUntil(avisarSolicitudNueva(db, c.env, origenDe(c.req.url), solicitud));
    return c.json({ id: solicitud.id }, 201);
  },
);
