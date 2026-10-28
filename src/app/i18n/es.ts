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
    guardar: "Guardar",
    cancelar: "Cancelar",
    volver: "Volver",
  },
  publico: {
    titulo: "Almuerzo para los misioneros",
    turnosLibres: (n: number) =>
      n === 0 ? "No quedan turnos libres" : n === 1 ? "Queda 1 turno libre" : `Quedan ${n} turnos libres`,
    libre: "Libre",
    tomado: "Tomado",
    bloqueado: "Bloqueado",
    anotarme: "Anotarme",
    mesNoAbierto: "Este mes todavía no está abierto para anotarse.",
  },
  formulario: {
    titulo: "Anotarme para dar almuerzo",
    nombre: "Tu nombre",
    nombreAyuda: "Así aparecerá en el calendario, ej. «Hna. Pérez».",
    telefono: "Teléfono",
    consentimiento: "Acepto que los misioneros y la presidenta vean mi teléfono para coordinar.",
    modalidad: "¿Dónde será?",
    enCasa: "En mi casa",
    llevar: "Lo llevo yo",
    nota: "Dirección u hora (opcional)",
    confirmar: "Confirmar",
    listo: "¡Listo! Quedaste anotada.",
    cancelarInscripcion: "Cancelar mi turno",
  },
  errores: {
    TURNO_TOMADO: "Alguien se te adelantó y tomó este turno. Elige otro día, por favor.",
    TURNO_BLOQUEADO: "Este turno no está disponible.",
    MES_NO_ABIERTO: "Este mes no está abierto para anotarse.",
    NO_ENCONTRADO: "No encontramos lo que buscas.",
    TOKEN_INVALIDO: "Este enlace ya no es válido.",
    DATOS_INVALIDOS: "Revisa los datos del formulario.",
    NO_AUTORIZADO: "No tienes permiso para hacer esto.",
    ERROR_INTERNO: "Algo salió mal. Inténtalo de nuevo en un momento.",
  } satisfies Record<CodigoError, string>,
};

export type Mensajes = typeof es;
