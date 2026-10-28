import type { CodigoError } from "@/shared/errores";

/**
 * Diccionario base. `pt.ts` y `en.ts` se tipan con `Mensajes`, así TypeScript
 * avisa si falta una clave. Los textos con parámetros son funciones.
 */
export const es = {
  comun: {
    nombreApp: "Almuerzo Misional",
    idioma: "Idioma",
    cargando: "Cargando…",
    reintentar: "Reintentar",
    opcional: "(opcional)",
  },
  inicio: {
    texto: "Pide a la presidenta de la Sociedad de Socorro el enlace de tu barrio para anotarte.",
  },
  publico: {
    intro: "Elige un turno libre y anótate. En esta página solo se muestra tu nombre.",
    todos: "Todos",
    soloLibres: "Solo libres",
    turnosLibres: (n: number) =>
      n === 0 ? "Sin turnos libres" : n === 1 ? "1 turno libre" : `${n} turnos libres`,
    disponible: "Disponible",
    anotarme: "Anotarme",
    tuTurno: "Tu turno",
    mesAnterior: "Mes anterior",
    mesSiguiente: "Mes siguiente",
    verAnteriores: (n: number) => (n === 1 ? "Ver el día anterior" : `Ver los ${n} días anteriores`),
    ocultarAnteriores: "Ocultar días anteriores",
    sinMesAbierto: "Todavía no hay un mes abierto para anotarse. Vuelve pronto.",
    sinLibres: "No quedan turnos libres este mes.",
    mesCerrado: "Este mes está cerrado: ya no recibe anotaciones.",
    cambiarDia: "¿Necesitas cambiar tu día? Entra desde el mismo teléfono con el que te anotaste.",
  },
  formulario: {
    volver: "Volver al calendario",
    nombre: "¿Quién da el almuerzo?",
    nombrePlaceholder: "Ej: Hna. Pérez",
    nombreAyuda: "Así aparecerá en el calendario.",
    telefono: "Teléfono (WhatsApp)",
    telefonoPlaceholder: "Ej: +56 9 1234 5678",
    modalidad: "¿Cómo será el almuerzo?",
    enCasa: "Vienen a mi casa",
    llevar: "Les llevo el almuerzo",
    nota: "Dirección u hora",
    notaPlaceholder: "Ej: 13:30, pasaje Los Aromos 123",
    paraTomarEnCuenta: "Para tomar en cuenta:",
    consentimiento:
      "Acepto que los misioneros y la presidenta vean mi teléfono para coordinar. En la página pública solo aparece mi nombre.",
    confirmar: "Confirmar mi día",
    guardando: "Guardando…",
    errorNombre: "Escribe tu nombre (al menos 2 letras).",
    errorTelefono: "Revisa el teléfono: solo números, espacios y el signo +.",
    errorConsentimientoSinTelefono: "Para compartir tu teléfono, escríbelo arriba.",
    tomadoPor: (nombre: string) => `Este turno ya lo tomó ${nombre}.`,
    bloqueadoPor: (motivo: string | null) =>
      motivo ? `Este día no hay almuerzo: ${motivo}.` : "Este turno no está disponible.",
    elegirOtro: "Elegir otro día",
  },
  exito: {
    titulo: "¡Gracias por servir!",
    texto: (fecha: string, companerismo: string) =>
      `Tu almuerzo quedó anotado para el ${fecha} con ${companerismo}.`,
    recordar:
      "Este teléfono recordará tu anotación, así puedes cambiarla o cancelarla cuando lo necesites.",
    agregarCalendario: "Agregar a mi calendario",
    eventoTitulo: (companerismo: string) => `Almuerzo para los misioneros (${companerismo})`,
  },
  errores: {
    TURNO_TOMADO: "Alguien se te adelantó y tomó este turno. Elige otro día, por favor.",
    TURNO_BLOQUEADO: "Este turno no está disponible.",
    TURNO_PASADO: "Este día ya pasó.",
    MES_NO_ABIERTO: "Este mes no está abierto para anotarse.",
    NO_ENCONTRADO: "No encontramos lo que buscas. Revisa el enlace.",
    TOKEN_INVALIDO: "Este enlace ya no es válido.",
    DATOS_INVALIDOS: "Revisa los datos del formulario.",
    NO_AUTORIZADO: "No tienes permiso para hacer esto.",
    ERROR_INTERNO: "Algo salió mal o no hay conexión. Inténtalo de nuevo en un momento.",
  } satisfies Record<CodigoError, string>,
};

export type Mensajes = typeof es;
