import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { inscripciones, meses } from "@/db/schema";
import type { Db } from "@/db";
import { claveDeIp, esViolacionUnica, sha256Hex } from "@/worker/http";
import { CODIGOS, IDS, NOTA_PRIVADA, TELEFONO_PRIVADO, TOKEN_TOMADO, pedir, sembrar } from "./datos";

let db: Db;
beforeEach(async () => {
  db = await sembrar();
});

const anotarse = (turnoId: string, json: unknown = { nombre: "Hna. Nueva" }, slug = "prueba") =>
  pedir(`/api/barrios/${slug}/turnos/${turnoId}/inscripcion`, { method: "POST", json });

describe("buscadores", () => {
  it("la API pide no indexar, también en los errores", async () => {
    expect((await pedir("/api/barrios/prueba")).headers.get("X-Robots-Tag")).toBe("noindex");
    expect((await pedir("/api/barrios/nada")).headers.get("X-Robots-Tag")).toBe("noindex");
  });
});

describe("GET /api/barrios/:slug", () => {
  it("devuelve el barrio y solo los meses abiertos", async () => {
    const res = await pedir("/api/barrios/prueba");
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.barrio).toMatchObject({ slug: "prueba", idioma: "es", zonaHoraria: "America/Santiago" });
    expect(body.mesesAbiertos).toEqual([
      { anio: 2000, mes: 1 },
      { anio: 2099, mes: 1 },
    ]);
    expect(body.hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // El código de los misioneros nunca sale en la vista pública.
    expect(JSON.stringify(body)).not.toContain(CODIGOS.prueba);
  });

  it("responde 404 con código si el barrio no existe", async () => {
    const res = await pedir("/api/barrios/nada");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NO_ENCONTRADO" });
  });
});

describe("GET /api/barrios/:slug/meses/:periodo", () => {
  it("lista turnos con estado y solo el nombre de quien se anotó", async () => {
    const res = await pedir("/api/barrios/prueba/meses/2099-01");
    expect(res.status).toBe(200);
    const body = await res.json<any>();

    expect(body.companerismos.map((c: any) => c.nombre)).toEqual(["Élderes", "Hermanas"]);
    const porId = Object.fromEntries(body.turnos.map((t: any) => [t.id, t]));
    expect(porId[IDS.libre]).toMatchObject({ estado: "libre", nombre: null, inscripcionId: null });
    expect(porId[IDS.tomado]).toEqual({
      id: IDS.tomado,
      fecha: "2099-01-11",
      companerismoId: "c-e",
      estado: "tomado",
      nombre: "Hna. Pérez",
      inscripcionId: "i-tomado",
      motivoBloqueo: null,
    });
    // El bloqueo manda: no se muestra quién estaba anotada.
    expect(porId[IDS.bloqueadoConInscripcion]).toMatchObject({
      estado: "bloqueado",
      nombre: null,
      inscripcionId: null,
      motivoBloqueo: "Conferencia de estaca",
    });
    // Compañerismos inactivos no aparecen.
    expect(porId[IDS.inactivo]).toBeUndefined();
  });

  it("nunca expone teléfono, nota ni token", async () => {
    const texto = await (await pedir("/api/barrios/prueba/meses/2099-01")).text();
    expect(texto).not.toContain(TELEFONO_PRIVADO);
    expect(texto).not.toContain(NOTA_PRIVADA);
    expect(texto).not.toMatch(/telefono|nota"|token/i);
  });

  it("muestra meses cerrados pero no borradores", async () => {
    expect((await pedir("/api/barrios/prueba/meses/2099-03")).status).toBe(200);
    expect((await pedir("/api/barrios/prueba/meses/2099-02")).status).toBe(404);
  });

  it("rechaza un periodo mal formado", async () => {
    const res = await pedir("/api/barrios/prueba/meses/2099-13");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "DATOS_INVALIDOS", campos: ["periodo"] });
  });
});

describe("GET /api/barrios/:slug/turnos/:turnoId", () => {
  it("devuelve el turno para el formulario, sin datos privados", async () => {
    const res = await pedir(`/api/barrios/prueba/turnos/${IDS.tomado}`);
    expect(res.status).toBe(200);
    const texto = await res.text();
    expect(JSON.parse(texto)).toMatchObject({
      turno: { id: IDS.tomado, estado: "tomado", nombre: "Hna. Pérez", inscripcionId: "i-tomado" },
      companerismo: { nombre: "Élderes", tipo: "elderes" },
      mes: { anio: 2099, mes: 1, estado: "abierto" },
    });
    expect(texto).not.toContain(TELEFONO_PRIVADO);
  });

  it("no encuentra turnos de otro barrio, de borradores ni de compañerismos inactivos", async () => {
    for (const id of [IDS.otroBarrio, IDS.borrador, IDS.inactivo]) {
      expect((await pedir(`/api/barrios/prueba/turnos/${id}`)).status).toBe(404);
    }
  });
});

describe("POST inscripción", () => {
  it("crea la inscripción, entrega el token una vez y guarda solo su hash", async () => {
    const res = await anotarse(IDS.libre, {
      nombre: "  Hna. Nueva  ",
      telefono: "+56 9 3333 4444",
      consentimientoTelefono: true,
      modalidad: "llevar",
      nota: "",
    });
    expect(res.status).toBe(201);
    const body = await res.json<any>();
    expect(body.tokenEdicion).toMatch(/^[0-9a-f]{64}$/);
    expect(body.inscripcion).toMatchObject({
      turnoId: IDS.libre,
      fecha: "2099-01-10",
      nombre: "Hna. Nueva",
      telefono: "+56 9 3333 4444",
      modalidad: "llevar",
      nota: null,
    });

    const guardada = await db.query.inscripciones.findFirst({ where: eq(inscripciones.turnoId, IDS.libre) });
    expect(guardada?.origen).toBe("publico");
    expect(guardada?.tokenEdicionHash).toBe(await sha256Hex(body.tokenEdicion));

    const mes = await (await pedir("/api/barrios/prueba/meses/2099-01")).json<any>();
    expect(mes.turnos.find((t: any) => t.id === IDS.libre)).toMatchObject({ estado: "tomado", nombre: "Hna. Nueva" });
  });

  it("responde 409 TURNO_TOMADO si el turno ya tiene inscripción", async () => {
    const res = await anotarse(IDS.tomado);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "TURNO_TOMADO" });
  });

  it("si dos personas se anotan a la vez, solo una lo consigue", async () => {
    const respuestas = await Promise.all([anotarse(IDS.libre), anotarse(IDS.libre), anotarse(IDS.libre)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });

  it("detecta la violación del UNIQUE tal como la lanza D1 a través de Drizzle", async () => {
    const duplicada = db.insert(inscripciones).values({ turnoId: IDS.tomado, nombre: "Otra", origen: "publico" });
    const error = await duplicada.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).not.toBeNull();
    expect(esViolacionUnica(error)).toBe(true);
    expect(esViolacionUnica(new Error("otra cosa"))).toBe(false);
  });

  it.each([
    [IDS.bloqueadoConInscripcion, 422, "TURNO_BLOQUEADO"],
    [IDS.pasado, 422, "TURNO_PASADO"],
    [IDS.cerrado, 422, "MES_NO_ABIERTO"],
    [IDS.borrador, 404, "NO_ENCONTRADO"],
    [IDS.inactivo, 404, "NO_ENCONTRADO"],
    [IDS.otroBarrio, 404, "NO_ENCONTRADO"],
  ])("rechaza el turno %s con %i %s", async (turnoId, status, error) => {
    const res = await anotarse(turnoId);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });

  it("valida los datos y dice qué campos fallaron", async () => {
    const res = await anotarse(IDS.libre, { nombre: "X", telefono: "llámame", modalidad: "delivery" });
    expect(res.status).toBe(400);
    const body = await res.json<any>();
    expect(body.error).toBe("DATOS_INVALIDOS");
    expect(body.campos.sort()).toEqual(["modalidad", "nombre", "telefono"]);
  });
});

describe("/api/inscripciones/:id con token de edición", () => {
  const ruta = "/api/inscripciones/i-tomado";

  it("con el token, la dueña ve sus propios datos (incluido el teléfono)", async () => {
    const res = await pedir(ruta, { token: TOKEN_TOMADO });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).inscripcion).toMatchObject({
      id: "i-tomado",
      fecha: "2099-01-11",
      companerismoNombre: "Élderes",
      barrio: { slug: "prueba", nombre: "Barrio Prueba" },
      telefono: TELEFONO_PRIVADO,
      nota: NOTA_PRIVADA,
      editable: true,
    });
  });

  it("sin token o con uno incorrecto responde 403; si no existe, 404", async () => {
    expect((await pedir(ruta)).status).toBe(403);
    const res = await pedir(ruta, { token: "otro" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "TOKEN_INVALIDO" });
    expect((await pedir("/api/inscripciones/no-existe", { token: TOKEN_TOMADO })).status).toBe(404);
  });

  it("las anotadas por un admin no se pueden tocar con ningún token", async () => {
    expect((await pedir("/api/inscripciones/i-admin", { token: "" })).status).toBe(403);
    expect((await pedir("/api/inscripciones/i-admin", { token: "cualquiera" })).status).toBe(403);
  });

  it("PATCH cambia solo lo enviado; vacío borra un opcional", async () => {
    const res = await pedir(ruta, { method: "PATCH", token: TOKEN_TOMADO, json: { nombre: "Hna. Pérez Soto", nota: "" } });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).inscripcion).toMatchObject({
      nombre: "Hna. Pérez Soto",
      nota: null,
      telefono: TELEFONO_PRIVADO,
      consentimientoTelefono: true,
      modalidad: "en_casa",
    });
  });

  it("PATCH valida los datos", async () => {
    const res = await pedir(ruta, { method: "PATCH", token: TOKEN_TOMADO, json: { nombre: "" } });
    expect(res.status).toBe(400);
  });

  it("DELETE cancela y el turno vuelve a quedar libre", async () => {
    const res = await pedir(ruta, { method: "DELETE", token: TOKEN_TOMADO });
    expect(res.status).toBe(204);
    expect((await pedir(ruta, { token: TOKEN_TOMADO })).status).toBe(404);

    const mes = await (await pedir("/api/barrios/prueba/meses/2099-01")).json<any>();
    expect(mes.turnos.find((t: any) => t.id === IDS.tomado)).toMatchObject({ estado: "libre", nombre: null });
  });

  it("no se puede editar ni cancelar en un mes cerrado o un día pasado", async () => {
    // Se anota hoy en el turno futuro y luego la presidenta cierra el mes.
    const creada = await (await anotarse(IDS.libreHermanas)).json<any>();
    await db.update(meses).set({ estado: "cerrado" }).where(eq(meses.id, "m-futuro"));
    const r = `/api/inscripciones/${creada.inscripcion.id}`;
    const get = await (await pedir(r, { token: creada.tokenEdicion })).json<any>();
    expect(get.inscripcion.editable).toBe(false);
    const del = await pedir(r, { method: "DELETE", token: creada.tokenEdicion });
    expect(del.status).toBe(422);
    expect(await del.json()).toEqual({ error: "MES_NO_ABIERTO" });
  });
});


describe("límite de inscripciones por IP", () => {
  /** El mismo `limit` que el binding LIMITE_INSCRIPCIONES de wrangler.jsonc. */
  const LIMITE = 30;
  // El contador vive en el binding y no se reinicia entre tests: cada test usa su propia IP.
  const desde = (ip: string, turnoId = "no-existe") =>
    pedir(`/api/barrios/prueba/turnos/${turnoId}/inscripcion`, {
      method: "POST",
      json: { nombre: "Hna. Nueva" },
      headers: { "cf-connecting-ip": ip },
    });
  /**
   * Manda intentos hasta el primer 429 y devuelve cuántos pasaron. El limitador usa ventanas fijas:
   * si el minuto cambia a mitad de camino pasan más de LIMITE, pero nunca más del doble.
   */
  const agotar = async (ip: (i: number) => string) => {
    let pasaron = 0;
    while ((await desde(ip(pasaron))).status !== 429 && pasaron <= 2 * LIMITE) pasaron++;
    expect(pasaron).toBeGreaterThanOrEqual(LIMITE);
    expect(pasaron).toBeLessThanOrEqual(2 * LIMITE);
  };

  it("al pasar el límite responde 429 DEMASIADOS_INTENTOS sin tocar la base", async () => {
    await agotar(() => "203.0.113.1");
    const res = await desde("203.0.113.1", IDS.libreHermanas);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "DEMASIADOS_INTENTOS" });
    const mes = await (await pedir("/api/barrios/prueba/meses/2099-01")).json<any>();
    expect(mes.turnos.find((t: any) => t.id === IDS.libreHermanas)).toMatchObject({ estado: "libre" });
  });

  it("cuenta cada IP por separado", async () => {
    await agotar(() => "203.0.113.2");
    expect((await desde("203.0.113.3", IDS.libreHermanas)).status).toBe(201);
  });

  it("en IPv6 cuenta la /64 completa: cambiar de dirección dentro de ella no reinicia el contador", async () => {
    await agotar((i) => `2001:db8:1:2::${(i + 1).toString(16)}`);
    expect((await desde("2001:0db8:0001:0002:ffff:ffff:ffff:ffff")).status).toBe(429);
    expect((await desde("2001:db8:1:3::1", IDS.libreHermanas)).status).toBe(201);
  });
});

describe("claveDeIp", () => {
  it("IPv4 tal cual; IPv6 por su /64 aunque venga abreviada", () => {
    expect(claveDeIp("203.0.113.7")).toBe("203.0.113.7");
    expect(claveDeIp("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(claveDeIp("2001:DB8:0:0:abcd::")).toBe("2001:db8:0:0::/64");
    expect(claveDeIp("::1")).toBe("0:0:0:0::/64");
  });
});
