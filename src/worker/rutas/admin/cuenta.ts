import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { adminsBarrio, barrios } from "@/db/schema";
import type { RolBarrio } from "@/shared/roles";
import type { AppEnvAdmin } from "../../contexto";
import { fallar, origenDe, validar } from "../../http";
import { esSuperAdmin } from "../../permisos";
import { crearBarrio, esquemaNuevoBarrio } from "../../barrios";

/** Cuenta del admin y crear barrios (solo super admin). Los admins de un barrio están en `equipo.ts`. */
export const rutasCuenta = new Hono<AppEnvAdmin>()
  .get("/yo", async (c) => {
    const { db, usuario } = c.var;
    const superAdmin = esSuperAdmin(usuario);
    const lista = superAdmin
      ? await db
          .select({ slug: barrios.slug, nombre: barrios.nombre })
          .from(barrios)
          .orderBy(asc(barrios.nombre))
          .then((filas) =>
            filas.map((f) => ({ ...f, cargo: null as string | null, rol: null as RolBarrio | null })),
          )
      : await db
          .select({ slug: barrios.slug, nombre: barrios.nombre, cargo: adminsBarrio.cargo, rol: adminsBarrio.rol })
          .from(adminsBarrio)
          .innerJoin(barrios, eq(barrios.id, adminsBarrio.barrioId))
          .where(eq(adminsBarrio.userId, usuario.id))
          .orderBy(asc(barrios.nombre));
    return c.json({
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.name,
        superAdmin,
        debeCambiarPassword: usuario.debeCambiarPassword,
      },
      barrios: lista,
    });
  })

  .post("/barrios", validar("json", esquemaNuevoBarrio), async (c) => {
    if (!esSuperAdmin(c.var.usuario)) return fallar(c, "SIN_PERMISO", 403);
    const creado = await crearBarrio(c.var.db, c.env, origenDe(c.req.url), c.req.valid("json"));
    if (!creado) return fallar(c, "SLUG_EXISTENTE", 409);
    const { barrioId: _, ...respuesta } = creado;
    return c.json(respuesta, 201);
  });
