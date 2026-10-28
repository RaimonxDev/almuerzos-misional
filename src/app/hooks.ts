import { useEffect } from "react";
import { useSearchParams } from "react-router";
import type { Idioma } from "@/shared/idiomas";
import { useBarrio } from "./consultas";
import { useIdioma } from "./i18n";
import { leerPeriodo, mesInicial, textoPeriodo, type Periodo } from "./periodos";

/** Título de la pestaña: "<lo que se pasa> · Almuerzo Misional". */
export function useTitulo(titulo: string | undefined) {
  const { t } = useIdioma();
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${t.comun.nombreApp}` : t.comun.nombreApp;
  }, [titulo, t]);
}

/** Aplica el idioma por defecto del barrio (si la persona no eligió otro). */
export function useIdiomaDelBarrio(idioma: Idioma | undefined) {
  const { usarIdiomaDelBarrio } = useIdioma();
  useEffect(() => usarIdiomaDelBarrio(idioma), [idioma, usarIdiomaDelBarrio]);
}

/** Carga el barrio y aplica su idioma. */
export function useBarrioConIdioma(slug: string) {
  const consulta = useBarrio(slug);
  useIdiomaDelBarrio(consulta.data?.barrio.idioma);
  return consulta;
}

/**
 * Mes visible: viene en la URL (`?mes=2026-11`); sin parámetro, el que corresponde a hoy.
 * Devuelve el periodo y cómo cambiarlo.
 */
export function usePeriodoDeLaUrl(meses: Periodo[], hoy: string) {
  const [params, setParams] = useSearchParams();
  const periodo = leerPeriodo(params.get("mes")) ?? mesInicial(meses, hoy);
  const ir = (p: Periodo) => setParams({ mes: textoPeriodo(p) }, { replace: true });
  return [periodo, ir] as const;
}
