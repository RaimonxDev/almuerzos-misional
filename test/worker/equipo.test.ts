import { env } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearDb } from "@/db";
import { session, user } from "@/db/auth-schema";
import { adminsBarrio, barrios, inscripciones } from "@/db/schema";
import { capturarCorreos, crearAdmin, IDS, iniciarSesion, pedir, sembrar } from "./datos";

const RUTA = "/api/admin/barrios/prueba";

beforeEach(async () => {
  await sembrar();
});
afterEach(() => vi.restoreAllMocks());

const como = async (email: string, opciones: Omit<Parameters<typeof crearAdmin>[0], "email">) => {
  const cuenta = await crearAdmin({ email, ...opciones });
  return { ...cuenta, cookie: await iniciarSesion(email) };
};

const invitar = (cookie: string, json: object, ruta = RUTA) =>
  pedir(`${ruta}/admins`, { method: "POST", cookie, json });
const quitar = (cookie: string, userId: string, ruta = RUTA) =>
  pedir(`${ruta}/admins/${userId}`, { method: "DELETE", cookie });

const cuentaDe = (email: string) => crearDb(env.DB).select().from(user).where(eq(user.email, email)).get();

describe("invitar", () => {
  it("la presidenta invita a una consejera y esta entra al panel de ese barrio", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const res = await invitar(cookie, { email: "Consejera@Ejemplo.cl", nombre: "Hna. Rojas", cargo: "Primera consejera" });
    expect(res.status).toBe(200);
    const cuerpo = await res.json<any>();
    expect(cuerpo.admin).toMatchObject({ email: "consejera@ejemplo.cl", cargo: "Primera consejera", rol: "equipo" });
    expect(cuerpo.cuentaNueva).toBe(true);
    // Sin Resend en los tests el correo no sale: llega la contraseña temporal como respaldo.
    expect(cuerpo.correoEnviado).toBe(false);
    expect(cuerpo.passwordTemporal).toMatch(/^.{12,}$/);

    const entra = await iniciarSesion("consejera@ejemplo.cl", cuerpo.passwordTemporal);
    const yo = await (await pedir("/api/admin/yo", { cookie: entra })).json<any>();
    expect(yo.usuario.debeCambiarPassword).toBe(true);
    expect(yo.barrios).toEqual([{ slug: "prueba", nombre: "Barrio Prueba", cargo: "Primera consejera", rol: "equipo" }]);
    expect((await pedir(RUTA, { cookie: entra })).status).toBe(200);
  });

  it("si el correo ya tiene cuenta solo la asigna como equipo, sin contraseña temporal", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    await crearAdmin({ email: "otra@ejemplo.cl", barrios: ["b2"], rol: "presidenta" });
    const cuerpo = await (await invitar(cookie, { email: "otra@ejemplo.cl", nombre: "Hna. Otra" })).json<any>();
    expect(cuerpo).toMatchObject({ cuentaNueva: false, passwordTemporal: null });
    const filas = await crearDb(env.DB).select().from(adminsBarrio).where(eq(adminsBarrio.barrioId, "b1"));
    expect(filas.map((f) => f.rol).sort()).toEqual(["equipo", "presidenta"]);
  });

  it("invitar a quien ya está no cambia su rol (la presidenta sigue siéndolo)", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    expect((await invitar(cookie, { email: "pres@ejemplo.cl", nombre: "Yo" })).status).toBe(200);
    const fila = await crearDb(env.DB).select().from(adminsBarrio).where(eq(adminsBarrio.barrioId, "b1")).get();
    expect(fila?.rol).toBe("presidenta");
  });

  it("el super admin también puede invitar", async () => {
    const { cookie } = await como("root@ejemplo.cl", { superAdmin: true });
    expect((await invitar(cookie, { email: "nueva@ejemplo.cl", nombre: "Hna. Nueva" })).status).toBe(200);
  });

  it("datos inválidos → 400", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const res = await invitar(cookie, { email: "no-es-correo", nombre: "x" });
    expect(res.status).toBe(400);
  });
});

describe("permisos", () => {
  it("equipo recibe 403 al invitar o quitar, pero puede ver la lista", async () => {
    const { cookie } = await como("eq@ejemplo.cl", { barrios: ["b1"], rol: "equipo" });
    const otra = await crearAdmin({ email: "otra@ejemplo.cl", barrios: ["b1"] });
    const invitacion = await invitar(cookie, { email: "x@ejemplo.cl", nombre: "Hna. X" });
    expect(invitacion.status).toBe(403);
    expect(await invitacion.json()).toEqual({ error: "SIN_PERMISO" });
    expect((await quitar(cookie, otra.id)).status).toBe(403);
    for (const [metodo, ruta] of [
      ["POST", `/admins/${otra.id}/invitacion`],
      ["PATCH", `/admins/${otra.id}`],
      ["POST", `/admins/${otra.id}/password-temporal`],
    ] as const) {
      expect((await pedir(RUTA + ruta, { method: metodo, cookie, json: { email: "z@ejemplo.cl" } })).status).toBe(403);
    }
    expect(await cuentaDe("x@ejemplo.cl")).toBeUndefined();

    const lista = await pedir(`${RUTA}/admins`, { cookie });
    expect(lista.status).toBe(200);
    expect((await lista.json<any>()).admins.map((a: any) => a.email).sort()).toEqual(["eq@ejemplo.cl", "otra@ejemplo.cl"]);
  });

  it("la lista dice quién es la presidenta", async () => {
    await crearAdmin({ email: "pres@ejemplo.cl", barrios: ["b1"], rol: "presidenta" });
    const { cookie } = await como("eq@ejemplo.cl", { barrios: ["b1"] });
    const { admins } = await (await pedir(`${RUTA}/admins`, { cookie })).json<any>();
    expect(admins.map((a: any) => [a.email, a.rol])).toEqual([
      ["pres@ejemplo.cl", "presidenta"],
      ["eq@ejemplo.cl", "equipo"],
    ]);
  });

  it("la presidenta de un barrio no puede tocar a personas ni el barrio de otro", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const ajena = await crearAdmin({ email: "ajena@ejemplo.cl", barrios: ["b2"] });
    const propia = await crearAdmin({ email: "propia@ejemplo.cl", barrios: ["b1"] });

    // Otro barrio: 403 en todo.
    expect((await invitar(cookie, { email: "x@ejemplo.cl", nombre: "Hna. X" }, "/api/admin/barrios/otro")).status).toBe(403);
    expect((await quitar(cookie, ajena.id, "/api/admin/barrios/otro")).status).toBe(403);
    expect((await pedir("/api/admin/barrios/otro/admins", { cookie })).status).toBe(403);

    // En su barrio, el id de alguien de otro no existe.
    expect((await quitar(cookie, ajena.id)).status).toBe(404);
    for (const [metodo, ruta] of [
      ["POST", `/admins/${ajena.id}/invitacion`],
      ["PATCH", `/admins/${ajena.id}`],
      ["POST", `/admins/${ajena.id}/password-temporal`],
    ] as const) {
      expect((await pedir(RUTA + ruta, { method: metodo, cookie, json: { email: "z@ejemplo.cl" } })).status).toBe(404);
    }
    expect(await cuentaDe("ajena@ejemplo.cl")).toBeDefined();
    expect(await crearDb(env.DB).select().from(adminsBarrio).where(eq(adminsBarrio.userId, propia.id))).toHaveLength(1);
  });

  it("la presidenta reenvía la invitación y corrige el correo de su gente", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const invitada = await (await invitar(cookie, { email: "mal@gmial.com", nombre: "Hna. Rojas" })).json<any>();
    const id = (await cuentaDe("mal@gmial.com"))!.id;

    const reenvio = await pedir(`${RUTA}/admins/${id}/invitacion`, { method: "POST", cookie });
    expect(reenvio.status).toBe(200);
    const corregido = await pedir(`${RUTA}/admins/${id}`, { method: "PATCH", cookie, json: { email: "bien@gmail.com" } });
    expect(corregido.status).toBe(200);
    expect(await cuentaDe("bien@gmail.com")).toBeDefined();
    const temporal = await pedir(`${RUTA}/admins/${id}/password-temporal`, { method: "POST", cookie });
    expect(temporal.status).toBe(200);
    expect(invitada.passwordTemporal).not.toBe((await temporal.json<any>()).passwordTemporal);
  });
});

describe("quitar", () => {
  it("cierra la sesión: la siguiente petición da 401", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const consejera = await como("cons@ejemplo.cl", { barrios: ["b1", "b2"] });
    expect((await pedir(RUTA, { cookie: consejera.cookie })).status).toBe(200);

    const res = await quitar(cookie, consejera.id);
    expect(res.status).toBe(200);
    const siguiente = await pedir(RUTA, { cookie: consejera.cookie });
    expect(siguiente.status).toBe(401);
    expect(await crearDb(env.DB).select().from(session).where(eq(session.userId, consejera.id))).toHaveLength(0);
  });

  it("conserva la cuenta si administra otro barrio y la borra si no", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const doble = await crearAdmin({ email: "doble@ejemplo.cl", barrios: ["b1", "b2"] });
    const sola = await crearAdmin({ email: "sola@ejemplo.cl", barrios: ["b1"] });
    const db = crearDb(env.DB);

    const r1 = await quitar(cookie, doble.id);
    expect(await r1.json()).toEqual({ cuentaBorrada: false });
    expect(await cuentaDe("doble@ejemplo.cl")).toBeDefined();
    expect(await db.select().from(adminsBarrio).where(eq(adminsBarrio.userId, doble.id))).toEqual([
      expect.objectContaining({ barrioId: "b2" }),
    ]);

    const r2 = await quitar(cookie, sola.id);
    expect(await r2.json()).toEqual({ cuentaBorrada: true });
    expect(await cuentaDe("sola@ejemplo.cl")).toBeUndefined();
    expect(await db.select().from(adminsBarrio).where(eq(adminsBarrio.userId, sola.id))).toHaveLength(0);
  });

  it("borra también los enlaces de restablecer pendientes de la cuenta que se va", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    await invitar(cookie, { email: "nueva@ejemplo.cl", nombre: "Hna. Nueva" });
    const { id } = (await cuentaDe("nueva@ejemplo.cl"))!;
    await pedir(`${RUTA}/admins/${id}/invitacion`, { method: "POST", cookie });
    const pendientes = () => env.DB.prepare("select count(*) as n from verification where value = ?").bind(id).first<{ n: number }>();
    expect((await pendientes())!.n).toBeGreaterThan(0);
    await quitar(cookie, id);
    expect((await pendientes())!.n).toBe(0);
  });

  it("nunca borra la cuenta de un super admin", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const root = await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true, barrios: ["b1"] });
    const res = await quitar(cookie, root.id);
    expect(await res.json()).toEqual({ cuentaBorrada: false });
    expect(await cuentaDe("root@ejemplo.cl")).toBeDefined();
  });

  it("quitar a la presidenta da 422 ES_PRESIDENTA, también al super admin", async () => {
    const pres = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const root = await como("root@ejemplo.cl", { superAdmin: true });
    for (const cookie of [pres.cookie, root.cookie]) {
      const res = await quitar(cookie, pres.id);
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "ES_PRESIDENTA" });
    }
    expect(await crearDb(env.DB).select().from(adminsBarrio).where(eq(adminsBarrio.userId, pres.id))).toHaveLength(1);
  });

  it("avisa por correo a quien pierde el acceso, en el idioma del barrio", async () => {
    const correos = capturarCorreos();
    await crearDb(env.DB).update(barrios).set({ idioma: "pt" }).where(eq(barrios.id, "b1"));
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const cons = await crearAdmin({ email: "cons@ejemplo.cl", barrios: ["b1"] });
    await quitar(cookie, cons.id);
    await vi.waitFor(() => expect(correos().filter((c) => c.para === "cons@ejemplo.cl")).toHaveLength(1));
    expect(correos().find((c) => c.para === "cons@ejemplo.cl")!.asunto).toContain("Barrio Prueba");
    expect(correos().find((c) => c.para === "cons@ejemplo.cl")!.asunto).toMatch(/acesso/i);
  });

  it("una persona que no está en el barrio da 404", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    expect((await quitar(cookie, "no-existe")).status).toBe(404);
  });

  it("una inscripción creada a mano sobrevive al borrado de quien la creó", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const cons = await como("cons@ejemplo.cl", { barrios: ["b1"] });
    const anotada = await pedir(`${RUTA}/turnos/${IDS.libre}/inscripcion`, {
      method: "POST",
      cookie: cons.cookie,
      json: { nombre: "Familia Soto" },
    });
    expect(anotada.status).toBe(201);

    await quitar(cookie, cons.id);
    expect(await cuentaDe("cons@ejemplo.cl")).toBeUndefined();
    const fila = await crearDb(env.DB)
      .select()
      .from(inscripciones)
      .where(and(eq(inscripciones.turnoId, IDS.libre)))
      .get();
    expect(fila).toMatchObject({ nombre: "Familia Soto", origen: "admin", creadoPorUserId: null });
  });
});
