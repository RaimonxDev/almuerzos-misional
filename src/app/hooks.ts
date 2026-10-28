import { useEffect } from "react";
import { useBarrio } from "./consultas";
import { useIdioma } from "./i18n";

/** Título de la pestaña: "<lo que se pasa> · Almuerzo Misional". */
export function useTitulo(titulo: string | undefined) {
  const { t } = useIdioma();
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${t.comun.nombreApp}` : t.comun.nombreApp;
  }, [titulo, t]);
}

/** Carga el barrio y aplica su idioma por defecto (si la persona no eligió otro). */
export function useBarrioConIdioma(slug: string) {
  const consulta = useBarrio(slug);
  const { usarIdiomaDelBarrio } = useIdioma();
  const idioma = consulta.data?.barrio.idioma;
  useEffect(() => usarIdiomaDelBarrio(idioma), [idioma, usarIdiomaDelBarrio]);
  return consulta;
}
