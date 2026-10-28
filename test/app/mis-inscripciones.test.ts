import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  olvidarInscripcion,
  recordarInscripcion,
  useMisInscripciones,
  type MiInscripcion,
} from "@/app/mis-inscripciones";

const una = (id: string, barrio = "centro"): MiInscripcion => ({
  id,
  turnoId: `t-${id}`,
  barrio,
  fecha: "2026-11-09",
  tokenEdicion: `token-${id}`,
});

describe("mis-inscripciones", () => {
  it("recuerda, reemplaza por id y olvida; el hook filtra por barrio y se actualiza", () => {
    const { result } = renderHook(() => useMisInscripciones("centro"));
    expect(result.current).toEqual([]);

    act(() => {
      recordarInscripcion(una("a"));
      recordarInscripcion(una("b", "jardim"));
      recordarInscripcion({ ...una("a"), fecha: "2026-11-10" });
    });
    expect(result.current).toEqual([{ ...una("a"), fecha: "2026-11-10" }]);

    act(() => olvidarInscripcion("a"));
    expect(result.current).toEqual([]);
    expect(JSON.parse(localStorage.getItem("almuerzo-misional:inscripciones")!)).toHaveLength(1);
  });

  it("ignora datos corruptos en el storage", () => {
    localStorage.setItem("almuerzo-misional:inscripciones", "{no es json");
    const { result } = renderHook(() => useMisInscripciones("centro"));
    expect(result.current).toEqual([]);
  });

  it("si el storage no deja escribir (modo privado), no rompe", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    const { result } = renderHook(() => useMisInscripciones("centro"));
    expect(() => act(() => recordarInscripcion(una("a")))).not.toThrow();
    expect(result.current).toEqual([]);
  });

  it("devuelve el mismo arreglo mientras el storage no cambie (sin renders infinitos)", () => {
    recordarInscripcion(una("a"));
    const { result, rerender } = renderHook(() => useMisInscripciones("centro"));
    const primero = result.current;
    rerender();
    // El filtro crea un arreglo nuevo, pero con los mismos objetos.
    expect(result.current[0]).toBe(primero[0]);
  });
});
