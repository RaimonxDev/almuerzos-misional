/** La parte legible del enlace de un barrio. Mismas reglas que la API (`esquemaNuevoBarrio` en `src/worker/barrios.ts`). */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** + "-" y el código de 5 que agrega el Worker = 60. */
export const LARGO_ENLACE = 54;

export const enlaceValido = (slug: string) => slug.length >= 2 && SLUG.test(slug);

/** "Barrio Ñuñoa 2" → "barrio-nunoa-2" */
export const sugerirSlug = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LARGO_ENLACE);

/** Cómo se verá el enlace: el código al azar lo pone el servidor al guardarlo. */
export const vistaPreviaEnlace = (slug: string) => `${location.host}/${slug || "…"}-•••••`;
