import { toBlob } from "html-to-image";

export const nombreArchivoCalendario = (slug: string, periodo: string) => `almuerzos-${slug}-${periodo}.png`;

export type ResultadoCompartir = "compartido" | "descargado" | "cancelado";

/** Los subconjuntos de fuentes cuyo primer rango empieza en latín (latin, latin-ext, vietnamese). */
const esLatina = (rango: string) => {
  const inicio = /U\+([0-9A-F]+)/i.exec(rango)?.[1];
  return !inicio || parseInt(inicio, 16) <= 0x24f;
};

const comoDataUrl = async (url: string) => {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result as string);
    lector.onerror = () => rechazar(lector.error);
    lector.readAsDataURL(blob);
  });
};

let cssFuentes: Promise<string> | null = null;

/**
 * `@font-face` de la app con las fuentes incrustadas, solo los subconjuntos latinos: html-to-image
 * por su cuenta incrusta todos (cirílico, griego…), unos 4 MB. Se calcula una vez; llamarla al abrir
 * la pantalla deja listo lo lento antes del toque, porque Safari exige `share()` cerca del gesto.
 */
export function prepararFuentes(): Promise<string> {
  cssFuentes ??= (async () => {
    const reglas: { regla: CSSFontFaceRule; base: string }[] = [];
    for (const hoja of Array.from(document.styleSheets)) {
      let lista: CSSRuleList;
      try {
        lista = hoja.cssRules;
      } catch {
        continue; // hoja de otro origen
      }
      for (const regla of Array.from(lista)) {
        if (regla instanceof CSSFontFaceRule && esLatina(regla.style.getPropertyValue("unicode-range"))) {
          reglas.push({ regla, base: hoja.href ?? location.href });
        }
      }
    }
    const caras = await Promise.all(
      reglas.map(async ({ regla, base }) => {
        let css = regla.cssText;
        for (const [, url] of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          if (url.startsWith("data:")) continue;
          css = css.replace(url, await comoDataUrl(new URL(url, base).href));
        }
        return css;
      }),
    );
    return caras.join("\n");
  })().catch((e) => {
    cssFuentes = null; // reintentar la próxima vez
    throw e;
  });
  return cssFuentes;
}

function descargar(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Convierte el nodo en PNG y lo comparte con la hoja del sistema (móvil → WhatsApp);
 * si el navegador no puede compartir archivos, o rechaza `share()` por haber pasado
 * demasiado tiempo desde el toque (Safari), lo descarga.
 */
export async function compartirPng(nodo: HTMLElement, nombreArchivo: string): Promise<ResultadoCompartir> {
  const blob = await toBlob(nodo, { pixelRatio: 2, fontEmbedCSS: await prepararFuentes() });
  if (!blob) throw new Error("No se pudo crear la imagen");
  const archivo = new File([blob], nombreArchivo, { type: "image/png" });

  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombreArchivo });
      return "compartido";
    } catch (e) {
      const nombre = (e as { name?: string } | null)?.name;
      if (nombre === "AbortError") return "cancelado";
      if (nombre !== "NotAllowedError") throw e;
    }
  }

  descargar(blob, nombreArchivo);
  return "descargado";
}
