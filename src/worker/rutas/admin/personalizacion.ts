import { and, eq, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import type { Db } from "@/db";
import { meses } from "@/db/schema";
import {
  esquemaPersonalizacion,
  MAX_BYTES_IMAGEN,
  TIPOS_IMAGEN,
  type TipoImagen,
} from "@/shared/personalizacion";
import type { AppEnvBarrioAdmin } from "../../contexto";
import { fallar, validar } from "../../http";
import { aNumeros, paramsMes } from "../../params";

const EXTENSION: Record<TipoImagen, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const columnas = {
  imagenKey: meses.imagenKey,
  escritura: meses.escritura,
  escrituraRef: meses.escrituraRef,
  mensaje: meses.mensaje,
  plantilla: meses.plantilla,
};

/** El mes `periodo` del barrio. */
const dondeMes = (barrioId: string, periodo: string) => {
  const [anio, numeroMes] = aNumeros(periodo);
  return and(eq(meses.barrioId, barrioId), eq(meses.anio, anio), eq(meses.mes, numeroMes));
};

/** Lee el cuerpo contando bytes; devuelve null si pasa el máximo (sin confiar en Content-Length). */
async function leerAcotado(req: Request, max: number): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array(0);
  const lector = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lector.cancel();
      return null;
    }
    partes.push(value);
  }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    bytes.set(p, pos);
    pos += p.byteLength;
  }
  return bytes;
}

/**
 * Personalización del mes e imagen (R2). Se monta en `/api/admin/barrios/:slug`.
 *
 * El `PUT .../imagen` recibe el archivo crudo (tipo en `Content-Type`). Con el cliente RPC:
 * ```ts
 * api.admin.barrios[":slug"].meses[":periodo"].imagen.$put(
 *   { param: { slug, periodo } },
 *   { init: { body: archivo, headers: { "Content-Type": archivo.type } } },
 * );
 * ```
 */
export const rutasPersonalizacion = new Hono<AppEnvBarrioAdmin>()
  .patch(
    "/meses/:periodo/personalizacion",
    validar("param", paramsMes),
    validar("json", esquemaPersonalizacion),
    async (c) => {
      const { db, barrio } = c.var;
      const donde = dondeMes(barrio.id, c.req.valid("param").periodo);
      const set = Object.fromEntries(Object.entries(c.req.valid("json")).filter(([, v]) => v !== undefined));

      const personalizacion =
        Object.keys(set).length === 0
          ? await db.select(columnas).from(meses).where(donde).get()
          : await db.update(meses).set(set).where(donde).returning(columnas).get();
      if (!personalizacion) return fallar(c, "NO_ENCONTRADO", 404);
      return c.json({ personalizacion }, 200);
    },
  )

  .put("/meses/:periodo/imagen", validar("param", paramsMes), async (c) => {
    const { db, barrio } = c.var;
    const { periodo } = c.req.valid("param");
    const donde = dondeMes(barrio.id, periodo);

    const existe = await db.select({ id: meses.id }).from(meses).where(donde).get();
    if (!existe) return fallar(c, "NO_ENCONTRADO", 404);

    const tipo = c.req.header("Content-Type")?.split(";")[0].trim().toLowerCase() as TipoImagen | undefined;
    if (!tipo || !TIPOS_IMAGEN.includes(tipo)) return fallar(c, "IMAGEN_INVALIDA", 400);

    const declarado = Number(c.req.header("Content-Length"));
    if (declarado > MAX_BYTES_IMAGEN) return fallar(c, "IMAGEN_MUY_GRANDE", 413);
    const bytes = await leerAcotado(c.req.raw, MAX_BYTES_IMAGEN);
    if (!bytes) return fallar(c, "IMAGEN_MUY_GRANDE", 413);
    if (bytes.byteLength === 0) return fallar(c, "IMAGEN_INVALIDA", 400);

    const key = `meses/${barrio.id}/${periodo}/${crypto.randomUUID()}.${EXTENSION[tipo]}`;
    await c.env.IMAGENES.put(key, bytes, { httpMetadata: { contentType: tipo } });
    let resultado;
    try {
      resultado = await reemplazarImagen(db, donde, key);
    } catch (err) {
      await c.env.IMAGENES.delete(key); // sin fila que la apunte quedaría huérfana
      throw err;
    }
    if (resultado.anterior) await c.env.IMAGENES.delete(resultado.anterior);
    return c.json({ personalizacion: resultado.personalizacion }, 200);
  })

  .delete("/meses/:periodo/imagen", validar("param", paramsMes), async (c) => {
    const { db, barrio } = c.var;
    const resultado = await reemplazarImagen(db, dondeMes(barrio.id, c.req.valid("param").periodo), null);
    if (!resultado.personalizacion) return fallar(c, "NO_ENCONTRADO", 404);
    if (resultado.anterior) await c.env.IMAGENES.delete(resultado.anterior);
    return c.json({ personalizacion: resultado.personalizacion }, 200);
  });

/**
 * Cambia la clave de la imagen y devuelve la que reemplazó. El batch de D1 es una transacción:
 * la clave leída es justo la que se pisa, así dos subidas a la vez no dejan objetos sin borrar.
 */
async function reemplazarImagen(db: Db, donde: SQL | undefined, key: string | null) {
  const [[actual], [personalizacion]] = await db.batch([
    db.select({ imagenKey: meses.imagenKey }).from(meses).where(donde),
    db.update(meses).set({ imagenKey: key }).where(donde).returning(columnas),
  ]);
  return { anterior: actual?.imagenKey ?? null, personalizacion };
}
