import { createMiddleware } from "hono/factory";
import { crearDb, type Db } from "@/db";
import type { Barrio } from "@/db/schema";
import type { RolBarrio } from "@/shared/roles";

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
export type AppEnvBarrioAdmin = AppEnvAdmin & {
  Variables: {
    barrio: Barrio;
    /** Rol en ese barrio; `null` si es super admin y no tiene fila en `admins_barrio`. */
    rolBarrio: RolBarrio | null;
  };
};

/** Deja una instancia de Drizzle en `c.var.db` para cada request. */
export const conDb = createMiddleware<AppEnv>(async (c, next) => {
  c.set("db", crearDb(c.env.DB));
  await next();
});
