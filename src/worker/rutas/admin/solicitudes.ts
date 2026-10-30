import { and, count, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { barrios, solicitudes, type Solicitud } from "@/db/schema";
import { ESTADOS_SOLICITUD, esquemaRechazoSolicitud, type TipoCompanerismo } from "@/shared/solicitudes";
import { avisarSolicitudRechazada } from "../../avisos-solicitudes";
import { crearBarrio, esquemaNuevoBarrio } from "../../barrios";
import type { AppEnvAdmin } from "../../contexto";
import { fallar, validar } from "../../http";
import { esSuperAdmin } from "../../permisos";

const paramsSolicitud = z.object({ id: z.string().min(1).max(100) });
const queryLista = z.object({ estado: z.enum(ESTADOS_SOLICITUD).default("pendiente") });

/** Solo el super admin: todo lo de `/api/admin/solicitudes`. */
const soloSuperAdmin = createMiddleware<AppEnvAdmin>(async (c, next) => {
  if (!esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);
  await next();
});

/** La solicitud como la ve el panel: los compañerismos como lista, igual que los manda el formulario. */
const aRespuesta = (s: Solicitud, barrioSlug: string | null) => {
  const { tieneElderes, tieneHermanas, ...resto } = s;
  const companerismos: TipoCompanerismo[] = [...(tieneElderes ? (["elderes"] as const) : []), ...(tieneHermanas ? (["hermanas"] as const) : [])];
  return { ...resto, companerismos, barrioSlug };
};

const origenDe = (url: string) => new URL(url).origin;

/**
 * Toma la solicitud si sigue pendiente: el UPDATE lleva `estado = 'pendiente'` en el WHERE, así dos
 * resoluciones a la vez (doble clic, dos pestañas) no pasan las dos. Si no la tomó, dice por qué.
 */
async function resolver(
  db: Db,
  id: string,
  cambios: Partial<Solicitud>,
): Promise<{ solicitud: Solicitud; error?: never } | { error: "NO_ENCONTRADO" | "SOLICITUD_RESUELTA" }> {
  const [tomada] = await db
    .update(solicitudes)
    .set(cambios)
    .where(and(eq(solicitudes.id, id), eq(solicitudes.estado, "pendiente")))
    .returning();
  if (tomada) return { solicitud: tomada };
  const existe = await db.select({ id: solicitudes.id }).from(solicitudes).where(eq(solicitudes.id, id)).get();
  return { error: existe ? "SOLICITUD_RESUELTA" : "NO_ENCONTRADO" };
}

/** Solicitudes de acceso: el super admin las revisa, aprueba (crea el barrio) o rechaza. */
export const rutasSolicitudesAdmin = new Hono<AppEnvAdmin>()
  .use(soloSuperAdmin)

  /** Las del estado pedido (por defecto `pendiente`), más nuevas primero, y cuántas hay pendientes. */
  .get("/", validar("query", queryLista), async (c) => {
    const { db } = c.var;
    const { estado } = c.req.valid("query");
    const [filas, [{ pendientes }]] = await db.batch([
      db
        .select({ solicitud: solicitudes, barrioSlug: barrios.slug })
        .from(solicitudes)
        .leftJoin(barrios, eq(barrios.id, solicitudes.barrioId))
        .where(eq(solicitudes.estado, estado))
        .orderBy(desc(solicitudes.creadoEn), desc(solicitudes.id)),
      db.select({ pendientes: count() }).from(solicitudes).where(eq(solicitudes.estado, "pendiente")),
    ]);
    return c.json({ solicitudes: filas.map((f) => aRespuesta(f.solicitud, f.barrioSlug)), pendientes });
  })

  /** Crea el barrio con los datos que mande el super admin (corregidos si hizo falta) y marca la solicitud. */
  .post("/:id/aprobar", validar("param", paramsSolicitud), validar("json", esquemaNuevoBarrio), async (c) => {
    const { db, usuario } = c.var;
    const { id } = c.req.valid("param");
    // Primero se toma (queda aprobada); si el barrio no se puede crear, vuelve a pendiente.
    const tomada = await resolver(db, id, { estado: "aprobada", resueltaEn: new Date(), resueltaPorUserId: usuario.id });
    if (tomada.error) return fallar(c, tomada.error, tomada.error === "NO_ENCONTRADO" ? 404 : 409);
    const devolver = () =>
      db
        .update(solicitudes)
        .set({ estado: "pendiente", resueltaEn: null, resueltaPorUserId: null })
        .where(eq(solicitudes.id, id));

    let creado;
    try {
      // El barrio y su id en la solicitud van en el mismo batch.
      creado = await crearBarrio(db, c.env, origenDe(c.req.url), c.req.valid("json"), (barrioId) => [
        db.update(solicitudes).set({ barrioId }).where(eq(solicitudes.id, id)),
      ]);
    } catch (err) {
      await devolver();
      throw err;
    }
    if (!creado) {
      await devolver();
      return fallar(c, "SLUG_EXISTENTE", 409);
    }

    const { barrioId: _, ...respuesta } = creado;
    return c.json({ ...respuesta, solicitud: { id, estado: "aprobada" as const } }, 201);
  })

  .post("/:id/rechazar", validar("param", paramsSolicitud), validar("json", esquemaRechazoSolicitud), async (c) => {
    const { db, usuario } = c.var;
    const { id } = c.req.valid("param");
    const { motivo } = c.req.valid("json");
    const tomada = await resolver(db, id, {
      estado: "rechazada",
      motivoRechazo: motivo,
      resueltaEn: new Date(),
      resueltaPorUserId: usuario.id,
    });
    if (tomada.error) return fallar(c, tomada.error, tomada.error === "NO_ENCONTRADO" ? 404 : 409);
    // Después de guardar: si el correo falla, igual quedó rechazada.
    await avisarSolicitudRechazada(c.env, tomada.solicitud, motivo);
    return c.json({ solicitud: { id, estado: "rechazada" as const, motivoRechazo: motivo } });
  });
