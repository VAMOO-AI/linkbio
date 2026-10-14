/**
 * Textos do /admin: nome em PT-BR de cada campo da config, nome de cada tipo de bloco e o bloco novo de cada tipo.
 * Só dados (sem servidor): o editor client importa este arquivo.
 */

import { idLivre } from "./normalizar";

export const CAMPOS: Record<string, string> = {
  site: "Site",
  url: "Link",
  locale: "Idioma",
  tz: "Fuso horário",
  share: "Capa ao compartilhar",
  description: "Texto do link",
  theme: "Aparência",
  preset: "Modelo",
  mode: "Claro ou escuro",
  accent: "Cor de destaque",
  accent2: "2ª cor da marca",
  titulo: "Peso dos títulos",
  fundoImagem: "Imagem de fundo",
  rotulos: "Selos e etiquetas",
  palette: "Cores do modelo (avançado)",
  claro: "Paleta clara",
  escuro: "Paleta escura",
  bg: "Fundo",
  surface: "Fundo dos cards",
  surface2: "Fundo secundário",
  text: "Texto",
  dim: "Texto de apoio",
  faint: "Linhas e detalhes",
  line: "Bordas",
  ctaBg: "Botão principal: fundo",
  ctaBg2: "Botão principal: 2ª cor (degradê)",
  ctaText: "Botão principal: texto",
  shellBg: "Bloco em destaque: fundo",
  shellText: "Bloco em destaque: texto",
  font: "Fonte",
  display: "Fonte dos títulos",
  body: "Texto",
  background: "Fundo da página",
  buttons: "Botões",
  corners: "Cantos",
  radius: "Cantos em px (substitui Cantos)",
  profile: "Perfil",
  name: "Nome",
  handle: "@ do perfil",
  avatar: "Foto",
  bio: "Bio",
  tags: "Etiquetas",
  tipo: "Pessoa ou empresa",
  socials: "Redes",
  icone: "Ícone",
  rotulo: "Nome",
  contact: "Contato",
  whatsapp: "WhatsApp (com DDD)",
  offers: "Ofertas",
  catalog: "Produtos da vitrine",
  blocks: "Blocos",
  id: "Identificador (minúsculas e hífens, não mude depois de publicar)",
  title: "Título",
  why: "Descrição",
  price_cents: "Preço (R$)",
  price_label: "Texto do preço (ex.: a partir de, Sob consulta)",
  wa: "Mensagem do WhatsApp",
  cta: "Texto do botão",
  more_label: "Texto do link secundário",
  more_url: "Link secundário",
  cover: "Capa",
  image: "Imagem",
  headline: "Título da capa",
  tag: "Etiqueta",
  tone: "Tom da capa",
  category: "Categoria",
  type: "Tipo",
  enabled: "Ligado",
  visivel: "Mostrar só entre datas",
  de: "De",
  ate: "Até",
  header: "Cabeçalho",
  label: "Texto do botão",
  action: "Ao clicar, abre",
  variant: "Estilo",
  note: "Linha abaixo do botão",
  pulse: "Ponto verde de online",
  subtitle: "Subtítulo",
  icon: "Ícone",
  layout: "Layout",
  items: "Itens",
  eyebrow: "Título da seção",
  videoId: "Link do vídeo no YouTube",
  poster: "Capa do vídeo",
  images: "Imagens",
  src: "Imagem",
  alt: "Descrição da imagem (para quem não vê)",
  intro: "Introdução",
  mode_concierge: "Modo",
  flow: "Perguntas",
  question: "Pergunta",
  options: "Respostas",
  offer: "Oferta recomendada",
  reason: "Por que essa oferta",
  collapsed: "Começa fechado",
  quote: "Depoimento",
  role: "Profissão",
  openFirst: "Primeira pergunta aberta",
  q: "Pergunta",
  a: "Resposta",
  filter: "Filtro por categoria",
  code: "Código do cupom",
  expires: "Válido até",
  copy: "Botão Copiar",
  features: "Recursos",
  meta: "Pixel da Meta",
  ga4: "Google Analytics",
  pedir: "O que pedir",
  sucesso: "Mensagem depois de enviar",
  consentimento: "Texto do consentimento",
  entrega: "Material para baixar",
  chave: "Chave Pix",
  nome: "Nome de quem recebe",
  cidade: "Cidade",
  valor_cents: "Valor (R$)",
  txid: "Descrição",
  date: "Data",
  time: "Hora",
  duration: "Duração (minutos)",
  place: "Local ou link",
};

/** Nome e dica dos campos de uma resposta do concierge, onde os nomes genéricos confundem. */
export const CONCIERGE_OPCAO: Record<string, { nome: string; dica?: string }> = {
  label: { nome: "Texto da resposta" },
  reason: { nome: "Explicação no final" },
  title: { nome: "Título do final (sem oferta)", dica: "Só vale em resposta que decide o final, sem oferta. Padrão: \"Vamos conversar\"." },
  cta: { nome: "Texto do botão (sem oferta)", dica: "Só vale em resposta que decide o final, sem oferta. Padrão: \"Falar no WhatsApp\"." },
  wa: { nome: "Mensagem do WhatsApp (sem oferta)", dica: "Só vale em resposta que decide o final, sem oferta. As respostas vão junto, como contexto." },
};

/**
 * Nome e dica dos campos da capa ao compartilhar (site.share): "Imagem" e "Título" sozinhos não
 * dizem que é o cartão do link no WhatsApp.
 */
export const COMPARTILHAR: Record<string, { nome: string; dica?: string }> = {
  image: {
    nome: "Imagem da capa",
    dica: "Ideal 1200 x 630 (deitada). Aparece quando você manda o link no WhatsApp. Outro formato entra inteiro, com fundo. Sem imagem, o site monta uma com sua foto, nome e bio.",
  },
  title: { nome: "Título do link", dica: "Aparece em negrito embaixo da capa. Padrão: seu nome e @." },
  description: { nome: "Texto do link", dica: "Linha embaixo do título. Padrão: sua bio." },
};

/** Campos que pedem caixa de texto grande. */
/** `headline` também: a dica manda usar Enter para quebrar linha, e input de uma linha não quebra. */
export const TEXTO_LONGO = new Set(["bio", "why", "body", "wa", "intro", "reason", "question", "quote", "a", "text", "headline", "sucesso", "consentimento"]);

/** Campos de imagem: mostram botão de envio. */
export const IMAGEM = new Set(["avatar", "cover", "image", "poster", "src", "fundoImagem"]);

type Novo = (ctx: { ofertas: string[]; eventos: string[] }) => Record<string, unknown>;

/**
 * Item novo das listas da raiz (seções Ofertas e Vitrine). Nasce com identificador livre e com o
 * que o schema exige para existir (a oferta, um destino): sem isso o leigo recebia cinco erros,
 * um deles num campo escondido em Avançado.
 */
export const NOVO_ITEM: Record<string, (id: string) => Record<string, unknown>> = {
  offers: (id) => ({ id, title: "Nova oferta", why: "", wa: "Oi! Vim pela bio e quero saber mais sobre esta oferta." }),
  catalog: (id) => ({ id, title: "Novo produto", url: "" }),
};
export const PREFIXO_ID: Record<string, string> = { offers: "oferta", catalog: "produto" };

export const BLOCOS: Record<string, { nome: string; descricao: string; novo: Novo }> = {
  profile: { nome: "Perfil", descricao: "Foto, nome, bio e redes", novo: () => ({ type: "profile" }) },
  cta: {
    nome: "Botão principal",
    descricao: "Botão grande (WhatsApp ou link)",
    novo: () => ({ type: "cta", label: "Falar no WhatsApp", action: { wa: "Oi! Vim pela sua bio." } }),
  },
  banner: { nome: "Aviso", descricao: "Faixa de destaque (nova turma, evento)", novo: () => ({ type: "banner", title: "Aviso" }) },
  concierge: {
    nome: "Concierge",
    descricao: "Perguntas que indicam a oferta certa",
    novo: ({ ofertas }) => ({
      type: "concierge",
      mode: "roteiro",
      title: "Não sabe por onde começar?",
      flow: [
        {
          id: "passo-1",
          question: "Qual é o seu momento?",
          options: [
            // Sem oferta cadastrada, as respostas levam para a conversa no WhatsApp (válido desde o início).
            ofertas.length
              ? { id: "opcao-1", label: "Opção 1", offer: ofertas[0], reason: "Por que esta oferta." }
              : { id: "opcao-1", label: "Opção 1", reason: "Por que conversar." },
            ofertas.length
              ? { id: "opcao-2", label: "Opção 2", offer: ofertas[1] ?? ofertas[0], reason: "Por que esta oferta." }
              : { id: "opcao-2", label: "Opção 2", reason: "Por que conversar." },
          ],
        },
      ],
    }),
  },
  cards: {
    nome: "Ofertas",
    descricao: "Cards das ofertas, com capa e preço",
    novo: ({ ofertas }) => ({ type: "cards", eyebrow: "Ofertas", items: ofertas.slice(0, 2) }),
  },
  products: { nome: "Vitrine", descricao: "Produtos com preço e filtro", novo: () => ({ type: "products", title: "Loja" }) },
  coupon: {
    nome: "Cupom",
    descricao: "Código de desconto",
    novo: () => ({ type: "coupon", code: "CUPOM10", label: "10% de desconto" }),
  },
  link: { nome: "Link", descricao: "Um link (vira card com imagem)", novo: () => ({ type: "link", title: "Novo link", url: "https://" }) },
  links: {
    nome: "Grupo de links",
    descricao: "Até 12 links juntos",
    novo: () => ({ type: "links", title: "Links", items: [{ title: "Novo link", url: "https://" }] }),
  },
  social: {
    nome: "Redes em linha",
    descricao: "Ícones das redes",
    novo: () => ({ type: "social", items: [{ icone: "instagram", rotulo: "Instagram", url: "https://" }] }),
  },
  youtube: { nome: "Vídeo", descricao: "Vídeo do YouTube", novo: () => ({ type: "youtube", title: "Vídeo", videoId: "" }) },
  gallery: { nome: "Galeria", descricao: "Fotos", novo: () => ({ type: "gallery", title: "Galeria", images: [] }) },
  testimonials: {
    nome: "Depoimentos",
    descricao: "Só depoimentos reais",
    novo: () => ({ type: "testimonials", title: "Depoimentos", items: [{ quote: "", name: "" }] }),
  },
  faq: {
    nome: "Perguntas frequentes",
    descricao: "Abre e fecha sem JavaScript",
    novo: () => ({ type: "faq", title: "Perguntas frequentes", items: [{ q: "", a: "" }] }),
  },
  text: { nome: "Texto", descricao: "Texto livre ou rodapé", novo: () => ({ type: "text", body: "Escreva aqui." }) },
  divider: { nome: "Divisor", descricao: "Linha entre blocos", novo: () => ({ type: "divider" }) },
  lead: {
    nome: "Contato",
    descricao: "Formulário para material ou lista de espera",
    novo: () => ({
      type: "lead",
      id: "contato",
      title: "Baixe o material grátis",
      label: "Quero receber",
      pedir: "whatsapp",
      sucesso: "Pronto! Em instantes você recebe.",
    }),
  },
  pix: {
    nome: "Pix",
    descricao: "QR Code e código para copiar",
    novo: () => ({
      type: "pix",
      chave: "123e4567-e12b-12d1-a456-426655440000",
      nome: "Seu Nome",
      cidade: "SAO PAULO",
    }),
  },
  agenda: {
    nome: "Agenda",
    descricao: "Próximos eventos",
    novo: ({ eventos }) => ({
      type: "agenda",
      title: "Agenda",
      items: [{ id: idLivre("encontro", eventos), title: "Encontro", date: "2099-12-31" }],
    }),
  },
};

/** Resumo de uma linha para a lista de blocos. */
export function resumoDoBloco(b: Record<string, unknown>): string {
  for (const k of ["title", "label", "eyebrow", "code", "nome", "body"]) {
    const v = b[k];
    if (typeof v === "string" && v.trim()) return v.length > 60 ? `${v.slice(0, 57)}...` : v;
  }
  return "";
}

/** Nome dos valores que não estão no catálogo config/opcoes.ts. */
export const VALORES: Record<string, string> = {
  escuro: "Escuro",
  claro: "Claro",
  gradiente: "Degradê",
  primario: "Cheio",
  secundario: "Vazado",
  padrao: "Padrão",
  rodape: "Rodapé",
  roteiro: "Roteiro",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  email: "E-mail",
  ambos: "WhatsApp e e-mail",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  site: "Site",
  pessoa: "Pessoa",
  empresa: "Empresa",
};

/** Dicas curtas embaixo do campo. */
export const DICAS: Record<string, string> = {
  handle: "Como aparece no Instagram. Se faltar o @, o painel coloca.",
  whatsapp: "Digite do jeito que quiser, ex.: (11) 98765-4321. O painel tira os símbolos e acrescenta o 55 do Brasil.",
  wa: "Texto que já vem escrito quando a pessoa abre o WhatsApp.",
  price_cents: "Em reais, ex.: 1.290,50. Deixe vazio para não mostrar preço. 0 aparece como Grátis.",
  accent: "Cor dos detalhes: links, preços, destaques.",
  accent2: "Cor dos botões vazados (ação dos cards, botão secundário). Vazio: cor do texto.",
  ctaBg2: "Com ela, o botão principal vira um degradê das duas cores.",
  fundoImagem: "Fica por baixo de um véu na cor do fundo, para o texto continuar legível.",
  headline: "Texto grande da capa quando não há imagem. Use Enter para quebrar linha.",
  videoId: "Cole o link inteiro do vídeo (do navegador ou do botão Compartilhar). O painel guarda só o código dele.",
  expires: "O check avisa quando o cupom vencer.",
  filter: "Mostra botões por categoria (até 6).",
  collapsed: "Mostra só o título; abre ao tocar.",
  enabled: "Desligado sai da página, mas o conteúdo fica guardado.",
  visivel: "A bio mostra este bloco só entre essas datas. O último dia vale até o fim. Vazio fica sempre no ar.",
  url: "Endereço completo. Se faltar o https://, o painel coloca.",
  more_url: "Endereço completo. Se faltar o https://, o painel coloca.",
  code: "Letras, números, - ou _. O painel coloca em maiúsculas.",
  pedir: "WhatsApp, e-mail ou os dois. O nome é sempre pedido.",
  sucesso: "O que a pessoa vê depois de enviar.",
  consentimento: "Texto curto da lei de proteção de dados. Já vem preenchido.",
  entrega: "Link do material (PDF ou página). Aparece depois do envio.",
  chave: "CPF, CNPJ, e-mail, telefone ou chave aleatória. Pode colar com ponto e traço: o painel tira.",
  nome: "Até 25 letras. Se tiver acento, o Pix mostra sem.",
  cidade: "Até 15 letras. Se tiver acento, o Pix mostra sem.",
  valor_cents: "Em reais, ex.: 49,90. Vazio: quem paga escolhe o valor.",
  txid: "Opcional. Vira o código da cobrança (letras e números, até 25). Vazio: o banco usa ***.",
  copy: "Mostra o botão Copiar. Sem ele, um toque no código seleciona tudo.",
  date: "Dia do evento. Quando passar, some da bio sozinho.",
  time: "Vazio: o dia inteiro.",
  duration: "Em minutos. Vazio: no Google Agenda vale uma hora.",
  place: "Um endereço ou um link https da sala.",
  offer: "No concierge: sem oferta, a resposta leva direto à conversa no WhatsApp (bom para \"Ainda não sei\").",
  radius: "Arredondamento exato dos cards, em pixels. Substitui a opção Cantos.",
};

/**
 * Grupos do formulário de oferta e de produto, na ordem de leitura do card: o que ele diz, quanto
 * custa, para onde o botão leva e a imagem de cima. Campo fora dos grupos (e fora de AVANCADO)
 * aparece depois deles, para um campo novo do schema nunca sumir do painel.
 */
export const GRUPOS: Record<string, { titulo: string; campos: string[]; dica?: string }[]> = {
  offers: [
    { titulo: "Texto", campos: ["title", "why"] },
    { titulo: "Preço", campos: ["price_cents", "price_label"] },
    { titulo: "Botão e destino", campos: ["url", "wa", "cta"], dica: "Preencha o Link ou a Mensagem do WhatsApp. Com os dois, o botão abre o link." },
    { titulo: "Capa", campos: ["cover"] },
  ],
  catalog: [
    { titulo: "Texto", campos: ["title", "category"] },
    { titulo: "Preço", campos: ["price_cents", "price_label"] },
    { titulo: "Botão e destino", campos: ["url", "cta"] },
    { titulo: "Foto", campos: ["image"] },
  ],
};

/** Campos que ficam em "Avançado" (quase ninguém precisa mexer). */
export const AVANCADO = new Set(["id", "radius", "palette", "locale", "tz", "mode", "more_label", "more_url"]);
