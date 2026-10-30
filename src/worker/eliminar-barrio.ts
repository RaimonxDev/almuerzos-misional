import { and, count, eq, gte, inArray, ne, type SQL } from "drizzle-orm";
import type { Db } from "@/db";
import { user } from "@/db/auth-schema";
import { adminsBarrio, type Barrio, barrios, inscripciones, meses, solicitudes, turnos } from "@/db/schema";
import { hoyEnZona } from "@/shared/fechas";
import { borrarEnlacesRestablecer } from "./auth";
import { esSuperAdmin } from "./permisos";

/**
 * Admins del barrio y si su cuenta se borra con él: sin otro barrio solo les quedaría un panel vacío
 * y su correo guardado. La de un super admin nunca se borra.
 */
export async function adminsDelBarrio(db: Db, barrioId: string) {
  const admins = await db
    .select({ id: user.id, email: user.email, nombre: user.name, role: user.role })
    .from(adminsBarrio)
    .innerJoin(user, eq(user.id, adminsBarrio.userId))
    .where(eq(adminsBarrio.barrioId, barrioId));
  if (admins.length === 0) return [];
  const conOtroBarrio = await db
    .select({ userId: adminsBarrio.userId })
    .from(adminsBarrio)
    .where(and(inArray(adminsBarrio.userId, admins.map((a) => a.id)), ne(adminsBarrio.barrioId, barrioId)));
  const conservan = new Set(conOtroBarrio.map((a) => a.userId));
  return admins.map(({ role, ...a }) => ({ ...a, cuentaSeBorra: !esSuperAdmin({ role }) && !conservan.has(a.id) }));
}

/** Lo que se pierde al borrar el barrio, para mostrarlo antes de confirmar. */
export async function resumenEliminacion(db: Db, barrio: Barrio) {
  const contar = (filtro?: SQL) =>
    db
      .select({ n: count() })
      .from(inscripciones)
      .innerJoin(turnos, eq(turnos.id, inscripciones.turnoId))
      .innerJoin(meses, eq(meses.id, turnos.mesId))
      .where(and(eq(meses.barrioId, barrio.id), filtro));
  const [[{ n: total }], [{ n: futuras }], admins] = await Promise.all([
    contar(),
    contar(gte(turnos.fecha, hoyEnZona(barrio.zonaHoraria))),
    adminsDelBarrio(db, barrio.id),
  ]);
  return {
    inscripciones: total,
    inscripcionesFuturas: futuras,
    cuentasQueSeBorran: admins.filter((a) => a.cuentaSeBorra).map((a) => a.email),
  };
}

/**
 * Borra el barrio y todo lo que cuelga de él en un solo batch. El esquema borra en cascada
 * compañerismos, meses, turnos e inscripciones; la solicitud de acceso solo soltaría su `barrio_id`,
 * así que se borra aparte para no dejar los datos de quien la pidió.
 */
export async function borrarBarrio(db: Db, barrioId: string, cuentas: string[]) {
  await db.batch([
    db.delete(solicitudes).where(eq(solicitudes.barrioId, barrioId)),
    db.delete(barrios).where(eq(barrios.id, barrioId)),
    ...cuentas.map((id) => borrarEnlacesRestablecer(db, id)),
    ...cuentas.map((id) => db.delete(user).where(eq(user.id, id))),
  ]);
}

/**
 * Imágenes del barrio en R2, que la base de datos no borra. Va después del batch y nunca lanza: si
 * falla, el barrio ya no existe y solo queda alguna imagen suelta.
 */
export async function borrarImagenes(env: Env, barrioId: string) {
  try {
    let cursor: string | undefined;
    do {
      const pagina = await env.IMAGENES.list({ prefix: `meses/${barrioId}/`, cursor });
      if (pagina.objects.length > 0) await env.IMAGENES.delete(pagina.objects.map((o) => o.key));
      cursor = pagina.truncated ? pagina.cursor : undefined;
    } while (cursor);
  } catch (e) {
    console.error("[r2] No se pudieron borrar las imágenes del barrio:", e);
  }
}
