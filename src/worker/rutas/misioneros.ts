import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { and, asc, eq, inArray } from "drizzle-orm";
import { companerismos, inscripciones, meses, turnos, type Barrio } from "@/db/schema";
import { hoyEnZona } from "@/shared/fechas";
import type { AppEnv } from "../contexto";
import { buscarBarrio, buscarMesVisible, companerismosActivos, ESTADOS_VISIBLES, estadoTurno } from "../consultas";
import { fallar, leerBearer, validar } from "../http";
import { paramsBarrio, paramsMes } from "../params";

/**
 * Calendario de misioneros (enlace /:barrio/m/:token). El token llega en
 * `Authorization: Bearer`, nunca en la URL, para que no quede en logs.
 * Aquí sí sale el teléfono, pero solo con `consentimiento_telefono`.
 */

/**
 * Barrio inexistente, sin token o con uno que no es el suyo (de otro barrio o ya regenerado):
 * la misma respuesta, para no revelar qué barrios existen.
 */
const conTokenMisioneros = createMiddleware<AppEnv & { Variables: { barrio: Barrio } }>(async (c, next) => {
  const barrio = await buscarBarrio(c.var.db, c.req.param("slug") ?? "");
  const token = leerBearer(c);
  if (!barrio || !token || token !== barrio.tokenMisioneros) return fallar(c, "TOKEN_INVALIDO", 404);
  c.set("barrio", barrio);
  await next();
});

export const rutasMisioneros = new Hono<AppEnv>()
  /** Datos del barrio y los meses que se pueden recorrer. */
  .get("/:slug/misioneros", validar("param", paramsBarrio), conTokenMisioneros, async (c) => {
    const barrio = c.var.barrio;
    const visibles = await c.var.db
      .select({ anio: meses.anio, mes: meses.mes, estado: meses.estado })
      .from(meses)
      .where(and(eq(meses.barrioId, barrio.id), inArray(meses.estado, ESTADOS_VISIBLES)))
      .orderBy(asc(meses.anio), asc(meses.mes));

    return c.json({
      barrio: {
        slug: barrio.slug,
        nombre: barrio.nombre,
        idioma: barrio.idioma,
        zonaHoraria: barrio.zonaHoraria,
      },
      meses: visibles,
      hoy: hoyEnZona(barrio.zonaHoraria),
    });
  })

  /** Turnos del mes con lo necesario para coordinar: nombre, modalidad, nota y teléfono si se compartió. */
  .get("/:slug/misioneros/meses/:periodo", validar("param", paramsMes), conTokenMisioneros, async (c) => {
    const db = c.var.db;
    const barrio = c.var.barrio;
    const mes = await buscarMesVisible(db, barrio.id, c.req.valid("param").periodo);
    if (!mes) return fallar(c, "NO_ENCONTRADO", 404);

    // Independientes entre sí: se piden a la vez.
    const [listaCompanerismos, filas] = await Promise.all([
      companerismosActivos(db, barrio.id),
      db
        .select({
          id: turnos.id,
          fecha: turnos.fecha,
          companerismoId: turnos.companerismoId,
          bloqueado: turnos.bloqueado,
          motivoBloqueo: turnos.motivoBloqueo,
          nombre: inscripciones.nombre,
          telefono: inscripciones.telefono,
          consentimientoTelefono: inscripciones.consentimientoTelefono,
          modalidad: inscripciones.modalidad,
          nota: inscripciones.nota,
        })
        .from(turnos)
        .innerJoin(
          companerismos,
          and(eq(companerismos.id, turnos.companerismoId), eq(companerismos.activo, true)),
        )
        .leftJoin(inscripciones, eq(inscripciones.turnoId, turnos.id))
        .where(eq(turnos.mesId, mes.id))
        .orderBy(asc(turnos.fecha), asc(companerismos.orden)),
    ]);

    return c.json({
      mes: { anio: mes.anio, mes: mes.mes, estado: mes.estado },
      companerismos: listaCompanerismos,
      turnos: filas.map((t) => {
        const estado = estadoTurno(t.bloqueado, t.nombre);
        const tomado = estado === "tomado";
        return {
          id: t.id,
          fecha: t.fecha,
          companerismoId: t.companerismoId,
          estado,
          nombre: tomado ? t.nombre : null,
          telefono: tomado && t.consentimientoTelefono ? t.telefono : null,
          modalidad: tomado ? t.modalidad : null,
          nota: tomado ? t.nota : null,
          motivoBloqueo: estado === "bloqueado" ? t.motivoBloqueo : null,
        };
      }),
      hoy: hoyEnZona(barrio.zonaHoraria),
    });
  });
