import type { MensajesCorreo } from "./es";

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
      `Missionary Lunch is a page where the sisters of the ward sign up to give lunch to the missionaries, without coordinating it by hand on WhatsApp. The ${barrio} ward was created and you are its administrator.`,
      "From the dashboard you can open months, see who signed up, block days and share the calendar. To sign in, first create your password with the button.",
      "First steps: create next month, open it when it's ready and share the ward link on WhatsApp with the sisters. The link for the missionaries is in the dashboard sidebar.",
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
      `You were assigned the ${barrio} ward on Missionary Lunch. It already shows up in your dashboard, next to the ones you managed.`,
    ],
    boton: { texto: `Open ${barrio}`, enlace },
    nota: "Sign in with your usual email and password.",
  }),
  solicitudNueva: ({ nombre, email, barrio, ciudad, pais, mensaje, enlace }) => ({
    asunto: `New access request: ${barrio}`,
    titulo: "New request",
    saludo: "Hi,",
    parrafos: [
      `${nombre} (${email}) asked to use Missionary Lunch in the ${barrio} ward, ${ciudad}, ${pais}.`,
      ...(mensaje ? [`They wrote: ${mensaje}`] : []),
    ],
    boton: { texto: "Review the request", enlace },
  }),
  solicitudRecibida: ({ nombre, barrio }) => ({
    asunto: "We received your request",
    titulo: "We received your request",
    saludo: `Hi ${nombre},`,
    parrafos: [
      `Thanks for asking for Missionary Lunch in the ${barrio} ward. We'll review it soon and let you know at this same email.`,
    ],
  }),
  solicitudRechazada: ({ nombre, barrio, motivo }) => ({
    asunto: "About your Missionary Lunch request",
    titulo: "About your request",
    saludo: `Hi ${nombre},`,
    parrafos: [
      `Thanks for your interest in Missionary Lunch for the ${barrio} ward. We couldn't approve your request for now.`,
      ...(motivo ? [`Reason: ${motivo}`] : []),
      "If you think this is a mistake or want to try again, reply to this email or send another request.",
    ],
  }),
};
