import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { barrios, inscripciones } from "@/db/schema";
import type { Db } from "@/db";
import { CODIGOS, IDS, NOTA_PRIVADA, TELEFONO_PRIVADO, entrarComoMisioneros, pedir, sembrar, tokenMisioneros } from "./datos";

/**
 * Calendario de misioneros: entran en /:barrio/m con el código del barrio y reciben un token que
 * viaja en `Authorization: Bearer`, así no queda en la URL de la API ni en sus logs.
 */

let db: Db;
let TOKEN: string;
let TOKEN_OTRO: string;
beforeEach(async () => {
  db = await sembrar();
  TOKEN = await tokenMisioneros("prueba");
  TOKEN_OTRO = await tokenMisioneros("otro");
});
const TELEFONO_SIN_CONSENTIMIENTO = "+56 9 3333 4444";

const verBarrio = (token?: string, slug = "prueba") => pedir(`/api/barrios/${slug}/misioneros`, { token });
const verMes = (periodo: string, token?: string, slug = "prueba") =>
  pedir(`/api/barrios/${slug}/misioneros/meses/${periodo}`, { token });

describe("POST /api/barrios/:slug/misioneros/acceso", () => {
  it("con el código del barrio entrega un token que sirve para ver el calendario", async () => {
    const res = await entrarComoMisioneros(CODIGOS.prueba);
    expect(res.status).toBe(200);
    const { token } = await res.json<any>();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // El token no es el código: verlo en un teléfono no sirve para entrar desde otro.
    expect(token).not.toContain(CODIGOS.prueba);
    expect((await verBarrio(token)).status).toBe(200);
  });

  it.each([["k7pm2x"], ["K7P-M2X"], [" k7p m2x "]])("acepta el código como se escriba: %s", async (codigo) => {
    expect((await entrarComoMisioneros(codigo)).status).toBe(200);
  });

  it("código incorrecto, de otro barrio o barrio inexistente: el mismo 404", async () => {
    for (const res of [
      await entrarComoMisioneros("AAAAAA"),
      await entrarComoMisioneros(CODIGOS.otro),
      await entrarComoMisioneros(CODIGOS.prueba, "no-existe"),
      await entrarComoMisioneros(""),
    ]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "CODIGO_INVALIDO" });
    }
  });

  it("un barrio que quedara sin código no se abre con un código vacío", async () => {
    await db.update(barrios).set({ codigoMisioneros: "" }).where(eq(barrios.id, "b1"));
    for (const codigo of ["", " ", "-"]) expect((await entrarComoMisioneros(codigo)).status).toBe(404);
  });

  it("el token de un barrio no sirve en otro", async () => {
    expect((await verBarrio(TOKEN, "otro")).status).toBe(404);
  });

  /** El mismo `limit` que el binding LIMITE_ACCESO_MISIONEROS de wrangler.jsonc. */
  const LIMITE = 10;

  it("pasado el límite por IP responde 429, aunque después llegue el código correcto", async () => {
    // Ventanas fijas: si el minuto cambia a mitad de camino pasan más de LIMITE, nunca más del doble.
    let pasaron = 0;
    while ((await entrarComoMisioneros("AAAAAA", "prueba", "203.0.113.50")).status !== 429 && pasaron <= 2 * LIMITE) pasaron++;
    expect(pasaron).toBeGreaterThanOrEqual(LIMITE);
    expect(pasaron).toBeLessThanOrEqual(2 * LIMITE);
    const res = await entrarComoMisioneros(CODIGOS.prueba, "prueba", "203.0.113.50");
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "DEMASIADOS_INTENTOS" });
    expect((await entrarComoMisioneros(CODIGOS.prueba, "prueba", "203.0.113.51")).status).toBe(200);
    // Se cuenta por IP y barrio: detrás del mismo CGNAT, otro barrio sigue entrando.
    expect((await entrarComoMisioneros(CODIGOS.otro, "otro", "203.0.113.50")).status).toBe(200);
  });
});

describe("GET /api/barrios/:slug/misioneros", () => {
  it("con el token devuelve el barrio y los meses abiertos y cerrados, sin borradores", async () => {
    const res = await verBarrio(TOKEN);
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.barrio).toEqual({
      slug: "prueba",
      nombre: "Barrio Prueba",
      idioma: "es",
      zonaHoraria: "America/Santiago",
    });
    expect(body.meses).toEqual([
      { anio: 2000, mes: 1, estado: "abierto" },
      { anio: 2099, mes: 1, estado: "abierto" },
      { anio: 2099, mes: 3, estado: "cerrado" },
    ]);
    expect(body.hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sin token, con uno incorrecto, de otro barrio o de un barrio que no existe: el mismo 404", async () => {
    for (const res of [
      await verBarrio(),
      await verBarrio("nada"),
      await verBarrio(TOKEN_OTRO),
      await verBarrio(TOKEN, "no-existe"),
    ]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "TOKEN_INVALIDO" });
    }
  });

  it("al cambiar el código, los teléfonos que entraron con el anterior quedan afuera", async () => {
    await db.update(barrios).set({ codigoMisioneros: "N3WCDD" }).where(eq(barrios.id, "b1"));
    expect((await verBarrio(TOKEN)).status).toBe(404);
    expect((await verMes("2099-01", TOKEN)).status).toBe(404);
    expect((await entrarComoMisioneros(CODIGOS.prueba)).status).toBe(404);
    const nuevo = (await (await entrarComoMisioneros("N3WCDD")).json<any>()).token;
    expect((await verBarrio(nuevo)).status).toBe(200);
  });

  it("el token no sirve en la URL", async () => {
    expect((await pedir(`/api/barrios/prueba/misioneros?token=${TOKEN}`)).status).toBe(404);
  });
});

describe("GET /api/barrios/:slug/misioneros/meses/:periodo", () => {
  it("devuelve los turnos con nombre, modalidad, nota y teléfono con consentimiento", async () => {
    const res = await verMes("2099-01", TOKEN);
    expect(res.status).toBe(200);
    const body = await res.json<any>();

    expect(body.mes).toEqual({ anio: 2099, mes: 1, estado: "abierto" });
    expect(body.companerismos.map((c: any) => c.nombre)).toEqual(["Élderes", "Hermanas"]);
    const porId = Object.fromEntries(body.turnos.map((t: any) => [t.id, t]));
    expect(porId[IDS.tomado]).toEqual({
      id: IDS.tomado,
      fecha: "2099-01-11",
      companerismoId: "c-e",
      estado: "tomado",
      nombre: "Hna. Pérez",
      telefono: TELEFONO_PRIVADO,
      modalidad: "en_casa",
      nota: NOTA_PRIVADA,
      motivoBloqueo: null,
    });
    expect(porId[IDS.deAdmin]).toMatchObject({ estado: "tomado", nombre: "Familia Muñoz", telefono: null });
    expect(porId[IDS.libre]).toMatchObject({ estado: "libre", nombre: null, telefono: null, nota: null });
    // El bloqueo manda: no se muestra quién estaba anotada ni sus datos.
    expect(porId[IDS.bloqueadoConInscripcion]).toMatchObject({
      estado: "bloqueado",
      nombre: null,
      telefono: null,
      nota: null,
      motivoBloqueo: "Conferencia de estaca",
    });
    expect(porId[IDS.inactivo]).toBeUndefined();
    expect(body.hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sin consentimiento, el teléfono no aparece en ninguna parte de la respuesta", async () => {
    await db.insert(inscripciones).values({
      turnoId: IDS.libreHermanas,
      nombre: "Hna. Reservada",
      telefono: TELEFONO_SIN_CONSENTIMIENTO,
      consentimientoTelefono: false,
      modalidad: "llevar",
      nota: "14:00",
      origen: "publico",
      tokenEdicionHash: "hash-que-no-debe-salir",
    });
    const res = await verMes("2099-01", TOKEN);
    const texto = await res.text();
    expect(texto).toContain("Hna. Reservada");
    expect(texto).not.toContain(TELEFONO_SIN_CONSENTIMIENTO);
    expect(texto).not.toContain("hash-que-no-debe-salir");
    expect(texto).not.toMatch(/token|consentimiento|origen/i);

    const turno = JSON.parse(texto).turnos.find((t: any) => t.id === IDS.libreHermanas);
    expect(turno).toMatchObject({ nombre: "Hna. Reservada", telefono: null, modalidad: "llevar", nota: "14:00" });
  });

  it("muestra meses cerrados pero no borradores", async () => {
    expect((await verMes("2099-03", TOKEN)).status).toBe(200);
    const res = await verMes("2099-02", TOKEN);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NO_ENCONTRADO" });
  });

  it("con token de otro barrio o regenerado responde 404 sin datos", async () => {
    for (const res of [await verMes("2099-01", TOKEN_OTRO), await verMes("2099-01"), await verMes("2099-01", TOKEN, "otro")]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "TOKEN_INVALIDO" });
    }
  });

  it("rechaza un periodo mal formado", async () => {
    const res = await verMes("2099-13", TOKEN);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "DATOS_INVALIDOS", campos: ["periodo"] });
  });
});
