import { Hono } from "hono";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { companerismos, inscripciones, meses, turnos } from "@/db/schema";
import { hoyEnZona } from "@/shared/fechas";
import { esquemaNuevaInscripcion } from "@/shared/inscripciones";
import type { AppEnv } from "../contexto";
import { buscarBarrio, buscarTurno, estadoTurno } from "../consultas";
import { esViolacionUnica, fallar, nuevoTokenEdicion, sha256Hex, validar } from "../http";

/**
 * API pública (sin login). Regla de oro: aquí nunca sale teléfono, dirección ni nota
 * de una inscripción; solo el nombre. Cada `select` nombra sus columnas a propósito.
 */

const paramsBarrio = z.object({ slug: z.string().min(1).max(60) });
const paramsMes = paramsBarrio.extend({ periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
const paramsTurno = paramsBarrio.extend({ turnoId: z.string().min(1).max(100) });

/** El público ve meses abiertos y cerrados (solo lectura); los borradores no existen para él. */
const ESTADOS_VISIBLES = ["abierto", "cerrado"] as const;

export const rutasBarrios = new Hono<AppEnv>()
  /** Datos del barrio y los meses en que se puede anotar. */
  .get("/:slug", validar("param", paramsBarrio), async (c) => {
    const db = c.var.db;
    const barrio = await buscarBarrio(db, c.req.valid("param").slug);
    if (!barrio) return fallar(c, "NO_ENCONTRADO", 404);

    const abiertos = await db
      .select({ anio: meses.anio, mes: meses.mes })
      .from(meses)
      .where(and(eq(meses.barrioId, barrio.id), eq(meses.estado, "abierto")))
      .orderBy(asc(meses.anio), asc(meses.mes));

    return c.json({
      barrio: {
        slug: barrio.slug,
        nombre: barrio.nombre,
        idioma: barrio.idioma,
        zonaHoraria: barrio.zonaHoraria,
        notaParaCocinar: barrio.notaParaCocinar,
      },
      mesesAbiertos: abiertos,
      hoy: hoyEnZona(barrio.zonaHoraria),
    });
  })

  /** Turnos de un mes: estado y, si está tomado, solo el nombre. */
  .get("/:slug/meses/:periodo", validar("param", paramsMes), async (c) => {
    const db = c.var.db;
    const { slug, periodo } = c.req.valid("param");
    const barrio = await buscarBarrio(db, slug);
    if (!barrio) return fallar(c, "NO_ENCONTRADO", 404);

    const [anio, numeroMes] = periodo.split("-").map(Number);
    const mes = await db.query.meses.findFirst({
      where: and(
        eq(meses.barrioId, barrio.id),
        eq(meses.anio, anio),
        eq(meses.mes, numeroMes),
        inArray(meses.estado, ESTADOS_VISIBLES),
      ),
    });
    if (!mes) return fallar(c, "NO_ENCONTRADO", 404);

    const listaCompanerismos = await db
      .select({ id: companerismos.id, nombre: companerismos.nombre, tipo: companerismos.tipo })
      .from(companerismos)
      .where(and(eq(companerismos.barrioId, barrio.id), eq(companerismos.activo, true)))
      .orderBy(asc(companerismos.orden));

    const filas = await db
      .select({
        id: turnos.id,
        fecha: turnos.fecha,
        companerismoId: turnos.companerismoId,
        bloqueado: turnos.bloqueado,
        motivoBloqueo: turnos.motivoBloqueo,
        nombre: inscripciones.nombre,
        inscripcionId: inscripciones.id,
      })
      .from(turnos)
      .innerJoin(
        companerismos,
        and(eq(companerismos.id, turnos.companerismoId), eq(companerismos.activo, true)),
      )
      .leftJoin(inscripciones, eq(inscripciones.turnoId, turnos.id))
      .where(eq(turnos.mesId, mes.id))
      .orderBy(asc(turnos.fecha), asc(companerismos.orden));

    return c.json({
      mes: { anio: mes.anio, mes: mes.mes, estado: mes.estado },
      companerismos: listaCompanerismos,
      turnos: filas.map((t) => {
        const estado = estadoTurno(t.bloqueado, t.nombre);
        return {
          id: t.id,
          fecha: t.fecha,
          companerismoId: t.companerismoId,
          estado,
          nombre: estado === "tomado" ? t.nombre : null,
          /**
           * Para que el teléfono que se anotó reconozca su turno comparando con el id guardado.
           * No da acceso a nada: editar exige además el token de edición.
           */
          inscripcionId: estado === "tomado" ? t.inscripcionId : null,
          motivoBloqueo: estado === "bloqueado" ? t.motivoBloqueo : null,
        };
      }),
      hoy: hoyEnZona(barrio.zonaHoraria),
    });
  })

  /** Un turno, para el encabezado del formulario (se puede abrir directo desde un link). */
  .get("/:slug/turnos/:turnoId", validar("param", paramsTurno), async (c) => {
    const { slug, turnoId } = c.req.valid("param");
    const fila = await buscarTurno(c.var.db, slug, turnoId);
    if (!fila || !fila.companerismo.activo || fila.mes.estado === "borrador") {
      return fallar(c, "NO_ENCONTRADO", 404);
    }
    const estado = estadoTurno(fila.turno.bloqueado, fila.nombreInscrito);
    return c.json({
      turno: {
        id: fila.turno.id,
        fecha: fila.turno.fecha,
        estado,
        nombre: estado === "tomado" ? fila.nombreInscrito : null,
        inscripcionId: estado === "tomado" ? fila.inscripcionId : null,
        motivoBloqueo: estado === "bloqueado" ? fila.turno.motivoBloqueo : null,
      },
      companerismo: { nombre: fila.companerismo.nombre, tipo: fila.companerismo.tipo },
      mes: { anio: fila.mes.anio, mes: fila.mes.mes, estado: fila.mes.estado },
      barrio: { nombre: fila.barrio.nombre, notaParaCocinar: fila.barrio.notaParaCocinar },
      hoy: hoyEnZona(fila.barrio.zonaHoraria),
    });
  })

  /**
   * Anotarse. Si dos personas toman el mismo turno a la vez, el UNIQUE de
   * inscripciones.turno_id hace fallar la segunda inserción → 409 TURNO_TOMADO.
   */
  .post(
    "/:slug/turnos/:turnoId/inscripcion",
    validar("param", paramsTurno),
    validar("json", esquemaNuevaInscripcion),
    async (c) => {
      const db = c.var.db;
      const { slug, turnoId } = c.req.valid("param");
      const datos = c.req.valid("json");

      const fila = await buscarTurno(db, slug, turnoId);
      if (!fila || !fila.companerismo.activo || fila.mes.estado === "borrador") {
        return fallar(c, "NO_ENCONTRADO", 404);
      }
      if (fila.mes.estado !== "abierto") return fallar(c, "MES_NO_ABIERTO", 422);
      if (fila.turno.bloqueado) return fallar(c, "TURNO_BLOQUEADO", 422);
      if (fila.turno.fecha < hoyEnZona(fila.barrio.zonaHoraria)) return fallar(c, "TURNO_PASADO", 422);
      if (fila.nombreInscrito) return fallar(c, "TURNO_TOMADO", 409);

      const tokenEdicion = nuevoTokenEdicion();
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
            origen: "publico",
            tokenEdicionHash: await sha256Hex(tokenEdicion),
          })
          .returning({ id: inscripciones.id });

        return c.json(
          {
            inscripcion: {
              id: creada.id,
              turnoId,
              fecha: fila.turno.fecha,
              companerismoNombre: fila.companerismo.nombre,
              nombre: datos.nombre,
              telefono: datos.telefono,
              consentimientoTelefono: datos.consentimientoTelefono,
              modalidad: datos.modalidad,
              nota: datos.nota,
            },
            /** Se entrega una sola vez: el cliente lo guarda en localStorage. */
            tokenEdicion,
          },
          201,
        );
      } catch (err) {
        if (esViolacionUnica(err)) return fallar(c, "TURNO_TOMADO", 409);
        throw err;
      }
    },
  );
