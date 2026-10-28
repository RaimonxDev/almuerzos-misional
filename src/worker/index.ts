import { Hono } from "hono";
import type { RespuestaError } from "@/shared/errores";
import { conDb, type AppEnv } from "./contexto";
import { rutasBarrios } from "./rutas/barrios";
import { rutasInscripciones } from "./rutas/inscripciones";

const app = new Hono<AppEnv>().basePath("/api");

app.use(conDb);

const rutas = app
  .get("/salud", (c) => c.json({ ok: true }))
  .route("/barrios", rutasBarrios)
  .route("/inscripciones", rutasInscripciones);

app.notFound((c) => c.json<RespuestaError>({ error: "NO_ENCONTRADO" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json<RespuestaError>({ error: "ERROR_INTERNO" }, 500);
});

/** Tipo para el cliente RPC del frontend: `hc<AppType>("/")`. */
export type AppType = typeof rutas;

export default app;
