import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearDb } from "@/db";
import { user, verification } from "@/db/auth-schema";
import { barrios } from "@/db/schema";
import { PASSWORD_PRUEBA, capturarCorreos, crearAdmin, iniciarSesion, pedir, sembrar } from "./datos";

beforeEach(async () => {
  await sembrar();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const pedirEnlace = (email: string, ip?: string) =>
  pedir("/api/auth/request-password-reset", {
    method: "POST",
    json: { email },
    headers: ip ? { "cf-connecting-ip": ip } : undefined,
  });

const restablecer = (token: string, newPassword: string) =>
  pedir("/api/auth/reset-password", { method: "POST", json: { token, newPassword } });

/** El correo sale en segundo plano (`waitUntil`): espera a que llegue. */
async function esperarCorreos(correos: ReturnType<typeof capturarCorreos>, cuantos = 1) {
  await vi.waitFor(() => expect(correos()).toHaveLength(cuantos));
  return correos();
}

const ENLACE = /http:\/\/localhost\/admin\/restablecer\?token=([A-Za-z0-9]+)/;

/** Pide el enlace para `email` y devuelve el token que llegó por correo. */
async function tokenPorCorreo(email: string) {
  const correos = capturarCorreos();
  expect((await pedirEnlace(email)).status).toBe(200);
  const [correo] = await esperarCorreos(correos);
  return correo.texto.match(ENLACE)![1];
}

describe("POST /api/auth/request-password-reset", () => {
  it("con un correo existente manda un correo con el enlace a /admin/restablecer", async () => {
    await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"] });
    const correos = capturarCorreos();

    const res = await pedirEnlace("a@ejemplo.cl");
    expect(res.status).toBe(200);

    const [correo] = await esperarCorreos(correos);
    expect(correo.para).toBe("a@ejemplo.cl");
    expect(correo.asunto).toBe("Restablece tu contraseña");
    expect(correo.texto).toMatch(ENLACE);
    expect(correo.texto).toContain("60 minutos");
  });

  it("con un correo inexistente responde lo mismo y no manda nada", async () => {
    await crearAdmin({ email: "a@ejemplo.cl" });
    const correos = capturarCorreos();

    const inexistente = await pedirEnlace("nadie@ejemplo.cl");
    const existente = await pedirEnlace("a@ejemplo.cl");
    expect(inexistente.status).toBe(existente.status);
    expect(await inexistente.json()).toEqual(await existente.json());

    // Solo el del correo que existe (el otro habría salido antes).
    const enviados = await esperarCorreos(correos);
    expect(enviados.map((c) => c.para)).toEqual(["a@ejemplo.cl"]);
  });

  it("el correo sale en el idioma del barrio que administra; sin barrio, en español", async () => {
    await crearDb(env.DB).update(barrios).set({ idioma: "pt" }).where(eq(barrios.id, "b2"));
    await crearAdmin({ email: "pt@ejemplo.cl", barrios: ["b2"] });
    await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
    const correos = capturarCorreos();

    await pedirEnlace("pt@ejemplo.cl");
    await esperarCorreos(correos, 1);
    await pedirEnlace("root@ejemplo.cl");
    const [pt, es] = await esperarCorreos(correos, 2);

    expect(pt.para).toBe("pt@ejemplo.cl");
    expect(pt.asunto).toBe("Redefina sua senha");
    expect(es.para).toBe("root@ejemplo.cl");
    expect(es.asunto).toBe("Restablece tu contraseña");
  });

  it("el token vence en una hora", async () => {
    await crearAdmin({ email: "a@ejemplo.cl" });
    const token = await tokenPorCorreo("a@ejemplo.cl");
    const [fila] = await crearDb(env.DB)
      .select()
      .from(verification)
      .where(eq(verification.identifier, `reset-password:${token}`));
    const minutos = (fila.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(58);
    expect(minutos).toBeLessThanOrEqual(60);
  });

  it("tras 3 pedidos por minuto desde la misma IP responde 429; otra IP sigue pudiendo", async () => {
    capturarCorreos();
    for (let i = 0; i < 3; i++) expect((await pedirEnlace("nadie@ejemplo.cl", "203.0.113.7")).status).toBe(200);
    expect((await pedirEnlace("nadie@ejemplo.cl", "203.0.113.7")).status).toBe(429);
    expect((await pedirEnlace("nadie@ejemplo.cl", "203.0.113.8")).status).toBe(200);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("con el token se entra con la contraseña nueva y no con la vieja", async () => {
    await crearAdmin({ email: "a@ejemplo.cl" });
    const token = await tokenPorCorreo("a@ejemplo.cl");

    expect((await restablecer(token, "mi-clave-nueva-1")).status).toBe(200);

    await expect(iniciarSesion("a@ejemplo.cl", PASSWORD_PRUEBA)).rejects.toThrow();
    expect(await iniciarSesion("a@ejemplo.cl", "mi-clave-nueva-1")).toContain("session_token=");
  });

  it("el token sirve una sola vez", async () => {
    await crearAdmin({ email: "a@ejemplo.cl" });
    const token = await tokenPorCorreo("a@ejemplo.cl");

    expect((await restablecer(token, "mi-clave-nueva-1")).status).toBe(200);
    const otraVez = await restablecer(token, "mi-clave-nueva-2");
    expect(otraVez.status).toBe(400);
    expect((await otraVez.json<any>()).code).toBe("INVALID_TOKEN");
    expect(await iniciarSesion("a@ejemplo.cl", "mi-clave-nueva-1")).toContain("session_token=");
  });

  it("un token vencido no sirve", async () => {
    await crearAdmin({ email: "a@ejemplo.cl" });
    const token = await tokenPorCorreo("a@ejemplo.cl");
    await crearDb(env.DB)
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(verification.identifier, `reset-password:${token}`));

    const res = await restablecer(token, "mi-clave-nueva-1");
    expect(res.status).toBe(400);
    expect((await res.json<any>()).code).toBe("INVALID_TOKEN");
    expect(await iniciarSesion("a@ejemplo.cl")).toContain("session_token=");
  });

  it("un token inventado no sirve", async () => {
    await crearAdmin({ email: "a@ejemplo.cl" });
    const res = await restablecer("inventado", "mi-clave-nueva-1");
    expect(res.status).toBe(400);
    expect((await res.json<any>()).code).toBe("INVALID_TOKEN");
  });

  it("apaga debeCambiarPassword y cierra las sesiones abiertas", async () => {
    const { id } = await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"] });
    const db = crearDb(env.DB);
    await db.update(user).set({ debeCambiarPassword: true }).where(eq(user.id, id));
    const vieja = await iniciarSesion("a@ejemplo.cl");
    const token = await tokenPorCorreo("a@ejemplo.cl");

    expect((await restablecer(token, "mi-clave-nueva-1")).status).toBe(200);

    expect((await pedir("/api/admin/yo", { cookie: vieja })).status).toBe(401);
    const nueva = await iniciarSesion("a@ejemplo.cl", "mi-clave-nueva-1");
    const yo = await (await pedir("/api/admin/yo", { cookie: nueva })).json<any>();
    expect(yo.usuario.debeCambiarPassword).toBe(false);
  });
});
