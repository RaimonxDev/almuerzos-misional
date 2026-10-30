import type { TextosPortada } from "./es";

export const pt: TextosPortada = {
  menu: {
    secciones: "Seções",
    entrar: "Entrar",
    entrarAyuda: "Entrar no painel de administração",
  },
  hero: {
    sub: "O calendário de almoços para os missionários da sua ala. Cada irmã escolhe o seu dia pelo celular e a presidente não precisa mais cuidar da lista pelo WhatsApp.",
    accion: "Solicitar para minha ala",
    hermana: "É irmã da ala? Peça o link à presidente da Sociedade de Socorro.",
    pestanas: {
      probar: "Experimente",
      comoFunciona: "Como funciona",
      loQueCambia: "O que muda",
      preguntas: "Perguntas",
      solicitar: "Solicitar",
    },
  },
  demo: {
    titulo: "Inscreva-se num dia livre",
    intro: "É assim que uma semana aparece no link da ala. Toque em «Inscrever-me» e experimente.",
    elderes: "Élderes",
    hermanas: "Sísteres",
    anotarme: "Inscrever-me",
    tuNombre: "Seu nome",
    confirmar: "Confirmar",
    cancelar: "Voltar",
    tuyo: "Seu",
    libre: "Livre",
    deshacer: "Desfazer",
    conferencia: "Conferência de estaca",
    libres: (n: number) => (n === 0 ? "Semana completa" : n === 1 ? "Resta 1 turno livre" : `Restam ${n} turnos livres`),
    listo: (dia: string) => `Pronto: ${dia} é seu. Na sua ala fica salvo e a presidente vê na hora.`,
    nombres: ["Irmã Silva", "Fam. Souza", "Irmã Costa", "Irmã Lima", "Fam. Rocha", "Irmã Alves"],
  },
  comoFunciona: {
    titulo: "Como funciona",
    texto: "A presidente prepara o mês uma vez. Depois, cada irmã se inscreve sozinha e os missionários sabem onde almoçam cada dia.",
    grupos: [
      {
        titulo: "Antes do mês",
        pasos: [
          ["Criar o mês com um turno por dia", "a presidente"],
          ["Bloquear os dias sem almoço", "a presidente"],
          ["Compartilhar o link da ala", "pelo WhatsApp"],
        ],
      },
      {
        titulo: "Durante o mês",
        pasos: [
          ["Escolher um dia livre e se inscrever", "cada irmã"],
          ["Mudar ou cancelar pelo mesmo celular", "cada irmã"],
          ["Ver quem cozinha, o endereço e o telefone", "os missionários"],
        ],
      },
      {
        titulo: "Para a reunião",
        pasos: [["Imprimir o calendário ou enviar como imagem", "a presidente"]],
      },
    ],
    resultado: ["Um mês de almoços sem lista para copiar", "grátis"],
  },
  loQueCambia: {
    titulo: "O que muda",
    hojas: [
      {
        titulo: "Ninguém pega o mesmo dia",
        texto: "Quando uma irmã escolhe um turno, ele deixa de estar livre para as outras. Se duas escolhem ao mesmo tempo, a segunda vê um aviso gentil e escolhe outro dia. Sem mensagens cruzadas nem listas copiadas e coladas.",
      },
      {
        titulo: "Seu telefone não fica à vista",
        texto: "A página da ala mostra só nomes. O endereço e a nota são vistos pelos missionários e pela presidente; o telefone, só se você permitiu ao se inscrever.",
      },
      {
        titulo: "Um calendário para a reunião",
        texto: "A presidente personaliza com uma escritura, uma mensagem e uma imagem do mês, e imprime em A4 ou envia como imagem para o grupo da ala.",
      },
      {
        titulo: "Em três idiomas",
        texto: "Español, português e English. Cada pessoa escolhe o seu e o link da ala continua o mesmo.",
      },
    ],
    calendarioAlt: "O calendário para imprimir: um mês com os nomes de quem dá o almoço cada dia",
  },
  preguntas: {
    titulo: "Perguntas frequentes",
    hechos: [
      "Grátis para a ala, sem publicidade.",
      "As irmãs não precisam de conta nem senha.",
      "Funciona no navegador de qualquer celular.",
    ],
    verTodas: "Ver todas as perguntas",
    destacadas: ["cuenta", "enlace", "telefono", "cambiar", "empezar", "costo"],
  },
  solicitar: {
    titulo: "Quer usar na sua ala?",
    texto: "Conte como se chama a sua ala e quem coordena os almoços. Revisamos cada solicitação à mão e respondemos por e-mail.",
    accion: "Solicitar acesso",
    aparte: "Quem pede é a presidente da Sociedade de Socorro ou quem organiza os almoços. É grátis e não precisa instalar nada.",
  },
  pie: {
    despedida: "Bom apetite, élderes e sísteres",
    mensaje: "Almoço Missionário é um projeto pessoal e gratuito, feito para facilitar a coordenação dos almoços da ala. Não é um site oficial de nenhuma igreja.",
    preguntas: "Perguntas frequentes",
    informacion: "Informações e aviso legal",
    entrar: "Painel de administração",
    creditos: "Fotos e ilustração: © Intellectual Reserve, Inc. No calendário de exemplo, pintura de Jacob van Es (domínio público).",
  },
  cuadros: {
    cena: "Uma família almoça com dois élderes em casa",
    elderes: "Um élder ora com as mãos juntas à mesa antes de comer",
    visita: "Uma mulher abre a porta de casa para duas irmãs",
    misioneras: "Duas sísteres sorriem num jardim",
    caminando: "Duas sísteres caminham por uma trilha com suas bolsas",
    ministrantes: "Três irmãs conversam e leem juntas",
    bendecir: "Ilustração de uma família que abençoa os alimentos à mesa, de Phyllis Luch",
  },
  paginaPreguntas: {
    titulo: "Perguntas frequentes",
    intro: "O que as irmãs, as presidentes e os missionários costumam perguntar. Sua pergunta não está aqui? Escreva para",
  },
  grupos: [
    {
      titulo: "Para as irmãs",
      preguntas: [
        {
          id: "cuenta",
          p: "Preciso criar uma conta?",
          r: "Não. Você abre o link da sua ala, escolhe um dia livre e escreve seu nome. Só isso.",
        },
        {
          id: "enlace",
          p: "Onde consigo o link da minha ala?",
          r: "Com a presidente da Sociedade de Socorro, normalmente no grupo de WhatsApp da ala. Por privacidade, esta página não mostra a lista de alas.",
        },
        {
          id: "telefono",
          p: "Quem vê meu telefone?",
          r: "Na página da ala aparece só o seu nome. Os missionários e a presidente veem seu telefone só se você marcar a caixa de permissão ao se inscrever. O endereço ou o horário que você escrever, só eles veem.",
        },
        {
          id: "cambiar",
          p: "Como mudo ou cancelo meu dia?",
          r: "Abra o link da ala no mesmo celular com que se inscreveu e toque em «Ver meu turno». Você pode mudar os dados ou cancelar enquanto o mês estiver aberto e o dia não tiver passado. Se trocou de celular, peça à presidente.",
        },
        {
          id: "adelanto",
          p: "Alguém pegou o dia logo antes de mim",
          r: "Acontece quando duas pessoas escolhem o mesmo turno ao mesmo tempo: fica com quem confirma primeiro. Volte ao calendário e escolha outro dia livre.",
        },
        {
          id: "llevar",
          p: "Posso levar a comida em vez de recebê-los?",
          r: "Sim. Ao se inscrever você escolhe se eles vêm à sua casa ou se você leva o almoço, e na nota pode pôr o horário ou o endereço.",
        },
        {
          id: "calendario",
          p: "Posso adicionar à agenda do celular?",
          r: "Sim. Depois de se inscrever aparece «Adicionar à minha agenda», que cria um evento para esse dia.",
        },
      ],
    },
    {
      titulo: "Para a presidente",
      preguntas: [
        {
          id: "empezar",
          p: "Como começo na minha ala?",
          r: "Peça acesso pelo formulário. Quando aprovamos, chega um e-mail para você escolher sua senha, e o painel guia os primeiros passos: a nota para cozinhar, criar o mês, abri-lo e compartilhar o link.",
        },
        {
          id: "bloquear",
          p: "O que faço com os dias de conferência?",
          r: "Bloqueie um turno ou o dia inteiro com um motivo, por exemplo «Conferência de estaca». Nesse dia ninguém pode se inscrever e o calendário mostra o motivo.",
        },
        {
          id: "a-mano",
          p: "Posso inscrever alguém que não usa WhatsApp?",
          r: "Sim. Pelo painel você inscreve à mão qualquer irmã ou família, também em dias passados ou com o mês fechado.",
        },
        {
          id: "companerismos",
          p: "Minha ala tem só élderes, ou só sísteres",
          r: "Você escolhe quais companheirismos a ala tem e pode adicionar ou desativar um quando as designações mudam. Desativar não apaga o que já foi inscrito.",
        },
        {
          id: "costo",
          p: "Quanto custa?",
          r: "Nada. É um projeto pessoal e gratuito, sem publicidade.",
        },
      ],
    },
    {
      titulo: "Para os missionários",
      preguntas: [
        {
          id: "misioneros",
          p: "Como os missionários veem o calendário?",
          r: "Com um link privado que a presidente envia. Ali veem quem dá o almoço cada dia, a nota e, se houve permissão, o telefone com um botão para escrever pelo WhatsApp.",
        },
        {
          id: "enlace-perdido",
          p: "E se o link dos missionários chegar a quem não deve?",
          r: "A presidente troca o link pelo painel. O anterior para de funcionar na hora e se compartilha o novo.",
        },
      ],
    },
    {
      titulo: "Sobre o site",
      preguntas: [
        {
          id: "oficial",
          p: "É um site oficial?",
          r: "Não. É uma ferramenta independente, feita por um membro para ajudar as alas. Os detalhes estão na página de informações e aviso legal.",
        },
        {
          id: "idiomas",
          p: "Em quais idiomas está?",
          r: "Em espanhol, português e inglês. Escolha no seletor de idioma, lá em cima; a escolha fica salva no seu celular.",
        },
      ],
    },
  ],
};
