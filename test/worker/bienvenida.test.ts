import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearDb } from "@/db";
import { user, verification } from "@/db/auth-schema";
import { capturarCorreos, crearAdmin, iniciarSesion, pedir, sembrar } from "./datos";

beforeEach(async () => {
  await sembrar();
});

/** El Worker corre en el mismo isolate y recibe este mismo `env`: se le puede poner una key. */
const fijarResendKey = (key: string) => {
  (env as unknown as { RESEND_API_KEY: string }).RESEND_API_KEY = key;
};

afterEach(() => {
  vi.restoreAllMocks();
  fijarResendKey("");
});

const BARRIO_NUEVO = {
  slug: "oriente",
  nombre: "Barrio Oriente",
  idioma: "pt",
  companerismos: [{ tipo: "elderes", nombre: "Élderes" }],
};
const PRESIDENTA = { email: "nueva@ejemplo.cl", nombre: "Hna. Rojas" };

const ENLACE = /http:\/\/localhost\/admin\/restablecer\?token=([A-Za-z0-9]+)/;

interface Enviado {
  para: string;
  asunto: string;
  texto: string;
}

/**
 * Como en producción: con `RESEND_API_KEY` y `fetch` a Resend simulado (`status` = su respuesta).
 * Devuelve los correos que recibió Resend.
 */
function conResend(status = 200) {
  fijarResendKey("re_test_123");
  const fetchSimulado = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json(status === 200 ? { id: "x" } : { message: "caído" }, { status }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  return (): Enviado[] =>
    fetchSimulado.mock.calls
      .filter(([url]) => String(url) === "https://api.resend.com/emails")
      .map(([, init]) => {
        const body = JSON.parse(String(init?.body));
        return { para: body.to[0], asunto: body.subject, texto: body.text };
      });
}

const comoSuperAdmin = async () => {
  await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
  return iniciarSesion("root@ejemplo.cl");
};

const crearBarrio = (cookie: string, presidenta: object = PRESIDENTA) =>
  pedir("/api/admin/barrios", { method: "POST", cookie, json: { ...BARRIO_NUEVO, presidenta } });

const restablecer = (token: string, newPassword: string) =>
  pedir("/api/auth/reset-password", { method: "POST", json: { token, newPassword } });

describe("POST /api/admin/barrios: bienvenida a la presidenta", () => {
  it("presidenta nueva: le llega la bienvenida en el idioma del barrio, con enlace de 7 días y el panel", async () => {
    const root = await comoSuperAdmin();
    const enviados = conResend();

    const res = await crearBarrio(root);
    expect(res.status).toBe(201);
    const { presidenta } = await res.json<any>();
    expect(presidenta).toMatchObject({ email: "nueva@ejemplo.cl", cuentaNueva: true, correoEnviado: true, passwordTemporal: null });

    const [correo] = enviados();
    expect(enviados()).toHaveLength(1);
    expect(correo.para).toBe("nueva@ejemplo.cl");
    expect(correo.asunto).toBe("Boas-vindas ao Almoço Missionário: Barrio Oriente");
    expect(correo.texto).toContain("Hna. Rojas");
    expect(correo.texto).toContain("http://localhost/admin/oriente");
    expect(correo.texto).toContain("7 dias");
    const token = correo.texto.match(ENLACE)![1];

    const [fila] = await crearDb(env.DB).select().from(verification).where(eq(verification.identifier, `reset-password:${token}`));
    const dias = (fila.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(6.9);
    expect(dias).toBeLessThanOrEqual(7);
  });

  it("el enlace de la bienvenida sirve para elegir la contraseña y entrar sin pasar por /admin/cuenta", async () => {
    const root = await comoSuperAdmin();
    const enviados = conResend();
    await crearBarrio(root);
    const token = enviados()[0].texto.match(ENLACE)![1];

    expect((await restablecer(token, "mi-clave-propia-1")).status).toBe(200);

    const suya = await iniciarSesion("nueva@ejemplo.cl", "mi-clave-propia-1");
    const yo = await (await pedir("/api/admin/yo", { cookie: suya })).json<any>();
    expect(yo.usuario.debeCambiarPassword).toBe(false);
    expect(yo.barrios.map((b: any) => b.slug)).toEqual(["oriente"]);
  });

  it("si Resend falla el barrio igual se crea, correoEnviado es falso y se entrega la contraseña temporal", async () => {
    const root = await comoSuperAdmin();
    const enviados = conResend(500);

    const res = await crearBarrio(root);
    expect(res.status).toBe(201);
    const { barrio, presidenta } = await res.json<any>();
    expect(barrio.slug).toBe("oriente");
    expect(enviados()).toHaveLength(1);
    expect(presidenta.correoEnviado).toBe(false);
    expect(presidenta.passwordTemporal).toMatch(/^.{12,}$/);

    // "Copiar datos" sirve de respaldo: con la temporal entra.
    const suya = await iniciarSesion("nueva@ejemplo.cl", presidenta.passwordTemporal);
    expect((await pedir("/api/admin/barrios/oriente", { cookie: suya })).status).toBe(200);
  });

  it("sin RESEND_API_KEY (desarrollo) el correo va a la consola y correoEnviado es falso, con la contraseña temporal", async () => {
    const root = await comoSuperAdmin();
    const correos = capturarCorreos();

    const { presidenta } = await (await crearBarrio(root)).json<any>();
    expect(presidenta.correoEnviado).toBe(false);
    expect(presidenta.passwordTemporal).toMatch(/^.{12,}$/);
    expect(correos().map((c) => c.asunto)).toEqual(["Boas-vindas ao Almoço Missionário: Barrio Oriente"]);
    // El enlace de la consola también funciona.
    const token = correos()[0].texto.match(ENLACE)![1];
    expect((await restablecer(token, "mi-clave-propia-1")).status).toBe(200);
  });

  it("presidenta con cuenta: le llega el aviso de asignación con el enlace al panel, sin tocar su contraseña", async () => {
    await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"] });
    const root = await comoSuperAdmin();
    const enviados = conResend();

    const res = await crearBarrio(root, { email: "a@ejemplo.cl", nombre: "Otro nombre" });
    const { presidenta } = await res.json<any>();
    expect(presidenta).toMatchObject({ cuentaNueva: false, correoEnviado: true, passwordTemporal: null });

    expect(enviados()).toHaveLength(1);
    const [correo] = enviados();
    expect(correo.para).toBe("a@ejemplo.cl");
    expect(correo.asunto).toBe("Agora você administra Barrio Oriente");
    expect(correo.texto).toContain("http://localhost/admin/oriente");
    expect(correo.texto).not.toMatch(ENLACE);
    expect(await iniciarSesion("a@ejemplo.cl")).toContain("session_token=");
  });

  it("sin presidenta no se manda nada", async () => {
    const root = await comoSuperAdmin();
    const enviados = conResend();
    const res = await pedir("/api/admin/barrios", { method: "POST", cookie: root, json: BARRIO_NUEVO });
    expect(res.status).toBe(201);
    expect(enviados()).toEqual([]);
  });
});

describe("POST /api/admin/barrios/:slug/admins", () => {
  it("asignar a alguien nuevo en el barrio le manda el aviso; repetirlo no", async () => {
    await crearAdmin({ email: "pres@ejemplo.cl" });
    const root = await comoSuperAdmin();
    const enviados = conResend();
    const asignar = () => pedir("/api/admin/barrios/otro/admins", { method: "POST", cookie: root, json: { email: "pres@ejemplo.cl" } });

    expect((await (await asignar()).json<any>()).correoEnviado).toBe(true);
    expect(enviados().map((c) => [c.para, c.asunto])).toEqual([["pres@ejemplo.cl", "Ahora administras Otro Barrio"]]);
    expect(enviados()[0].texto).toContain("http://localhost/admin/otro");

    expect((await (await asignar()).json<any>()).correoEnviado).toBe(false);
    expect(enviados()).toHaveLength(1);
  });
});

describe("GET /api/admin/barrios/:slug/admins", () => {
  it("el super admin ve los admins del barrio y si les falta elegir su contraseña", async () => {
    const { id } = await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"] });
    await crearAdmin({ email: "otra@ejemplo.cl", barrios: ["b2"] });
    await crearDb(env.DB).update(user).set({ debeCambiarPassword: true }).where(eq(user.id, id));
    const root = await comoSuperAdmin();

    const res = await pedir("/api/admin/barrios/prueba/admins", { cookie: root });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).admins).toEqual([{ id, email: "a@ejemplo.cl", nombre: "a", cargo: null, debeCambiarPassword: true }]);
  });

  it("un admin del barrio no puede (403); un barrio inexistente da 404", async () => {
    await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"] });
    const cookie = await iniciarSesion("a@ejemplo.cl");
    const res = await pedir("/api/admin/barrios/prueba/admins", { cookie });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "SIN_PERMISO" });

    const root = await comoSuperAdmin();
    expect((await pedir("/api/admin/barrios/no-existe/admins", { cookie: root })).status).toBe(404);
  });
});

describe("POST /api/admin/barrios/:slug/admins/:userId/invitacion", () => {
  it("si aún no eligió contraseña, reenvía la bienvenida con un enlace nuevo que funciona", async () => {
    const root = await comoSuperAdmin();
    const enviados = conResend();
    await crearBarrio(root);
    const nueva = await crearDb(env.DB).select().from(user).where(eq(user.email, "nueva@ejemplo.cl")).get();
    const primero = enviados()[0].texto.match(ENLACE)![1];

    const res = await pedir(`/api/admin/barrios/oriente/admins/${nueva!.id}/invitacion`, { method: "POST", cookie: root });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ correoEnviado: true });

    expect(enviados()).toHaveLength(2);
    const segundo = enviados()[1];
    expect(segundo.para).toBe("nueva@ejemplo.cl");
    expect(segundo.asunto).toBe("Boas-vindas ao Almoço Missionário: Barrio Oriente");
    const token = segundo.texto.match(ENLACE)![1];
    expect(token).not.toBe(primero);
    expect((await restablecer(token, "mi-clave-propia-1")).status).toBe(200);
    expect(await iniciarSesion("nueva@ejemplo.cl", "mi-clave-propia-1")).toContain("session_token=");
  });

  it("si ya eligió su contraseña, reenvía el aviso de asignación", async () => {
    const { id } = await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"] });
    const root = await comoSuperAdmin();
    const enviados = conResend();

    const res = await pedir(`/api/admin/barrios/prueba/admins/${id}/invitacion`, { method: "POST", cookie: root });
    expect(await res.json()).toEqual({ correoEnviado: true });
    expect(enviados().map((c) => c.asunto)).toEqual(["Ahora administras Barrio Prueba"]);
  });

  it("si Resend falla responde correoEnviado falso", async () => {
    const { id } = await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"] });
    const root = await comoSuperAdmin();
    conResend(500);
    const res = await pedir(`/api/admin/barrios/prueba/admins/${id}/invitacion`, { method: "POST", cookie: root });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ correoEnviado: false });
  });

  it("alguien que no administra ese barrio → 404; un admin normal → 403", async () => {
    const { id } = await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"] });
    const root = await comoSuperAdmin();
    conResend();
    expect((await pedir(`/api/admin/barrios/otro/admins/${id}/invitacion`, { method: "POST", cookie: root })).status).toBe(404);

    const cookie = await iniciarSesion("a@ejemplo.cl");
    const res = await pedir(`/api/admin/barrios/prueba/admins/${id}/invitacion`, { method: "POST", cookie });
    expect(res.status).toBe(403);
  });
});

describe("enlaces pendientes", () => {
  it("elegir la contraseña con un enlace invalida los demás (reenvíos de la bienvenida)", async () => {
    const root = await comoSuperAdmin();
    const enviados = conResend();
    await crearBarrio(root);
    const nueva = await crearDb(env.DB).select().from(user).where(eq(user.email, "nueva@ejemplo.cl")).get();
    await pedir(`/api/admin/barrios/oriente/admins/${nueva!.id}/invitacion`, { method: "POST", cookie: root });
    const [primero, segundo] = enviados().map((c) => c.texto.match(ENLACE)![1]);

    expect((await restablecer(segundo, "mi-clave-propia-1")).status).toBe(200);
    expect((await restablecer(primero, "otra-clave-ajena-2")).status).toBe(400);
    const restantes = await crearDb(env.DB).select().from(verification).where(eq(verification.value, nueva!.id));
    expect(restantes).toEqual([]);
  });

  it("si no se puede crear el token de la bienvenida, el barrio igual se crea con la contraseña temporal", async () => {
    const root = await comoSuperAdmin();
    conResend();
    await env.DB.exec("ALTER TABLE verification RENAME TO verification_aparte");
    try {
      const res = await crearBarrio(root);
      expect(res.status).toBe(201);
      const { presidenta } = await res.json<any>();
      expect(presidenta.correoEnviado).toBe(false);
      expect(presidenta.passwordTemporal).toMatch(/^.{12,}$/);
    } finally {
      await env.DB.exec("ALTER TABLE verification_aparte RENAME TO verification");
    }
  });
});

describe("PATCH /api/admin/barrios/:slug/admins/:userId (corregir el correo)", () => {
  const corregir = (cookie: string, userId: string, email: string) =>
    pedir(`/api/admin/barrios/oriente/admins/${userId}`, { method: "PATCH", cookie, json: { email } });

  it("cambia el correo, invalida el enlace mandado al equivocado y manda la bienvenida al nuevo", async () => {
    const root = await comoSuperAdmin();
    const enviados = conResend();
    await crearBarrio(root, { email: "nueva@gmial.com", nombre: "Hna. Rojas" });
    const nueva = await crearDb(env.DB).select().from(user).where(eq(user.email, "nueva@gmial.com")).get();
    const viejo = enviados()[0].texto.match(ENLACE)![1];

    const res = await corregir(root, nueva!.id, " Nueva@Gmail.com ");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ admin: { id: nueva!.id, email: "nueva@gmail.com" }, correoEnviado: true });

    const segundo = enviados()[1];
    expect(segundo.para).toBe("nueva@gmail.com");
    expect((await restablecer(viejo, "otra-clave-ajena-2")).status).toBe(400);
    expect((await restablecer(segundo.texto.match(ENLACE)![1], "mi-clave-propia-1")).status).toBe(200);
    expect(await iniciarSesion("nueva@gmail.com", "mi-clave-propia-1")).toContain("session_token=");
  });

  it("un correo que ya tiene cuenta → 409; si ya eligió su contraseña → 422; un admin normal → 403", async () => {
    const root = await comoSuperAdmin();
    const enviados = conResend();
    await crearBarrio(root);
    const nueva = await crearDb(env.DB).select().from(user).where(eq(user.email, "nueva@ejemplo.cl")).get();

    const repetido = await corregir(root, nueva!.id, "root@ejemplo.cl");
    expect(repetido.status).toBe(409);
    expect(await repetido.json()).toEqual({ error: "CORREO_EXISTENTE" });

    await restablecer(enviados()[0].texto.match(ENLACE)![1], "mi-clave-propia-1");
    const enUso = await corregir(root, nueva!.id, "otra@ejemplo.cl");
    expect(enUso.status).toBe(422);
    expect(await enUso.json()).toEqual({ error: "CUENTA_EN_USO" });

    const suya = await iniciarSesion("nueva@ejemplo.cl", "mi-clave-propia-1");
    expect((await corregir(suya, nueva!.id, "otra@ejemplo.cl")).status).toBe(403);
  });
});

describe("POST /api/admin/barrios/:slug/admins/:userId/password-temporal", () => {
  const nuevaTemporal = (cookie: string, userId: string) =>
    pedir(`/api/admin/barrios/oriente/admins/${userId}/password-temporal`, { method: "POST", cookie });

  it("da otra contraseña temporal: con ella entra (y debe cambiarla), con la anterior no", async () => {
    const root = await comoSuperAdmin();
    conResend(500);
    const { presidenta } = await (await crearBarrio(root)).json<any>();
    const nueva = await crearDb(env.DB).select().from(user).where(eq(user.email, "nueva@ejemplo.cl")).get();
    const anterior = await iniciarSesion("nueva@ejemplo.cl", presidenta.passwordTemporal);

    const res = await nuevaTemporal(root, nueva!.id);
    expect(res.status).toBe(200);
    const { email, passwordTemporal } = await res.json<any>();
    expect(email).toBe("nueva@ejemplo.cl");
    expect(passwordTemporal).not.toBe(presidenta.passwordTemporal);

    // La sesión abierta con la anterior se cerró.
    expect((await pedir("/api/admin/yo", { cookie: anterior })).status).toBe(401);
    const login = await pedir("/api/auth/sign-in/email", {
      method: "POST",
      json: { email: "nueva@ejemplo.cl", password: presidenta.passwordTemporal },
    });
    expect(login.status).toBe(401);
    const suya = await iniciarSesion("nueva@ejemplo.cl", passwordTemporal);
    const yo = await (await pedir("/api/admin/yo", { cookie: suya })).json<any>();
    expect(yo.usuario.debeCambiarPassword).toBe(true);
  });

  it("si ya eligió su contraseña → 422 y no se toca", async () => {
    const { id } = await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"] });
    const root = await comoSuperAdmin();
    const res = await pedir(`/api/admin/barrios/prueba/admins/${id}/password-temporal`, { method: "POST", cookie: root });
    expect(res.status).toBe(422);
    expect(await iniciarSesion("a@ejemplo.cl")).toContain("session_token=");
  });
});
