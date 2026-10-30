import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { companerismos, inscripciones, turnos } from "@/db/schema";
import type { Db } from "@/db";
import { CODIGOS, crearAdmin, enlaceConCodigo, entrarComoMisioneros, iniciarSesion, pedir, sembrar, tokenMisioneros } from "./datos";

let db: Db;
let cookie: string;

beforeEach(async () => {
  db = await sembrar();
  await crearAdmin({ email: "p@x.cl", barrios: ["b1"] });
  cookie = await iniciarSesion("p@x.cl");
});

const base = "/api/admin/barrios/prueba";
const patch = (json: unknown, ruta = base) => pedir(ruta, { method: "PATCH", cookie, json });
const turnosDe = async (companerismoId: string, mesId: string) =>
  (await db.select({ id: turnos.id }).from(turnos).where(and(eq(turnos.companerismoId, companerismoId), eq(turnos.mesId, mesId))))
    .length;

describe("GET /api/admin/barrios/:slug", () => {
  it("devuelve el barrio con su código de misioneros y todos los compañerismos, activos o no", async () => {
    const res = await pedir(base, { cookie });
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.barrio).toEqual({
      slug: "prueba",
      nombre: "Barrio Prueba",
      idioma: "es",
      zonaHoraria: "America/Santiago",
      codigoMisioneros: CODIGOS.prueba,
      notaParaCocinar: null,
      contactoNombre: null,
      contactoTelefono: null,
    });
    expect(body.companerismos).toEqual([
      { id: "c-e", tipo: "elderes", nombre: "Élderes", activo: true, orden: 0 },
      { id: "c-h", tipo: "hermanas", nombre: "Hermanas", activo: true, orden: 1 },
      { id: "c-x", tipo: "elderes", nombre: "Trasladados", activo: false, orden: 2 },
    ]);
  });
});

describe("POST /codigo-misioneros", () => {
  it("cambia el código: el anterior no entra y los teléfonos que ya entraron quedan afuera", async () => {
    const token = await tokenMisioneros();
    const res = await pedir(`${base}/codigo-misioneros`, { method: "POST", cookie });
    expect(res.status).toBe(200);
    const { codigoMisioneros } = await res.json<any>();
    expect(codigoMisioneros).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(codigoMisioneros).not.toBe(CODIGOS.prueba);

    expect((await entrarComoMisioneros(CODIGOS.prueba)).status).toBe(404);
    expect((await pedir("/api/barrios/prueba/misioneros", { token })).status).toBe(404);
    expect((await entrarComoMisioneros(codigoMisioneros)).status).toBe(200);
    expect((await (await pedir(base, { cookie })).json<any>()).barrio.codigoMisioneros).toBe(codigoMisioneros);
  });
});

describe("POST /enlace", () => {
  it("cambia el enlace por uno con código; el anterior deja de funcionar y el código de misioneros sigue", async () => {
    const res = await pedir(`${base}/enlace`, { method: "POST", cookie, json: { slug: "barrio-prueba" } });
    expect(res.status).toBe(200);
    const { slug } = await res.json<any>();
    expect(slug).toMatch(enlaceConCodigo("barrio-prueba"));

    expect((await pedir("/api/barrios/prueba")).status).toBe(404);
    expect((await entrarComoMisioneros(CODIGOS.prueba)).status).toBe(404);
    expect((await pedir(`/api/barrios/${slug}`)).status).toBe(200);
    // El código no va en la URL: los misioneros entran al enlace nuevo con el mismo.
    expect((await entrarComoMisioneros(CODIGOS.prueba, slug)).status).toBe(200);
    // El panel sigue con el enlace nuevo; los meses e inscripciones no se tocan.
    expect((await pedir(`/api/admin/barrios/${slug}/meses/2099-01`, { cookie })).status).toBe(200);
    expect((await pedir(base, { cookie })).status).toBe(403);
  });

  it.each([["Mayúsculas"], ["x"], ["-guion"], ["a".repeat(55)]])("enlace inválido %s → 400", async (slug) => {
    const res = await pedir(`${base}/enlace`, { method: "POST", cookie, json: { slug } });
    expect(res.status).toBe(400);
    expect((await res.json<any>()).campos).toEqual(["slug"]);
  });
});

describe("PATCH /api/admin/barrios/:slug", () => {
  it("guarda nota, contacto, idioma y zona; la vista pública los refleja", async () => {
    const res = await patch({
      nombre: "Barrio Nuevo",
      notaParaCocinar: "Sin gluten",
      contactoNombre: "Hna. Presi",
      contactoTelefono: "+56 9 1",
      idioma: "pt",
      zonaHoraria: "America/Sao_Paulo",
    });
    expect(res.status).toBe(200);
    const { barrio } = await res.json<any>();
    expect(barrio).toMatchObject({
      nombre: "Barrio Nuevo",
      notaParaCocinar: "Sin gluten",
      contactoNombre: "Hna. Presi",
      contactoTelefono: "+56 9 1",
      idioma: "pt",
      zonaHoraria: "America/Sao_Paulo",
      codigoMisioneros: CODIGOS.prueba,
    });
    const publica = await (await pedir("/api/barrios/prueba")).json<any>();
    expect(publica.barrio).toMatchObject({ idioma: "pt", zonaHoraria: "America/Sao_Paulo", notaParaCocinar: "Sin gluten" });
  });

  it("es parcial y null en la nota la borra", async () => {
    await patch({ notaParaCocinar: "Sin gluten", contactoNombre: "Ana" });
    const res = await patch({ notaParaCocinar: null });
    const { barrio } = await res.json<any>();
    expect(barrio.notaParaCocinar).toBeNull();
    expect(barrio.contactoNombre).toBe("Ana");
    expect(barrio.idioma).toBe("es");
  });

  it("zona inválida o idioma desconocido → 400 DATOS_INVALIDOS", async () => {
    const zona = await patch({ zonaHoraria: "Marte/Olimpo" });
    expect(zona.status).toBe(400);
    expect(await zona.json()).toEqual({ error: "DATOS_INVALIDOS", campos: ["zonaHoraria"] });
    const idioma = await patch({ idioma: "fr" });
    expect(idioma.status).toBe(400);
    expect((await idioma.json<any>()).campos).toEqual(["idioma"]);
    expect((await (await pedir(base, { cookie })).json<any>()).barrio.zonaHoraria).toBe("America/Santiago");
  });
});

describe("compañerismos", () => {
  it("desactivar conserva turnos e inscripciones y desaparece de la vista pública; reactivar lo devuelve", async () => {
    const res = await patch({ activo: false }, `${base}/companerismos/c-e`);
    expect(res.status).toBe(200);
    expect((await res.json<any>()).companerismo).toEqual({ id: "c-e", tipo: "elderes", nombre: "Élderes", activo: false, orden: 0 });

    expect((await db.select().from(turnos).where(eq(turnos.companerismoId, "c-e"))).length).toBeGreaterThan(0);
    expect(await db.select().from(inscripciones).where(eq(inscripciones.id, "i-tomado"))).toHaveLength(1);

    const ids = async () =>
      (await (await pedir("/api/barrios/prueba/meses/2099-01")).json<any>()).companerismos.map((x: any) => x.id);
    expect(await ids()).toEqual(["c-h"]);

    await patch({ activo: true }, `${base}/companerismos/c-e`);
    expect(await ids()).toEqual(["c-e", "c-h"]);
  });

  it("edita nombre y orden", async () => {
    const res = await patch({ nombre: "Hermanas 9", orden: 5 }, `${base}/companerismos/c-h`);
    expect((await res.json<any>()).companerismo).toMatchObject({ nombre: "Hermanas 9", orden: 5 });
  });

  it("crear uno nuevo → 201, activo y al final", async () => {
    const res = await pedir(`${base}/companerismos`, { method: "POST", cookie, json: { tipo: "hermanas", nombre: "Hermanas 2" } });
    expect(res.status).toBe(201);
    const { companerismo } = await res.json<any>();
    expect(companerismo).toMatchObject({ tipo: "hermanas", nombre: "Hermanas 2", activo: true, orden: 3 });
    const fila = await db.select().from(companerismos).where(eq(companerismos.id, companerismo.id)).get();
    expect(fila?.barrioId).toBe("b1");
  });

  it("uno nuevo recibe turnos en los meses abiertos y borradores que no pasaron", async () => {
    const res = await pedir(`${base}/companerismos`, { method: "POST", cookie, json: { tipo: "hermanas", nombre: "Hermanas nuevas" } });
    const { companerismo } = await res.json<any>();
    expect(await turnosDe(companerismo.id, "m-futuro")).toBe(31);
    expect(await turnosDe(companerismo.id, "m-borrador")).toBe(28);
    expect(await turnosDe(companerismo.id, "m-cerrado")).toBe(0);
    expect(await turnosDe(companerismo.id, "m-pasado")).toBe(0);
  });

  it("reactivar completa los turnos que faltan sin duplicar los que ya tenía", async () => {
    expect(await turnosDe("c-x", "m-futuro")).toBe(1);
    expect((await patch({ activo: true }, `${base}/companerismos/c-x`)).status).toBe(200);
    expect(await turnosDe("c-x", "m-futuro")).toBe(31);
    expect(await turnosDe("c-x", "m-borrador")).toBe(28);
    expect(await turnosDe("c-x", "m-cerrado")).toBe(0);
  });

  it("datos inválidos → 400", async () => {
    const res = await pedir(`${base}/companerismos`, { method: "POST", cookie, json: { tipo: "otros", nombre: "" } });
    expect(res.status).toBe(400);
  });

  it("un compañerismo de otro barrio por este slug → 404 y no se toca", async () => {
    const res = await patch({ activo: false }, `${base}/companerismos/c-o`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NO_ENCONTRADO" });
    expect((await db.select().from(companerismos).where(eq(companerismos.id, "c-o")).get())?.activo).toBe(true);
  });
});

describe("permisos", () => {
  it("admin de otro barrio → 403 SIN_PERMISO en todas las rutas", async () => {
    await crearAdmin({ email: "o@x.cl", barrios: ["b2"] });
    const c = await iniciarSesion("o@x.cl");
    const intentos: [string, string, unknown?][] = [
      ["GET", base],
      ["PATCH", base, { nombre: "X" }],
      ["POST", `${base}/codigo-misioneros`],
      ["POST", `${base}/enlace`, { slug: "robado" }],
      ["POST", `${base}/companerismos`, { tipo: "elderes", nombre: "X" }],
      ["PATCH", `${base}/companerismos/c-e`, { activo: false }],
    ];
    for (const [method, ruta, json] of intentos) {
      const res = await pedir(ruta, { method, cookie: c, json });
      expect(res.status, `${method} ${ruta}`).toBe(403);
      expect(await res.json()).toEqual({ error: "SIN_PERMISO" });
    }
  });

  it("sin sesión → 401", async () => {
    const res = await pedir(base);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "NO_AUTORIZADO" });
  });
});
