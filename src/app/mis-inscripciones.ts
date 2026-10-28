import { useSyncExternalStore } from "react";

/**
 * Inscripciones hechas desde este teléfono, con su token de edición.
 * La base guarda solo el hash del token: perderlo aquí = no poder editar desde la web.
 */
export type MiInscripcion = {
  id: string;
  turnoId: string;
  barrio: string;
  fecha: string;
  tokenEdicion: string;
};

const CLAVE = "almuerzo-misional:inscripciones";
const VACIO: MiInscripcion[] = [];
const oyentes = new Set<() => void>();
let cache: { texto: string | null; valor: MiInscripcion[] } = { texto: null, valor: VACIO };

function leer(): MiInscripcion[] {
  let texto: string | null = null;
  try {
    texto = localStorage.getItem(CLAVE);
  } catch {
    return VACIO;
  }
  // Mismo texto → mismo arreglo, para que useSyncExternalStore no re-renderice sin parar.
  if (texto === cache.texto) return cache.valor;
  let valor = VACIO;
  try {
    const parsed: unknown = texto ? JSON.parse(texto) : [];
    if (Array.isArray(parsed)) valor = parsed as MiInscripcion[];
  } catch {
    // Dato corrupto: se ignora.
  }
  cache = { texto, valor };
  return valor;
}

function escribir(lista: MiInscripcion[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Sin storage (modo privado): la inscripción vale igual, solo no se podrá editar desde aquí.
  }
  oyentes.forEach((o) => o());
}

export function recordarInscripcion(nueva: MiInscripcion) {
  escribir([...leer().filter((i) => i.id !== nueva.id), nueva]);
}

export function olvidarInscripcion(id: string) {
  escribir(leer().filter((i) => i.id !== id));
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  // Cambios hechos en otra pestaña.
  const enStorage = (e: StorageEvent) => e.key === CLAVE && oyente();
  window.addEventListener("storage", enStorage);
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener("storage", enStorage);
  };
}

export function useMisInscripciones(barrio: string) {
  const todas = useSyncExternalStore(suscribir, leer, () => VACIO);
  return todas.filter((i) => i.barrio === barrio);
}
