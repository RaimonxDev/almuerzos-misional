import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { meses } from "@/db/schema";
import {
  esquemaPersonalizacion,
  MAX_BYTES_IMAGEN,
  TIPOS_IMAGEN,
  type TipoImagen,
} from "@/shared/personalizacion";
import type { AppEnvBarrioAdmin } from "../../contexto";
import { fallar, validar } from "../../http";
import { paramsMes } from "../../params";

const EXTENSION: Record<TipoImagen, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const columnas = {
  id: meses.id,
  imagenKey: meses.imagenKey,
  escritura: meses.escritura,
  escrituraRef: meses.escrituraRef,
  mensaje: meses.mensaje,
  plantilla: meses.plantilla,
};

const personalizacionDe = ({ id: _id, ...resto }: { id: string } & Record<string, unknown>) => resto as Omit<typeof resto, "id">;

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
      const [anio, numeroMes] = c.req.valid("param").periodo.split("-").map(Number);
      const cambios = c.req.valid("json");
      const donde = and(eq(meses.barrioId, barrio.id), eq(meses.anio, anio), eq(meses.mes, numeroMes));

      const mes = await db.select(columnas).from(meses).where(donde).get();
      if (!mes) return fallar(c, "NO_ENCONTRADO", 404);

      const set = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined));
      if (Object.keys(set).length === 0) return c.json({ personalizacion: personalizacionDe(mes) }, 200);
      const actualizado = await db.update(meses).set(set).where(donde).returning(columnas).get();
      return c.json({ personalizacion: personalizacionDe(actualizado) }, 200);
    },
  )

  .put("/meses/:periodo/imagen", validar("param", paramsMes), async (c) => {
    const { db, barrio } = c.var;
    const [anio, numeroMes] = c.req.valid("param").periodo.split("-").map(Number);
    const donde = and(eq(meses.barrioId, barrio.id), eq(meses.anio, anio), eq(meses.mes, numeroMes));

    const mes = await db.select(columnas).from(meses).where(donde).get();
    if (!mes) return fallar(c, "NO_ENCONTRADO", 404);

    const tipo = c.req.header("Content-Type")?.split(";")[0].trim().toLowerCase() as TipoImagen | undefined;
    if (!tipo || !TIPOS_IMAGEN.includes(tipo)) return fallar(c, "IMAGEN_INVALIDA", 400);

    const declarado = Number(c.req.header("Content-Length"));
    if (declarado > MAX_BYTES_IMAGEN) return fallar(c, "IMAGEN_MUY_GRANDE", 413);
    const bytes = await leerAcotado(c.req.raw, MAX_BYTES_IMAGEN);
    if (!bytes) return fallar(c, "IMAGEN_MUY_GRANDE", 413);
    if (bytes.byteLength === 0) return fallar(c, "IMAGEN_INVALIDA", 400);

    const key = `meses/${barrio.id}/${c.req.valid("param").periodo}/${crypto.randomUUID()}.${EXTENSION[tipo]}`;
    await c.env.IMAGENES.put(key, bytes, { httpMetadata: { contentType: tipo } });
    const actualizado = await db.update(meses).set({ imagenKey: key }).where(donde).returning(columnas).get();
    if (mes.imagenKey) await c.env.IMAGENES.delete(mes.imagenKey);
    return c.json({ personalizacion: personalizacionDe(actualizado) }, 200);
  })

  .delete("/meses/:periodo/imagen", validar("param", paramsMes), async (c) => {
    const { db, barrio } = c.var;
    const [anio, numeroMes] = c.req.valid("param").periodo.split("-").map(Number);
    const donde = and(eq(meses.barrioId, barrio.id), eq(meses.anio, anio), eq(meses.mes, numeroMes));

    const mes = await db.select(columnas).from(meses).where(donde).get();
    if (!mes) return fallar(c, "NO_ENCONTRADO", 404);

    const actualizado = await db.update(meses).set({ imagenKey: null }).where(donde).returning(columnas).get();
    if (mes.imagenKey) await c.env.IMAGENES.delete(mes.imagenKey);
    return c.json({ personalizacion: personalizacionDe(actualizado) }, 200);
  });
