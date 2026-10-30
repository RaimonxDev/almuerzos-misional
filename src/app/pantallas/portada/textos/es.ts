/**
 * Textos de la portada y de las preguntas frecuentes. Van aparte del diccionario general
 * (`src/app/i18n`) porque solo los usan estas pantallas, que se cargan con `lazy`: así la
 * vista del barrio no los descarga. `pt.ts` y `en.ts` se tipan con `TextosPortada`.
 */
export const es = {
  menu: {
    secciones: "Secciones",
    entrar: "Entrar",
    entrarAyuda: "Entrar al panel de administración",
  },
  hero: {
    sub: "El calendario de almuerzos para los misioneros de tu barrio. Cada hermana elige su día desde el teléfono y la presidenta ya no lleva la lista por WhatsApp.",
    accion: "Solicitar para mi barrio",
    hermana: "¿Eres hermana? Pide el enlace de tu barrio a la presidenta de la Sociedad de Socorro.",
    pestanas: {
      probar: "Pruébalo",
      comoFunciona: "Cómo funciona",
      loQueCambia: "Lo que cambia",
      preguntas: "Preguntas",
      solicitar: "Solicitar",
    },
  },
  demo: {
    titulo: "Anótate en un día libre",
    intro: "Así se ve una semana en el enlace del barrio. Toca «Anotarme» y prueba.",
    elderes: "Élderes",
    hermanas: "Hermanas",
    anotarme: "Anotarme",
    tuNombre: "Tu nombre",
    confirmar: "Confirmar",
    cancelar: "Volver",
    tuyo: "Tuyo",
    libre: "Libre",
    deshacer: "Deshacer",
    conferencia: "Conferencia de estaca",
    libres: (n: number) => (n === 0 ? "Semana completa" : n === 1 ? "Queda 1 turno libre" : `Quedan ${n} turnos libres`),
    listo: (dia: string) => `Listo: el ${dia} es tuyo. En tu barrio queda guardado y la presidenta lo ve al momento.`,
    nombres: ["Hna. Pérez", "Fam. Muñoz", "Hna. Rojas", "Hna. Soto", "Fam. Díaz", "Hna. Vera"],
  },
  comoFunciona: {
    titulo: "Cómo funciona",
    texto: "La presidenta prepara el mes una vez. Después, cada hermana se anota sola y los misioneros saben dónde almuerzan cada día.",
    grupos: [
      {
        titulo: "Antes del mes",
        pasos: [
          ["Crear el mes con un turno por día", "la presidenta"],
          ["Bloquear los días sin almuerzo", "la presidenta"],
          ["Compartir el enlace del barrio", "por WhatsApp"],
        ],
      },
      {
        titulo: "Durante el mes",
        pasos: [
          ["Elegir un día libre y anotarse", "cada hermana"],
          ["Cambiar o cancelar desde el mismo teléfono", "cada hermana"],
          ["Ver quién cocina, la dirección y el teléfono", "los misioneros"],
        ],
      },
      {
        titulo: "Para la reunión",
        pasos: [["Imprimir el calendario o mandarlo como imagen", "la presidenta"]],
      },
    ] as { titulo: string; pasos: [string, string][] }[],
    resultado: ["Un mes de almuerzos sin lista que copiar", "gratis"] as [string, string],
  },
  loQueCambia: {
    titulo: "Lo que cambia",
    hojas: [
      {
        titulo: "Nadie se pisa el día",
        texto: "Cuando una hermana toma un turno, deja de estar libre para las demás. Si dos lo eligen al mismo tiempo, la segunda ve un aviso amable y elige otro día. Sin mensajes cruzados ni listas copiadas y pegadas.",
      },
      {
        titulo: "Tu teléfono no queda a la vista",
        texto: "La página del barrio muestra solo nombres. La dirección y la nota las ven los misioneros y la presidenta; el teléfono, solo si diste permiso al anotarte.",
      },
      {
        titulo: "Un calendario para la reunión",
        texto: "La presidenta lo personaliza con una escritura, un mensaje y una imagen del mes, y lo imprime en A4 o lo manda como imagen al grupo del barrio.",
      },
      {
        titulo: "En tres idiomas",
        texto: "Español, português e English. Cada persona elige el suyo y el enlace del barrio sigue siendo el mismo.",
      },
    ],
    calendarioAlt: "El calendario imprimible: un mes con los nombres de quienes dan el almuerzo cada día",
  },
  preguntas: {
    titulo: "Preguntas frecuentes",
    hechos: [
      "Gratis para el barrio, sin publicidad.",
      "Las hermanas no necesitan cuenta ni contraseña.",
      "Funciona en el navegador de cualquier teléfono.",
    ],
    verTodas: "Ver todas las preguntas",
    // Las que salen en la portada, por `id`.
    destacadas: ["cuenta", "enlace", "telefono", "cambiar", "empezar", "costo"],
  },
  solicitar: {
    titulo: "¿Lo quieres en tu barrio?",
    texto: "Cuéntanos cómo se llama tu barrio y quién coordina los almuerzos. Revisamos cada solicitud a mano y te respondemos por correo.",
    accion: "Solicitar acceso",
    aparte: "Lo pide la presidenta de la Sociedad de Socorro o quien organice los almuerzos. Es gratis y no hay nada que instalar.",
  },
  pie: {
    despedida: "Buen provecho, élderes y hermanas",
    mensaje: "Almuerzo Misional es un proyecto personal y gratuito, hecho para que coordinar los almuerzos del barrio sea más fácil. No es un sitio oficial de ninguna iglesia.",
    preguntas: "Preguntas frecuentes",
    informacion: "Información y aviso legal",
    entrar: "Panel de administración",
    creditos: "Fotos e ilustración: © Intellectual Reserve, Inc. En el calendario de muestra, pintura de Jacob van Es (dominio público).",
  },
  cuadros: {
    cena: "Una familia almuerza con dos élderes en su casa",
    elderes: "Un élder ora con las manos juntas en la mesa antes de comer",
    visita: "Una mujer abre la puerta de su casa a dos hermanas",
    misioneras: "Dos hermanas misioneras sonríen en un jardín",
    caminando: "Dos hermanas misioneras caminan por un sendero con sus bolsos",
    ministrantes: "Tres hermanas conversan y leen juntas",
    bendecir: "Ilustración de una familia que bendice los alimentos en la mesa, de Phyllis Luch",
  },
  paginaPreguntas: {
    titulo: "Preguntas frecuentes",
    intro: "Lo que suelen preguntar las hermanas, las presidentas y los misioneros. ¿No está tu pregunta? Escríbenos a",
  },
  grupos: [
    {
      titulo: "Para las hermanas",
      preguntas: [
        {
          id: "cuenta",
          p: "¿Necesito crear una cuenta?",
          r: "No. Abres el enlace de tu barrio, eliges un día libre y escribes tu nombre. Nada más.",
        },
        {
          id: "enlace",
          p: "¿Dónde consigo el enlace de mi barrio?",
          r: "Te lo da la presidenta de la Sociedad de Socorro, normalmente en el grupo de WhatsApp del barrio. Por privacidad, esta página no muestra la lista de barrios.",
        },
        {
          id: "telefono",
          p: "¿Quién ve mi teléfono?",
          r: "En la página del barrio solo aparece tu nombre. Los misioneros y la presidenta ven tu teléfono solo si marcas la casilla de permiso al anotarte. La dirección o la hora que escribas la ven ellos y nadie más.",
        },
        {
          id: "cambiar",
          p: "¿Cómo cambio o cancelo mi día?",
          r: "Entra al enlace del barrio desde el mismo teléfono con el que te anotaste y toca «Ver mi turno». Puedes cambiar los datos o cancelar mientras el mes esté abierto y el día no haya pasado. Si cambiaste de teléfono, pídeselo a la presidenta.",
        },
        {
          id: "adelanto",
          p: "Alguien tomó el día justo antes que yo",
          r: "Pasa cuando dos personas eligen el mismo turno a la vez: se lo queda quien confirma primero. Vuelve al calendario y elige otro día libre.",
        },
        {
          id: "llevar",
          p: "¿Puedo llevarles la comida en vez de recibirlos?",
          r: "Sí. Al anotarte eliges si vienen a tu casa o si les llevas el almuerzo, y en la nota puedes poner la hora o la dirección.",
        },
        {
          id: "calendario",
          p: "¿Puedo agregarlo al calendario de mi teléfono?",
          r: "Sí. Después de anotarte aparece «Agregar a mi calendario», que crea un evento para ese día.",
        },
      ],
    },
    {
      titulo: "Para la presidenta",
      preguntas: [
        {
          id: "empezar",
          p: "¿Cómo empiezo en mi barrio?",
          r: "Pide acceso con el formulario. Cuando lo aprobamos te llega un correo para elegir tu contraseña, y el panel te guía con los primeros pasos: la nota para cocinar, crear el mes, abrirlo y compartir el enlace.",
        },
        {
          id: "bloquear",
          p: "¿Qué hago con los días de conferencia?",
          r: "Bloqueas un turno o el día entero con un motivo, por ejemplo «Conferencia de estaca». Ese día nadie se puede anotar y el calendario muestra el motivo.",
        },
        {
          id: "a-mano",
          p: "¿Puedo anotar a alguien que no usa WhatsApp?",
          r: "Sí. Desde el panel anotas a mano a cualquier hermana o familia, también en días pasados o con el mes cerrado.",
        },
        {
          id: "companerismos",
          p: "Mi barrio tiene solo élderes, o solo hermanas misioneras",
          r: "Eliges qué compañerismos tiene el barrio y puedes agregar o desactivar uno cuando cambian las asignaciones. Desactivar no borra lo anotado.",
        },
        {
          id: "costo",
          p: "¿Cuánto cuesta?",
          r: "Nada. Es un proyecto personal y gratuito, sin publicidad.",
        },
      ],
    },
    {
      titulo: "Para los misioneros",
      preguntas: [
        {
          id: "misioneros",
          p: "¿Cómo ven los misioneros el calendario?",
          r: "Con un enlace privado que les da la presidenta. Ahí ven quién da el almuerzo cada día, la nota y, si hubo permiso, el teléfono con un botón para escribir por WhatsApp.",
        },
        {
          id: "enlace-perdido",
          p: "¿Y si el enlace de los misioneros llega a quien no debe?",
          r: "La presidenta lo cambia desde el panel. El enlace anterior deja de funcionar al instante y se comparte el nuevo.",
        },
      ],
    },
    {
      titulo: "Sobre el sitio",
      preguntas: [
        {
          id: "oficial",
          p: "¿Es un sitio oficial?",
          r: "No. Es una herramienta independiente, hecha por un miembro para ayudar a los barrios. Los detalles están en la página de información y aviso legal.",
        },
        {
          id: "idiomas",
          p: "¿En qué idiomas está?",
          r: "En español, portugués e inglés. Se elige arriba, en el selector de idioma, y la elección queda guardada en tu teléfono.",
        },
      ],
    },
  ],
};

export type TextosPortada = typeof es;
