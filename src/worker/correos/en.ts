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
  bienvenidaPresidenta: ({ nombre, barrio, enlace, horas }) => ({
    asunto: `Welcome to Missionary Lunch: ${barrio}`,
    titulo: "Welcome",
    saludo: `Hi ${nombre},`,
    parrafos: [
      `The ${barrio} ward was created on Missionary Lunch and you are its administrator.`,
      "From the dashboard you can open months, see who signed up, block days and share the calendar. To sign in, first create your password.",
    ],
    boton: { texto: "Create my password", enlace },
    nota: `The link expires in ${horas} hours. If it expires, request a new one with "Forgot your password?".`,
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
