/**
 * Textos de los correos (fuente). `pt.ts` y `en.ts` se tipan con `MensajesCorreo`,
 * así TypeScript avisa si falta una plantilla o un dato. Cada plantilla es una
 * función que recibe sus datos y devuelve el contenido; `armarCorreo` (index.ts)
 * lo convierte en HTML (escapado) y texto plano.
 */

/** Contenido de un correo, antes de armar el HTML. Todo es texto plano: se escapa al armar. */
export interface ContenidoCorreo {
  asunto: string;
  /** Título grande en la cabecera azul. */
  titulo: string;
  saludo: string;
  parrafos: string[];
  boton: { texto: string; enlace: string };
  /** Texto chico bajo el botón (vencimiento del enlace, "si no fuiste tú"…). */
  nota?: string;
}

/** Datos que necesita cada plantilla. */
export interface DatosCorreo {
  restablecerPassword: { nombre: string; enlace: string; minutos: number };
  bienvenidaPresidenta: { nombre: string; barrio: string; enlace: string; horas: number };
  barrioAsignado: { nombre: string; barrio: string; enlace: string };
}

export type PlantillaCorreo = keyof DatosCorreo;

export type MensajesCorreo = {
  comun: {
    nombreApp: string;
    /** Se muestra bajo el botón por si el cliente de correo no lo abre. */
    enlaceAlternativo: string;
    pie: string;
  };
} & { [P in PlantillaCorreo]: (datos: DatosCorreo[P]) => ContenidoCorreo };

export const es: MensajesCorreo = {
  comun: {
    nombreApp: "Almuerzo Misional",
    enlaceAlternativo: "Si el botón no funciona, copia este enlace en tu navegador:",
    pie: "Recibes este correo porque administras un barrio en Almuerzo Misional. Es un proyecto personal, no oficial de la Iglesia.",
  },
  restablecerPassword: ({ nombre, enlace, minutos }) => ({
    asunto: "Restablece tu contraseña",
    titulo: "Restablecer contraseña",
    saludo: `Hola, ${nombre}:`,
    parrafos: ["Alguien pidió restablecer la contraseña de tu cuenta. Para elegir una nueva, usa el botón."],
    boton: { texto: "Elegir una contraseña nueva", enlace },
    nota: `El enlace vence en ${minutos} minutos. Si no lo pediste tú, ignora este correo: tu contraseña no cambia.`,
  }),
  bienvenidaPresidenta: ({ nombre, barrio, enlace, horas }) => ({
    asunto: `Bienvenida a Almuerzo Misional: ${barrio}`,
    titulo: "Te damos la bienvenida",
    saludo: `Hola, ${nombre}:`,
    parrafos: [
      `Se creó el barrio ${barrio} en Almuerzo Misional y quedaste como su administradora.`,
      "Desde el panel puedes abrir los meses, ver quién se anotó, bloquear días y compartir el calendario. Para entrar, primero crea tu contraseña.",
    ],
    boton: { texto: "Crear mi contraseña", enlace },
    nota: `El enlace vence en ${horas} horas. Si vence, pide uno nuevo con "¿Olvidaste tu contraseña?".`,
  }),
  barrioAsignado: ({ nombre, barrio, enlace }) => ({
    asunto: `Ahora administras ${barrio}`,
    titulo: "Tienes un barrio nuevo",
    saludo: `Hola, ${nombre}:`,
    parrafos: [
      `Te asignaron el barrio ${barrio} en Almuerzo Misional. Ya aparece en tu panel, junto a los que administrabas.`,
    ],
    boton: { texto: `Abrir ${barrio}`, enlace },
    nota: "Entra con tu correo y tu contraseña de siempre.",
  }),
};
