import { describe, expect, it, vi } from "vitest";
import { api, codigoDe, datos, ErrorApi } from "@/app/api";
import { simularApi } from "./utilidades";

describe("datos()", () => {
  it("devuelve el JSON de una respuesta exitosa", async () => {
    simularApi({ "/api/salud": { json: { ok: true } } });
    await expect(datos(api.api.salud.$get())).resolves.toEqual({ ok: true });
  });

  it("lanza ErrorApi con el código, el status y los campos", async () => {
    simularApi({ "/api/salud": { status: 400, json: { error: "DATOS_INVALIDOS", campos: ["nombre"] } } });
    const error = await datos(api.api.salud.$get()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error).toMatchObject({ codigo: "DATOS_INVALIDOS", status: 400, campos: ["nombre"] });
  });

  it("un código desconocido o un cuerpo que no es JSON se vuelven ERROR_INTERNO", async () => {
    simularApi({ "/api/salud": { status: 418, json: { error: "OTRA_COSA" } } });
    expect(codigoDe(await datos(api.api.salud.$get()).catch((e: unknown) => e))).toBe("ERROR_INTERNO");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 502 })));
    expect(await datos(api.api.salud.$get()).catch((e: unknown) => e)).toMatchObject({ codigo: "ERROR_INTERNO", status: 502 });
  });

  it("sin conexión lanza ERROR_INTERNO con status 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await datos(api.api.salud.$get()).catch((e: unknown) => e)).toMatchObject({ codigo: "ERROR_INTERNO", status: 0 });
  });

  it("codigoDe da ERROR_INTERNO para cualquier error que no sea de la API", () => {
    expect(codigoDe(new Error("x"))).toBe("ERROR_INTERNO");
    expect(codigoDe(new ErrorApi("TURNO_TOMADO", 409))).toBe("TURNO_TOMADO");
  });
});
