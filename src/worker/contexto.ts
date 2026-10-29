import { createMiddleware } from "hono/factory";
import { crearDb, type Db } from "@/db";
import type { Barrio } from "@/db/schema";

export type AppEnv = {
  Bindings: Env;
  Variables: { db: Db };
};

/** Usuario con sesión válida (Better Auth). `role === "admin"` es el super admin. */
export type UsuarioAdmin = {
  id: string;
  email: string;
  name: string;
  role: string | null;
  /** Entró con una contraseña temporal y todavía no eligió la suya. */
  debeCambiarPassword: boolean;
};

/** Rutas bajo `/api/admin`: detrás de `conSesion`. */
export type AppEnvAdmin = AppEnv & { Variables: { usuario: UsuarioAdmin } };

/** Rutas bajo `/api/admin/barrios/:slug/*`: detrás de `conSesion` y `conBarrioAdmin`. */
export type AppEnvBarrioAdmin = AppEnvAdmin & { Variables: { barrio: Barrio } };

/** Deja una instancia de Drizzle en `c.var.db` para cada request. */
export const conDb = createMiddleware<AppEnv>(async (c, next) => {
  c.set("db", crearDb(c.env.DB));
  await next();
});
