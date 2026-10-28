import { z } from "zod";

export const PLANTILLAS = ["azul", "dorado", "cielo"] as const;
export type Plantilla = (typeof PLANTILLAS)[number];

export const MAX_ESCRITURA = 400;
export const MAX_ESCRITURA_REF = 60;
export const MAX_MENSAJE = 160;

/** Imagen del mes: tipos aceptados (por `Content-Type`) y tamaño máximo. */
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoImagen = (typeof TIPOS_IMAGEN)[number];
export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;

/** Texto recortado; vacío → null (borra el campo). */
const texto = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : v),
    z.string().max(max).nullable().optional(),
  );

/** Cambios parciales a la personalización del mes: solo se tocan los campos presentes. */
export const esquemaPersonalizacion = z.object({
  escritura: texto(MAX_ESCRITURA),
  escrituraRef: texto(MAX_ESCRITURA_REF),
  mensaje: texto(MAX_MENSAJE),
  plantilla: z.enum(PLANTILLAS).optional(),
});

export type CambiosPersonalizacion = z.infer<typeof esquemaPersonalizacion>;
