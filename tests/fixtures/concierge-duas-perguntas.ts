// Concierge de uma bio real (anonimizada, 30/09/2026): 2 perguntas, e a 2ª tem oferta e explicação em
// cada resposta. No modo "primeira" elas são ignoradas; no modo "ultima", decidem o final.
// Só o fluxo e as ofertas: sem número de WhatsApp nem dados de contato.

export const ofertas = [
  {
    "id": "mentoria",
    "wa": "Oi, Marina! Quero aplicar para a Mentoria Estúdio Norte e entender qual caminho faz mais sentido para a minha empresa.",
    "cta": "Aplicar para mentoria",
    "why": "Você transforma problemas reais da sua empresa em software, com método, prática e curadoria em cada decisão importante.",
    "title": "Mentoria Estúdio Norte"
  },
  {
    "id": "servicos",
    "wa": "Oi, Marina! Quero avaliar um software 100% sob medida para a minha empresa.\n\nO processo que quero melhorar:\nHoje ele funciona assim:\nO principal gargalo ou impacto:",
    "cta": "Contar meu desafio",
    "why": "A Estúdio Norte entende sua operação, projeta a solução e entrega o sistema funcionando: sistemas, agentes de IA, automações e integrações.",
    "title": "Software sob medida"
  },
  {
    "id": "conteudo",
    "cta": "Abrir o Instagram",
    "url": "https://www.instagram.com/marina.exemplo/",
    "why": "Bastidores, sistemas AI-First e IA aplicada a negócios reais.",
    "title": "Acompanhe o @marina.exemplo"
  }
];

export const flow = [
  {
    "id": "goal",
    "options": [
      {
        "id": "mentoria",
        "label": "Aprender a criar soluções com IA",
        "offer": "mentoria",
        "reason": "Você aprende a transformar os problemas da sua empresa em software, com método e curadoria em cada decisão."
      },
      {
        "id": "servicos",
        "label": "Receber um sistema pronto",
        "offer": "servicos",
        "reason": "A Estúdio Norte entende a sua operação, projeta a solução e entrega o sistema funcionando."
      },
      {
        "id": "conteudo",
        "label": "Só acompanhar o conteúdo",
        "offer": "conteudo",
        "reason": "Bastidores, sistemas AI-First e IA aplicada a negócios reais."
      }
    ],
    "question": "O que você quer resolver agora?"
  },
  {
    "id": "role",
    "options": [
      {
        "id": "dono",
        "label": "Sou dono(a) / sócio(a)",
        "offer": "mentoria",
        "reason": "Como dono(a), você aprende a transformar os problemas da sua empresa em software, com método e curadoria em cada decisão."
      },
      {
        "id": "gestor",
        "label": "Lidero um time ou área",
        "offer": "servicos",
        "reason": "Liderando um time, a Estúdio Norte entende a sua operação, projeta a solução e entrega o sistema funcionando."
      },
      {
        "id": "autonomo",
        "label": "Trabalho por conta própria",
        "offer": "mentoria",
        "reason": "Trabalhando por conta própria, você aprende a criar suas próprias soluções com IA, com método e curadoria em cada decisão."
      }
    ],
    "question": "E qual é o seu papel no negócio?"
  }
];
