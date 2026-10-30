import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { companerismos, inscripciones, meses, turnos, type Barrio } from "@/db/schema";
import { LARGO_CODIGO, normalizarCodigo } from "@/shared/codigo-misioneros";
import { hoyEnZona } from "@/shared/fechas";
import type { AppEnv } from "../contexto";
import { buscarBarrio, buscarMesVisible, companerismosActivos, ESTADOS_VISIBLES, estadoTurno } from "../consultas";
import { fallar, hex, leerBearer, limitarPorIp, validar } from "../http";
import { paramsBarrio, paramsMes } from "../params";

/**
 * Calendario de misioneros (pantalla /:barrio/m). Entran con el código de 6 caracteres del barrio
 * y reciben un token que guardan en el teléfono y mandan en `Authorization: Bearer`, nunca en la
 * URL, para que no quede en logs. Aquí sí sale el teléfono, pero solo con `consentimiento_telefono`.
 */

const codificador = new TextEncoder();

/** La clave HMAC, una vez por isolate (el secreto no cambia mientras vive). */
let claveHmac: { secreto: string; clave: Promise<CryptoKey> } | null = null;

function claveDe(secreto: string) {
  if (claveHmac?.secreto !== secreto) {
    const clave = crypto.subtle.importKey("raw", codificador.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    claveHmac = { secreto, clave };
  }
  return claveHmac.clave;
}

/**
 * El token es un HMAC del barrio y su código: cambiar el código deja afuera a todos los teléfonos
 * que entraron con el anterior, sin guardar sesiones. Usa su propio secreto (`SECRETO_MISIONEROS`),
 * no el de Better Auth: rotar el de los admins no saca a los misioneros, y al revés.
 */
async function tokenDeAcceso(secreto: string, barrio: Barrio) {
  return hex(await crypto.subtle.sign("HMAC", await claveDe(secreto), codificador.encode(`misioneros:${barrio.id}:${barrio.codigoMisioneros}`)));
}

/** Sin pistas por el tiempo de respuesta de cuántos caracteres coincidieron. */
function iguales(a: string, b: string) {
  const [x, y] = [codificador.encode(a), codificador.encode(b)];
  if (x.length !== y.length) return false;
  let distintos = 0;
  for (let i = 0; i < x.length; i++) distintos |= x[i] ^ y[i];
  return distintos === 0;
}

/**
 * Barrio inexistente, sin token o con uno que no es el suyo (de otro barrio o de un código anterior):
 * la misma respuesta, para no revelar qué barrios existen.
 */
const conTokenMisioneros = createMiddleware<AppEnv & { Variables: { barrio: Barrio } }>(async (c, next) => {
  const barrio = await buscarBarrio(c.var.db, c.req.param("slug") ?? "");
  const token = leerBearer(c);
  if (!barrio || !token || !iguales(token, await tokenDeAcceso(c.env.SECRETO_MISIONEROS, barrio))) {
    return fallar(c, "TOKEN_INVALIDO", 404);
  }
  c.set("barrio", barrio);
  await next();
});

export const rutasMisioneros = new Hono<AppEnv>()
  /**
   * Código → token. El límite por IP va antes de validar: cuenta también los intentos inválidos.
   * Código malo o barrio inexistente: el mismo 404.
   */
  .post(
    "/:slug/misioneros/acceso",
    limitarPorIp(
      (env) => env.LIMITE_ACCESO_MISIONEROS,
      (c) => c.req.param("slug") ?? "",
    ),
    validar("param", paramsBarrio),
    validar("json", z.object({ codigo: z.string().max(20) })),
    async (c) => {
      const barrio = await buscarBarrio(c.var.db, c.req.valid("param").slug);
      const codigo = normalizarCodigo(c.req.valid("json").codigo);
      // El largo exacto también descarta el código vacío (la columna tiene DEFAULT '' en SQLite).
      if (!barrio || codigo.length !== LARGO_CODIGO || !iguales(codigo, barrio.codigoMisioneros)) {
        return fallar(c, "CODIGO_INVALIDO", 404);
      }
      return c.json({ token: await tokenDeAcceso(c.env.SECRETO_MISIONEROS, barrio) });
    },
  )

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
