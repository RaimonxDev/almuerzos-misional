import { toBlob } from "html-to-image";

export const nombreArchivoCalendario = (slug: string, periodo: string) => `almuerzos-${slug}-${periodo}.png`;

export type ResultadoCompartir = "compartido" | "descargado" | "cancelado";

/**
 * Convierte el nodo en PNG y lo comparte con la hoja del sistema (móvil → WhatsApp);
 * si el navegador no puede compartir archivos, lo descarga.
 */
export async function compartirPng(nodo: HTMLElement, nombreArchivo: string): Promise<ResultadoCompartir> {
  const blob = await toBlob(nodo, { pixelRatio: 2, cacheBust: true });
  if (!blob) throw new Error("No se pudo crear la imagen");
  const archivo = new File([blob], nombreArchivo, { type: "image/png" });

  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombreArchivo });
      return "compartido";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelado";
      throw e;
    }
  }

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "descargado";
}
