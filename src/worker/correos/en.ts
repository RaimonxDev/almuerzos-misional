import type { MensajesCorreo } from "./es";

/** Pie de los correos a quien pidió acceso: todavía no administra nada. */
const PIE_SOLICITUD =
  "You're receiving this email because you asked to use Missionary Lunch in your ward. It's a personal project, not an official Church site.";

export const en: MensajesCorreo = {
  comun: {
    nombreApp: "Missionary Lunch",
    enlaceAlternativo: "If the button doesn't work, copy this link into your browser:",
    pie: "You're receiving this email because you manage a ward on Missionary Lunch. It's a personal project, not an official Church site.",
  },
  restablecerPassword: ({ nombre, enlace, minutos }) => ({
    asunto: "Reset your password",
    titulo: "Reset your password",
    saludo: `Hi ${nombre},`,
    parrafos: ["Someone asked to reset the password for your account. To choose a new one, use the button."],
    boton: { texto: "Choose a new password", enlace },
    nota: `The link expires in ${minutos} minutes. If you didn't ask for this, ignore this email: your password won't change.`,
  }),
  bienvenidaPresidenta: ({ nombre, barrio, enlace, panel, dias }) => ({
    asunto: `Welcome to Missionary Lunch: ${barrio}`,
    titulo: "Welcome",
    saludo: `Hi ${nombre},`,
    parrafos: [
      `Missionary Lunch is a page where the sisters of the ward sign up to give lunch to the missionaries, without coordinating it by hand on WhatsApp. ${barrio} was created and you are its administrator.`,
      "From the dashboard you can open months, see who signed up, block days and share the calendar. To sign in, first create your password with the button.",
      "First steps: create next month, open it when it's ready and share the ward link on WhatsApp with the sisters. The link and code for the missionaries are in the dashboard sidebar.",
      `After that, your dashboard is at ${panel}`,
    ],
    boton: { texto: "Create my password", enlace },
    nota: `The link expires in ${dias} days. If it expires, request a new one with "Forgot your password?" on the sign-in screen.`,
  }),
  barrioAsignado: ({ nombre, barrio, enlace }) => ({
    asunto: `You now manage ${barrio}`,
    titulo: "You have a new ward",
    saludo: `Hi ${nombre},`,
    parrafos: [
      `You were assigned ${barrio} on Missionary Lunch. It already shows up in your dashboard, next to the ones you managed.`,
    ],
    boton: { texto: `Open ${barrio}`, enlace },
    nota: "Sign in with your usual email and password.",
  }),
  solicitudNueva: ({ nombre, email, barrio, ciudad, pais, mensaje, enlace }) => ({
    asunto: `New access request: ${barrio}`,
    titulo: "New request",
    saludo: "Hi,",
    parrafos: [
      `${nombre} (${email}) asked to use Missionary Lunch in ${barrio} (${ciudad}, ${pais}).`,
      ...(mensaje ? [`They wrote: ${mensaje}`] : []),
    ],
    boton: { texto: "Review the request", enlace },
  }),
  solicitudRecibida: ({ nombre, barrio }) => ({
    asunto: "We received your request",
    titulo: "We received your request",
    saludo: `Hi ${nombre},`,
    parrafos: [
      `Thanks for asking for Missionary Lunch in ${barrio}. We'll review it soon and let you know at this same email.`,
    ],
    pie: PIE_SOLICITUD,
  }),
  solicitudRechazada: ({ nombre, barrio, motivo }) => ({
    asunto: "About your Missionary Lunch request",
    titulo: "About your request",
    saludo: `Hi ${nombre},`,
    parrafos: [
      `Thanks for your interest in Missionary Lunch for ${barrio}. We couldn't approve your request for now.`,
      ...(motivo ? [`Reason: ${motivo}`] : []),
      "If you think this is a mistake or want to try again, reply to this email or send another request.",
    ],
    pie: PIE_SOLICITUD,
  }),
  eliminacionSolicitada: ({ nombre, email, barrio, motivo, enlace }) => ({
    asunto: `Request to delete ${barrio}`,
    titulo: "Deletion request",
    saludo: "Hi,",
    parrafos: [
      `${nombre} (${email}) asked to delete ${barrio} from Missionary Lunch. The ward keeps working until you delete it.`,
      ...(motivo ? [`They wrote: ${motivo}`] : []),
    ],
    boton: { texto: "View requests", enlace },
  }),
  barrioEliminado: ({ nombre, barrio, cuentaBorrada }) => ({
    asunto: `We deleted ${barrio}`,
    titulo: "Ward deleted",
    saludo: `Hi ${nombre},`,
    parrafos: [
      `We deleted ${barrio} from Missionary Lunch, along with its calendars, sign-ups, and images. Its links no longer work.`,
      ...(cuentaBorrada ? ["Since you didn't manage another ward, we also deleted your account."] : []),
      "Thank you for the time you used it.",
    ],
    pie: "You're receiving this email because you managed this ward on Missionary Lunch. It is a personal project, not an official Church site.",
  }),
};
