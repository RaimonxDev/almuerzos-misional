/** Idiomas de la UI. El barrio define el idioma por defecto; cada persona puede cambiarlo. */
export const IDIOMAS = ["es", "pt", "en"] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const esIdioma = (valor: unknown): valor is Idioma =>
  typeof valor === "string" && (IDIOMAS as readonly string[]).includes(valor);
