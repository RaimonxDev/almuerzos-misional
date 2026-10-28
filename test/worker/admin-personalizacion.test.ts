import { env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";
import { MAX_BYTES_IMAGEN } from "@/shared/personalizacion";
import { crearAdmin, iniciarSesion, pedir, sembrar } from "./datos";

const MES = "/api/admin/barrios/prueba/meses/2099-01";
const PERSONALIZACION = `${MES}/personalizacion`;
const IMAGEN = `${MES}/imagen`;
let cookie: string;

type Personalizacion = {
  imagenKey: string | null;
  escritura: string | null;
  escrituraRef: string | null;
  mensaje: string | null;
  plantilla: string;
};
const leer = async (res: Response) => ((await res.json()) as { personalizacion: Personalizacion }).personalizacion;
const subir = (bytes: BodyInit, tipo: string, ruta = IMAGEN, ck = cookie) =>
  pedir(ruta, { method: "PUT", cookie: ck, body: bytes, headers: { "Content-Type": tipo } });
const PNG = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

beforeEach(async () => {
  await sembrar();
  await crearAdmin({ email: "p@x.cl", barrios: ["b1"] });
  cookie = await iniciarSesion("p@x.cl");
});

describe("permisos", () => {
  test("sin sesión → 401", async () => {
    for (const [method, ruta] of [
      ["PATCH", PERSONALIZACION],
      ["PUT", IMAGEN],
      ["DELETE", IMAGEN],
    ]) {
      const res = await pedir(ruta, { method, json: {} });
      expect(res.status, `${method} ${ruta}`).toBe(401);
    }
  });

  test("admin de otro barrio → 403", async () => {
    await crearAdmin({ email: "o@x.cl", barrios: ["b2"] });
    const otra = await iniciarSesion("o@x.cl");
    expect((await pedir(PERSONALIZACION, { method: "PATCH", cookie: otra, json: { mensaje: "x" } })).status).toBe(403);
    expect((await subir(PNG, "image/png", IMAGEN, otra)).status).toBe(403);
    expect((await pedir(IMAGEN, { method: "DELETE", cookie: otra })).status).toBe(403);
    expect((await env.IMAGENES.list()).objects).toHaveLength(0);
  });
});

describe("PATCH /personalizacion", () => {
  test("cambia solo los campos presentes", async () => {
    let res = await pedir(PERSONALIZACION, {
      method: "PATCH",
      cookie,
      json: { escritura: "  Venid a mí  ", escrituraRef: "Mateo 11:28", mensaje: "¡Gracias!", plantilla: "dorado" },
    });
    expect(res.status).toBe(200);
    expect(await leer(res)).toEqual({
      imagenKey: null,
      escritura: "Venid a mí",
      escrituraRef: "Mateo 11:28",
      mensaje: "¡Gracias!",
      plantilla: "dorado",
    });

    res = await pedir(PERSONALIZACION, { method: "PATCH", cookie, json: { mensaje: "Otro" } });
    expect(await leer(res)).toMatchObject({ escritura: "Venid a mí", mensaje: "Otro", plantilla: "dorado" });
  });

  test("string vacío o null borra el campo", async () => {
    await pedir(PERSONALIZACION, { method: "PATCH", cookie, json: { escritura: "a", mensaje: "b" } });
    const res = await pedir(PERSONALIZACION, { method: "PATCH", cookie, json: { escritura: "  ", mensaje: null } });
    expect(await leer(res)).toMatchObject({ escritura: null, mensaje: null });
  });

  test("se puede en un mes cerrado y en uno borrador", async () => {
    for (const periodo of ["2099-03", "2099-02"]) {
      const res = await pedir(`/api/admin/barrios/prueba/meses/${periodo}/personalizacion`, {
        method: "PATCH",
        cookie,
        json: { plantilla: "cielo" },
      });
      expect(res.status).toBe(200);
    }
  });

  test("plantilla inválida → 400 con campos", async () => {
    const res = await pedir(PERSONALIZACION, { method: "PATCH", cookie, json: { plantilla: "rojo" } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "DATOS_INVALIDOS", campos: ["plantilla"] });
  });

  test("textos demasiado largos → 400", async () => {
    for (const [campo, largo] of [
      ["escritura", 401],
      ["escrituraRef", 61],
      ["mensaje", 161],
    ] as const) {
      const res = await pedir(PERSONALIZACION, { method: "PATCH", cookie, json: { [campo]: "a".repeat(largo) } });
      expect(res.status, campo).toBe(400);
      expect(await res.json()).toEqual({ error: "DATOS_INVALIDOS", campos: [campo] });
    }
  });

  test("mes inexistente → 404", async () => {
    const res = await pedir("/api/admin/barrios/prueba/meses/2098-01/personalizacion", {
      method: "PATCH",
      cookie,
      json: { mensaje: "x" },
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NO_ENCONTRADO" });
  });

  test("otro barrio por la URL → 403", async () => {
    const res = await pedir("/api/admin/barrios/otro/meses/2099-01/personalizacion", {
      method: "PATCH",
      cookie,
      json: { mensaje: "x" },
    });
    expect(res.status).toBe(403);
  });
});

describe("imagen del mes", () => {
  test("tipo no permitido → 400 IMAGEN_INVALIDA", async () => {
    for (const tipo of ["image/gif", "application/pdf", "text/html"]) {
      const res = await subir(PNG, tipo);
      expect(res.status, tipo).toBe(400);
      expect(await res.json()).toEqual({ error: "IMAGEN_INVALIDA" });
    }
    expect((await env.IMAGENES.list()).objects).toHaveLength(0);
  });

  test("cuerpo vacío → 400 IMAGEN_INVALIDA", async () => {
    const res = await subir(new Uint8Array(0), "image/png");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "IMAGEN_INVALIDA" });
  });

  test("demasiado grande → 413 IMAGEN_MUY_GRANDE", async () => {
    const res = await subir(new Uint8Array(MAX_BYTES_IMAGEN + 1), "image/png");
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "IMAGEN_MUY_GRANDE" });
    expect((await env.IMAGENES.list()).objects).toHaveLength(0);
  });

  test("subir guarda la clave y /api/imagenes la sirve con caché immutable", async () => {
    const res = await subir(PNG, "image/png");
    expect(res.status).toBe(200);
    const { imagenKey } = await leer(res);
    expect(imagenKey).toMatch(/^meses\/b1\/2099-01\/[0-9a-f-]{36}\.png$/);

    const mes = await pedir(MES, { cookie });
    expect(((await mes.json()) as { mes: { imagenKey: string } }).mes.imagenKey).toBe(imagenKey);

    // público: sin cookie
    const pub = await pedir(`/api/imagenes/${imagenKey}`);
    expect(pub.status).toBe(200);
    expect(pub.headers.get("Content-Type")).toBe("image/png");
    expect(pub.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(pub.headers.get("ETag")).toBeTruthy();
    expect(new Uint8Array(await pub.arrayBuffer())).toEqual(PNG);
  });

  test("reemplazar borra el objeto anterior del bucket", async () => {
    const vieja = (await leer(await subir(PNG, "image/png"))).imagenKey!;
    const nueva = (await leer(await subir(PNG, "image/jpeg"))).imagenKey!;
    expect(nueva).not.toBe(vieja);
    expect(nueva).toMatch(/\.jpg$/);
    expect(await env.IMAGENES.get(vieja)).toBeNull();
    expect(await env.IMAGENES.get(nueva)).not.toBeNull();
    expect((await pedir(`/api/imagenes/${vieja}`)).status).toBe(404);
  });

  test("DELETE quita la imagen", async () => {
    const key = (await leer(await subir(PNG, "image/webp"))).imagenKey!;
    const res = await pedir(IMAGEN, { method: "DELETE", cookie });
    expect(res.status).toBe(200);
    expect((await leer(res)).imagenKey).toBeNull();
    expect(await env.IMAGENES.get(key)).toBeNull();
    // idempotente
    expect((await pedir(IMAGEN, { method: "DELETE", cookie })).status).toBe(200);
  });

  test("mes inexistente → 404", async () => {
    const res = await subir(PNG, "image/png", "/api/admin/barrios/prueba/meses/2098-01/imagen");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/imagenes/*", () => {
  test("clave inexistente → 404", async () => {
    const res = await pedir("/api/imagenes/meses/b1/2099-01/no-existe.png");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NO_ENCONTRADO" });
  });

  test("rechaza claves que no empiezan con meses/", async () => {
    await env.IMAGENES.put("privado/secreto.png", PNG);
    const res = await pedir("/api/imagenes/privado/secreto.png");
    expect(res.status).toBe(404);
  });

  test("una secuencia % inválida → 404, no 500", async () => {
    const res = await pedir("/api/imagenes/meses/%E0%A4%A.png");
    expect(res.status).toBe(404);
  });
});
