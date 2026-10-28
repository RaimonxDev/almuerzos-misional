import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";
import { ProveedorIdioma } from "@/app/i18n";
import type { MiInscripcion } from "@/app/mis-inscripciones";

/** Envuelve en React Query (sin reintentos) e idioma, como `main.tsx`. */
export function Proveedores({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <ProveedorIdioma>{children}</ProveedorIdioma>
    </QueryClientProvider>
  );
}

/** Renderiza una pantalla en una ruta concreta, con los proveedores de la app. */
export function renderizarRuta(path: string, url: string, elemento: ReactNode) {
  const router = createMemoryRouter([{ path, element: elemento }], { initialEntries: [url] });
  return render(
    <Proveedores>
      <RouterProvider router={router} />
    </Proveedores>,
  );
}

type Respuesta = { status?: number; json?: unknown };

/**
 * Reemplaza `fetch`: la primera clave contenida en la URL decide la respuesta.
 * Devuelve el mock para revisar las llamadas.
 */
export function simularApi(respuestas: Record<string, Respuesta | ((init?: RequestInit) => Respuesta)>) {
  const mock = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada instanceof Request ? entrada.url : entrada);
    const clave = Object.keys(respuestas).find((k) => url.includes(k));
    if (!clave) throw new Error(`Sin respuesta simulada para ${url}`);
    const r = respuestas[clave];
    const { status = 200, json } = typeof r === "function" ? r(init) : r;
    return new Response(json === undefined ? null : JSON.stringify(json), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

export function guardarInscripciones(lista: MiInscripcion[]) {
  localStorage.setItem("almuerzo-misional:inscripciones", JSON.stringify(lista));
}
