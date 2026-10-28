import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { companerismos, inscripciones, meses, turnos } from "@/db/schema";
import { fechasDelMes } from "@/shared/fechas";
import type { AppEnvBarrioAdmin } from "../../contexto";
import { esViolacionUnica, fallar, validar } from "../../http";
import { paramsMes } from "../../params";

const REGEX_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

const esquemaNuevoMes = z.object({ periodo: z.string().regex(REGEX_PERIODO) });
const esquemaCambioEstado = z.object({ estado: z.enum(["borrador", "abierto", "cerrado"]) });

/** Cambios de estado permitidos. Cualquier otro (incluido quedarse igual) es TRANSICION_INVALIDA. */
const TRANSICIONES: Record<string, readonly string[]> = {
  borrador: ["abierto"],
  abierto: ["cerrado"],
  cerrado: ["abierto"],
};

/** D1 admite como máximo 100 parámetros por consulta: los turnos se insertan en tandas. */
const TURNOS_POR_TANDA = 20;

const periodoDe = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, "0")}`;

const columnasMes = {
  id: meses.id,
  anio: meses.anio,
  mes: meses.mes,
  estado: meses.estado,
};

/** Un mes del barrio con sus conteos (para listar y para responder al crear/cambiar estado). */
async function resumenDeMes(db: AppEnvBarrioAdmin["Variables"]["db"], barrioId: string, anio: number, mes: number) {
  const fila = await db
    .select({
      ...columnasMes,
      turnos: sql<number>`count(${turnos.id})`,
      tomados: sql<number>`count(${inscripciones.id})`,
      bloqueados: sql<number>`coalesce(sum(${turnos.bloqueado}), 0)`,
    })
    .from(meses)
    .leftJoin(turnos, eq(turnos.mesId, meses.id))
    .leftJoin(inscripciones, eq(inscripciones.turnoId, turnos.id))
    .where(and(eq(meses.barrioId, barrioId), eq(meses.anio, anio), eq(meses.mes, mes)))
    .groupBy(meses.id)
    .get();
  return fila ? formatear(fila) : null;
}

const formatear = (f: { anio: number; mes: number; estado: string; turnos: number; tomados: number; bloqueados: number }) => ({
  periodo: periodoDe(f.anio, f.mes),
  anio: f.anio,
  mes: f.mes,
  estado: f.estado,
  turnos: Number(f.turnos),
  tomados: Number(f.tomados),
  bloqueados: Number(f.bloqueados),
});

const aNumeros = (periodo: string) => periodo.split("-").map(Number) as [number, number];

/** Meses del barrio (issue #8). Se monta en `/api/admin/barrios/:slug`. */
export const rutasMeses = new Hono<AppEnvBarrioAdmin>()
  /** Todos los meses del barrio, en cualquier estado, con conteos. */
  .get("/meses", async (c) => {
    const { db, barrio } = c.var;
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
      .where(eq(meses.barrioId, barrio.id))
      .groupBy(meses.id)
      .orderBy(asc(meses.anio), asc(meses.mes));
    return c.json({ meses: filas.map(formatear) });
  })

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
    const filasTurnos = fechasDelMes(anio, mes).flatMap((fecha) =>
      activos.map((cp) => ({ mesId, companerismoId: cp.id, fecha })),
    );
    const tandas: (typeof filasTurnos)[] = [];
    for (let i = 0; i < filasTurnos.length; i += TURNOS_POR_TANDA) tandas.push(filasTurnos.slice(i, i + TURNOS_POR_TANDA));

    try {
      // Un solo batch: o se crea el mes con todos sus turnos o no se crea nada.
      await db.batch([
        db.insert(meses).values({ id: mesId, barrioId: barrio.id, anio, mes }),
        ...tandas.map((tanda) => db.insert(turnos).values(tanda)),
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
        ...columnasMes,
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
