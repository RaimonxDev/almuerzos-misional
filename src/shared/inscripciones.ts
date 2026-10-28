import { z } from "zod";

export const MODALIDADES = ["en_casa", "llevar"] as const;
export type Modalidad = (typeof MODALIDADES)[number];

/** Texto opcional: vacío o ausente se guarda como null. */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const campos = {
  nombre: z.string().trim().min(2).max(60),
  telefono: textoOpcional(30).refine((v) => v === null || /^\+?[\d\s()-]{6,}$/.test(v)),
  modalidad: z.enum(MODALIDADES).nullish().transform((v) => v ?? null),
  nota: textoOpcional(200),
};

/** Lo que manda el formulario público al anotarse. Lo usan la API y el frontend. */
export const esquemaNuevaInscripcion = z.object({
  ...campos,
  consentimientoTelefono: z.boolean().default(false),
});

/** Edición con token: solo los campos enviados cambian; null o "" borra los opcionales. */
export const esquemaEdicionInscripcion = z
  .object({ ...campos, consentimientoTelefono: z.boolean() })
  .partial();

export type NuevaInscripcionPublica = z.input<typeof esquemaNuevaInscripcion>;
export type EdicionInscripcion = z.input<typeof esquemaEdicionInscripcion>;
