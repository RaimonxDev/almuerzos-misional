import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { crearDb } from "@/db";
import { adminsBarrio, barrios } from "@/db/schema";
import migracion from "../../migrations/0007_slimy_old_lace.sql?raw";
import { crearAdmin, IDS, iniciarSesion, pedir, sembrar } from "./datos";

const RUTA = "/api/admin/barrios/prueba";

beforeEach(async () => {
  await sembrar();
});

const como = async (email: string, opciones: Omit<Parameters<typeof crearAdmin>[0], "email">) => {
  await crearAdmin({ email, ...opciones });
  return iniciarSesion(email);
};

describe("una presidenta por barrio", () => {
  it("la base rechaza una segunda presidenta en el mismo barrio", async () => {
    const a = await crearAdmin({ email: "a@ejemplo.cl", barrios: ["b1"], rol: "presidenta" });
    const b = await crearAdmin({ email: "b@ejemplo.cl" });
    const db = crearDb(env.DB);
    await expect(
      db.insert(adminsBarrio).values({ userId: b.id, barrioId: "b1", rol: "presidenta" }),
    ).rejects.toThrow();
    // Equipo hay todo el que se quiera, y la misma persona puede presidir otro barrio.
    await db.insert(adminsBarrio).values({ userId: b.id, barrioId: "b1", rol: "equipo" });
    await db.insert(adminsBarrio).values({ userId: a.id, barrioId: "b2", rol: "presidenta" });
  });
});

describe("equipo", () => {
  it("recibe 403 al pedir o retirar la eliminación del barrio", async () => {
    const cookie = await como("eq@ejemplo.cl", { barrios: ["b1"], rol: "equipo" });
    const pedido = await pedir(`${RUTA}/solicitud-eliminacion`, { method: "POST", cookie, json: {} });
    expect(pedido.status).toBe(403);
    expect(await pedido.json()).toEqual({ error: "SIN_PERMISO" });
    const retiro = await pedir(`${RUTA}/solicitud-eliminacion`, { method: "DELETE", cookie });
    expect(retiro.status).toBe(403);
    const b = await crearDb(env.DB).query.barrios.findFirst({ where: eq(barrios.id, "b1") });
    expect(b?.eliminacionSolicitadaEn).toBeNull();
  });

  it("puede crear un mes y anotar a alguien a mano", async () => {
    const cookie = await como("eq@ejemplo.cl", { barrios: ["b1"], rol: "equipo" });
    const mes = await pedir(`${RUTA}/meses`, { method: "POST", cookie, json: { periodo: "2099-05" } });
    expect(mes.status).toBe(201);
    const nota = await pedir(`${RUTA}/turnos/${IDS.libre}/inscripcion`, {
      method: "POST",
      cookie,
      json: { nombre: "Familia Soto" },
    });
    expect(nota.status).toBe(201);
  });

  it("conserva datos del barrio, enlace y código de misioneros", async () => {
    const cookie = await como("eq@ejemplo.cl", { barrios: ["b1"], rol: "equipo" });
    expect((await pedir(RUTA, { method: "PATCH", cookie, json: { notaParaCocinar: "Sin maní" } })).status).toBe(200);
    expect((await pedir(`${RUTA}/codigo-misioneros`, { method: "POST", cookie })).status).toBe(200);
  });
});

describe("presidenta y super admin", () => {
  it("la presidenta pide y retira la eliminación", async () => {
    const cookie = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    expect((await pedir(`${RUTA}/solicitud-eliminacion`, { method: "POST", cookie, json: {} })).status).toBe(200);
    expect((await pedir(`${RUTA}/solicitud-eliminacion`, { method: "DELETE", cookie })).status).toBe(200);
  });

  it("el super admin mantiene acceso sin fila en admins_barrio", async () => {
    const cookie = await como("root@ejemplo.cl", { superAdmin: true });
    expect((await pedir(`${RUTA}/solicitud-eliminacion`, { method: "POST", cookie, json: {} })).status).toBe(200);
    expect((await pedir(`${RUTA}/meses`, { method: "POST", cookie, json: { periodo: "2099-06" } })).status).toBe(201);
  });
});

describe("GET /api/admin/yo", () => {
  it("devuelve el rol por barrio (null para el super admin)", async () => {
    const cookie = await como("eq@ejemplo.cl", { barrios: ["b1"], rol: "equipo" });
    expect((await (await pedir("/api/admin/yo", { cookie })).json<any>()).barrios).toEqual([
      { slug: "prueba", nombre: "Barrio Prueba", cargo: null, rol: "equipo" },
    ]);
    const root = await como("root@ejemplo.cl", { superAdmin: true });
    const todos = (await (await pedir("/api/admin/yo", { cookie: root })).json<any>()).barrios;
    expect(todos.map((b: any) => b.rol)).toEqual([null, null]);
  });
});

describe("migración 0007: conserva a los admins existentes", () => {
  // Las sentencias de datos de la migración (las UPDATE), aplicadas a filas con rol 'equipo'.
  const backfill = migracion
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/^--.*$/gm, "").trim())
    .filter((s) => s.startsWith("UPDATE"));

  const roles = async (barrioId: string) =>
    Object.fromEntries(
      (await crearDb(env.DB).select().from(adminsBarrio).where(eq(adminsBarrio.barrioId, barrioId))).map((a) => [
        `${a.cargo}|${a.userId}`,
        a.rol,
      ]),
    );

  const aplicar = () => env.DB.batch(backfill.map((s) => env.DB.prepare(s)));

  it("un solo admin → presidenta; todos siguen con acceso", async () => {
    await crearAdmin({ email: "unica@ejemplo.cl", barrios: ["b1"] });
    await aplicar();
    expect(Object.values(await roles("b1"))).toEqual(["presidenta"]);
  });

  it("varios: el cargo decide si alcanza; si no, ninguno queda presidenta", async () => {
    const db = crearDb(env.DB);
    const [a, b, c] = await Promise.all(
      ["a", "b", "c"].map((n) => crearAdmin({ email: `${n}@ejemplo.cl` })),
    );
    await db.insert(adminsBarrio).values([
      { userId: a.id, barrioId: "b1", cargo: "Presidenta de la Sociedad de Socorro" },
      { userId: b.id, barrioId: "b1", cargo: "Primera consejera" },
      { userId: c.id, barrioId: "b1", cargo: null },
      { userId: a.id, barrioId: "b2", cargo: "Presidenta" },
      { userId: b.id, barrioId: "b2", cargo: "Presidenta" },
    ]);
    await aplicar();
    expect(await roles("b1")).toEqual({
      [`Presidenta de la Sociedad de Socorro|${a.id}`]: "presidenta",
      [`Primera consejera|${b.id}`]: "equipo",
      [`null|${c.id}`]: "equipo",
    });
    expect(Object.values(await roles("b2"))).toEqual(["equipo", "equipo"]);
  });
});
