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

describe("traspasar la presidencia", () => {
  const traspasar = (cookie: string, json: object, ruta = RUTA) =>
    pedir(`${ruta}/presidencia`, { method: "POST", cookie, json });
  const filas = (barrioId = "b1") =>
    crearDb(env.DB)
      .select({ email: user.email, rol: adminsBarrio.rol })
      .from(adminsBarrio)
      .innerJoin(user, eq(user.id, adminsBarrio.userId))
      .where(eq(adminsBarrio.barrioId, barrioId));

  it("la presidenta traspasa a una cuenta nueva: la anterior queda en el equipo y sigue habiendo una sola", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const res = await traspasar(cookie, { email: "Nueva@Ejemplo.cl", nombre: "Hna. Nueva", cargo: "Presidenta" });
    expect(res.status).toBe(200);
    const cuerpo = await res.json<any>();
    expect(cuerpo.presidenta).toMatchObject({ email: "nueva@ejemplo.cl", rol: "presidenta", cargo: "Presidenta" });
    expect(cuerpo.anterior).toMatchObject({ email: "pres@ejemplo.cl" });
    expect(cuerpo).toMatchObject({ cuentaNueva: true, correoEnviado: false });
    expect(cuerpo.passwordTemporal).toMatch(/^.{12,}$/);

    const roles = Object.fromEntries((await filas()).map((f) => [f.email, f.rol]));
    expect(roles).toEqual({ "pres@ejemplo.cl": "equipo", "nueva@ejemplo.cl": "presidenta" });
    // La nueva entra con la temporal y debe cambiarla.
    const entra = await iniciarSesion("nueva@ejemplo.cl", cuerpo.passwordTemporal);
    const yo = await (await pedir("/api/admin/yo", { cookie: entra })).json<any>();
    expect(yo.usuario.debeCambiarPassword).toBe(true);
    expect(yo.barrios[0]).toMatchObject({ slug: "prueba", rol: "presidenta" });
  });

  it("traspasar a alguien del equipo solo cambia su rol, sin crear una cuenta", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const cons = await crearAdmin({ email: "cons@ejemplo.cl", barrios: ["b1"] });
    const antes = await crearDb(env.DB).select().from(user);
    const cuerpo = await (await traspasar(cookie, { email: "cons@ejemplo.cl", nombre: "Otro nombre" })).json<any>();
    expect(cuerpo).toMatchObject({ cuentaNueva: false, passwordTemporal: null });
    expect(await crearDb(env.DB).select().from(user)).toHaveLength(antes.length);
    expect(cuerpo.presidenta.id).toBe(cons.id);
    expect(Object.fromEntries((await filas()).map((f) => [f.email, f.rol]))).toEqual({
      "pres@ejemplo.cl": "equipo",
      "cons@ejemplo.cl": "presidenta",
    });
  });

  it("alguien con cuenta que no era del barrio se agrega como presidenta", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    await crearAdmin({ email: "otra@ejemplo.cl", barrios: ["b2"], rol: "presidenta" });
    const cuerpo = await (await traspasar(cookie, { email: "otra@ejemplo.cl", nombre: "Hna. Otra" })).json<any>();
    expect(cuerpo.cuentaNueva).toBe(false);
    expect((await filas("b2")).map((f) => f.rol)).toEqual(["presidenta"]);
    expect((await filas()).filter((f) => f.rol === "presidenta").map((f) => f.email)).toEqual(["otra@ejemplo.cl"]);
  });

  it("equipo y la presidenta de otro barrio reciben 403 y nada cambia", async () => {
    await crearAdmin({ email: "pres@ejemplo.cl", barrios: ["b1"], rol: "presidenta" });
    const eq1 = await como("eq@ejemplo.cl", { barrios: ["b1"] });
    const ajena = await como("ajena@ejemplo.cl", { barrios: ["b2"], rol: "presidenta" });
    for (const cookie of [eq1.cookie, ajena.cookie]) {
      const res = await traspasar(cookie, { email: "eq@ejemplo.cl", nombre: "Hna. Eq" });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "SIN_PERMISO" });
    }
    expect((await filas()).find((f) => f.email === "pres@ejemplo.cl")?.rol).toBe("presidenta");
    expect((await filas()).find((f) => f.email === "eq@ejemplo.cl")?.rol).toBe("equipo");
  });

  it("el super admin traspasa aunque la anterior no responda, y define la presidenta de un barrio que no tiene", async () => {
    const { cookie } = await como("root@ejemplo.cl", { superAdmin: true });
    await crearAdmin({ email: "eq@ejemplo.cl", barrios: ["b1"] });
    // b1 no tiene presidenta: solo el equipo.
    expect((await filas()).some((f) => f.rol === "presidenta")).toBe(false);
    const sin = await (await traspasar(cookie, { email: "eq@ejemplo.cl", nombre: "Hna. Eq" })).json<any>();
    expect(sin.anterior).toBeNull();
    expect((await filas()).map((f) => f.rol).sort()).toEqual(["presidenta"]);

    // Y con una presidenta que nunca entró: igual se la releva.
    await crearAdmin({ email: "nueva@ejemplo.cl", barrios: ["b2"] });
    await crearAdmin({ email: "muda@ejemplo.cl", barrios: ["b2"], rol: "presidenta" });
    const res = await traspasar(cookie, { email: "nueva@ejemplo.cl", nombre: "Hna. Nueva" }, "/api/admin/barrios/otro");
    expect(res.status).toBe(200);
    expect(Object.fromEntries((await filas("b2")).map((f) => [f.email, f.rol]))).toEqual({
      "muda@ejemplo.cl": "equipo",
      "nueva@ejemplo.cl": "presidenta",
    });
  });

  it("la anterior conserva el acceso como equipo y ya no puede invitar ni quitar", async () => {
    const pres = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const nueva = await como("nueva@ejemplo.cl", { barrios: ["b1"] });
    await traspasar(pres.cookie, { email: "nueva@ejemplo.cl", nombre: "Hna. Nueva" });

    expect((await pedir(RUTA, { cookie: pres.cookie })).status).toBe(200);
    expect((await invitar(pres.cookie, { email: "x@ejemplo.cl", nombre: "Hna. X" })).status).toBe(403);
    expect((await quitar(pres.cookie, nueva.id)).status).toBe(403);
    expect((await traspasar(pres.cookie, { email: "pres@ejemplo.cl", nombre: "Yo" })).status).toBe(403);
    // La nueva sí puede quitar a la anterior.
    expect((await quitar(nueva.cookie, pres.id)).status).toBe(200);
  });

  it("traspasar a quien ya es presidenta da 422 YA_ES_PRESIDENTA", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const res = await traspasar(cookie, { email: "pres@ejemplo.cl", nombre: "Yo" });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "YA_ES_PRESIDENTA" });
  });

  it("siempre queda exactamente una presidenta, también al traspasar de ida y vuelta", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    await crearAdmin({ email: "cons@ejemplo.cl", barrios: ["b1"] });
    const ok = await traspasar(cookie, { email: "cons@ejemplo.cl", nombre: "Hna. C" });
    expect(ok.status).toBe(200);
    expect((await filas()).filter((f) => f.rol === "presidenta")).toHaveLength(1);
    // Dos traspasos seguidos (la nueva traspasa de vuelta con su propia sesión): siempre una.
    const vuelta = await iniciarSesion("cons@ejemplo.cl");
    expect((await traspasar(vuelta, { email: "pres@ejemplo.cl", nombre: "Hna. P" })).status).toBe(200);
    const roles = await filas();
    expect(roles.filter((f) => f.rol === "presidenta").map((f) => f.email)).toEqual(["pres@ejemplo.cl"]);
    expect(roles).toHaveLength(2);
  });

  it("marca la fecha del traspaso en el barrio", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const antes = await crearDb(env.DB).select().from(barrios).where(eq(barrios.id, "b1")).get();
    expect(antes?.presidenciaTraspasadaEn).toBeNull();
    await traspasar(cookie, { email: "nueva@ejemplo.cl", nombre: "Hna. Nueva" });
    const despues = await crearDb(env.DB).select().from(barrios).where(eq(barrios.id, "b1")).get();
    expect(despues?.presidenciaTraspasadaEn).toBeInstanceOf(Date);
    expect(despues?.presidenciaRevisadaEn).toBeNull();
  });

  it("avisa a la nueva (bienvenida si es cuenta nueva, 'ahora eres presidenta' si no) y a la anterior, en el idioma del barrio", async () => {
    const correos = capturarCorreos();
    await crearDb(env.DB).update(barrios).set({ idioma: "en" }).where(eq(barrios.id, "b1"));
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    await crearAdmin({ email: "cons@ejemplo.cl", barrios: ["b1"] });
    await traspasar(cookie, { email: "cons@ejemplo.cl", nombre: "Hna. C" });
    await vi.waitFor(() => expect(correos().map((c) => c.para).sort()).toEqual(["cons@ejemplo.cl", "pres@ejemplo.cl"]));
    expect(correos().find((c) => c.para === "cons@ejemplo.cl")!.asunto).toMatch(/president/i);
    expect(correos().find((c) => c.para === "pres@ejemplo.cl")!.asunto).toMatch(/Barrio Prueba/);
  });

  it("el correo mal escrito de la nueva presidenta se corrige con el PATCH de siempre (super admin)", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const root = await como("root@ejemplo.cl", { superAdmin: true });
    await traspasar(cookie, { email: "mal@gmial.com", nombre: "Hna. Nueva" });
    const nueva = (await cuentaDe("mal@gmial.com"))!;
    // La anterior ya no puede; el super admin sí.
    expect((await pedir(`${RUTA}/admins/${nueva.id}`, { method: "PATCH", cookie, json: { email: "bien@gmail.com" } })).status).toBe(403);
    const res = await pedir(`${RUTA}/admins/${nueva.id}`, { method: "PATCH", cookie: root.cookie, json: { email: "bien@gmail.com" } });
    expect(res.status).toBe(200);
    expect((await filas()).find((f) => f.email === "bien@gmail.com")?.rol).toBe("presidenta");
  });

  it("datos inválidos → 400", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    expect((await traspasar(cookie, { email: "no-es-correo", nombre: "x" })).status).toBe(400);
  });
});

describe("revisión de la presidencia tras un traspaso", () => {
  const traspasar = (cookie: string, json: object) => pedir(`${RUTA}/presidencia`, { method: "POST", cookie, json });
  const pendiente = async (cookie: string) => (await (await pedir(RUTA, { cookie })).json<any>()).revisionPresidenciaPendiente;
  const marcar = (cookie: string) => pedir(`${RUTA}/presidencia/revisada`, { method: "POST", cookie });

  it("sin traspaso no hay revisión pendiente", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    expect(await pendiente(cookie)).toBe(false);
  });

  it("tras el traspaso la nueva presidenta la ve; marcarla la apaga y sigue apagada al volver a pedir", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const nueva = await (await traspasar(cookie, { email: "nueva@ejemplo.cl", nombre: "Hna. Nueva" })).json<any>();
    const entra = await iniciarSesion("nueva@ejemplo.cl", nueva.passwordTemporal);
    expect(await pendiente(entra)).toBe(true);

    const res = await marcar(entra);
    expect(res.status).toBe(200);
    expect(await pendiente(entra)).toBe(false);
    expect(await pendiente(entra)).toBe(false);
  });

  it("no la ven el equipo (incluida la presidenta anterior) ni el super admin, y no pueden marcarla", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const otro = await como("eq@ejemplo.cl", { barrios: ["b1"] });
    const sup = await como("super@ejemplo.cl", { superAdmin: true });
    await traspasar(cookie, { email: "nueva@ejemplo.cl", nombre: "Hna. Nueva" });
    expect(await pendiente(cookie)).toBe(false); // la anterior ya es equipo
    expect(await pendiente(otro.cookie)).toBe(false);
    expect(await pendiente(sup.cookie)).toBe(false);
    expect((await marcar(otro.cookie)).status).toBe(403);
    expect((await marcar(cookie)).status).toBe(403);
    const fila = await crearDb(env.DB).select().from(barrios).where(eq(barrios.id, "b1")).get();
    expect(fila?.presidenciaRevisadaEn).toBeNull();
  });

  it("un traspaso nuevo la vuelve a mostrar, incluso en el mismo segundo de la revisión", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const nueva = await (await traspasar(cookie, { email: "nueva@ejemplo.cl", nombre: "Hna. Nueva" })).json<any>();
    const entra = await iniciarSesion("nueva@ejemplo.cl", nueva.passwordTemporal);
    await marcar(entra);
    expect(await pendiente(entra)).toBe(false);

    await traspasar(entra, { email: "pres@ejemplo.cl", nombre: "Hna. P" });
    expect(await pendiente(cookie)).toBe(true);
    expect(await pendiente(entra)).toBe(false);
  });

  it("requiere sesión de este barrio", async () => {
    const ajena = await como("ajena@ejemplo.cl", { barrios: ["b2"], rol: "presidenta" });
    expect((await marcar(ajena.cookie)).status).toBe(403);
    expect((await pedir(`${RUTA}/presidencia/revisada`, { method: "POST" })).status).toBe(401);
  });
});

describe("cargo de la presidenta anterior", () => {
  it("al traspasar se borra su cargo; el de los demás no cambia", async () => {
    const { cookie, id } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const cons = await crearAdmin({ email: "cons@ejemplo.cl", barrios: ["b1"] });
    const db = crearDb(env.DB);
    await db.update(adminsBarrio).set({ cargo: "Presidenta" }).where(eq(adminsBarrio.userId, id));
    await db.update(adminsBarrio).set({ cargo: "Consejera" }).where(eq(adminsBarrio.userId, cons.id));
    await pedir(`${RUTA}/presidencia`, { method: "POST", cookie, json: { email: "nueva@ejemplo.cl", nombre: "Hna. Nueva", cargo: "Presidenta" } });
    const filas = await db.select().from(adminsBarrio).where(eq(adminsBarrio.barrioId, "b1"));
    const por = (uid: string) => filas.find((f) => f.userId === uid);
    expect(por(id)).toMatchObject({ rol: "equipo", cargo: null });
    expect(por(cons.id)).toMatchObject({ rol: "equipo", cargo: "Consejera" });
  });

  it("quien sube desde el equipo deja su cargo de equipo: queda el que se escribe o ninguno", async () => {
    const { cookie } = await como("pres@ejemplo.cl", { barrios: ["b1"], rol: "presidenta" });
    const cons = await crearAdmin({ email: "cons@ejemplo.cl", barrios: ["b1"] });
    const otra = await crearAdmin({ email: "otra@ejemplo.cl", barrios: ["b1"] });
    const db = crearDb(env.DB);
    await db.update(adminsBarrio).set({ cargo: "Primera consejera" }).where(eq(adminsBarrio.userId, cons.id));
    await db.update(adminsBarrio).set({ cargo: "Secretaria" }).where(eq(adminsBarrio.userId, otra.id));
    const res = await pedir(`${RUTA}/presidencia`, { method: "POST", cookie, json: { email: "cons@ejemplo.cl", nombre: "Hna. Cons" } });
    expect(res.status).toBe(200);
    expect((await res.json<{ presidenta: { cargo: string | null } }>()).presidenta.cargo).toBeNull();
    const cookieCons = await iniciarSesion("cons@ejemplo.cl");
    await pedir(`${RUTA}/presidencia`, { method: "POST", cookie: cookieCons, json: { email: "otra@ejemplo.cl", nombre: "Hna. Otra", cargo: "Presidenta" } });
    const filas = await db.select().from(adminsBarrio).where(eq(adminsBarrio.barrioId, "b1"));
    expect(filas.find((f) => f.userId === otra.id)).toMatchObject({ rol: "presidenta", cargo: "Presidenta" });
  });
});
