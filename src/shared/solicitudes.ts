import { z } from "zod";
import { zonaValida } from "./fechas";
import { IDIOMAS } from "./idiomas";

export const ESTADOS_SOLICITUD = ["pendiente", "aprobada", "rechazada"] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const TIPOS_COMPANERISMO = ["elderes", "hermanas"] as const;
export type TipoCompanerismo = (typeof TIPOS_COMPANERISMO)[number];

export const MENSAJE_SOLICITUD_MAX = 1000;
export const MOTIVO_RECHAZO_MAX = 500;

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/**
 * Lo que manda el formulario público `/solicitar`. Lo usan la API y el frontend.
 * `turnstileToken` lo valida la API contra Cloudflare; no se guarda.
 */
export const esquemaNuevaSolicitud = z.object({
  nombre: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  telefono: z.string().trim().max(30).regex(/^\+?[\d\s()-]{6,}$/),
  barrio: z.string().trim().min(2).max(80),
  estaca: textoOpcional(80),
  ciudad: z.string().trim().min(2).max(80),
  pais: z.string().trim().min(2).max(80),
  idioma: z.enum(IDIOMAS),
  zonaHoraria: z.string().refine(zonaValida),
  companerismos: z.array(z.enum(TIPOS_COMPANERISMO)).min(1).max(2),
  mensaje: textoOpcional(MENSAJE_SOLICITUD_MAX),
  turnstileToken: z.string().min(1).max(2048),
});

export type NuevaSolicitud = z.input<typeof esquemaNuevaSolicitud>;

export const esquemaRechazoSolicitud = z.object({ motivo: textoOpcional(MOTIVO_RECHAZO_MAX) });
