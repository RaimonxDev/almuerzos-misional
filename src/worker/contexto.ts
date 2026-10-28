import { createMiddleware } from "hono/factory";
import { crearDb, type Db } from "@/db";

export type AppEnv = {
  Bindings: Env;
  Variables: { db: Db };
};

/** Deja una instancia de Drizzle en `c.var.db` para cada request. */
export const conDb = createMiddleware<AppEnv>(async (c, next) => {
  c.set("db", crearDb(c.env.DB));
  await next();
});
