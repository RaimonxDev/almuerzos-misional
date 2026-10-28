import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { inscripciones, turnos } from "@/db/schema";
import { IDS, crearAdmin, iniciarSesion, pedir, sembrar } from "./datos";

const base = "/api/admin/barrios/prueba";
const nueva = {
  nombre: "Hna. Rojas",
  telefono: "+56 9 5555 6666",
  consentimientoTelefono: true,
  modalidad: "llevar",
  nota: "A las 13:00",
};

let db: Db;
let cookie: string;
let adminId: string;

beforeEach(async () => {
  db = await sembrar();
  adminId = (await crearAdmin({ email: "pres@x.cl", barrios: ["b1"] })).id;
  cookie = await iniciarSesion("pres@x.cl");
});

const publico = async () => {
  const res = await pedir("/api/barrios/prueba/meses/2099-01");
  return (await res.json()) as { turnos: { id: string; estado: string; motivoBloqueo: string | null }[] };
};
const estadoPublico = async (id: string) => (await publico()).turnos.find((t) => t.id === id)!;

describe("bloquear un turno", () => {
  it("bloquea con motivo y la vista pública lo muestra; desbloquear limpia el motivo", async () => {
    const res = await pedir(`${base}/turnos/${IDS.libre}`, {
      method: "PATCH",
      cookie,
      json: { bloqueado: true, motivo: "Conferencia de estaca" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      turno: { id: IDS.libre, fecha: "2099-01-10", bloqueado: true, motivoBloqueo: "Conferencia de estaca" },
    });
    expect(await estadoPublico(IDS.libre)).toMatchObject({
      estado: "bloqueado",
      motivoBloqueo: "Conferencia de estaca",
    });

    const des = await pedir(`${base}/turnos/${IDS.libre}`, {
      method: "PATCH",
      cookie,
      json: { bloqueado: false, motivo: "ignorado" },
    });
    expect(await des.json()).toMatchObject({ turno: { bloqueado: false, motivoBloqueo: null } });
    expect(await estadoPublico(IDS.libre)).toMatchObject({ estado: "libre", motivoBloqueo: null });
  });

  it("bloquear sin motivo guarda null", async () => {
    await pedir(`${base}/turnos/${IDS.libre}`, { method: "PATCH", cookie, json: { bloqueado: true } });
    const [t] = await db.select().from(turnos).where(eq(turnos.id, IDS.libre));
    expect(t.bloqueado).toBe(true);
    expect(t.motivoBloqueo).toBeNull();
  });

  it("datos inválidos → 400", async () => {
    const res = await pedir(`${base}/turnos/${IDS.libre}`, { method: "PATCH", cookie, json: { bloqueado: "si" } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "DATOS_INVALIDOS" });
  });

  it("un turno de otro barrio → 404", async () => {
    const res = await pedir(`${base}/turnos/${IDS.otroBarrio}`, { method: "PATCH", cookie, json: { bloqueado: true } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NO_ENCONTRADO" });
    const [t] = await db.select().from(turnos).where(eq(turnos.id, IDS.otroBarrio));
    expect(t.bloqueado).toBe(false);
  });
});

describe("bloquear un día", () => {
  it("bloquea los turnos de todos los compañerismos, también el inactivo (decisión: si se reactiva, el día sigue bloqueado)", async () => {
    const res = await pedir(`${base}/dias/2099-01-10`, {
      method: "PATCH",
      cookie,
      json: { bloqueado: true, motivo: "Conferencia" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      dia: { fecha: "2099-01-10", bloqueado: true, motivoBloqueo: "Conferencia", turnos: 3 },
    });

    const p = await publico();
    expect(p.turnos.find((t) => t.id === IDS.libre)!.estado).toBe("bloqueado");
    expect(p.turnos.find((t) => t.id === IDS.libreHermanas)!.estado).toBe("bloqueado");
    const [inactivo] = await db.select().from(turnos).where(eq(turnos.id, IDS.inactivo));
    expect(inactivo.bloqueado).toBe(true);
    // No toca otros días ni otros barrios.
    const [otro] = await db.select().from(turnos).where(eq(turnos.id, IDS.otroBarrio));
    expect(otro.bloqueado).toBe(false);
    expect((await estadoPublico(IDS.tomado)).estado).toBe("tomado");
  });

  it("desbloquear el día limpia los motivos", async () => {
    await pedir(`${base}/dias/2099-01-10`, { method: "PATCH", cookie, json: { bloqueado: true, motivo: "X" } });
    await pedir(`${base}/dias/2099-01-10`, { method: "PATCH", cookie, json: { bloqueado: false } });
    expect(await estadoPublico(IDS.libre)).toMatchObject({ estado: "libre", motivoBloqueo: null });
  });

  it("día sin turnos → 404; fecha mal formada → 400", async () => {
    const res = await pedir(`${base}/dias/2099-01-20`, { method: "PATCH", cookie, json: { bloqueado: true } });
    expect(res.status).toBe(404);
    const mal = await pedir(`${base}/dias/manana`, { method: "PATCH", cookie, json: { bloqueado: true } });
    expect(mal.status).toBe(400);
  });
});

describe("asignar a mano", () => {
  it("turno libre → 201 con origen admin, sin token", async () => {
    const res = await pedir(`${base}/turnos/${IDS.libre}/inscripcion`, { method: "POST", cookie, json: nueva });
    expect(res.status).toBe(201);
    const cuerpo = (await res.json()) as { inscripcion: { id: string }; tokenEdicion?: string };
    expect(cuerpo.tokenEdicion).toBeUndefined();
    expect(cuerpo.inscripcion).toMatchObject({
      turnoId: IDS.libre,
      fecha: "2099-01-10",
      nombre: "Hna. Rojas",
      origen: "admin",
      consentimientoTelefono: true,
    });

    const [fila] = await db.select().from(inscripciones).where(eq(inscripciones.id, cuerpo.inscripcion.id));
    expect(fila).toMatchObject({ origen: "admin", creadoPorUserId: adminId, tokenEdicionHash: null });
    expect((await estadoPublico(IDS.libre)).estado).toBe("tomado");
  });

  it.each([IDS.pasado, IDS.borrador, IDS.cerrado])(
    "sirve en día pasado, mes borrador o cerrado (%s)",
    async (id) => {
      const res = await pedir(`${base}/turnos/${id}/inscripcion`, {
        method: "POST",
        cookie,
        json: { nombre: "Familia Soto" },
      });
      expect(res.status).toBe(201);
    },
  );

  it("tomado → 409; bloqueado → 422", async () => {
    const tomado = await pedir(`${base}/turnos/${IDS.tomado}/inscripcion`, { method: "POST", cookie, json: nueva });
    expect(tomado.status).toBe(409);
    expect(await tomado.json()).toEqual({ error: "TURNO_TOMADO" });
    const bloq = await pedir(`${base}/turnos/${IDS.bloqueadoConInscripcion}/inscripcion`, {
      method: "POST",
      cookie,
      json: nueva,
    });
    expect(bloq.status).toBe(422);
    expect(await bloq.json()).toEqual({ error: "TURNO_BLOQUEADO" });
  });

  it("datos inválidos → 400; turno de otro barrio → 404", async () => {
    const mal = await pedir(`${base}/turnos/${IDS.libre}/inscripcion`, { method: "POST", cookie, json: { nombre: "x" } });
    expect(mal.status).toBe(400);
    expect(await mal.json()).toMatchObject({ error: "DATOS_INVALIDOS", campos: ["nombre"] });
    const otro = await pedir(`${base}/turnos/${IDS.otroBarrio}/inscripcion`, { method: "POST", cookie, json: nueva });
    expect(otro.status).toBe(404);
  });
});

describe("editar y borrar inscripciones", () => {
  it("edita una inscripción pública sin token y ve los datos privados", async () => {
    const res = await pedir(`${base}/inscripciones/i-tomado`, {
      method: "PATCH",
      cookie,
      json: { nombre: "Hna. Pérez de Soto", nota: null },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      inscripcion: {
        id: "i-tomado",
        nombre: "Hna. Pérez de Soto",
        nota: null,
        telefono: "+56 9 1111 2222",
        origen: "publico",
      },
    });
    const [fila] = await db.select().from(inscripciones).where(eq(inscripciones.id, "i-tomado"));
    expect(fila.nombre).toBe("Hna. Pérez de Soto");
    expect(fila.nota).toBeNull();
  });

  it("sin consentimiento no devuelve el teléfono (ni al editar ni al anotar a mano)", async () => {
    const editada = await pedir(`${base}/inscripciones/i-bloqueado`, { method: "PATCH", cookie, json: { nombre: "Hna. Otra" } });
    expect(editada.status).toBe(200);
    expect(await editada.json()).toMatchObject({ inscripcion: { telefono: null, consentimientoTelefono: false } });

    const creada = await pedir(`${base}/turnos/${IDS.libre}/inscripcion`, {
      method: "POST",
      cookie,
      json: { ...nueva, consentimientoTelefono: false },
    });
    expect(creada.status).toBe(201);
    expect(await creada.json()).toMatchObject({ inscripcion: { telefono: null, consentimientoTelefono: false } });
  });

  it("no puede dar un consentimiento que la persona no dio, pero sí quitarlo", async () => {
    const dar = await pedir(`${base}/inscripciones/i-bloqueado`, { method: "PATCH", cookie, json: { consentimientoTelefono: true } });
    expect(dar.status).toBe(400);
    expect(await dar.json()).toEqual({ error: "DATOS_INVALIDOS", campos: ["consentimientoTelefono"] });

    const quitar = await pedir(`${base}/inscripciones/i-tomado`, { method: "PATCH", cookie, json: { consentimientoTelefono: false } });
    expect(quitar.status).toBe(200);
    expect(await quitar.json()).toMatchObject({ inscripcion: { telefono: null, consentimientoTelefono: false } });
  });

  it("también en día pasado (el admin no tiene esa restricción)", async () => {
    await db.insert(inscripciones).values({ id: "i-pasada", turnoId: IDS.pasado, nombre: "Vieja", origen: "publico" });
    const res = await pedir(`${base}/inscripciones/i-pasada`, { method: "PATCH", cookie, json: { nombre: "Nueva" } });
    expect(res.status).toBe(200);
  });

  it("datos inválidos → 400", async () => {
    const res = await pedir(`${base}/inscripciones/i-tomado`, { method: "PATCH", cookie, json: { nombre: "x" } });
    expect(res.status).toBe(400);
  });

  it("borrar → 204 y el turno queda libre en la vista pública", async () => {
    const res = await pedir(`${base}/inscripciones/i-tomado`, { method: "DELETE", cookie });
    expect(res.status).toBe(204);
    expect((await estadoPublico(IDS.tomado)).estado).toBe("libre");
    expect((await pedir(`${base}/inscripciones/i-tomado`, { method: "DELETE", cookie })).status).toBe(404);
  });

  it("una inscripción de otro barrio → 404 (editar y borrar)", async () => {
    await db.insert(inscripciones).values({ id: "i-otro", turnoId: IDS.otroBarrio, nombre: "Ajena", origen: "publico" });
    expect((await pedir(`${base}/inscripciones/i-otro`, { method: "PATCH", cookie, json: { nombre: "Hackeada" } })).status).toBe(404);
    expect((await pedir(`${base}/inscripciones/i-otro`, { method: "DELETE", cookie })).status).toBe(404);
    const [fila] = await db.select().from(inscripciones).where(eq(inscripciones.id, "i-otro"));
    expect(fila.nombre).toBe("Ajena");
  });
});

describe("permisos", () => {
  it("admin de otro barrio → 403 SIN_PERMISO", async () => {
    await crearAdmin({ email: "otra@x.cl", barrios: ["b2"] });
    const c2 = await iniciarSesion("otra@x.cl");
    const casos: [string, string, unknown][] = [
      [`${base}/turnos/${IDS.libre}`, "PATCH", { bloqueado: true }],
      [`${base}/dias/2099-01-10`, "PATCH", { bloqueado: true }],
      [`${base}/turnos/${IDS.libre}/inscripcion`, "POST", nueva],
      [`${base}/inscripciones/i-tomado`, "PATCH", { nombre: "Otra" }],
      [`${base}/inscripciones/i-tomado`, "DELETE", undefined],
    ];
    for (const [ruta, method, json] of casos) {
      const res = await pedir(ruta, { method, cookie: c2, json });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "SIN_PERMISO" });
    }
  });

  it("sin sesión → 401", async () => {
    const res = await pedir(`${base}/turnos/${IDS.libre}`, { method: "PATCH", json: { bloqueado: true } });
    expect(res.status).toBe(401);
  });
});
