import { Hono } from "hono";
import type { RespuestaError } from "@/shared/errores";
import { crearAuth } from "./auth";
import { conDb, type AppEnv } from "./contexto";
import { rutasAdmin } from "./rutas/admin";
import { rutasBarrios } from "./rutas/barrios";
import { rutasInscripciones } from "./rutas/inscripciones";
import { rutasMisioneros } from "./rutas/misioneros";

const app = new Hono<AppEnv>().basePath("/api");

app.use(conDb);

// Better Auth: login/logout/sesión y el plugin `admin` (sin registro público). Va fuera del tipo RPC.
app.on(["GET", "POST"], "/auth/*", (c) => crearAuth(c.env, c.var.db).handler(c.req.raw));

const rutas = app
  .get("/salud", (c) => c.json({ ok: true }))
  .route("/barrios", rutasBarrios)
  .route("/barrios", rutasMisioneros)
  .route("/inscripciones", rutasInscripciones)
  .route("/admin", rutasAdmin);

app.notFound((c) => c.json<RespuestaError>({ error: "NO_ENCONTRADO" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json<RespuestaError>({ error: "ERROR_INTERNO" }, 500);
});

/** Tipo para el cliente RPC del frontend: `hc<AppType>("/")`. */
export type AppType = typeof rutas;

export default app;
