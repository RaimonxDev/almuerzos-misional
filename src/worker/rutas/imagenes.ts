import { Hono } from "hono";
import { fallar } from "../http";
import type { AppEnv } from "../contexto";

/**
 * Imágenes del mes, públicas: la clave lleva un uuid impredecible y solo se conoce desde el panel y
 * desde los calendarios. La clave cambia al reemplazar la imagen, por eso la caché es inmutable.
 */
export const rutasImagenes = new Hono<AppEnv>().get("/*", async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/api\/imagenes\//, ""));
  if (!key.startsWith("meses/") || key.includes("..")) return fallar(c, "NO_ENCONTRADO", 404);

  const objeto = await c.env.IMAGENES.get(key);
  if (!objeto) return fallar(c, "NO_ENCONTRADO", 404);

  const headers = new Headers({
    "Content-Type": objeto.httpMetadata?.contentType ?? "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: objeto.httpEtag,
    "X-Content-Type-Options": "nosniff",
  });
  if (c.req.header("If-None-Match") === objeto.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(objeto.body, { headers });
});
