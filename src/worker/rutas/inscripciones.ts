import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { inscripciones } from "@/db/schema";
import { hoyEnZona } from "@/shared/fechas";
import { esquemaEdicionInscripcion } from "@/shared/inscripciones";
import type { AppEnv } from "../contexto";
import { buscarInscripcion } from "../consultas";
import { fallar, leerBearer, sha256Hex, validar } from "../http";

/**
 * "Mi turno": ver, editar o cancelar la propia inscripción con el token de edición
 * (header `Authorization: Bearer <token>`). Las anotadas por un admin no tienen token.
 */

type Encontrada = NonNullable<Awaited<ReturnType<typeof buscarInscripcion>>>;

const conToken = createMiddleware<AppEnv & { Variables: { encontrada: Encontrada } }>(async (c, next) => {
  const encontrada = await buscarInscripcion(c.var.db, c.req.param("id") ?? "");
  // NO_ENCONTRADO le dice al cliente que puede olvidar el token (ej. la presidenta la borró).
  if (!encontrada) return fallar(c, "NO_ENCONTRADO", 404);

  const token = leerBearer(c);
  const hash = encontrada.inscripcion.tokenEdicionHash;
  if (!token || !hash || (await sha256Hex(token)) !== hash) return fallar(c, "TOKEN_INVALIDO", 403);

  c.set("encontrada", encontrada);
  await next();
});

/** Solo se cambia o cancela en meses abiertos y para días que no han pasado. */
const motivoNoEditable = (e: Encontrada) =>
  e.mesEstado !== "abierto"
    ? ("MES_NO_ABIERTO" as const)
    : e.fecha < hoyEnZona(e.zonaHoraria)
      ? ("TURNO_PASADO" as const)
      : null;

const vistaPropia = (e: Encontrada) => ({
  id: e.inscripcion.id,
  turnoId: e.inscripcion.turnoId,
  fecha: e.fecha,
  companerismoNombre: e.companerismoNombre,
  barrio: { slug: e.barrioSlug, nombre: e.barrioNombre },
  nombre: e.inscripcion.nombre,
  telefono: e.inscripcion.telefono,
  consentimientoTelefono: e.inscripcion.consentimientoTelefono,
  modalidad: e.inscripcion.modalidad,
  nota: e.inscripcion.nota,
  editable: motivoNoEditable(e) === null,
});

const paramsId = z.object({ id: z.string().min(1).max(100) });

export const rutasInscripciones = new Hono<AppEnv>()
  .get("/:id", validar("param", paramsId), conToken, (c) => c.json({ inscripcion: vistaPropia(c.var.encontrada) }))

  .patch("/:id", validar("param", paramsId), conToken, validar("json", esquemaEdicionInscripcion), async (c) => {
    const encontrada = c.var.encontrada;
    const motivo = motivoNoEditable(encontrada);
    if (motivo) return fallar(c, motivo, 422);

    const cambios = c.req.valid("json");
    if (Object.keys(cambios).length > 0) {
      await c.var.db.update(inscripciones).set(cambios).where(eq(inscripciones.id, encontrada.inscripcion.id));
    }
    const actualizada = await buscarInscripcion(c.var.db, encontrada.inscripcion.id);
    return c.json({ inscripcion: vistaPropia(actualizada!) });
  })

  .delete("/:id", validar("param", paramsId), conToken, async (c) => {
    const encontrada = c.var.encontrada;
    const motivo = motivoNoEditable(encontrada);
    if (motivo) return fallar(c, motivo, 422);

    await c.var.db.delete(inscripciones).where(eq(inscripciones.id, encontrada.inscripcion.id));
    return c.body(null, 204);
  });
