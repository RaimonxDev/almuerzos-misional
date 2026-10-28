import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { companerismos, inscripciones, meses, turnos } from "@/db/schema";
import { esquemaEdicionInscripcion, esquemaNuevaInscripcion } from "@/shared/inscripciones";
import type { AppEnvBarrioAdmin } from "../../contexto";
import { esViolacionUnica, fallar, validar } from "../../http";
import { paramsTurno } from "../../params";

/**
 * Bloqueos, anotar a mano, editar y borrar inscripciones (issue #9). Se monta en `/api/admin/barrios/:slug`.
 * Todo se busca restringido al barrio de `c.var.barrio`: un id de otro barrio da 404.
 * A diferencia de la API pública, el admin opera también días pasados y meses borrador o cerrados,
 * y ve la nota y el teléfono de las inscripciones (este último solo con consentimiento).
 */

const paramsDia = z.object({ fecha: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/) });
const paramsInscripcion = z.object({ id: z.string().min(1).max(100) });

/**
 * Como la edición con token, pero el consentimiento solo se puede quitar: darlo le toca a la persona
 * (un admin que lo activara expondría a los misioneros un teléfono que ella no autorizó).
 */
const esquemaEdicionAdmin = esquemaEdicionInscripcion.extend({ consentimientoTelefono: z.literal(false).optional() });

const esquemaBloqueo = z.object({
  bloqueado: z.boolean(),
  motivo: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => (v ? v : null)),
});

/** Un turno del barrio (cualquier mes, cualquier compañerismo, activo o no). */
async function turnoDelBarrio(db: Db, barrioId: string, turnoId: string) {
  const [fila] = await db
    .select({
      id: turnos.id,
      fecha: turnos.fecha,
      bloqueado: turnos.bloqueado,
      companerismoNombre: companerismos.nombre,
      inscripcionId: inscripciones.id,
    })
    .from(turnos)
    .innerJoin(meses, eq(meses.id, turnos.mesId))
    .innerJoin(companerismos, eq(companerismos.id, turnos.companerismoId))
    .leftJoin(inscripciones, eq(inscripciones.turnoId, turnos.id))
    .where(and(eq(turnos.id, turnoId), eq(meses.barrioId, barrioId)))
    .limit(1);
  return fila;
}

/** Una inscripción del barrio con lo necesario para mostrarla en el panel. */
async function inscripcionDelBarrio(db: Db, barrioId: string, id: string) {
  const [fila] = await db
    .select({
      id: inscripciones.id,
      turnoId: inscripciones.turnoId,
      fecha: turnos.fecha,
      companerismoNombre: companerismos.nombre,
      nombre: inscripciones.nombre,
      telefono: inscripciones.telefono,
      consentimientoTelefono: inscripciones.consentimientoTelefono,
      modalidad: inscripciones.modalidad,
      nota: inscripciones.nota,
      origen: inscripciones.origen,
    })
    .from(inscripciones)
    .innerJoin(turnos, eq(turnos.id, inscripciones.turnoId))
    .innerJoin(meses, eq(meses.id, turnos.mesId))
    .innerJoin(companerismos, eq(companerismos.id, turnos.companerismoId))
    .where(and(eq(inscripciones.id, id), eq(meses.barrioId, barrioId)))
    .limit(1);
  // Sin consentimiento el teléfono no sale por ningún endpoint, tampoco por los de admin.
  return fila && { ...fila, telefono: fila.consentimientoTelefono ? fila.telefono : null };
}

export const rutasTurnos = new Hono<AppEnvBarrioAdmin>()
  /** Bloquear o desbloquear un turno. Al desbloquear se limpia el motivo. */
  .patch("/turnos/:turnoId", validar("param", paramsTurno), validar("json", esquemaBloqueo), async (c) => {
    const db = c.var.db;
    const { turnoId } = c.req.valid("param");
    const { bloqueado, motivo } = c.req.valid("json");

    const turno = await turnoDelBarrio(db, c.var.barrio.id, turnoId);
    if (!turno) return fallar(c, "NO_ENCONTRADO", 404);

    const motivoBloqueo = bloqueado ? motivo : null;
    await db.update(turnos).set({ bloqueado, motivoBloqueo }).where(eq(turnos.id, turnoId));
    return c.json({ turno: { id: turno.id, fecha: turno.fecha, bloqueado, motivoBloqueo } });
  })

  /**
   * Bloquear o desbloquear un día completo: todos los turnos de esa fecha del barrio, incluidos los
   * de compañerismos inactivos (si se reactivan, el día sigue bloqueado).
   */
  .patch("/dias/:fecha", validar("param", paramsDia), validar("json", esquemaBloqueo), async (c) => {
    const db = c.var.db;
    const { fecha } = c.req.valid("param");
    const { bloqueado, motivo } = c.req.valid("json");

    const delDia = await db
      .select({ id: turnos.id })
      .from(turnos)
      .innerJoin(meses, eq(meses.id, turnos.mesId))
      .where(and(eq(meses.barrioId, c.var.barrio.id), eq(turnos.fecha, fecha)));
    if (delDia.length === 0) return fallar(c, "NO_ENCONTRADO", 404);

    const motivoBloqueo = bloqueado ? motivo : null;
    await db
      .update(turnos)
      .set({ bloqueado, motivoBloqueo })
      .where(inArray(turnos.id, delDia.map((t) => t.id)));
    return c.json({ dia: { fecha, bloqueado, motivoBloqueo, turnos: delDia.length } });
  })

  /** Anotar a mano. Sin token de edición; sirve en días pasados y meses que no están abiertos. */
  .post(
    "/turnos/:turnoId/inscripcion",
    validar("param", paramsTurno),
    validar("json", esquemaNuevaInscripcion),
    async (c) => {
      const db = c.var.db;
      const { turnoId } = c.req.valid("param");
      const datos = c.req.valid("json");

      const turno = await turnoDelBarrio(db, c.var.barrio.id, turnoId);
      if (!turno) return fallar(c, "NO_ENCONTRADO", 404);
      if (turno.bloqueado) return fallar(c, "TURNO_BLOQUEADO", 422);
      if (turno.inscripcionId) return fallar(c, "TURNO_TOMADO", 409);

      try {
        const [creada] = await db
          .insert(inscripciones)
          .values({
            turnoId,
            nombre: datos.nombre,
            telefono: datos.telefono,
            consentimientoTelefono: datos.consentimientoTelefono,
            modalidad: datos.modalidad,
            nota: datos.nota,
            origen: "admin",
            creadoPorUserId: c.var.usuario.id,
            tokenEdicionHash: null,
          })
          .returning({ id: inscripciones.id });
        return c.json({ inscripcion: await inscripcionDelBarrio(db, c.var.barrio.id, creada.id) }, 201);
      } catch (err) {
        if (esViolacionUnica(err)) return fallar(c, "TURNO_TOMADO", 409);
        throw err;
      }
    },
  )

  /** Editar cualquier inscripción del barrio (también las públicas). */
  .patch("/inscripciones/:id", validar("param", paramsInscripcion), validar("json", esquemaEdicionAdmin), async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid("param");
    const cambios = c.req.valid("json");

    if (!(await inscripcionDelBarrio(db, c.var.barrio.id, id))) return fallar(c, "NO_ENCONTRADO", 404);
    if (Object.keys(cambios).length > 0) {
      await db.update(inscripciones).set(cambios).where(eq(inscripciones.id, id));
    }
    return c.json({ inscripcion: await inscripcionDelBarrio(db, c.var.barrio.id, id) });
  })

  /** Borrar = el turno vuelve a quedar libre. */
  .delete("/inscripciones/:id", validar("param", paramsInscripcion), async (c) => {
    const { id } = c.req.valid("param");
    if (!(await inscripcionDelBarrio(c.var.db, c.var.barrio.id, id))) return fallar(c, "NO_ENCONTRADO", 404);
    await c.var.db.delete(inscripciones).where(eq(inscripciones.id, id));
    return c.body(null, 204);
  });
