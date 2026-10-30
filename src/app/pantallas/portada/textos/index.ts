import { useIdioma } from "@/app/i18n";
import type { Idioma } from "@/shared/idiomas";
import { es, type TextosPortada } from "./es";
import { pt } from "./pt";
import { en } from "./en";

const TEXTOS: Record<Idioma, TextosPortada> = { es, pt, en };

/** Textos de la portada y de las preguntas frecuentes en el idioma de la pantalla. */
export function useTextosPortada(): TextosPortada {
  const { idioma } = useIdioma();
  return TEXTOS[idioma];
}

export type { TextosPortada };
