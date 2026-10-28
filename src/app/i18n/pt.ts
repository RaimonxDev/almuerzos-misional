import type { Mensajes } from "./es";

export const pt: Mensajes = {
  comun: {
    nombreApp: "Almoço Missionário",
    idioma: "Idioma",
    cargando: "Carregando…",
    guardar: "Salvar",
    cancelar: "Cancelar",
    volver: "Voltar",
  },
  publico: {
    titulo: "Almoço para os missionários",
    turnosLibres: (n) =>
      n === 0 ? "Não há horários livres" : n === 1 ? "Resta 1 horário livre" : `Restam ${n} horários livres`,
    libre: "Livre",
    tomado: "Ocupado",
    bloqueado: "Bloqueado",
    anotarme: "Quero me inscrever",
    mesNoAbierto: "Este mês ainda não está aberto para inscrições.",
  },
  formulario: {
    titulo: "Inscrever-me para dar almoço",
    nombre: "Seu nome",
    nombreAyuda: "Assim aparecerá no calendário, ex. «Irmã Silva».",
    telefono: "Telefone",
    consentimiento: "Aceito que os missionários e a presidente vejam meu telefone para combinar.",
    modalidad: "Onde será?",
    enCasa: "Na minha casa",
    llevar: "Eu levo",
    nota: "Endereço ou horário (opcional)",
    confirmar: "Confirmar",
    listo: "Pronto! Você está inscrita.",
    cancelarInscripcion: "Cancelar minha inscrição",
  },
  errores: {
    TURNO_TOMADO: "Alguém chegou antes e pegou este horário. Escolha outro dia, por favor.",
    TURNO_BLOQUEADO: "Este horário não está disponível.",
    MES_NO_ABIERTO: "Este mês não está aberto para inscrições.",
    NO_ENCONTRADO: "Não encontramos o que você procura.",
    TOKEN_INVALIDO: "Este link não é mais válido.",
    DATOS_INVALIDOS: "Revise os dados do formulário.",
    NO_AUTORIZADO: "Você não tem permissão para fazer isto.",
    ERROR_INTERNO: "Algo deu errado. Tente novamente em instantes.",
  },
};
