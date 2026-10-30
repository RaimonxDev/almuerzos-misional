import type { TextosPortada } from "./es";

export const en: TextosPortada = {
  menu: {
    secciones: "Sections",
    entrar: "Sign in",
    entrarAyuda: "Sign in to the admin panel",
  },
  hero: {
    sub: "The lunch calendar for your ward's missionaries. Each sister picks her day from her phone, and the Relief Society president no longer keeps the list on WhatsApp.",
    accion: "Request it for my ward",
    hermana: "A sister in the ward? Ask your Relief Society president for the link.",
    pestanas: {
      probar: "Try it",
      comoFunciona: "How it works",
      loQueCambia: "What changes",
      preguntas: "Questions",
      solicitar: "Request",
    },
  },
  demo: {
    titulo: "Sign up for a free day",
    intro: "This is what a week looks like on the ward link. Tap “Sign me up” and try it.",
    elderes: "Elders",
    hermanas: "Sisters",
    anotarme: "Sign me up",
    tuNombre: "Your name",
    confirmar: "Confirm",
    cancelar: "Back",
    tuyo: "Yours",
    libre: "Free",
    deshacer: "Undo",
    conferencia: "Stake conference",
    libres: (n: number) => (n === 0 ? "Week is full" : n === 1 ? "1 free slot left" : `${n} free slots left`),
    listo: (dia: string) => `Done: ${dia} is yours. In your ward it's saved and the president sees it right away.`,
    nombres: ["Sister Smith", "The Johnsons", "Sister Brown", "Sister Lee", "The Garcias", "Sister Clark"],
  },
  comoFunciona: {
    titulo: "How it works",
    texto: "The president sets up the month once. After that, each sister signs up on her own and the missionaries know where they're eating every day.",
    grupos: [
      {
        titulo: "Before the month",
        pasos: [
          ["Create the month with one slot per day", "the president"],
          ["Block the days without lunch", "the president"],
          ["Share the ward link", "on WhatsApp"],
        ],
      },
      {
        titulo: "During the month",
        pasos: [
          ["Pick a free day and sign up", "each sister"],
          ["Change or cancel from the same phone", "each sister"],
          ["See who's cooking, the address and phone", "the missionaries"],
        ],
      },
      {
        titulo: "For the meeting",
        pasos: [["Print the calendar or send it as an image", "the president"]],
      },
    ],
    resultado: ["A month of lunches, no list to copy", "free"],
  },
  loQueCambia: {
    titulo: "What changes",
    hojas: [
      {
        titulo: "No one takes the same day",
        texto: "Once a sister takes a slot, it's no longer free for anyone else. If two pick it at the same moment, the second sees a friendly note and chooses another day. No crossed messages, no copied-and-pasted lists.",
      },
      {
        titulo: "Your phone stays private",
        texto: "The ward page shows names only. The missionaries and the president see the address and the note, and the phone number only if you gave permission when signing up.",
      },
      {
        titulo: "A calendar for the meeting",
        texto: "The president adds a scripture, a message and a picture for the month, then prints it on A4 or sends it as an image to the ward group.",
      },
      {
        titulo: "In three languages",
        texto: "Español, português and English. Everyone picks their own and the ward link stays the same.",
      },
    ],
    calendarioAlt: "The printable calendar: a month with the names of who gives lunch each day",
  },
  preguntas: {
    titulo: "Frequently asked questions",
    hechos: [
      "Free for the ward, with no ads.",
      "Sisters don't need an account or a password.",
      "Works in the browser of any phone.",
    ],
    verTodas: "See all questions",
    destacadas: ["cuenta", "enlace", "telefono", "cambiar", "empezar", "costo"],
  },
  solicitar: {
    titulo: "Want it for your ward?",
    texto: "Tell us your ward's name and who organizes the lunches. We review every request by hand and reply by email.",
    accion: "Request access",
    aparte: "The Relief Society president, or whoever organizes the lunches, can ask for it. It's free and there's nothing to install.",
  },
  pie: {
    despedida: "Enjoy your meal, elders and sisters",
    mensaje: "Missionary Lunch is a free personal project, made to make organizing the ward's lunches easier. It is not an official site of any church.",
    preguntas: "Frequently asked questions",
    informacion: "Information and legal notice",
    entrar: "Admin panel",
    creditos: "Photos and illustration: © Intellectual Reserve, Inc. In the sample calendar, a painting by Jacob van Es (public domain).",
  },
  cuadros: {
    cena: "A family eats lunch at home with two elders",
    elderes: "An elder prays with folded hands at the table before eating",
    visita: "A woman opens her front door to two sisters",
    misioneras: "Two sister missionaries smile in a garden",
    caminando: "Two sister missionaries walk down a path with their bags",
    ministrantes: "Three sisters talk and read together",
    bendecir: "Illustration of a family blessing the food at the table, by Phyllis Luch",
  },
  paginaPreguntas: {
    titulo: "Frequently asked questions",
    intro: "What sisters, presidents and missionaries usually ask. Don't see your question? Write to",
  },
  grupos: [
    {
      titulo: "For sisters",
      preguntas: [
        {
          id: "cuenta",
          p: "Do I need to create an account?",
          r: "No. Open your ward's link, pick a free day and type your name. That's it.",
        },
        {
          id: "enlace",
          p: "Where do I get my ward's link?",
          r: "From your Relief Society president, usually in the ward's WhatsApp group. For privacy, this page doesn't list the wards.",
        },
        {
          id: "telefono",
          p: "Who sees my phone number?",
          r: "The ward page shows only your name. The missionaries and the president see your phone only if you tick the permission box when signing up. The address or time you write is seen by them and no one else.",
        },
        {
          id: "cambiar",
          p: "How do I change or cancel my day?",
          r: "Open the ward link on the same phone you signed up with and tap “See my slot”. You can change the details or cancel while the month is open and the day hasn't passed. If you changed phones, ask the president.",
        },
        {
          id: "adelanto",
          p: "Someone took the day just before me",
          r: "It happens when two people pick the same slot at the same time: whoever confirms first keeps it. Go back to the calendar and pick another free day.",
        },
        {
          id: "llevar",
          p: "Can I bring them the food instead of hosting?",
          r: "Yes. When you sign up you choose whether they come to your home or you bring the lunch, and the note can hold the time or the address.",
        },
        {
          id: "calendario",
          p: "Can I add it to my phone's calendar?",
          r: "Yes. After signing up you'll see “Add to my calendar”, which creates an event for that day.",
        },
      ],
    },
    {
      titulo: "For the president",
      preguntas: [
        {
          id: "empezar",
          p: "How do I start in my ward?",
          r: "Request access with the form. Once we approve it you get an email to choose your password, and the panel walks you through the first steps: the cooking note, creating the month, opening it and sharing the link.",
        },
        {
          id: "bloquear",
          p: "What about conference days?",
          r: "Block one slot or the whole day with a reason, such as “Stake conference”. No one can sign up that day and the calendar shows the reason.",
        },
        {
          id: "a-mano",
          p: "Can I sign up someone who doesn't use WhatsApp?",
          r: "Yes. From the panel you can add any sister or family by hand, even on past days or in a closed month.",
        },
        {
          id: "companerismos",
          p: "My ward has only elders, or only sister missionaries",
          r: "You choose which companionships the ward has, and you can add or turn one off when assignments change. Turning one off doesn't delete past sign-ups.",
        },
        {
          id: "costo",
          p: "How much does it cost?",
          r: "Nothing. It's a free personal project with no ads.",
        },
      ],
    },
    {
      titulo: "For the missionaries",
      preguntas: [
        {
          id: "misioneros",
          p: "How do the missionaries see the calendar?",
          r: "With a private link the president gives them. There they see who's giving lunch each day, the note and, if permission was given, the phone with a button to message on WhatsApp.",
        },
        {
          id: "enlace-perdido",
          p: "What if the missionaries' link reaches the wrong person?",
          r: "The president changes it from the panel. The old link stops working right away and the new one is shared.",
        },
      ],
    },
    {
      titulo: "About the site",
      preguntas: [
        {
          id: "oficial",
          p: "Is this an official site?",
          r: "No. It's an independent tool made by a member to help wards. The details are on the information and legal notice page.",
        },
        {
          id: "idiomas",
          p: "Which languages does it have?",
          r: "Spanish, Portuguese and English. Pick one in the language selector at the top; the choice is saved on your phone.",
        },
      ],
    },
  ],
};
