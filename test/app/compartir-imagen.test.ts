import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("html-to-image", () => ({ toBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })) }));

import { toBlob } from "html-to-image";
import { compartirPng, nombreArchivoCalendario } from "@/app/compartir-imagen";

const nodo = document.createElement("div");

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
});

describe("nombreArchivoCalendario", () => {
  it("arma almuerzos-<barrio>-<periodo>.png", () => {
    expect(nombreArchivoCalendario("centro", "2026-11")).toBe("almuerzos-centro-2026-11.png");
  });
});

describe("compartirPng", () => {
  it("descarga el archivo si el navegador no puede compartir archivos", async () => {
    Object.defineProperty(navigator, "canShare", { value: () => false, configurable: true });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const resultado = await compartirPng(nodo, "almuerzos-centro-2026-11.png");
    expect(toBlob).toHaveBeenCalledWith(nodo, expect.objectContaining({ pixelRatio: 2 }));
    expect(clic).toHaveBeenCalledOnce();
    expect(resultado).toBe("descargado");
  });

  it("usa la hoja de compartir cuando acepta archivos", async () => {
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const resultado = await compartirPng(nodo, "a.png");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }));
    expect(resultado).toBe("compartido");
  });

  it("cancelar la hoja de compartir no es un error", async () => {
    const abort = Object.assign(new Error("cancel"), { name: "AbortError" });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", { value: vi.fn(async () => { throw abort; }), configurable: true });
    await expect(compartirPng(nodo, "a.png")).resolves.toBe("cancelado");
  });

  it("descarga si Safari rechaza share() por haber pasado el gesto", async () => {
    const rechazo = Object.assign(new Error("no gesture"), { name: "NotAllowedError" });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", { value: vi.fn(async () => { throw rechazo; }), configurable: true });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await expect(compartirPng(nodo, "a.png")).resolves.toBe("descargado");
    expect(clic).toHaveBeenCalledOnce();
  });
});
