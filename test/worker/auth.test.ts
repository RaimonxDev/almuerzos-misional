import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { user } from "@/db/auth-schema";
import { hashPassword, verificarPassword } from "@/shared/password";
import { PASSWORD_PRUEBA, crearAdmin, iniciarSesion, pedir, sembrar } from "./datos";
import { crearDb } from "@/db";

beforeEach(async () => {
  await sembrar();
});

const contarUsuarios = async () => (await crearDb(env.DB).select().from(user)).length;

describe("ruta protegida", () => {
  it("sin sesión → 401 NO_AUTORIZADO", async () => {
    const res = await pedir("/api/admin/yo");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "NO_AUTORIZADO" });
  });

  it("con cookie inventada → 401", async () => {
    const res = await pedir("/api/admin/yo", { cookie: "better-auth.session_token=falsa.firma" });
    expect(res.status).toBe(401);
  });

  it("con sesión válida → 200", async () => {
    await crearAdmin({ email: "presidenta@ejemplo.cl", barrios: ["b1"] });
    const cookie = await iniciarSesion("presidenta@ejemplo.cl");
    const res = await pedir("/api/admin/yo", { cookie });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).usuario.email).toBe("presidenta@ejemplo.cl");
  });
});

describe("login", () => {
  it("email y contraseña correctos entregan la cookie de sesión", async () => {
    await crearAdmin({ email: "a@ejemplo.cl" });
    const res = await pedir("/api/auth/sign-in/email", { method: "POST", json: { email: "a@ejemplo.cl", password: PASSWORD_PRUEBA } });
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().join(";")).toContain("session_token=");
  });

  it("contraseña incorrecta no da sesión", async () => {
    await crearAdmin({ email: "a@ejemplo.cl" });
    const res = await pedir("/api/auth/sign-in/email", { method: "POST", json: { email: "a@ejemplo.cl", password: "otra-clave-123" } });
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("un correo que no existe tampoco", async () => {
    const res = await pedir("/api/auth/sign-in/email", { method: "POST", json: { email: "nadie@ejemplo.cl", password: PASSWORD_PRUEBA } });
    expect(res.status).toBe(401);
  });
});

describe("sin registro público", () => {
  it("POST /api/auth/sign-up/email no crea usuarios", async () => {
    const antes = await contarUsuarios();
    const res = await pedir("/api/auth/sign-up/email", {
      method: "POST",
      json: { email: "intruso@ejemplo.cl", password: "clave-larga-123", name: "Intruso" },
    });
    expect(res.ok).toBe(false);
    expect(await contarUsuarios()).toBe(antes);
  });

  it("un admin de barrio tampoco puede crear usuarios con el plugin admin", async () => {
    await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"] });
    const cookie = await iniciarSesion("a@ejemplo.cl");
    const antes = await contarUsuarios();
    const res = await pedir("/api/auth/admin/create-user", {
      method: "POST",
      cookie,
      json: { email: "otro@ejemplo.cl", password: "clave-larga-123", name: "Otro", role: "admin" },
    });
    expect(res.ok).toBe(false);
    expect(await contarUsuarios()).toBe(antes);
  });

  it("el super admin sí crea cuentas con el plugin admin", async () => {
    await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
    const cookie = await iniciarSesion("root@ejemplo.cl");
    const res = await pedir("/api/auth/admin/create-user", {
      method: "POST",
      cookie,
      json: { email: "nueva@ejemplo.cl", password: "clave-larga-123", name: "Nueva", role: "user" },
    });
    expect(res.status).toBe(200);
    // y la nueva puede entrar con la contraseña que le pusieron
    expect(await iniciarSesion("nueva@ejemplo.cl", "clave-larga-123")).toContain("session_token=");
  });
});

describe("hash PBKDF2", () => {
  it("verifica la contraseña correcta y rechaza la incorrecta", async () => {
    const hash = await hashPassword("secreta-123");
    expect(hash).toMatch(/^pbkdf2\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verificarPassword({ hash, password: "secreta-123" })).toBe(true);
    expect(await verificarPassword({ hash, password: "secreta-124" })).toBe(false);
    expect(await verificarPassword({ hash: "scrypt-otra-cosa", password: "x" })).toBe(false);
  });
});
