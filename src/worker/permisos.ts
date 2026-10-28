import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { adminsBarrio, barrios } from "@/db/schema";
import { crearAuth } from "./auth";
import type { AppEnvAdmin, AppEnvBarrioAdmin, UsuarioAdmin } from "./contexto";
import { fallar } from "./http";

/** El rol del plugin `admin` puede venir con varios valores separados por coma. */
export const esSuperAdmin = (usuario: Pick<UsuarioAdmin, "role">) =>
  (usuario.role ?? "").split(",").includes("admin");

/** Sin sesión → 401 `NO_AUTORIZADO`. Con sesión deja el usuario en `c.var.usuario`. */
export const conSesion = createMiddleware<AppEnvAdmin>(async (c, next) => {
  const sesion = await crearAuth(c.env, c.var.db).api.getSession({ headers: c.req.raw.headers });
  if (!sesion) return fallar(c, "NO_AUTORIZADO", 401);
  const { id, email, name, role } = sesion.user;
  c.set("usuario", { id, email, name, role: role ?? null });
  await next();
});

/**
 * Para `/api/admin/barrios/:slug/*`: deja el barrio en `c.var.barrio`.
 * Quien no es super admin ni está en `admins_barrio` recibe 403 `SIN_PERMISO`, también si el barrio
 * no existe (no se revelan slugs). El super admin con un slug inexistente recibe 404.
 */
export const conBarrioAdmin = createMiddleware<AppEnvBarrioAdmin>(async (c, next) => {
  const { db, usuario } = c.var;
  const barrio = await db.query.barrios.findFirst({ where: eq(barrios.slug, c.req.param("slug") ?? "") });
  const superAdmin = esSuperAdmin(usuario);

  if (!barrio) return superAdmin ? fallar(c, "NO_ENCONTRADO", 404) : fallar(c, "SIN_PERMISO", 403);
  if (!superAdmin) {
    const asignado = await db.query.adminsBarrio.findFirst({
      where: and(eq(adminsBarrio.userId, usuario.id), eq(adminsBarrio.barrioId, barrio.id)),
    });
    if (!asignado) return fallar(c, "SIN_PERMISO", 403);
  }
  c.set("barrio", barrio);
  await next();
});
