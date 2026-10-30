import type { MensajesCorreo } from "./es";

/** Pie de los correos a quien pidió acceso: todavía no administra nada. */
const PIE_SOLICITUD =
  "Você recebe este e-mail porque pediu para usar o Almoço Missionário na sua ala. É um projeto pessoal, não oficial da Igreja.";

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
  bienvenidaPresidenta: ({ nombre, barrio, enlace, panel, dias }) => ({
    asunto: `Boas-vindas ao Almoço Missionário: ${barrio}`,
    titulo: "Boas-vindas",
    saludo: `Olá, ${nombre}:`,
    parrafos: [
      `O Almoço Missionário é uma página para que as irmãs da ala se inscrevam para dar almoço aos missionários, sem precisar combinar tudo à mão pelo WhatsApp. ${barrio} foi criada e você é a administradora.`,
      "No painel você pode abrir os meses, ver quem se inscreveu, bloquear dias e compartilhar o calendário. Para entrar, primeiro crie sua senha com o botão.",
      "Primeiros passos: crie o mês que vem, abra-o quando estiver pronto e compartilhe o link da ala pelo WhatsApp com as irmãs. O link e o código para os missionários estão na barra lateral do painel.",
      `Depois, seu painel fica em ${panel}`,
    ],
    boton: { texto: "Criar minha senha", enlace },
    nota: `O link vence em ${dias} dias. Se vencer, peça um novo em "Esqueceu sua senha?" na tela de entrada.`,
  }),
  barrioAsignado: ({ nombre, barrio, enlace }) => ({
    asunto: `Agora você administra ${barrio}`,
    titulo: "Você tem uma nova ala",
    saludo: `Olá, ${nombre}:`,
    parrafos: [
      `${barrio} foi atribuída a você no Almoço Missionário. Ela já aparece no seu painel, junto com as que você administrava.`,
    ],
    boton: { texto: `Abrir ${barrio}`, enlace },
    nota: "Entre com seu e-mail e sua senha de sempre.",
  }),
  solicitudNueva: ({ nombre, email, barrio, ciudad, pais, mensaje, enlace }) => ({
    asunto: `Nova solicitação de acesso: ${barrio}`,
    titulo: "Nova solicitação",
    saludo: "Olá:",
    parrafos: [
      `${nombre} (${email}) pediu para usar o Almoço Missionário em ${barrio} (${ciudad}, ${pais}).`,
      ...(mensaje ? [`Escreveu: ${mensaje}`] : []),
    ],
    boton: { texto: "Revisar a solicitação", enlace },
  }),
  solicitudRecibida: ({ nombre, barrio }) => ({
    asunto: "Recebemos sua solicitação",
    titulo: "Recebemos sua solicitação",
    saludo: `Olá, ${nombre}:`,
    parrafos: [
      `Obrigado por pedir o Almoço Missionário para ${barrio}. Vamos analisar em breve e avisaremos por este mesmo e-mail.`,
    ],
    pie: PIE_SOLICITUD,
  }),
  solicitudRechazada: ({ nombre, barrio, motivo }) => ({
    asunto: "Sobre sua solicitação do Almoço Missionário",
    titulo: "Sobre sua solicitação",
    saludo: `Olá, ${nombre}:`,
    parrafos: [
      `Obrigado pelo seu interesse no Almoço Missionário para ${barrio}. Por enquanto não pudemos aprovar sua solicitação.`,
      ...(motivo ? [`Motivo: ${motivo}`] : []),
      "Se acha que foi um engano ou quer tentar de novo, responda a este e-mail ou envie outra solicitação.",
    ],
    pie: PIE_SOLICITUD,
  }),
  eliminacionSolicitada: ({ nombre, email, barrio, motivo, enlace }) => ({
    asunto: `Pedido para excluir ${barrio}`,
    titulo: "Pedido de exclusão",
    saludo: "Olá:",
    parrafos: [
      `${nombre} (${email}) pediu para excluir ${barrio} do Almoço Missionário. A ala continua funcionando até você apagá-la.`,
      ...(motivo ? [`Escreveu: ${motivo}`] : []),
    ],
    boton: { texto: "Abrir a ala", enlace },
  }),
  barrioEliminado: ({ nombre, barrio, cuentaBorrada }) => ({
    asunto: `Excluímos ${barrio}`,
    titulo: "Ala excluída",
    saludo: `Olá, ${nombre}:`,
    parrafos: [
      `Excluímos ${barrio} do Almoço Missionário, junto com seus calendários, inscrições e imagens. Os links dela não funcionam mais.`,
      ...(cuentaBorrada ? ["Como você não administrava outra ala, também apagamos sua conta."] : []),
      "Obrigado pelo tempo em que vocês usaram o aplicativo.",
    ],
    pie: "Você recebe este e-mail porque administrava esta ala no Almoço Missionário. É um projeto pessoal, não oficial da Igreja.",
  }),
};
