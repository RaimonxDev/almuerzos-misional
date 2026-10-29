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
};
