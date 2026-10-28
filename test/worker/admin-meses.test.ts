import { env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";
import { crearAdmin, IDS, iniciarSesion, pedir, sembrar, TELEFONO_PRIVADO } from "./datos";

const BASE = "/api/admin/barrios/prueba/meses";
let cookie: string;

async function contarTurnos(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  const fila = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM turnos t JOIN meses m ON m.id = t.mes_id WHERE m.barrio_id = 'b1' AND m.anio = ? AND m.mes = ?",
  )
    .bind(anio, mes)
    .first<{ n: number }>();
  return fila!.n;
}

beforeEach(async () => {
  await sembrar();
  await crearAdmin({ email: "p@x.cl", barrios: ["b1"] });
  cookie = await iniciarSesion("p@x.cl");
});

describe("permisos", () => {
  test("sin sesión → 401", async () => {
    const res = await pedir(BASE);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "NO_AUTORIZADO" });
  });

  test("admin de otro barrio → 403 SIN_PERMISO en todas las rutas", async () => {
    await crearAdmin({ email: "o@x.cl", barrios: ["b2"] });
    const otra = await iniciarSesion("o@x.cl");
    const intentos: [string, string, unknown?][] = [
      ["GET", BASE],
      ["POST", BASE, { periodo: "2099-05" }],
      ["GET", `${BASE}/2099-01`],
      ["PATCH", `${BASE}/2099-02`, { estado: "abierto" }],
    ];
    for (const [method, ruta, json] of intentos) {
      const res = await pedir(ruta, { method, cookie: otra, json });
      expect(res.status, `${method} ${ruta}`).toBe(403);
      expect(await res.json()).toEqual({ error: "SIN_PERMISO" });
    }
    expect(await contarTurnos("2099-05")).toBe(0);
  });
});

describe("GET /meses", () => {
  test("lista los meses del barrio con conteos, en orden cronológico", async () => {
    const res = await pedir(BASE, { cookie });
    expect(res.status).toBe(200);
    const { meses } = (await res.json()) as { meses: Record<string, unknown>[] };
    expect(meses).toEqual([
      { periodo: "2000-01", anio: 2000, mes: 1, estado: "abierto", turnos: 1, tomados: 0, bloqueados: 0 },
      { periodo: "2099-01", anio: 2099, mes: 1, estado: "abierto", turnos: 6, tomados: 3, bloqueados: 1 },
      { periodo: "2099-02", anio: 2099, mes: 2, estado: "borrador", turnos: 1, tomados: 0, bloqueados: 0 },
      { periodo: "2099-03", anio: 2099, mes: 3, estado: "cerrado", turnos: 1, tomados: 0, bloqueados: 0 },
    ]);
  });
});

describe("POST /meses", () => {
  test("crea 2099-05 en borrador con un turno por día y compañerismo activo", async () => {
    const res = await pedir(BASE, { method: "POST", cookie, json: { periodo: "2099-05" } });
    expect(res.status).toBe(201);
    const cuerpo = (await res.json()) as { mes: Record<string, unknown> };
    expect(cuerpo.mes).toMatchObject({ periodo: "2099-05", anio: 2099, mes: 5, estado: "borrador", turnos: 62, tomados: 0, bloqueados: 0 });
    expect(await contarTurnos("2099-05")).toBe(62);

    const inactivo = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM turnos t JOIN meses m ON m.id = t.mes_id WHERE m.anio = 2099 AND m.mes = 5 AND t.companerismo_id = 'c-x'",
    ).first<{ n: number }>();
    expect(inactivo!.n).toBe(0);
  });

  test.each([
    ["2096-02", 58], // bisiesto
    ["2097-02", 56],
    ["2099-04", 60],
  ])("%s genera %i turnos", async (periodo, esperados) => {
    const res = await pedir(BASE, { method: "POST", cookie, json: { periodo } });
    expect(res.status).toBe(201);
    expect(await contarTurnos(periodo)).toBe(esperados);
  });

  test("un periodo existente → 409 MES_EXISTENTE sin duplicar turnos", async () => {
    const antes = await contarTurnos("2099-01");
    const res = await pedir(BASE, { method: "POST", cookie, json: { periodo: "2099-01" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "MES_EXISTENTE" });
    expect(await contarTurnos("2099-01")).toBe(antes);
  });

  test.each(["2099-13", "2099-5", "hola", "", "2099-00"])("periodo inválido %j → 400", async (periodo) => {
    const res = await pedir(BASE, { method: "POST", cookie, json: { periodo } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "DATOS_INVALIDOS", campos: ["periodo"] });
  });

  test("sin periodo → 400", async () => {
    const res = await pedir(BASE, { method: "POST", cookie, json: {} });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /meses/:periodo", () => {
  const cambiar = (periodo: string, estado: string) =>
    pedir(`${BASE}/${periodo}`, { method: "PATCH", cookie, json: { estado } });
  const anotarse = (turnoId: string) =>
    pedir(`/api/barrios/prueba/turnos/${turnoId}/inscripcion`, { method: "POST", json: { nombre: "Hna. Nueva" } });

  test("borrador → abierto y entonces el público puede anotarse", async () => {
    expect((await anotarse(IDS.borrador)).status).toBeGreaterThanOrEqual(400);

    const res = await cambiar("2099-02", "abierto");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mes: { periodo: "2099-02", estado: "abierto" } });

    expect((await anotarse(IDS.borrador)).status).toBe(201);
  });

  test("abierto → cerrado (el público ya no puede) y cerrado → abierto", async () => {
    expect((await cambiar("2099-01", "cerrado")).status).toBe(200);
    expect((await anotarse(IDS.libre)).status).toBe(422);
    expect((await cambiar("2099-03", "abierto")).status).toBe(200);
  });

  test.each([
    ["2099-02", "cerrado"], // borrador → cerrado
    ["2099-01", "borrador"], // abierto → borrador
    ["2099-03", "borrador"], // cerrado → borrador
    ["2099-01", "abierto"], // mismo estado
  ])("%s → %s → 422 TRANSICION_INVALIDA", async (periodo, estado) => {
    const res = await cambiar(periodo, estado);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "TRANSICION_INVALIDA" });
  });

  test("estado desconocido → 400; periodo inexistente → 404", async () => {
    expect((await cambiar("2099-01", "otra")).status).toBe(400);
    const res = await cambiar("2099-09", "abierto");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NO_ENCONTRADO" });
  });
});

describe("GET /meses/:periodo", () => {
  test("mes completo con inscripciones, también en turnos bloqueados, y teléfono solo con consentimiento", async () => {
    const res = await pedir(`${BASE}/2099-01`, { cookie });
    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as {
      mes: Record<string, unknown>;
      companerismos: { id: string }[];
      turnos: { id: string; bloqueado: boolean; motivoBloqueo: string | null; inscripcion: Record<string, unknown> | null }[];
    };
    expect(cuerpo.mes).toMatchObject({ periodo: "2099-01", anio: 2099, mes: 1, estado: "abierto", plantilla: "azul" });
    // c-x tiene un turno ese mes: se incluye aunque esté inactivo.
    expect(cuerpo.companerismos.map((c) => c.id)).toEqual(["c-e", "c-h", "c-x"]);
    expect(cuerpo.turnos).toHaveLength(6);

    const porId = Object.fromEntries(cuerpo.turnos.map((t) => [t.id, t]));
    expect(porId[IDS.libre].inscripcion).toBeNull();
    expect(porId[IDS.tomado].inscripcion).toMatchObject({
      id: "i-tomado",
      nombre: "Hna. Pérez",
      telefono: TELEFONO_PRIVADO,
      consentimientoTelefono: true,
      modalidad: "en_casa",
      origen: "publico",
    });
    expect(porId[IDS.bloqueadoConInscripcion]).toMatchObject({ bloqueado: true, motivoBloqueo: "Conferencia de estaca" });
    expect(porId[IDS.bloqueadoConInscripcion].inscripcion).toMatchObject({
      nombre: "Hna. Bloqueada",
      telefono: null,
      consentimientoTelefono: false,
    });
    expect(porId[IDS.deAdmin].inscripcion).toMatchObject({ origen: "admin", telefono: null });
    expect(JSON.stringify(cuerpo)).not.toContain("tokenEdicion");
  });

  test("muestra borradores y no incluye c-x si no tiene turnos", async () => {
    const res = await pedir(`${BASE}/2099-02`, { cookie });
    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as { mes: { estado: string }; companerismos: { id: string }[]; turnos: { id: string }[] };
    expect(cuerpo.mes.estado).toBe("borrador");
    expect(cuerpo.turnos.map((t) => t.id)).toEqual([IDS.borrador]);
    expect(cuerpo.companerismos.map((c) => c.id)).toEqual(["c-e", "c-h"]);
  });

  test("periodo inexistente → 404", async () => {
    expect((await pedir(`${BASE}/2099-09`, { cookie })).status).toBe(404);
  });
});
