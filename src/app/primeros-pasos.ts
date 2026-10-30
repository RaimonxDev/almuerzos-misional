import { useCallback, useSyncExternalStore } from "react";

/**
 * Lo que "Primeros pasos" no puede deducir de los datos del barrio, y si la tarjeta está oculta.
 * Se guarda en `localStorage` por barrio: es una ayuda de este navegador, no un dato del barrio.
 */
export type EstadoPrimerosPasos = {
  oculto: boolean;
  /** Revisó la sección de misioneros (no se puede deducir: los compañerismos vienen creados). */
  misioneros: boolean;
  /** Copió el enlace para las hermanas o el de los misioneros. */
  compartido: boolean;
};

export type IdPaso = "misioneros" | "nota" | "crearMes" | "abrirMes" | "compartir";

export type Paso = { id: IdPaso; hecho: boolean };

const VACIO: EstadoPrimerosPasos = { oculto: false, misioneros: false, compartido: false };
const clave = (slug: string) => `almuerzo-misional:primeros-pasos:${slug}`;
const oyentes = new Set<() => void>();
const cache = new Map<string, { texto: string | null; valor: EstadoPrimerosPasos }>();

function leer(slug: string): EstadoPrimerosPasos {
  let texto: string | null = null;
  try {
    texto = localStorage.getItem(clave(slug));
  } catch {
    return VACIO;
  }
  const guardado = cache.get(slug);
  // Mismo texto → mismo objeto, para que useSyncExternalStore no re-renderice sin parar.
  if (guardado && guardado.texto === texto) return guardado.valor;
  let valor = VACIO;
  try {
    const parsed: unknown = texto ? JSON.parse(texto) : null;
    if (parsed && typeof parsed === "object") {
      const p = parsed as Partial<EstadoPrimerosPasos>;
      valor = { oculto: p.oculto === true, misioneros: p.misioneros === true, compartido: p.compartido === true };
    }
  } catch {
    // Dato corrupto: se ignora.
  }
  cache.set(slug, { texto, valor });
  return valor;
}

function cambiar(slug: string, cambios: Partial<EstadoPrimerosPasos>) {
  try {
    localStorage.setItem(clave(slug), JSON.stringify({ ...leer(slug), ...cambios }));
  } catch {
    // Sin storage (modo privado): la tarjeta sigue, solo no recuerda.
  }
  oyentes.forEach((o) => o());
}

const suscribir = (oyente: () => void) => {
  oyentes.add(oyente);
  window.addEventListener("storage", oyente);
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener("storage", oyente);
  };
};

/** Estado de "Primeros pasos" del barrio y cómo cambiarlo. */
export function usePrimerosPasos(slug: string) {
  const estado = useSyncExternalStore(
    suscribir,
    () => leer(slug),
    () => VACIO,
  );
  const marcar = useCallback((cambios: Partial<EstadoPrimerosPasos>) => cambiar(slug, cambios), [slug]);
  return [estado, marcar] as const;
}

/**
 * Los cinco pasos y cuáles están hechos. Crear y abrir el mes salen de los meses del barrio, la nota
 * de la nota para cocinar; revisar misioneros y compartir vienen de `localStorage`.
 */
export function calcularPasos(
  datos: { notaParaCocinar: string | null; meses: { estado: string }[] },
  guardado: Pick<EstadoPrimerosPasos, "misioneros" | "compartido">,
): Paso[] {
  return [
    { id: "misioneros", hecho: guardado.misioneros },
    { id: "nota", hecho: (datos.notaParaCocinar ?? "").trim() !== "" },
    { id: "crearMes", hecho: datos.meses.length > 0 },
    { id: "abrirMes", hecho: datos.meses.some((m) => m.estado === "abierto" || m.estado === "cerrado") },
    { id: "compartir", hecho: guardado.compartido },
  ];
}

/**
 * Un barrio que ya cerró un mes o recibió inscripciones está funcionando: su presidenta no necesita
 * la tarjeta (si no, aparecería a quienes usaban el panel desde antes, por los pasos que solo
 * están en `localStorage`).
 */
export const barrioEnMarcha = (meses: { estado: string; tomados: number }[]) =>
  meses.some((m) => m.estado === "cerrado" || m.tomados > 0);
