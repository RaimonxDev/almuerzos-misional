import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { adminsBarrio, barrios, companerismos } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { IDIOMAS } from "@/shared/idiomas";
import type { AppEnvAdmin } from "../../contexto";
import { esViolacionUnica, fallar, validar, zonaValida } from "../../http";
import { paramsBarrio } from "../../params";
import { esSuperAdmin } from "../../permisos";

const esquemaNuevoBarrio = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    // Reservados: chocan con rutas de la app.
    .refine((s) => !["admin", "api", "nuevo-barrio"].includes(s)),
  nombre: z.string().trim().min(2).max(80),
  idioma: z.enum(IDIOMAS).optional(),
  zonaHoraria: z.string().refine(zonaValida).optional(),
  companerismos: z
    .array(z.object({ tipo: z.enum(["elderes", "hermanas"]), nombre: z.string().trim().min(1).max(60) }))
    .min(1)
    .max(10),
});

const esquemaNuevoAdmin = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  cargo: z.string().trim().max(80).nullish().transform((v) => v || null),
});

/** Cuenta del admin y gestión de barrios/admins (solo super admin). */
export const rutasCuenta = new Hono<AppEnvAdmin>()
  .get("/yo", async (c) => {
    const { db, usuario } = c.var;
    const superAdmin = esSuperAdmin(usuario);
    const lista = superAdmin
      ? await db
          .select({ slug: barrios.slug, nombre: barrios.nombre })
          .from(barrios)
          .orderBy(asc(barrios.nombre))
          .then((filas) => filas.map((f) => ({ ...f, cargo: null as string | null })))
      : await db
          .select({ slug: barrios.slug, nombre: barrios.nombre, cargo: adminsBarrio.cargo })
          .from(adminsBarrio)
          .innerJoin(barrios, eq(barrios.id, adminsBarrio.barrioId))
          .where(eq(adminsBarrio.userId, usuario.id))
          .orderBy(asc(barrios.nombre));
    return c.json({
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.name, superAdmin },
      barrios: lista,
    });
  })

  .post("/barrios", validar("json", esquemaNuevoBarrio), async (c) => {
    if (!esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);
    const { db } = c.var;
    const datos = c.req.valid("json");

    const existente = await db.select({ id: barrios.id }).from(barrios).where(eq(barrios.slug, datos.slug)).get();
    if (existente) return fallar(c, "SLUG_EXISTENTE", 409);

    const barrioId = crypto.randomUUID();
    const filasCompanerismos = datos.companerismos.map((cp, orden) => ({ barrioId, tipo: cp.tipo, nombre: cp.nombre, orden }));
    try {
      await db.batch([
        db.insert(barrios).values({
          id: barrioId,
          slug: datos.slug,
          nombre: datos.nombre,
          ...(datos.idioma && { idioma: datos.idioma }),
          ...(datos.zonaHoraria && { zonaHoraria: datos.zonaHoraria }),
        }),
        db.insert(companerismos).values(filasCompanerismos),
      ]);
    } catch (err) {
      // Carrera entre dos super admins con el mismo slug.
      if (esViolacionUnica(err)) return fallar(c, "SLUG_EXISTENTE", 409);
      throw err;
    }

    const barrio = await db.query.barrios.findFirst({ where: eq(barrios.id, barrioId) });
    const creados = await db
      .select({ id: companerismos.id, tipo: companerismos.tipo, nombre: companerismos.nombre, activo: companerismos.activo, orden: companerismos.orden })
      .from(companerismos)
      .where(eq(companerismos.barrioId, barrioId))
      .orderBy(asc(companerismos.orden));
    return c.json(
      {
        barrio: {
          slug: barrio!.slug,
          nombre: barrio!.nombre,
          idioma: barrio!.idioma,
          zonaHoraria: barrio!.zonaHoraria,
          tokenMisioneros: barrio!.tokenMisioneros,
        },
        companerismos: creados,
      },
      201,
    );
  })

  .post("/barrios/:slug/admins", validar("param", paramsBarrio), validar("json", esquemaNuevoAdmin), async (c) => {
    if (!esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);
    const { db } = c.var;
    const { slug } = c.req.valid("param");
    const { email, cargo } = c.req.valid("json");

    const barrio = await db.select({ id: barrios.id }).from(barrios).where(eq(barrios.slug, slug)).get();
    const persona = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.email, email)).get();
    if (!barrio || !persona) return fallar(c, "NO_ENCONTRADO", 404);

    // Idempotente: si ya estaba asignado no se toca (ni el cargo).
    await db.insert(adminsBarrio).values({ userId: persona.id, barrioId: barrio.id, cargo }).onConflictDoNothing();
    const fila = await db
      .select({ cargo: adminsBarrio.cargo })
      .from(adminsBarrio)
      .where(and(eq(adminsBarrio.userId, persona.id), eq(adminsBarrio.barrioId, barrio.id)))
      .get();
    return c.json({ admin: { email: persona.email, cargo: fila?.cargo ?? null } });
  });
