import type { MensajesCorreo } from "./es";

export const pt: MensajesCorreo = {
  comun: {
    nombreApp: "Almoço Missionário",
    enlaceAlternativo: "Se o botão não funcionar, copie este link no seu navegador:",
    pie: "Você recebe este e-mail porque administra uma ala no Almoço Missionário. É um projeto pessoal, não oficial da Igreja.",
  },
  restablecerPassword: ({ nombre, enlace, minutos }) => ({
    asunto: "Redefina sua senha",
    titulo: "Redefinir senha",
    saludo: `Olá, ${nombre}:`,
    parrafos: ["Alguém pediu para redefinir a senha da sua conta. Para escolher uma nova, use o botão."],
    boton: { texto: "Escolher uma nova senha", enlace },
    nota: `O link vence em ${minutos} minutos. Se não foi você, ignore este e-mail: sua senha não muda.`,
  }),
  bienvenidaPresidenta: ({ nombre, barrio, enlace, horas }) => ({
    asunto: `Boas-vindas ao Almoço Missionário: ${barrio}`,
    titulo: "Boas-vindas",
    saludo: `Olá, ${nombre}:`,
    parrafos: [
      `A ala ${barrio} foi criada no Almoço Missionário e você é a administradora.`,
      "No painel você pode abrir os meses, ver quem se inscreveu, bloquear dias e compartilhar o calendário. Para entrar, primeiro crie sua senha.",
    ],
    boton: { texto: "Criar minha senha", enlace },
    nota: `O link vence em ${horas} horas. Se vencer, peça um novo em "Esqueceu sua senha?".`,
  }),
  barrioAsignado: ({ nombre, barrio, enlace }) => ({
    asunto: `Agora você administra ${barrio}`,
    titulo: "Você tem uma nova ala",
    saludo: `Olá, ${nombre}:`,
    parrafos: [
      `A ala ${barrio} foi atribuída a você no Almoço Missionário. Ela já aparece no seu painel, junto com as que você administrava.`,
    ],
    boton: { texto: `Abrir ${barrio}`, enlace },
    nota: "Entre com seu e-mail e sua senha de sempre.",
  }),
};
