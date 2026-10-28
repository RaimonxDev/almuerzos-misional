import { and, asc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "@/db";
import { companerismos, inscripciones, meses, turnos } from "@/db/schema";
import type { AppEnvBarrioAdmin } from "../../contexto";
import { insertsDeTurnos } from "../../consultas";
import { esViolacionUnica, fallar, validar } from "../../http";
import { esquemaPeriodo, paramsMes } from "../../params";

const esquemaNuevoMes = z.object({ periodo: esquemaPeriodo });
const esquemaCambioEstado = z.object({ estado: z.enum(["borrador", "abierto", "cerrado"]) });

/** Cambios de estado permitidos. Cualquier otro (incluido quedarse igual) es TRANSICION_INVALIDA. */
const TRANSICIONES: Record<string, readonly string[]> = {
  borrador: ["abierto"],
  abierto: ["cerrado"],
  cerrado: ["abierto"],
};

const periodoDe = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, "0")}`;

/** Meses del barrio con sus conteos, en orden cronológico; `filtro` acota a uno. */
async function resumenes(db: Db, barrioId: string, filtro?: SQL) {
  const filas = await db
    .select({
      anio: meses.anio,
      mes: meses.mes,
      estado: meses.estado,
      turnos: sql<number>`count(${turnos.id})`,
      tomados: sql<number>`count(${inscripciones.id})`,
      bloqueados: sql<number>`coalesce(sum(${turnos.bloqueado}), 0)`,
    })
    .from(meses)
    .leftJoin(turnos, eq(turnos.mesId, meses.id))
    .leftJoin(inscripciones, eq(inscripciones.turnoId, turnos.id))
    .where(and(eq(meses.barrioId, barrioId), filtro))
    .groupBy(meses.id)
    .orderBy(asc(meses.anio), asc(meses.mes));
  return filas.map((f) => ({
    periodo: periodoDe(f.anio, f.mes),
    anio: f.anio,
    mes: f.mes,
    estado: f.estado,
    turnos: Number(f.turnos),
    tomados: Number(f.tomados),
    bloqueados: Number(f.bloqueados),
  }));
}

const resumenDeMes = async (db: Db, barrioId: string, anio: number, mes: number) =>
  (await resumenes(db, barrioId, and(eq(meses.anio, anio), eq(meses.mes, mes))))[0] ?? null;

const aNumeros = (periodo: string) => periodo.split("-").map(Number) as [number, number];

/** Meses del barrio (issue #8). Se monta en `/api/admin/barrios/:slug`. */
export const rutasMeses = new Hono<AppEnvBarrioAdmin>()
  /** Todos los meses del barrio, en cualquier estado, con conteos. */
  .get("/meses", async (c) => c.json({ meses: await resumenes(c.var.db, c.var.barrio.id) }))

  /** Crea el mes en borrador con un turno por día y compañerismo activo. */
  .post("/meses", validar("json", esquemaNuevoMes), async (c) => {
    const { db, barrio } = c.var;
    const [anio, mes] = aNumeros(c.req.valid("json").periodo);

    const existente = await db
      .select({ id: meses.id })
      .from(meses)
      .where(and(eq(meses.barrioId, barrio.id), eq(meses.anio, anio), eq(meses.mes, mes)))
      .get();
    if (existente) return fallar(c, "MES_EXISTENTE", 409);

    const activos = await db
      .select({ id: companerismos.id })
      .from(companerismos)
      .where(and(eq(companerismos.barrioId, barrio.id), eq(companerismos.activo, true)))
      .orderBy(asc(companerismos.orden));

    const mesId = crypto.randomUUID();

    try {
      // Un solo batch: o se crea el mes con todos sus turnos o no se crea nada.
      await db.batch([
        db.insert(meses).values({ id: mesId, barrioId: barrio.id, anio, mes }),
        ...insertsDeTurnos(db, { id: mesId, anio, mes }, activos.map((cp) => cp.id)),
      ]);
    } catch (err) {
      // Carrera entre dos admins creando el mismo mes.
      if (esViolacionUnica(err)) return fallar(c, "MES_EXISTENTE", 409);
      throw err;
    }

    return c.json({ mes: await resumenDeMes(db, barrio.id, anio, mes) }, 201);
  })

  /** Mes completo para el panel: incluye borradores y la inscripción de turnos bloqueados. */
  .get("/meses/:periodo", validar("param", paramsMes), async (c) => {
    const { db, barrio } = c.var;
    const [anio, numeroMes] = aNumeros(c.req.valid("param").periodo);

    const mes = await db
      .select({
        id: meses.id,
        anio: meses.anio,
        mes: meses.mes,
        estado: meses.estado,
        imagenKey: meses.imagenKey,
        escritura: meses.escritura,
        escrituraRef: meses.escrituraRef,
        mensaje: meses.mensaje,
        plantilla: meses.plantilla,
      })
      .from(meses)
      .where(and(eq(meses.barrioId, barrio.id), eq(meses.anio, anio), eq(meses.mes, numeroMes)))
      .get();
    if (!mes) return fallar(c, "NO_ENCONTRADO", 404);

    const filas = await db
      .select({
        id: turnos.id,
        fecha: turnos.fecha,
        companerismoId: turnos.companerismoId,
        bloqueado: turnos.bloqueado,
        motivoBloqueo: turnos.motivoBloqueo,
        inscripcionId: inscripciones.id,
        nombre: inscripciones.nombre,
        telefono: inscripciones.telefono,
        consentimientoTelefono: inscripciones.consentimientoTelefono,
        modalidad: inscripciones.modalidad,
        nota: inscripciones.nota,
        origen: inscripciones.origen,
      })
      .from(turnos)
      .innerJoin(companerismos, eq(companerismos.id, turnos.companerismoId))
      .leftJoin(inscripciones, eq(inscripciones.turnoId, turnos.id))
      .where(eq(turnos.mesId, mes.id))
      .orderBy(asc(turnos.fecha), asc(companerismos.orden));

    // Los activos más los inactivos que todavía tienen turnos en este mes.
    const conTurnos = [...new Set(filas.map((f) => f.companerismoId))];
    const lista = await db
      .select({
        id: companerismos.id,
        tipo: companerismos.tipo,
        nombre: companerismos.nombre,
        activo: companerismos.activo,
        orden: companerismos.orden,
      })
      .from(companerismos)
      .where(
        and(
          eq(companerismos.barrioId, barrio.id),
          conTurnos.length > 0
            ? sql`(${companerismos.activo} = 1 or ${inArray(companerismos.id, conTurnos)})`
            : eq(companerismos.activo, true),
        ),
      )
      .orderBy(asc(companerismos.orden));

    const { id: _id, ...datosMes } = mes;
    return c.json({
      mes: { periodo: periodoDe(mes.anio, mes.mes), ...datosMes },
      companerismos: lista,
      turnos: filas.map((t) => ({
        id: t.id,
        fecha: t.fecha,
        companerismoId: t.companerismoId,
        bloqueado: t.bloqueado,
        motivoBloqueo: t.motivoBloqueo,
        inscripcion:
          t.inscripcionId === null
            ? null
            : {
                id: t.inscripcionId,
                nombre: t.nombre!,
                // Solo con consentimiento, igual que en la vista de misioneros.
                telefono: t.consentimientoTelefono ? t.telefono : null,
                consentimientoTelefono: t.consentimientoTelefono!,
                modalidad: t.modalidad,
                nota: t.nota,
                origen: t.origen!,
              },
      })),
    });
  })

  /** borrador → abierto → cerrado → abierto. */
  .patch("/meses/:periodo", validar("param", paramsMes), validar("json", esquemaCambioEstado), async (c) => {
    const { db, barrio } = c.var;
    const [anio, numeroMes] = aNumeros(c.req.valid("param").periodo);
    const { estado } = c.req.valid("json");

    const actual = await db
      .select({ id: meses.id, estado: meses.estado })
      .from(meses)
      .where(and(eq(meses.barrioId, barrio.id), eq(meses.anio, anio), eq(meses.mes, numeroMes)))
      .get();
    if (!actual) return fallar(c, "NO_ENCONTRADO", 404);
    if (!TRANSICIONES[actual.estado].includes(estado)) return fallar(c, "TRANSICION_INVALIDA", 422);

    // El WHERE incluye el estado leído: si alguien lo cambió en medio, no se pisa.
    const cambio = await db
      .update(meses)
      .set({ estado })
      .where(and(eq(meses.id, actual.id), eq(meses.estado, actual.estado)))
      .returning({ id: meses.id });
    if (cambio.length === 0) return fallar(c, "TRANSICION_INVALIDA", 422);

    return c.json({ mes: await resumenDeMes(db, barrio.id, anio, numeroMes) });
  });
