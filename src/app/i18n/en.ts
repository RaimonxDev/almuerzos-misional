import type { Mensajes } from "./es";

export const en: Mensajes = {
  comun: {
    nombreApp: "Missionary Lunch",
    idioma: "Language",
    cargando: "Loading…",
    guardar: "Save",
    cancelar: "Cancel",
    volver: "Back",
  },
  publico: {
    titulo: "Lunch for the missionaries",
    turnosLibres: (n) =>
      n === 0 ? "No open slots left" : n === 1 ? "1 open slot left" : `${n} open slots left`,
    libre: "Open",
    tomado: "Taken",
    bloqueado: "Unavailable",
    anotarme: "Sign me up",
    mesNoAbierto: "This month isn't open for sign-ups yet.",
  },
  formulario: {
    titulo: "Sign up to provide lunch",
    nombre: "Your name",
    nombreAyuda: "This is how it will appear on the calendar, e.g. “Sister Smith”.",
    telefono: "Phone",
    consentimiento: "I agree that the missionaries and the president can see my phone number to coordinate.",
    modalidad: "Where will it be?",
    enCasa: "At my home",
    llevar: "I'll bring it",
    nota: "Address or time (optional)",
    confirmar: "Confirm",
    listo: "All set! You're signed up.",
    cancelarInscripcion: "Cancel my slot",
  },
  errores: {
    TURNO_TOMADO: "Someone just took this slot. Please choose another day.",
    TURNO_BLOQUEADO: "This slot isn't available.",
    TURNO_PASADO: "This day has already passed.",
    MES_NO_ABIERTO: "This month isn't open for sign-ups.",
    NO_ENCONTRADO: "We couldn't find what you're looking for.",
    TOKEN_INVALIDO: "This link is no longer valid.",
    DATOS_INVALIDOS: "Please check the form.",
    NO_AUTORIZADO: "You don't have permission to do this.",
    ERROR_INTERNO: "Something went wrong. Please try again in a moment.",
  },
};
