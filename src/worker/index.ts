import { Hono } from "hono";
import type { RespuestaError } from "@/shared/errores";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

const rutas = app.get("/salud", (c) => c.json({ ok: true }));

app.notFound((c) => c.json<RespuestaError>({ error: "NO_ENCONTRADO" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json<RespuestaError>({ error: "ERROR_INTERNO" }, 500);
});

/** Tipo para el cliente RPC del frontend: `hc<AppType>("/")`. */
export type AppType = typeof rutas;

export default app;
