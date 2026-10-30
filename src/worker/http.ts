import type { Context, MiddlewareHandler, ValidationTargets } from "hono";
import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";
import type { CodigoError, RespuestaError } from "@/shared/errores";

export const fallar = (c: Context, error: CodigoError, status: ContentfulStatusCode) =>
  c.json<RespuestaError>({ error }, status);

/** zValidator que responde 400 `DATOS_INVALIDOS` con los campos que fallaron. */
export const validar = <T extends ZodType, Target extends keyof ValidationTargets>(target: Target, esquema: T) =>
  zValidator(target, esquema, (resultado, c) => {
    if (!resultado.success) {
      const campos = [...new Set(resultado.error.issues.map((i) => String(i.path[0] ?? "")))].filter(Boolean);
      return c.json<RespuestaError>({ error: "DATOS_INVALIDOS", campos }, 400);
    }
  });

/** D1 envuelve el error de SQLite (y Drizzle lo vuelve a envolver): se revisa toda la cadena de `cause`. */
export function esViolacionUnica(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (e.message.includes("UNIQUE constraint failed")) return true;
  }
  return false;
}

export const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(texto: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
}

/** 32 bytes aleatorios en hex: el token de edición que se queda en el teléfono de quien se anota. */
export function nuevoTokenEdicion(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export { zonaValida } from "@/shared/fechas";

export function leerBearer(c: Context): string | null {
  const valor = c.req.header("Authorization");
  return valor?.startsWith("Bearer ") ? valor.slice(7).trim() || null : null;
}

/**
 * Clave del límite por IP. IPv4 tal cual; IPv6 por su /64, que suele ser de un solo cliente y
 * dentro de la cual puede cambiar de dirección cuando quiera.
 */
export function claveDeIp(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [inicio, fin = ""] = ip.toLowerCase().split("::");
  const izquierda = inicio ? inicio.split(":") : [];
  const derecha = fin ? fin.split(":") : [];
  const grupos = ip.includes("::")
    ? [...izquierda, ...Array(8 - izquierda.length - derecha.length).fill("0"), ...derecha]
    : izquierda;
  return `${grupos.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/**
 * 429 `DEMASIADOS_INTENTOS` si la IP del cliente (`cf-connecting-ip`, que pone Cloudflare) pasó el
 * límite del binding. Sin ese header no se limita: en producción siempre viene.
 * `alcance` separa el contador (ej. por barrio), para que detrás del mismo CGNAT un abuso en un
 * lugar no bloquee a quien usa otro.
 */
export const limitarPorIp = (limitador: (env: Env) => RateLimit, alcance?: (c: Context) => string): MiddlewareHandler =>
  createMiddleware(async (c, next) => {
    const ip = c.req.header("cf-connecting-ip");
    const clave = ip && (alcance ? `${claveDeIp(ip)}|${alcance(c)}` : claveDeIp(ip));
    if (clave && !(await limitador(c.env).limit({ key: clave })).success) {
      return fallar(c, "DEMASIADOS_INTENTOS", 429);
    }
    await next();
  });
