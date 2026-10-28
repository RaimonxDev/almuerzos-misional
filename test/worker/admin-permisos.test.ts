import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { crearDb } from "@/db";
import { adminsBarrio, barrios, companerismos } from "@/db/schema";
import { crearAdmin, iniciarSesion, pedir, sembrar } from "./datos";

beforeEach(async () => {
  await sembrar();
});

const como = async (email: string, opciones: Parameters<typeof crearAdmin>[0] extends infer T ? Omit<T & object, "email"> : never) => {
  await crearAdmin({ email, ...opciones });
  return iniciarSesion(email);
};

const BARRIO_NUEVO = {
  slug: "oriente",
  nombre: "Barrio Oriente",
  companerismos: [
    { tipo: "elderes", nombre: "Élderes" },
    { tipo: "hermanas", nombre: "Hermanas misioneras" },
  ],
};

describe("GET /api/admin/yo", () => {
  it("admin de un barrio: lista solo los suyos, con cargo", async () => {
    const db = crearDb(env.DB);
    const cookie = await como("a@ejemplo.cl", { barrios: ["b1"] });
    await db.update(adminsBarrio).set({ cargo: "Presidenta" }).where(eq(adminsBarrio.barrioId, "b1"));
    const body = await (await pedir("/api/admin/yo", { cookie })).json<any>();
    expect(body.usuario).toMatchObject({ email: "a@ejemplo.cl", superAdmin: false });
    expect(body.barrios).toEqual([{ slug: "prueba", nombre: "Barrio Prueba", cargo: "Presidenta" }]);
  });

  it("admin sin barrios: lista vacía", async () => {
    const cookie = await como("sin@ejemplo.cl", {});
    const res = await pedir("/api/admin/yo", { cookie });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).barrios).toEqual([]);
  });

  it("super admin: ve todos los barrios", async () => {
    const cookie = await como("root@ejemplo.cl", { superAdmin: true });
    const body = await (await pedir("/api/admin/yo", { cookie })).json<any>();
    expect(body.usuario.superAdmin).toBe(true);
    expect(body.barrios.map((b: any) => b.slug).sort()).toEqual(["otro", "prueba"]);
  });
});

describe("conBarrioAdmin (todo bajo /api/admin/barrios/:slug/*)", () => {
  it("admin de `prueba` operando `otro` → 403 SIN_PERMISO", async () => {
    const cookie = await como("a@ejemplo.cl", { barrios: ["b1"] });
    const res = await pedir("/api/admin/barrios/otro/lo-que-sea", { cookie });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "SIN_PERMISO" });
  });

  it("admin de `prueba` en `prueba` pasa el permiso (404 porque la ruta la llenan otros issues)", async () => {
    const cookie = await como("a@ejemplo.cl", { barrios: ["b1"] });
    expect((await pedir("/api/admin/barrios/prueba/lo-que-sea", { cookie })).status).toBe(404);
  });

  it("un barrio inexistente da 403 a un admin (no revela slugs) y 404 al super admin", async () => {
    const admin = await como("a@ejemplo.cl", { barrios: ["b1"] });
    expect((await pedir("/api/admin/barrios/no-existe/x", { cookie: admin })).status).toBe(403);
    const root = await como("root@ejemplo.cl", { superAdmin: true });
    const res = await pedir("/api/admin/barrios/no-existe/x", { cookie: root });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NO_ENCONTRADO" });
  });

  it("el super admin opera cualquier barrio sin estar asignado", async () => {
    const root = await como("root@ejemplo.cl", { superAdmin: true });
    expect((await pedir("/api/admin/barrios/otro/x", { cookie: root })).status).toBe(404);
  });

  it("sin sesión → 401", async () => {
    expect((await pedir("/api/admin/barrios/prueba/x")).status).toBe(401);
  });
});

describe("POST /api/admin/barrios", () => {
  it("solo el super admin: un admin normal recibe 403", async () => {
    const cookie = await como("a@ejemplo.cl", { barrios: ["b1"] });
    const res = await pedir("/api/admin/barrios", { method: "POST", cookie, json: BARRIO_NUEVO });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "SIN_PERMISO" });
  });

  it("crea el barrio con sus compañerismos", async () => {
    const cookie = await como("root@ejemplo.cl", { superAdmin: true });
    const res = await pedir("/api/admin/barrios", { method: "POST", cookie, json: { ...BARRIO_NUEVO, idioma: "pt", zonaHoraria: "America/Sao_Paulo" } });
    expect(res.status).toBe(201);
    const body = await res.json<any>();
    expect(body.barrio).toMatchObject({ slug: "oriente", nombre: "Barrio Oriente", idioma: "pt", zonaHoraria: "America/Sao_Paulo" });
    expect(body.barrio.tokenMisioneros).toHaveLength(64);
    expect(body.companerismos.map((c: any) => [c.nombre, c.orden, c.activo])).toEqual([
      ["Élderes", 0, true],
      ["Hermanas misioneras", 1, true],
    ]);

    const db = crearDb(env.DB);
    const barrio = await db.query.barrios.findFirst({ where: eq(barrios.slug, "oriente") });
    const filas = await db.select().from(companerismos).where(eq(companerismos.barrioId, barrio!.id));
    expect(filas).toHaveLength(2);
  });

  it("idioma y zona por defecto cuando no se mandan", async () => {
    const cookie = await como("root@ejemplo.cl", { superAdmin: true });
    const body = await (await pedir("/api/admin/barrios", { method: "POST", cookie, json: BARRIO_NUEVO })).json<any>();
    expect(body.barrio).toMatchObject({ idioma: "es", zonaHoraria: "America/Santiago" });
  });

  it("slug duplicado → 409 SLUG_EXISTENTE y no crea nada", async () => {
    const cookie = await como("root@ejemplo.cl", { superAdmin: true });
    const res = await pedir("/api/admin/barrios", { method: "POST", cookie, json: { ...BARRIO_NUEVO, slug: "prueba" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "SLUG_EXISTENTE" });
    expect(await crearDb(env.DB).select().from(barrios)).toHaveLength(2);
  });

  it.each([["Mayúsculas"], ["con espacio"], ["admin"], ["api"], ["nuevo-barrio"], ["-guion"], ["x"]])("slug inválido %s → 400", async (slug) => {
    const cookie = await como("root@ejemplo.cl", { superAdmin: true });
    const res = await pedir("/api/admin/barrios", { method: "POST", cookie, json: { ...BARRIO_NUEVO, slug } });
    expect(res.status).toBe(400);
    expect((await res.json<any>()).campos).toEqual(["slug"]);
  });

  it("zona horaria inválida o sin compañerismos → 400", async () => {
    const cookie = await como("root@ejemplo.cl", { superAdmin: true });
    const zona = await pedir("/api/admin/barrios", { method: "POST", cookie, json: { ...BARRIO_NUEVO, zonaHoraria: "Marte/Olimpo" } });
    expect((await zona.json<any>()).campos).toEqual(["zonaHoraria"]);
    const sin = await pedir("/api/admin/barrios", { method: "POST", cookie, json: { ...BARRIO_NUEVO, companerismos: [] } });
    expect(sin.status).toBe(400);
  });
});

describe("POST /api/admin/barrios/:slug/admins", () => {
  it("asigna un usuario existente por email y ya puede operar el barrio", async () => {
    const root = await como("root@ejemplo.cl", { superAdmin: true });
    const presidenta = await como("pres@ejemplo.cl", {});
    const res = await pedir("/api/admin/barrios/otro/admins", {
      method: "POST",
      cookie: root,
      json: { email: "Pres@Ejemplo.cl", cargo: "Presidenta" },
    });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).admin).toEqual({ email: "pres@ejemplo.cl", cargo: "Presidenta" });

    const yo = await (await pedir("/api/admin/yo", { cookie: presidenta })).json<any>();
    expect(yo.barrios).toEqual([{ slug: "otro", nombre: "Otro Barrio", cargo: "Presidenta" }]);
    expect((await pedir("/api/admin/barrios/otro/x", { cookie: presidenta })).status).toBe(404); // pasó el permiso
  });

  it("es idempotente", async () => {
    const root = await como("root@ejemplo.cl", { superAdmin: true });
    await crearAdmin({ email: "pres@ejemplo.cl" });
    const pedirAsignar = () => pedir("/api/admin/barrios/otro/admins", { method: "POST", cookie: root, json: { email: "pres@ejemplo.cl" } });
    expect((await pedirAsignar()).status).toBe(200);
    expect((await pedirAsignar()).status).toBe(200);
    expect(await crearDb(env.DB).select().from(adminsBarrio)).toHaveLength(1);
  });

  it("email sin usuario → 404 NO_ENCONTRADO", async () => {
    const root = await como("root@ejemplo.cl", { superAdmin: true });
    const res = await pedir("/api/admin/barrios/otro/admins", { method: "POST", cookie: root, json: { email: "nadie@ejemplo.cl" } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NO_ENCONTRADO" });
  });

  it("barrio inexistente → 404", async () => {
    const root = await como("root@ejemplo.cl", { superAdmin: true });
    await crearAdmin({ email: "pres@ejemplo.cl" });
    const res = await pedir("/api/admin/barrios/no-existe/admins", { method: "POST", cookie: root, json: { email: "pres@ejemplo.cl" } });
    expect(res.status).toBe(404);
  });

  it("un admin de barrio (aunque sea de ese barrio) → 403", async () => {
    const cookie = await como("a@ejemplo.cl", { barrios: ["b1"] });
    await crearAdmin({ email: "pres@ejemplo.cl" });
    const res = await pedir("/api/admin/barrios/prueba/admins", { method: "POST", cookie, json: { email: "pres@ejemplo.cl" } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "SIN_PERMISO" });
  });
});
