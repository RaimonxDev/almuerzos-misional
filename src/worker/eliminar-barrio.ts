import { and, count, eq, gte, inArray, isNull, ne, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { user } from "@/db/auth-schema";
import { adminsBarrio, type Barrio, barrios, inscripciones, meses, solicitudes, turnos } from "@/db/schema";
import { hoyEnZona } from "@/shared/fechas";
import { borrarEnlacesRestablecer } from "./auth";
import { esSuperAdmin } from "./permisos";

const consultaAdmins = (db: Db, barrioId: string) =>
  db
    .select({
      id: user.id,
      email: user.email,
      nombre: user.name,
      role: user.role,
      otroBarrio: sql<number>`exists (select 1 from admins_barrio otro where otro.user_id = ${user.id} and otro.barrio_id <> ${barrioId})`,
    })
    .from(adminsBarrio)
    .innerJoin(user, eq(user.id, adminsBarrio.userId))
    .where(eq(adminsBarrio.barrioId, barrioId));

/**
 * Sin otro barrio, a una persona solo le quedaría un panel vacío y su correo guardado: la cuenta se
 * borra con el barrio. La de un super admin nunca se borra.
 */
const conCuenta = (admins: Awaited<ReturnType<typeof consultaAdmins>>) =>
  admins.map(({ role, otroBarrio, ...a }) => ({ ...a, cuentaSeBorra: !esSuperAdmin({ role }) && !otroBarrio }));

export const adminsDelBarrio = async (db: Db, barrioId: string) => conCuenta(await consultaAdmins(db, barrioId));

/** Lo que se pierde al borrar el barrio, para mostrarlo antes de confirmar. */
export async function resumenEliminacion(db: Db, barrio: Barrio) {
  const contar = (filtro?: SQL) =>
    db
      .select({ n: count() })
      .from(inscripciones)
      .innerJoin(turnos, eq(turnos.id, inscripciones.turnoId))
      .innerJoin(meses, eq(meses.id, turnos.mesId))
      .where(and(eq(meses.barrioId, barrio.id), filtro));
  const [[{ n: total }], [{ n: futuras }], admins] = await db.batch([
    contar(),
    contar(gte(turnos.fecha, hoyEnZona(barrio.zonaHoraria))),
    consultaAdmins(db, barrio.id),
  ]);
  return {
    inscripciones: total,
    inscripcionesFuturas: futuras,
    cuentasQueSeBorran: conCuenta(admins)
      .filter((a) => a.cuentaSeBorra)
      .map((a) => a.email),
  };
}

/**
 * Borra el barrio y todo lo que cuelga de él en un solo batch. El esquema borra en cascada
 * compañerismos, meses, turnos e inscripciones; las solicitudes de acceso solo soltarían su
 * `barrio_id`, así que se borran aparte: la del barrio y, de las cuentas que se van, las ya resueltas
 * que no están ligadas a otro barrio. Una pendiente sigue: esa persona está pidiendo otro barrio.
 */
export async function borrarBarrio(db: Db, barrioId: string, cuentas: { id: string; email: string }[]) {
  await db.batch([
    db.delete(solicitudes).where(
      or(
        eq(solicitudes.barrioId, barrioId),
        and(
          inArray(solicitudes.email, cuentas.map((c) => c.email)),
          isNull(solicitudes.barrioId),
          ne(solicitudes.estado, "pendiente"),
        ),
      ),
    ),
    db.delete(barrios).where(eq(barrios.id, barrioId)),
    ...cuentas.map((c) => borrarEnlacesRestablecer(db, c.id)),
    ...cuentas.map((c) => db.delete(user).where(eq(user.id, c.id))),
  ]);
}

/**
 * Imágenes del barrio en R2, que la base de datos no borra. Va después del batch y nunca lanza: si
 * falla, el barrio ya no existe y solo queda alguna imagen suelta.
 */
export async function borrarImagenes(env: Pick<Env, "IMAGENES">, barrioId: string) {
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
