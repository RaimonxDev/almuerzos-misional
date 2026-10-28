/**
 * En el móvil intenta la hoja de compartir (iOS/Android ofrecen "Agregar al calendario");
 * si no se puede, descarga el archivo.
 */
export async function abrirIcs(contenido: string, nombreArchivo: string) {
  const archivo = new File([contenido], nombreArchivo, { type: "text/calendar" });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo] });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(archivo);
  const a = Object.assign(document.createElement("a"), { href: url, download: nombreArchivo });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
