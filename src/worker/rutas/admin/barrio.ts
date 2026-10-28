import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "@/db";
import { type Barrio, barrios, companerismos, meses, nuevoToken } from "@/db/schema";
import { hoyEnZona } from "@/shared/fechas";
import { IDIOMAS } from "@/shared/idiomas";
import type { AppEnvBarrioAdmin } from "../../contexto";
import { insertsDeTurnos } from "../../consultas";
import { fallar, validar, zonaValida } from "../../http";
import { paramsBarrio } from "../../params";

/** Texto opcional: `null` o vacío lo borra. */
const texto = (max: number) => z.string().trim().max(max).nullable().transform((v) => v || null);

const esquemaBarrio = z.object({
  nombre: z.string().trim().min(2).max(80).optional(),
  notaParaCocinar: texto(500).optional(),
  contactoNombre: texto(80).optional(),
  contactoTelefono: texto(40).optional(),
  idioma: z.enum(IDIOMAS).optional(),
  zonaHoraria: z.string().refine(zonaValida).optional(),
});

const esquemaNuevoCompanerismo = z.object({
  tipo: z.enum(["elderes", "hermanas"]),
  nombre: z.string().trim().min(1).max(60),
});

const esquemaEditarCompanerismo = z.object({
  nombre: z.string().trim().min(1).max(60).optional(),
  activo: z.boolean().optional(),
  orden: z.number().int().min(0).max(1000).optional(),
});

const paramsCompanerismo = paramsBarrio.extend({ id: z.string().min(1).max(100) });

const columnasCompanerismo = {
  id: companerismos.id,
  tipo: companerismos.tipo,
  nombre: companerismos.nombre,
  activo: companerismos.activo,
  orden: companerismos.orden,
};

const listarCompanerismos = (db: Db, barrioId: string) =>
  db
    .select(columnasCompanerismo)
    .from(companerismos)
    .where(eq(companerismos.barrioId, barrioId))
    .orderBy(asc(companerismos.orden), asc(companerismos.nombre));

const datosBarrio = (b: typeof barrios.$inferSelect) => ({
  slug: b.slug,
  nombre: b.nombre,
  idioma: b.idioma,
  zonaHoraria: b.zonaHoraria,
  tokenMisioneros: b.tokenMisioneros,
  notaParaCocinar: b.notaParaCocinar,
  contactoNombre: b.contactoNombre,
  contactoTelefono: b.contactoTelefono,
});

/**
 * Turnos para un compañerismo nuevo o reactivado en los meses donde todavía se anota: borradores y
 * abiertos, del mes actual (en la zona del barrio) en adelante. Los cerrados y pasados no se tocan.
 */
async function turnosQueFaltan(db: Db, barrio: Barrio, companerismoId: string) {
  const [anio, mes] = hoyEnZona(barrio.zonaHoraria).split("-").map(Number);
  const vigentes = await db
    .select({ id: meses.id, anio: meses.anio, mes: meses.mes })
    .from(meses)
    .where(
      and(
        eq(meses.barrioId, barrio.id),
        inArray(meses.estado, ["borrador", "abierto"]),
        sql`${meses.anio} * 12 + ${meses.mes} >= ${anio * 12 + mes}`,
      ),
    );
  return vigentes.flatMap((m) => insertsDeTurnos(db, m, [companerismoId]));
}

const sinIndefinidos = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** Datos del barrio, token de misioneros y compañerismos (issue #10). Se monta en `/api/admin/barrios/:slug`. */
export const rutasBarrio = new Hono<AppEnvBarrioAdmin>()
  .get("/", async (c) => {
    const { db, barrio } = c.var;
    return c.json({ barrio: datosBarrio(barrio), companerismos: await listarCompanerismos(db, barrio.id) });
  })

  .patch("/", validar("json", esquemaBarrio), async (c) => {
    const { db, barrio } = c.var;
    const cambios = sinIndefinidos(c.req.valid("json"));
    if (Object.keys(cambios).length > 0) await db.update(barrios).set(cambios).where(eq(barrios.id, barrio.id));
    const actual = await db.select().from(barrios).where(eq(barrios.id, barrio.id)).get();
    return c.json({ barrio: datosBarrio(actual!) });
  })

  /** El token anterior deja de servir en cuanto se reemplaza. */
  .post("/token-misioneros", async (c) => {
    const { db, barrio } = c.var;
    const tokenMisioneros = nuevoToken();
    await db.update(barrios).set({ tokenMisioneros }).where(eq(barrios.id, barrio.id));
    return c.json({ tokenMisioneros });
  })

  .post("/companerismos", validar("json", esquemaNuevoCompanerismo), async (c) => {
    const { db, barrio } = c.var;
    const datos = c.req.valid("json");
    const id = crypto.randomUUID();
    // En un solo batch: el compañerismo y sus turnos en los meses vigentes.
    await db.batch([
      db.insert(companerismos).values({
        id,
        barrioId: barrio.id,
        tipo: datos.tipo,
        nombre: datos.nombre,
        // Al final de la lista, calculado en la misma sentencia.
        orden: sql`(select coalesce(max(${companerismos.orden}) + 1, 0) from ${companerismos} where ${companerismos.barrioId} = ${barrio.id})`,
      }),
      ...(await turnosQueFaltan(db, barrio, id)),
    ]);
    const creado = await db.select(columnasCompanerismo).from(companerismos).where(eq(companerismos.id, id)).get();
    return c.json({ companerismo: creado }, 201);
  })

  /** Nunca se borran: desactivar conserva turnos e inscripciones; reactivar completa los turnos que faltan. */
  .patch("/companerismos/:id", validar("param", paramsCompanerismo), validar("json", esquemaEditarCompanerismo), async (c) => {
    const { db, barrio } = c.var;
    const { id } = c.req.valid("param");
    const donde = and(eq(companerismos.id, id), eq(companerismos.barrioId, barrio.id));

    const existe = await db.select({ id: companerismos.id }).from(companerismos).where(donde).get();
    if (!existe) return fallar(c, "NO_ENCONTRADO", 404);

    const cambios = sinIndefinidos(c.req.valid("json"));
    if (Object.keys(cambios).length > 0) {
      const turnos = cambios.activo === true ? await turnosQueFaltan(db, barrio, id) : [];
      await db.batch([db.update(companerismos).set(cambios).where(donde), ...turnos]);
    }
    const actual = await db.select(columnasCompanerismo).from(companerismos).where(donde).get();
    return c.json({ companerismo: actual });
  });
