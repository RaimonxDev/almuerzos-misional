import { useEffect, useState } from "react";
import { toast } from "sonner";
import { compartirPng, prepararFuentes } from "./compartir-imagen";
import { useIdioma } from "./i18n";

/**
 * "Compartir imagen" de un nodo (calendario, tarjeta del QR): hoja de compartir o descarga, con sus
 * avisos. Al montar deja listas las fuentes, porque Safari exige `share()` cerca del toque.
 */
export function useCompartirPng() {
  const { t } = useIdioma();
  const [compartiendo, setCompartiendo] = useState(false);
  useEffect(() => void prepararFuentes().catch(() => {}), []);

  async function compartir(nodo: HTMLElement | null, nombreArchivo: string) {
    if (!nodo) return;
    setCompartiendo(true);
    try {
      const resultado = await compartirPng(nodo, nombreArchivo);
      if (resultado === "descargado") toast.success(t.calendario.imagenLista);
    } catch {
      toast.error(t.calendario.imagenError);
    } finally {
      setCompartiendo(false);
    }
  }

  return { compartir, compartiendo };
}
