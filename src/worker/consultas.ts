import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { barrios, companerismos, inscripciones, meses, turnos } from "@/db/schema";

export const buscarBarrio = async (db: Db, slug: string) =>
  db.query.barrios.findFirst({ where: and(eq(barrios.slug, slug), eq(barrios.activo, true)) });

/**
 * Un turno con todo lo necesario para decidir si se puede tomar o editar.
 * Filtra por barrio para que un id de otro barrio no sirva en esta URL.
 */
export async function buscarTurno(db: Db, slug: string, turnoId: string) {
  const [fila] = await db
    .select({
      turno: turnos,
      mes: { id: meses.id, anio: meses.anio, mes: meses.mes, estado: meses.estado },
      companerismo: { nombre: companerismos.nombre, tipo: companerismos.tipo, activo: companerismos.activo },
      barrio: {
        nombre: barrios.nombre,
        zonaHoraria: barrios.zonaHoraria,
        notaParaCocinar: barrios.notaParaCocinar,
      },
      nombreInscrito: inscripciones.nombre,
    })
    .from(turnos)
    .innerJoin(meses, eq(meses.id, turnos.mesId))
    .innerJoin(barrios, eq(barrios.id, meses.barrioId))
    .innerJoin(companerismos, eq(companerismos.id, turnos.companerismoId))
    .leftJoin(inscripciones, eq(inscripciones.turnoId, turnos.id))
    .where(and(eq(turnos.id, turnoId), eq(barrios.slug, slug), eq(barrios.activo, true)))
    .limit(1);
  return fila;
}

/**
 * Inscripción con su turno, mes y barrio. Incluye datos privados (teléfono, nota):
 * usarla solo después de validar el token de edición.
 */
export async function buscarInscripcion(db: Db, id: string) {
  const [fila] = await db
    .select({
      inscripcion: inscripciones,
      fecha: turnos.fecha,
      companerismoNombre: companerismos.nombre,
      mesEstado: meses.estado,
      barrioSlug: barrios.slug,
      barrioNombre: barrios.nombre,
      zonaHoraria: barrios.zonaHoraria,
    })
    .from(inscripciones)
    .innerJoin(turnos, eq(turnos.id, inscripciones.turnoId))
    .innerJoin(companerismos, eq(companerismos.id, turnos.companerismoId))
    .innerJoin(meses, eq(meses.id, turnos.mesId))
    .innerJoin(barrios, eq(barrios.id, meses.barrioId))
    .where(eq(inscripciones.id, id))
    .limit(1);
  return fila;
}

export type EstadoTurno = "libre" | "tomado" | "bloqueado";

/** Un bloqueo manda sobre una inscripción existente: el día no se hace. */
export const estadoTurno = (bloqueado: boolean, inscrito: unknown): EstadoTurno =>
  bloqueado ? "bloqueado" : inscrito ? "tomado" : "libre";
