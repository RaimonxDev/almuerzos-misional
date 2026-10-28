import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Radix (checkbox, radio) mide elementos con ResizeObserver, que jsdom no trae.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom dice "en-US": los tests parten en español, como un teléfono chileno.
Object.defineProperty(navigator, "language", { value: "es-CL", configurable: true });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
