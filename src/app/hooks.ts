import { useEffect } from "react";
import { useIdioma } from "./i18n";

/** Título de la pestaña: "<lo que se pasa> · Almuerzo Misional". */
export function useTitulo(titulo: string | undefined) {
  const { t } = useIdioma();
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${t.comun.nombreApp}` : t.comun.nombreApp;
  }, [titulo, t]);
}
