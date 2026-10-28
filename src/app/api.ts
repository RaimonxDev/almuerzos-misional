import { hc } from "hono/client";
import type { AppType } from "@/worker";
import { CODIGOS_ERROR, type CodigoError, type RespuestaError } from "@/shared/errores";

/** Cliente tipado de la API: `api.api.barrios[":slug"].$get(...)`. */
export const api = hc<AppType>("/");

/** Error de la API con su código; la UI lo traduce con `t.errores[error.codigo]`. */
export class ErrorApi extends Error {
  constructor(
    readonly codigo: CodigoError,
    readonly status: number,
    readonly campos: string[] = [],
  ) {
    super(codigo);
  }
}

type Respuesta = { ok: boolean; status: number; json(): Promise<unknown> };
/**
 * JSON de las respuestas exitosas: todo lo que no tenga la forma `RespuestaError`.
 * (No sirve filtrar por `ok`: con `c.json()` sin status, Hono lo tipa como `boolean`.)
 */
type Exito<R> = R extends { json(): Promise<infer J> } ? (J extends { error: unknown } ? never : J) : never;

/**
 * Espera la respuesta y devuelve el JSON del caso exitoso, o lanza `ErrorApi`.
 * Sin conexión → `ERROR_INTERNO` con status 0.
 */
export async function datos<R extends Respuesta>(peticion: Promise<R>): Promise<Exito<R>> {
  let res: R;
  try {
    res = await peticion;
  } catch {
    throw new ErrorApi("ERROR_INTERNO", 0);
  }
  if (res.ok) return (await res.json()) as Exito<R>;

  const cuerpo = (await res.json().catch(() => null)) as Partial<RespuestaError> | null;
  const codigo = CODIGOS_ERROR.find((c) => c === cuerpo?.error) ?? "ERROR_INTERNO";
  throw new ErrorApi(codigo, res.status, cuerpo?.campos);
}

/** Para respuestas 204 sin cuerpo: solo los errores pasan por `datos()`. */
export async function sinCuerpo(peticion: Promise<Respuesta>): Promise<void> {
  const res = await peticion;
  if (!res.ok) await datos(Promise.resolve(res));
}

export const codigoDe = (error: unknown): CodigoError =>
  error instanceof ErrorApi ? error.codigo : "ERROR_INTERNO";
