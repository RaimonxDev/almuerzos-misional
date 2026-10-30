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
  /** Sin botón en los avisos que no piden nada (ej. "recibimos tu solicitud"). */
  boton?: { texto: string; enlace: string };
  /** Texto chico bajo el botón (vencimiento del enlace, "si no fuiste tú"…). */
  nota?: string;
  /** Reemplaza el pie común (ej. a quien pidió acceso, que todavía no administra nada). */
  pie?: string;
}

/** Datos que necesita cada plantilla. */
export interface DatosCorreo {
  restablecerPassword: { nombre: string; enlace: string; minutos: number };
  /** `enlace`: crear la contraseña (vence en `dias`); `panel`: el panel del barrio. */
  bienvenidaPresidenta: { nombre: string; barrio: string; enlace: string; panel: string; dias: number };
  barrioAsignado: { nombre: string; barrio: string; enlace: string };
  /** Al super admin: alguien pidió acceso. `enlace` lleva a `/admin/solicitudes`. */
  solicitudNueva: {
    nombre: string;
    email: string;
    barrio: string;
    ciudad: string;
    pais: string;
    mensaje: string | null;
    enlace: string;
  };
  /** A quien pidió acceso: recibimos su solicitud. */
  solicitudRecibida: { nombre: string; barrio: string };
  /** A quien pidió acceso: no se aprobó; `motivo` si el super admin lo escribió. */
  solicitudRechazada: { nombre: string; barrio: string; motivo: string | null };
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

/** Pie de los correos a quien pidió acceso: todavía no administra nada. */
const PIE_SOLICITUD =
  "Recibes este correo porque pediste usar Almuerzo Misional en tu barrio. Es un proyecto personal, no oficial de la Iglesia.";

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
  bienvenidaPresidenta: ({ nombre, barrio, enlace, panel, dias }) => ({
    asunto: `Bienvenida a Almuerzo Misional: ${barrio}`,
    titulo: "Te damos la bienvenida",
    saludo: `Hola, ${nombre}:`,
    parrafos: [
      `Almuerzo Misional es una página para que las hermanas del barrio se anoten a dar almuerzo a los misioneros, sin coordinarlo a mano por WhatsApp. Se creó ${barrio} y quedaste como su administradora.`,
      "Desde el panel puedes abrir los meses, ver quién se anotó, bloquear días y compartir el calendario. Para entrar, primero crea tu contraseña con el botón.",
      "Primeros pasos: crea el mes que viene, ábrelo cuando esté listo y comparte el enlace del barrio por WhatsApp con las hermanas. El enlace para los misioneros está en la barra lateral del panel.",
      `Después, tu panel queda en ${panel}`,
    ],
    boton: { texto: "Crear mi contraseña", enlace },
    nota: `El enlace vence en ${dias} días. Si vence, pide uno nuevo con "¿Olvidaste tu contraseña?" en la pantalla de ingreso.`,
  }),
  barrioAsignado: ({ nombre, barrio, enlace }) => ({
    asunto: `Ahora administras ${barrio}`,
    titulo: "Tienes un barrio nuevo",
    saludo: `Hola, ${nombre}:`,
    parrafos: [
      `Te asignaron ${barrio} en Almuerzo Misional. Ya aparece en tu panel, junto a los que administrabas.`,
    ],
    boton: { texto: `Abrir ${barrio}`, enlace },
    nota: "Entra con tu correo y tu contraseña de siempre.",
  }),
  solicitudNueva: ({ nombre, email, barrio, ciudad, pais, mensaje, enlace }) => ({
    asunto: `Nueva solicitud de acceso: ${barrio}`,
    titulo: "Nueva solicitud",
    saludo: "Hola:",
    parrafos: [
      `${nombre} (${email}) pidió usar Almuerzo Misional en ${barrio} (${ciudad}, ${pais}).`,
      ...(mensaje ? [`Escribió: ${mensaje}`] : []),
    ],
    boton: { texto: "Revisar la solicitud", enlace },
  }),
  solicitudRecibida: ({ nombre, barrio }) => ({
    asunto: "Recibimos tu solicitud",
    titulo: "Recibimos tu solicitud",
    saludo: `Hola, ${nombre}:`,
    parrafos: [
      `Gracias por pedir Almuerzo Misional para ${barrio}. La revisaremos pronto y te avisaremos por este mismo correo.`,
    ],
    pie: PIE_SOLICITUD,
  }),
  solicitudRechazada: ({ nombre, barrio, motivo }) => ({
    asunto: "Sobre tu solicitud de Almuerzo Misional",
    titulo: "Sobre tu solicitud",
    saludo: `Hola, ${nombre}:`,
    parrafos: [
      `Gracias por tu interés en Almuerzo Misional para ${barrio}. Por ahora no pudimos aprobar tu solicitud.`,
      ...(motivo ? [`Motivo: ${motivo}`] : []),
      "Si crees que es un error o quieres volver a intentarlo, responde a este correo o envía otra solicitud.",
    ],
    pie: PIE_SOLICITUD,
  }),
};
