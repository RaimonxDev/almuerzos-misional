import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearDb } from "@/db";
import { account, session, user, verification } from "@/db/auth-schema";
import { adminsBarrio, barrios, companerismos, inscripciones, meses, solicitudes, turnos } from "@/db/schema";
import { capturarCorreos, crearAdmin, iniciarSesion, pedir, sembrar } from "./datos";

const RUTA = "/api/admin/barrios/prueba";
const SOLICITUD_ELIMINACION = `${RUTA}/solicitud-eliminacion`;

let correos: ReturnType<typeof capturarCorreos>;

beforeEach(async () => {
  const db = await sembrar();
  await db.delete(solicitudes);
  correos = capturarCorreos();
});

afterEach(() => vi.restoreAllMocks());

const comoSuperAdmin = async () => {
  await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
  return iniciarSesion("root@ejemplo.cl");
};

const comoPresidenta = async () => {
  await crearAdmin({ email: "pres@ejemplo.cl", barrios: ["b1"] });
  return iniciarSesion("pres@ejemplo.cl");
};

const leerBarrio = () => crearDb(env.DB).select().from(barrios).where(eq(barrios.id, "b1")).get();

const eliminar = (cookie: string, confirmacion = "Barrio Prueba", ruta = RUTA) =>
  pedir(ruta, { method: "DELETE", cookie, json: { confirmacion } });

describe("POST /solicitud-eliminacion", () => {
  it("la presidenta la pide con motivo: queda guardada y se avisa al super admin", async () => {
    await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
    const cookie = await comoPresidenta();

    const res = await pedir(SOLICITUD_ELIMINACION, { method: "POST", cookie, json: { motivo: "Ya no la usamos" } });

    expect(res.status).toBe(200);
    const b = await leerBarrio();
    expect(b?.eliminacionSolicitadaEn).toBeInstanceOf(Date);
    expect(b?.motivoEliminacion).toBe("Ya no la usamos");
    const aviso = correos().find((c) => c.para === "root@ejemplo.cl");
    expect(aviso?.texto).toContain("Barrio Prueba");
    expect(aviso?.texto).toContain("Ya no la usamos");
    expect(aviso?.texto).toContain("/admin/prueba");
  });

  it("el barrio sigue funcionando mientras se resuelve", async () => {
    const cookie = await comoPresidenta();
    await pedir(SOLICITUD_ELIMINACION, { method: "POST", cookie, json: {} });
    expect((await pedir("/api/barrios/prueba")).status).toBe(200);
  });

  it("pedirla dos veces no cambia la fecha ni vuelve a avisar", async () => {
    await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true });
    const cookie = await comoPresidenta();

    await pedir(SOLICITUD_ELIMINACION, { method: "POST", cookie, json: { motivo: "Primero" } });
    const res = await pedir(SOLICITUD_ELIMINACION, { method: "POST", cookie, json: { motivo: "Segundo" } });

    expect(res.status).toBe(200);
    expect((await leerBarrio())?.motivoEliminacion).toBe("Primero");
    expect(correos().filter((c) => c.para === "root@ejemplo.cl")).toHaveLength(1);
  });

  it("no se puede pedir para un barrio ajeno", async () => {
    await crearAdmin({ email: "ajena@ejemplo.cl", barrios: ["b2"] });
    const cookie = await iniciarSesion("ajena@ejemplo.cl");
    const res = await pedir(SOLICITUD_ELIMINACION, { method: "POST", cookie, json: {} });
    expect(res.status).toBe(403);
    expect((await leerBarrio())?.eliminacionSolicitadaEn).toBeNull();
  });

  it("sin sesión responde 401", async () => {
    expect((await pedir(SOLICITUD_ELIMINACION, { method: "POST", json: {} })).status).toBe(401);
  });

  it("GET del barrio informa la solicitud al panel", async () => {
    const cookie = await comoPresidenta();
    await pedir(SOLICITUD_ELIMINACION, { method: "POST", cookie, json: { motivo: "Nos fusionaron" } });
    const { barrio } = await (await pedir(RUTA, { cookie })).json<{
      barrio: { eliminacionSolicitadaEn: string | null; motivoEliminacion: string | null };
    }>();
    expect(barrio.eliminacionSolicitadaEn).not.toBeNull();
    expect(barrio.motivoEliminacion).toBe("Nos fusionaron");
  });
});

describe("DELETE /solicitud-eliminacion", () => {
  it("retirarla deja el barrio como estaba", async () => {
    const cookie = await comoPresidenta();
    await pedir(SOLICITUD_ELIMINACION, { method: "POST", cookie, json: { motivo: "Me equivoqué" } });

    const res = await pedir(SOLICITUD_ELIMINACION, { method: "DELETE", cookie });

    expect(res.status).toBe(200);
    const b = await leerBarrio();
    expect(b?.eliminacionSolicitadaEn).toBeNull();
    expect(b?.motivoEliminacion).toBeNull();
  });
});

describe("GET /api/admin/solicitudes", () => {
  it("lista los barrios con eliminación pedida", async () => {
    const pres = await comoPresidenta();
    await pedir(SOLICITUD_ELIMINACION, { method: "POST", cookie: pres, json: { motivo: "Sin misioneros" } });
    const cookie = await comoSuperAdmin();

    const { eliminaciones } = await (await pedir("/api/admin/solicitudes", { cookie })).json<{
      eliminaciones: { slug: string; nombre: string; motivo: string | null; solicitadaEn: string }[];
    }>();

    expect(eliminaciones).toEqual([
      { slug: "prueba", nombre: "Barrio Prueba", motivo: "Sin misioneros", solicitadaEn: expect.any(String) },
    ]);
  });
});

describe("GET /resumen-eliminacion", () => {
  it("cuenta las inscripciones que se pierden y las cuentas que se borran", async () => {
    await crearAdmin({ email: "pres@ejemplo.cl", barrios: ["b1"] });
    await crearAdmin({ email: "doble@ejemplo.cl", barrios: ["b1", "b2"] });
    const cookie = await comoSuperAdmin();

    const res = await pedir(`${RUTA}/resumen-eliminacion`, { cookie });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      inscripciones: 3,
      inscripcionesFuturas: 3,
      cuentasQueSeBorran: ["pres@ejemplo.cl"],
    });
  });

  it("no cuenta como futuras las de días pasados", async () => {
    const db = crearDb(env.DB);
    await db.insert(inscripciones).values({ turnoId: "t-pasado", nombre: "Hna. Antigua", origen: "publico" });
    const cookie = await comoSuperAdmin();

    const res = await pedir(`${RUTA}/resumen-eliminacion`, { cookie });

    expect(await res.json()).toMatchObject({ inscripciones: 4, inscripcionesFuturas: 3 });
  });

  it("solo para el super admin", async () => {
    const cookie = await comoPresidenta();
    expect((await pedir(`${RUTA}/resumen-eliminacion`, { cookie })).status).toBe(403);
  });
});

describe("DELETE /api/admin/barrios/:slug", () => {
  it("una presidenta no puede borrar su barrio", async () => {
    const cookie = await comoPresidenta();
    expect((await eliminar(cookie)).status).toBe(403);
    expect(await leerBarrio()).toBeDefined();
  });

  it("con otro nombre no borra nada", async () => {
    const cookie = await comoSuperAdmin();
    const res = await eliminar(cookie, "Otro nombre");
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "CONFIRMACION_INCORRECTA" });
    expect(await leerBarrio()).toBeDefined();
  });

  it("un barrio inexistente da 404", async () => {
    const cookie = await comoSuperAdmin();
    expect((await eliminar(cookie, "Nadie", "/api/admin/barrios/no-existe")).status).toBe(404);
  });

  it("borra todo lo del barrio y deja intacto el otro", async () => {
    const cookie = await comoSuperAdmin();
    const res = await eliminar(cookie);
    expect(res.status).toBe(200);

    const db = crearDb(env.DB);
    expect(await leerBarrio()).toBeUndefined();
    expect(await db.select().from(companerismos).where(eq(companerismos.barrioId, "b1"))).toEqual([]);
    expect(await db.select().from(meses).where(eq(meses.barrioId, "b1"))).toEqual([]);
    expect(await db.select().from(inscripciones)).toEqual([]);
    expect((await db.select().from(turnos)).map((t) => t.id)).toEqual(["t-otro-barrio"]);
    expect(await db.select().from(barrios).where(eq(barrios.id, "b2"))).toHaveLength(1);
    expect((await pedir("/api/barrios/prueba")).status).toBe(404);
  });

  it("borra las imágenes del barrio en R2, no las de otro", async () => {
    await env.IMAGENES.put("meses/b1/2099-01/a.png", "a");
    await env.IMAGENES.put("meses/b1/2099-02/b.png", "b");
    await env.IMAGENES.put("meses/b2/2099-01/c.png", "c");
    await env.IMAGENES.put("meses/b10/2099-01/d.png", "d");
    const cookie = await comoSuperAdmin();

    await eliminar(cookie);

    const { objects } = await env.IMAGENES.list({ prefix: "meses/" });
    const claves = objects.map((o) => o.key).sort();
    await Promise.all(claves.map((k) => env.IMAGENES.delete(k)));
    expect(claves).toEqual(["meses/b10/2099-01/d.png", "meses/b2/2099-01/c.png"]);
  });

  it("si R2 falla, el barrio igual queda borrado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(env.IMAGENES, "list").mockRejectedValue(new Error("R2 caído"));
    const cookie = await comoSuperAdmin();
    expect((await eliminar(cookie)).status).toBe(200);
    expect(await leerBarrio()).toBeUndefined();
  });

  it("borra la solicitud de acceso con la que se creó", async () => {
    const db = crearDb(env.DB);
    const comun = {
      email: "soto@ejemplo.cl",
      telefono: "+56 9 5555 4444",
      ciudad: "Santiago",
      pais: "Chile",
      idioma: "es" as const,
      zonaHoraria: "America/Santiago",
      tieneElderes: true,
      tieneHermanas: true,
    };
    await db.insert(solicitudes).values([
      { ...comun, id: "s-1", nombre: "Hna. Soto", barrio: "Barrio Prueba", estado: "aprobada", barrioId: "b1" },
      { ...comun, id: "s-2", nombre: "Hna. Rojas", barrio: "Otro Barrio", estado: "aprobada", barrioId: "b2" },
    ]);
    const cookie = await comoSuperAdmin();

    await eliminar(cookie);

    expect((await db.select().from(solicitudes)).map((s) => s.id)).toEqual(["s-2"]);
  });

  it("borra la cuenta de quien solo administraba ese barrio, con sus sesiones y enlaces", async () => {
    const { id } = await crearAdmin({ email: "pres@ejemplo.cl", barrios: ["b1"] });
    await iniciarSesion("pres@ejemplo.cl");
    const db = crearDb(env.DB);
    await db.insert(verification).values({
      id: "v-1",
      identifier: "reset-password:token-1",
      value: id,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const cookie = await comoSuperAdmin();

    await eliminar(cookie);

    expect(await db.select().from(user).where(eq(user.id, id))).toEqual([]);
    expect(await db.select().from(account).where(eq(account.userId, id))).toEqual([]);
    expect(await db.select().from(session).where(eq(session.userId, id))).toEqual([]);
    expect(await db.select().from(verification)).toEqual([]);
  });

  it("conserva la cuenta de quien administra otro barrio", async () => {
    const { id } = await crearAdmin({ email: "doble@ejemplo.cl", barrios: ["b1", "b2"] });
    const cookie = await comoSuperAdmin();

    await eliminar(cookie);

    const db = crearDb(env.DB);
    expect(await db.select().from(user).where(eq(user.id, id))).toHaveLength(1);
    expect((await db.select().from(adminsBarrio).where(eq(adminsBarrio.userId, id))).map((a) => a.barrioId)).toEqual(["b2"]);
  });

  it("nunca borra la cuenta de un super admin asignado al barrio", async () => {
    const { id } = await crearAdmin({ email: "root@ejemplo.cl", superAdmin: true, barrios: ["b1"] });
    const cookie = await iniciarSesion("root@ejemplo.cl");

    await eliminar(cookie);

    expect(await crearDb(env.DB).select().from(user).where(eq(user.id, id))).toHaveLength(1);
  });

  it("avisa a cada admin, diciéndole si su cuenta se borró", async () => {
    await crearAdmin({ email: "pres@ejemplo.cl", barrios: ["b1"] });
    await crearAdmin({ email: "doble@ejemplo.cl", barrios: ["b1", "b2"] });
    const cookie = await comoSuperAdmin();

    await eliminar(cookie);

    const de = (para: string) => correos().find((c) => c.para === para);
    expect(de("pres@ejemplo.cl")?.texto).toContain("Barrio Prueba");
    expect(de("pres@ejemplo.cl")?.texto).toContain("también borramos tu cuenta");
    expect(de("doble@ejemplo.cl")?.texto).toContain("Barrio Prueba");
    expect(de("doble@ejemplo.cl")?.texto).not.toContain("también borramos tu cuenta");
  });
});
