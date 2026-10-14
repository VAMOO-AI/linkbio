import { defineConfig } from "./config/schema";

/**
 * Config de EXEMPLO (pessoa fictícia). É este arquivo que o dono da bio edita.
 * Validado com zod no build: erro aqui quebra o build com mensagem em PT-BR.
 */
export default defineConfig({
  site: {
    url: "https://link.exemplo.com",
    locale: "pt-BR",
    tz: "America/Sao_Paulo",
  },
  theme: {
    preset: "neutro",
    accent: "#007dff",
    font: "jakarta",
    radius: 6,
  },
  profile: {
    name: "Marina Duarte",
    handle: "@marina.exemplo",
    avatar: "/avatar-placeholder.svg",
    bio: "Ajudo pessoas ocupadas a organizar a rotina em 15 minutos por dia.",
    tags: ["Rotina", "Produtividade"],
    socials: [
      { icone: "instagram", rotulo: "Instagram", url: "https://instagram.com/marina.exemplo" },
      { icone: "youtube", rotulo: "YouTube", url: "https://youtube.com/@marinaexemplo" },
    ],
  },
  contact: {
    whatsapp: "5511987654321",
  },
  offers: [
    {
      id: "mentoria",
      title: "Mentoria Rotina Leve",
      why: "Acompanhamento de 4 semanas para montar uma rotina que cabe na sua agenda.",
      price_cents: 49000,
      url: "https://exemplo.com/mentoria",
      wa: "Oi! Vim pela bio e quero saber mais sobre a Mentoria Rotina Leve.",
      cta: "Quero a mentoria",
      more_label: "Conhecer a mentoria",
      more_url: "https://exemplo.com/mentoria-sobre",
      cover: { tag: "4 semanas", headline: "Rotina\nque cabe.", tone: "escuro" },
    },
    {
      id: "guia",
      title: "Guia Primeiros Passos",
      why: "Um guia curto e direto para destravar a organização da semana.",
      price_cents: 2900,
      url: "https://exemplo.com/guia",
      wa: "Oi! Vim pela bio e quero o Guia Primeiros Passos.",
      cover: { tag: "Leitura rápida", headline: "Primeiros\npassos.", tone: "claro" },
    },
  ],
  catalog: [
    {
      id: "curso-rotina",
      title: "Curso Rotina em 15 minutos",
      url: "https://exemplo.com/curso-rotina",
      price_cents: 19700,
      category: "Cursos",
    },
    {
      id: "curso-agenda",
      title: "Agenda sem culpa",
      url: "https://exemplo.com/curso-agenda",
      price_cents: 9700,
      price_label: "a partir de",
      category: "Cursos",
    },
    {
      id: "livro-semana",
      title: "Livro A semana leve",
      url: "https://exemplo.com/livro",
      price_cents: 4990,
      category: "Livros",
      cta: "Comprar",
    },
    {
      id: "planner-mensal",
      title: "Planner mensal para imprimir",
      url: "https://exemplo.com/planner-mensal",
      price_cents: 0,
      category: "Materiais",
      cta: "Baixar",
    },
    {
      id: "consultoria",
      title: "Consultoria individual",
      url: "https://exemplo.com/consultoria",
      price_label: "Sob consulta",
      category: "Serviços",
    },
  ],
  // Blocos na ordem da página. Qualquer bloco aceita enabled: false (desliga sem apagar).
  blocks: [
    { type: "profile" },
    {
      type: "cta",
      id: "falar-whatsapp",
      label: "Falar no WhatsApp",
      action: { wa: "Oi! Vim pela sua bio." },
      note: "Respondo pessoalmente, em dias úteis",
      pulse: true,
    },
    {
      type: "banner",
      id: "nova-turma",
      title: "Nova turma em outubro",
      text: "Vagas limitadas para a mentoria.",
      label: "Quero entrar",
      action: { wa: "Oi! Quero entrar na turma de outubro da mentoria." },
    },
    {
      type: "concierge",
      id: "concierge",
      title: "Não sabe por onde começar?",
      intro: "Responda 2 perguntas e eu indico o melhor caminho.",
      mode: "roteiro",
      flow: [
        {
          id: "momento",
          question: "Qual é o seu momento hoje?",
          options: [
            {
              id: "perdida",
              label: "Estou perdida",
              offer: "mentoria",
              reason: "A mentoria acompanha de perto quem está começando do zero.",
            },
            {
              id: "andamento",
              label: "Já comecei",
              offer: "guia",
              reason: "O guia destrava os próximos passos de quem já saiu do lugar.",
            },
            {
              // Sem offer: o final vira convite para conversar no WhatsApp (title, cta e wa são opcionais).
              id: "nao-sei",
              label: "Ainda não sei",
              reason: "Numa conversa rápida eu entendo o seu momento e indico o caminho certo.",
              title: "Vamos descobrir juntos",
            },
          ],
        },
        {
          id: "tempo",
          question: "Quanto tempo você tem por dia?",
          options: [
            {
              id: "pouco",
              label: "Até 15 min",
              offer: "guia",
              reason: "O guia foi feito para caber em 15 minutos por dia.",
            },
            {
              id: "mais",
              label: "Mais de 30 min",
              offer: "mentoria",
              reason: "Com mais tempo disponível, a mentoria rende ainda mais.",
            },
          ],
        },
      ],
    },
    {
      type: "cards",
      id: "caminhos",
      eyebrow: "Dois caminhos",
      items: ["mentoria", "guia"],
    },
    {
      type: "coupon",
      id: "cupom-boas-vindas",
      code: "BEMVINDA10",
      copy: true,
      label: "10% no primeiro curso",
      expires: "2026-12-31",
      action: { url: "https://exemplo.com/curso-rotina" },
    },
    {
      type: "products",
      id: "loja",
      title: "Loja",
      filter: true,
    },
    {
      type: "link",
      id: "planner",
      title: "Planner semanal grátis",
      subtitle: "PDF para imprimir, 2 páginas",
      url: "https://exemplo.com/planner",
      image: "/gallery-2.svg",
    },
    {
      type: "links",
      id: "acompanhe",
      title: "Me acompanhe",
      items: [
        {
          title: "@marina.exemplo",
          subtitle: "Dicas rápidas de rotina",
          url: "https://instagram.com/marina.exemplo",
          icon: "instagram",
        },
        {
          title: "YouTube",
          subtitle: "Vídeos semanais",
          url: "https://youtube.com/@marinaexemplo",
          icon: "youtube",
        },
        { title: "Blog", subtitle: "Textos longos", url: "https://exemplo.com/blog", icon: "site" },
      ],
    },
    {
      type: "youtube",
      id: "video-destaque",
      title: "Comece por aqui",
      videoId: "dQw4w9WgXcQ",
    },
    {
      type: "gallery",
      id: "bastidores",
      title: "Bastidores",
      images: [
        { src: "/gallery-1.svg", alt: "Mesa de trabalho organizada" },
        { src: "/gallery-2.svg", alt: "Caderno de planejamento aberto" },
      ],
    },
    {
      type: "testimonials",
      id: "depoimentos",
      title: "Quem já fez",
      items: [
        {
          quote: "Depoimento de exemplo: troque pelo texto real de um cliente.",
          name: "Nome do cliente",
          role: "Profissão",
        },
        {
          quote: "Depoimento de exemplo: curto, específico e com o resultado que a pessoa teve.",
          name: "Nome do cliente",
          role: "Profissão",
        },
      ],
    },
    {
      type: "faq",
      id: "perguntas",
      title: "Perguntas frequentes",
      openFirst: true,
      items: [
        { q: "Como funciona a mentoria?", a: "São 4 encontros semanais online, com um plano de rotina feito para você." },
        { q: "Preciso de muito tempo livre?", a: "Não. O método foi pensado para 15 minutos por dia." },
        { q: "Posso cancelar?", a: "Sim, até 7 dias depois da compra, com reembolso integral." },
      ],
    },
    {
      type: "text",
      id: "sobre",
      title: "Sobre mim",
      body: "Sou uma pessoa fictícia criada só para demonstrar este template. Troque este texto pelo seu.",
    },
    {
      type: "text",
      id: "aviso-ferias",
      enabled: false,
      title: "Em férias até dia 10",
      body: "Exemplo de bloco desligado: com enabled: false ele sai da página e o texto fica guardado aqui.",
    },
    {
      type: "pix",
      id: "pix",
      chave: "123e4567-e12b-12d1-a456-426655440000",
      nome: "Fulano de Tal",
      cidade: "BRASILIA",
      valor_cents: 4990,
      copy: true,
    },
    {
      type: "agenda",
      id: "agenda",
      title: "Próximos encontros",
      url: "https://exemplo.com/agendar",
      items: [
        {
          id: "encontro",
          title: "Encontro de exemplo",
          date: "2099-06-15",
          time: "19:00",
          duration: 60,
          place: "https://exemplo.com/sala",
          description: "Conversa de exemplo, troque pela sua.",
        },
        {
          id: "passado",
          title: "Encontro que já passou",
          date: "2020-01-15",
          time: "10:00",
          duration: 60,
        },
      ],
    },
    {
      type: "text",
      id: "turma-futura",
      title: "Turma que ainda não começou",
      body: "Exemplo de bloco programado: fica fora da página até a data marcada.",
      visivel: { de: "2099-01-01" },
    },
    {
      type: "text",
      id: "turma-encerrada",
      title: "Turma que já acabou",
      body: "Exemplo de bloco expirado: a data já passou, então ele sai da página e o texto fica guardado aqui.",
      visivel: { ate: "2020-01-31" },
    },
    { type: "divider" },
    {
      type: "text",
      id: "rodape",
      variant: "rodape",
      title: "Rotina leve",
      body: "15 minutos por dia já mudam a semana.",
    },
  ],
  features: {
    leads: false,
    analytics: false,
    pixel: { meta: null, ga4: null },
  },
});
