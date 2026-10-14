import { z } from "zod";
import { janelaCoerente } from "../lib/janela";
import { MSG_GA4, MSG_META, RE_GA4, RE_META } from "../lib/pixel";
import { mensagemDaChave, semAcento } from "../lib/pix";
import { OPCOES, type Opcao } from "./opcoes";

/**
 * Schema da linkbio.config.ts.
 * Todo erro de validacao quebra o build com mensagem em PT-BR apontando o campo.
 */

// ---------------------------------------------------------------------------
// Basicos
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slug(campo: string) {
  return z
    .string()
    .min(1, `${campo} é obrigatório.`)
    .regex(
      SLUG_RE,
      `${campo} deve ser um slug estável escrito à mão (minúsculas, números e hífens, ex.: "mentoria").`,
    );
}

function textoObrigatorio(campo: string, max = 280) {
  return z
    .string()
    .min(1, `${campo} é obrigatório.`)
    .max(max, `${campo} deve ter no máximo ${max} caracteres.`);
}

/** URL externa: só https. */
function urlExterna(campo: string) {
  return z.string().refine(
    (v) => {
      try {
        return new URL(v).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: `${campo} deve ser uma URL externa com https (ex.: "https://instagram.com/perfil").` },
  );
}

/**
 * Imagem: caminho em public/ (ex.: "/avatar.jpg") ou URL https (imagem enviada pelo /admin).
 * O nome ficou "caminhoLocal" para não mexer em todos os campos; aceita os dois.
 */
function caminhoLocal(campo: string) {
  return z
    .string()
    .min(1, `${campo} é obrigatório.`)
    .refine((v) => v.startsWith("/") || /^https:\/\/[^\s]+$/.test(v), {
      message: `${campo} deve ser um arquivo em public/ começando com "/" (ex.: "/avatar.jpg") ou uma URL https.`,
    });
}

// ---------------------------------------------------------------------------
// Theme / Site / Profile / Contact / Offer
// ---------------------------------------------------------------------------

function corHex(campo: string) {
  return z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, `${campo} deve ser uma cor hexadecimal de 6 dígitos (ex.: "#007dff").`);
}

/** Enum a partir do catálogo config/opcoes.ts; a mensagem lista as opções com a descrição. */
function opcao<G extends Record<string, Opcao>>(campo: string, grupo: G) {
  const chaves = Object.keys(grupo) as [keyof G & string, ...(keyof G & string)[]];
  return z.enum(chaves, {
    message: `${campo} inválido. Use: ${chaves.map((k) => `"${k}" (${grupo[k]!.descricao})`).join(", ")}.`,
  });
}

/** Valores da v0.1.0 continuam válidos; lib/resolver.ts converte. */
export const PRESET_LEGADO = { "neutro-claro": "neutro", "neutro-escuro": "neutro" } as const;
export const FONTE_LEGADA = {
  "Plus Jakarta Sans": "jakarta",
  "Instrument Serif": "serif",
  "Space Grotesk": "grotesk",
  "Bricolage Grotesque": "bricolage",
} as const;

const legado = <T extends Record<string, string>>(campo: string, mapa: T) =>
  z.enum(Object.keys(mapa) as [keyof T & string, ...(keyof T & string)[]], {
    message: `${campo} inválido.`,
  });

const PaletaParcialSchema = z
  .object({
    bg: corHex("theme.palette.bg"),
    surface: corHex("theme.palette.surface"),
    surface2: corHex("theme.palette.surface2"),
    text: corHex("theme.palette.text"),
    dim: corHex("theme.palette.dim"),
    faint: corHex("theme.palette.faint"),
    line: corHex("theme.palette.line"),
    ctaBg: corHex("theme.palette.ctaBg"),
    ctaBg2: corHex("theme.palette.ctaBg2"),
    ctaText: corHex("theme.palette.ctaText"),
    shellBg: corHex("theme.palette.shellBg"),
    shellText: corHex("theme.palette.shellText"),
  })
  .partial()
  .strict();

const FonteSchema = z.union(
  [
    opcao("theme.font", OPCOES.font),
    legado("theme.font", FONTE_LEGADA),
    z
      .object({ display: opcao("theme.font.display", OPCOES.font), body: opcao("theme.font.body", OPCOES.font) })
      .strict(),
  ],
  {
    message: `theme.font inválido. Use: ${Object.keys(OPCOES.font).map((k) => `"${k}"`).join(", ")} ou { display, body }.`,
  },
);

/**
 * Tema. Só `preset` é obrigatório na prática (default "neutro"); o resto sobrescreve o modelo.
 * Precedência: modelo (config/presets) < theme.* < campo do bloco. Ver lib/resolver.ts.
 */
export const ThemeSchema = z
  .object({
    preset: z
      .union([opcao("theme.preset", OPCOES.preset), legado("theme.preset", PRESET_LEGADO)], {
        message: `theme.preset inválido. Use: ${Object.keys(OPCOES.preset).map((k) => `"${k}"`).join(", ")}.`,
      })
      .default("neutro"),
    mode: opcao("theme.mode", OPCOES.mode).optional(),
    accent: corHex("theme.accent").optional(),
    /** 2ª cor da marca: botões vazados (ação dos cards, botão secundário). Sem ela, usam a cor do texto. */
    accent2: corHex("theme.accent2").optional(),
    /** Peso dos títulos: fino, normal ou forte. Sem ele, o peso da fonte escolhida. */
    titulo: opcao("theme.titulo", OPCOES.titulo).optional(),
    /** Selos, etiquetas e rótulos: na fonte do texto ou "mono" (técnico, maiúsculo). */
    rotulos: opcao("theme.rotulos", OPCOES.rotulos).optional(),
    /** Sobrescreve cores do modelo, por modo. Toda cor passa pelo teste de contraste no check. */
    palette: z
      .object({ claro: PaletaParcialSchema.optional(), escuro: PaletaParcialSchema.optional() })
      .strict()
      .optional(),
    font: FonteSchema.optional(),
    background: opcao("theme.background", OPCOES.background).optional(),
    buttons: opcao("theme.buttons", OPCOES.buttons).optional(),
    corners: opcao("theme.corners", OPCOES.corners).optional(),
    /** v0.1.0: raio dos cards em px. Se presente, sobrescreve só o raio vindo de `corners`. */
    radius: z
      .number()
      .int("theme.radius deve ser um número inteiro.")
      .min(0, "theme.radius deve ser no mínimo 0.")
      .max(24, "theme.radius deve ser no máximo 24.")
      .optional(),
    /**
     * Imagem de fundo da página inteira (arquivo em public/ ou enviado pelo painel). Vai por baixo de
     * um véu na cor do fundo, forte o bastante para o texto continuar legível em qualquer imagem.
     */
    fundoImagem: caminhoLocal("theme.fundoImagem").optional(),
  })
  .strict();

const IconeSocialSchema = z.enum(
  ["instagram", "tiktok", "youtube", "whatsapp", "linkedin", "facebook", "x", "site"],
  { message: "ícone social inválido. Use: instagram, tiktok, youtube, whatsapp, linkedin, facebook, x ou site." },
);

const ItemSocialSchema = z.object({
  icone: IconeSocialSchema,
  rotulo: textoObrigatorio("social: rotulo", 40),
  url: urlExterna("social: url"),
});

/**
 * Capa ao compartilhar (o cartão do link no WhatsApp, Instagram, Telegram). Tudo opcional: sem nada,
 * vale a capa automática (foto, nome, @ e bio no visual do modelo) e o título/bio do perfil.
 */
export const ShareSchema = z
  .object({
    /**
     * Imagem própria da capa. Recomendado 1200 x 630. Proporção perto disso é recortada só na borda;
     * muito diferente (banner largo, quadrada, vertical) entra inteira, com fundo (lib/compartilhar.ts).
     */
    image: caminhoLocal("site.share.image").optional(),
    /** Título do cartão do link. Padrão: nome e @. */
    title: textoObrigatorio("site.share.title", 70).optional(),
    /** Texto do cartão do link. Padrão: a bio. */
    description: textoObrigatorio("site.share.description", 200).optional(),
  })
  .strict();

export const SiteSchema = z.object({
  url: urlExterna("site.url"),
  locale: textoObrigatorio("site.locale", 10),
  tz: textoObrigatorio("site.tz", 60),
  share: ShareSchema.optional(),
});

export const ProfileSchema = z.object({
  name: textoObrigatorio("profile.name", 80),
  handle: z
    .string()
    .min(1, "profile.handle é obrigatório.")
    .refine((v) => v.startsWith("@"), {
      message: 'profile.handle deve começar com "@" (ex.: "@perfil").',
    }),
  avatar: caminhoLocal("profile.avatar"),
  bio: textoObrigatorio("profile.bio"),
  tags: z.array(z.string().min(1, "profile.tags não aceita tag vazia.")).max(
    5,
    "profile.tags aceita no máximo 5 tags.",
  ),
  /** Pessoa (padrão) ou empresa. Empresa vira Organization no JSON-LD, com a foto como logo. */
  tipo: z
    .enum(["pessoa", "empresa"], { message: 'profile.tipo deve ser "pessoa" ou "empresa".' })
    .optional()
    .default("pessoa"),
  /** Redes mostradas no cabeçalho (bloco profile). Estilo em blocks[].socials ou no modelo. */
  socials: z.array(ItemSocialSchema).max(8, "profile.socials aceita no máximo 8 redes.").optional(),
});

export const ContactSchema = z.object({
  whatsapp: z
    .string()
    .regex(
      /^\d{8,15}$/,
      'contact.whatsapp deve conter só dígitos, com DDI (ex.: "5511987654321").',
    ),
});

export const OfferSchema = z
  .object({
    id: slug("offers[].id"),
    title: textoObrigatorio("offers[].title", 80),
    why: textoObrigatorio("offers[].why"),
    price_cents: z
      .number()
      .int("offers[].price_cents deve ser um número inteiro (centavos).")
      .min(0, "offers[].price_cents não pode ser negativo.")
      .optional(),
    url: urlExterna("offers[].url").optional(),
    wa: textoObrigatorio("offers[].wa", 500).optional(),
    cta: z.string().max(60, "offers[].cta deve ter no máximo 60 caracteres.").optional(),
    more_label: z.string().max(60, "offers[].more_label deve ter no máximo 60 caracteres.").optional(),
    more_url: urlExterna("offers[].more_url").optional(),
    /** Capa do card. Sem imagem, é gerada com as cores do modelo a partir de headline e tone. */
    cover: z
      .object({
        image: caminhoLocal("offers[].cover.image").optional(),
        headline: z.string().max(60, "offers[].cover.headline deve ter no máximo 60 caracteres.").optional(),
        tag: z.string().max(24, "offers[].cover.tag deve ter no máximo 24 caracteres.").optional(),
        tone: z
          .enum(["escuro", "claro", "gradiente"], {
            message: 'offers[].cover.tone deve ser "escuro", "claro" ou "gradiente".',
          })
          .optional(),
      })
      .strict()
      .optional(),
  })
  .refine((o) => o.url !== undefined || o.wa !== undefined, {
    message: "cada oferta precisa de ao menos um destino: offers[].url ou offers[].wa.",
  });

/** Produto da vitrine (catálogo). Separado das ofertas do concierge. Preço é número, nunca texto. */
export const ProdutoSchema = z
  .object({
    id: slug("catalog[].id"),
    title: textoObrigatorio("catalog[].title", 80),
    url: urlExterna("catalog[].url"),
    /** Foto do produto (arquivo em public/). Sem foto, a capa é gerada com as cores do modelo. */
    image: caminhoLocal("catalog[].image").optional(),
    price_cents: z
      .number()
      .int("catalog[].price_cents deve ser um número inteiro (centavos).")
      .min(0, "catalog[].price_cents não pode ser negativo.")
      .optional(),
    /** Texto antes do preço ("a partir de") ou no lugar dele ("Sob consulta"). */
    price_label: z.string().min(1, "catalog[].price_label não pode ser vazio.").max(24, "catalog[].price_label deve ter no máximo 24 caracteres.").optional(),
    /** Categoria para o filtro da vitrine (ex.: "Cursos"). */
    category: z
      .string()
      .trim()
      .min(1, "catalog[].category não pode ser vazia.")
      .max(24, "catalog[].category deve ter no máximo 24 caracteres.")
      .refine((c) => c.toLowerCase() !== "todos", {
        message: 'catalog[].category não pode ser "Todos" (é o nome do filtro que mostra tudo).',
      })
      .optional(),
    /** Texto do botão. Padrão: "Ver detalhes". */
    cta: z.string().min(1, "catalog[].cta não pode ser vazio.").max(24, "catalog[].cta deve ter no máximo 24 caracteres.").optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Blocos (union discriminada por "type")
// ---------------------------------------------------------------------------

/** Data AAAA-MM-DD que existe no calendário (recusa 2026-02-30). */
function dataValida(campo: string) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${campo} deve estar no formato AAAA-MM-DD (ex.: "2026-12-31").`)
    .refine(
      (v) => {
        const [a, m, d] = v.split("-").map(Number) as [number, number, number];
        const dt = new Date(Date.UTC(a, m - 1, d));
        return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
      },
      { message: `${campo} não é uma data que existe no calendário.` },
    );
}

/** Data ou data com hora (AAAA-MM-DDTHH:MM). A data reaproveita `dataValida`. */
function instanteVisivel(campo: string) {
  return z.string().superRefine((v, ctx) => {
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(v)) {
      ctx.addIssue({
        code: "custom",
        message: `${campo} deve estar no formato AAAA-MM-DD ou AAAA-MM-DDTHH:MM (ex.: "2026-12-31" ou "2026-12-31T18:00").`,
      });
      return;
    }
    const data = dataValida(campo).safeParse(v.slice(0, 10));
    if (!data.success) {
      ctx.addIssue({ code: "custom", message: data.error.issues[0]?.message ?? `${campo} não é uma data que existe no calendário.` });
      return;
    }
    if (v.length > 10) {
      const hh = Number(v.slice(11, 13));
      const mm = Number(v.slice(14, 16));
      if (hh > 23 || mm > 59) ctx.addIssue({ code: "custom", message: `${campo} não é um horário que existe.` });
    }
  });
}

/**
 * Janela opcional do bloco. Uma linha por bloco, para o merge com blocos novos:
 * `visivel: campoVisivel("bloco lead"),`
 */
export function campoVisivel(bloco: string) {
  return z
    .object({
      de: instanteVisivel(`${bloco}: visivel.de`).optional(),
      ate: instanteVisivel(`${bloco}: visivel.ate`).optional(),
    })
    .strict()
    .optional()
    .refine((v) => v === undefined || janelaCoerente(v), {
      message: `${bloco}: visivel.de não pode ser depois de visivel.ate.`,
    });
}

const ProfileBlockSchema = z.object({
  type: z.literal("profile"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco profile"),
  /** Sem valor: vem do modelo (theme.preset). */
  header: opcao("bloco profile: header", OPCOES.header).optional(),
  socials: opcao("bloco profile: socials", OPCOES.socials).optional(),
  /** Imagem da capa (só no header "capa"). Sem imagem, a capa é gerada com as cores do modelo. */
  cover: caminhoLocal("bloco profile: cover").optional(),
}).strict();

const SocialBlockSchema = z.object({
  type: z.literal("social"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco social"),
  items: z.array(ItemSocialSchema).min(1, "o bloco social precisa de ao menos 1 item."),
}).strict();

const CtaBlockSchema = z.object({
  type: z.literal("cta"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco cta"),
  id: slug("bloco cta: id").optional(),
  label: textoObrigatorio("bloco cta: label", 60),
  action: z.union(
    [
      z.object({ wa: textoObrigatorio("bloco cta: action.wa", 500) }),
      z.object({ url: urlExterna("bloco cta: action.url") }),
    ],
    { message: "bloco cta: action precisa ser { wa } ou { url }." },
  ),
  /** primario = botão cheio com a cor do modelo; secundario = vazado. */
  variant: z
    .enum(["primario", "secundario"], { message: 'bloco cta: variant deve ser "primario" ou "secundario".' })
    .optional(),
  /** Linha curta abaixo do botão (ex.: "Resposta pessoal, em horário comercial"). */
  note: z.string().min(1, "bloco cta: note não pode ser vazio.").max(80, "bloco cta: note deve ter no máximo 80 caracteres.").optional(),
  /** Ponto verde de "online" antes do texto. */
  pulse: z.boolean().optional(),
}).strict();

const LinkBlockSchema = z.object({
  type: z.literal("link"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco link"),
  id: slug("bloco link: id").optional(),
  title: textoObrigatorio("bloco link: title", 80),
  url: urlExterna("bloco link: url"),
  icon: IconeSocialSchema.optional(),
  /** Linha de apoio abaixo do título (ex.: "Meu livro, na Amazon"). */
  subtitle: z.string().max(80, "bloco link: subtitle deve ter no máximo 80 caracteres.").optional(),
  /** Miniatura à esquerda (arquivo em public/). Com imagem, o link vira card. */
  image: caminhoLocal("bloco link: image").optional(),
}).strict();

const ItemLinkSchema = z
  .object({
    title: textoObrigatorio("bloco links: items[].title", 80),
    url: urlExterna("bloco links: items[].url"),
    subtitle: z.string().max(80, "bloco links: items[].subtitle deve ter no máximo 80 caracteres.").optional(),
    icon: IconeSocialSchema.optional(),
  })
  .strict();

/** Grupo de links num bloco só. Layout vem do modelo quando não definido. */
const LinksBlockSchema = z.object({
  type: z.literal("links"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco links"),
  id: slug("bloco links: id").optional(),
  title: z.string().max(60, "bloco links: title deve ter no máximo 60 caracteres.").optional(),
  layout: opcao("bloco links: layout", OPCOES.linksLayout).optional(),
  items: z
    .array(ItemLinkSchema)
    .min(1, "o bloco links precisa de ao menos 1 item.")
    .max(12, "o bloco links aceita no máximo 12 itens."),
}).strict();

const CardsBlockSchema = z.object({
  type: z.literal("cards"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco cards"),
  id: slug("bloco cards: id").optional(),
  eyebrow: z.string().max(60, "bloco cards: eyebrow deve ter no máximo 60 caracteres.").optional(),
  /** Vazio: o bloco não aparece na página (ex.: a última oferta foi apagada). */
  items: z.array(z.string().min(1, "bloco cards: items não aceita id vazio.")),
  /** Sem valor: vem do modelo. */
  layout: opcao("bloco cards: layout", OPCOES.cardsLayout).optional(),
}).strict();

const TextBlockSchema = z.object({
  type: z.literal("text"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco text"),
  id: slug("bloco text: id").optional(),
  title: z.string().max(80, "bloco text: title deve ter no máximo 80 caracteres.").optional(),
  body: textoObrigatorio("bloco text: body", 1000),
  /** rodape = texto centralizado e discreto, para o fim da página. */
  variant: z
    .enum(["padrao", "rodape"], { message: 'bloco text: variant deve ser "padrao" ou "rodape".' })
    .optional(),
}).strict();

const DividerBlockSchema = z.object({
  type: z.literal("divider"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco divider"),
}).strict();

const YoutubeBlockSchema = z.object({
  type: z.literal("youtube"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco youtube"),
  id: slug("bloco youtube: id").optional(),
  title: z.string().max(80, "bloco youtube: title deve ter no máximo 80 caracteres.").optional(),
  videoId: z
    .string()
    .regex(
      /^[A-Za-z0-9_-]{11}$/,
      "bloco youtube: videoId deve ser o id de 11 caracteres do vídeo (o que vem depois de watch?v=).",
    ),
  poster: caminhoLocal("bloco youtube: poster").optional(),
}).strict();

const GalleryBlockSchema = z.object({
  type: z.literal("gallery"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco gallery"),
  id: slug("bloco gallery: id").optional(),
  title: z.string().max(80, "bloco gallery: title deve ter no máximo 80 caracteres.").optional(),
  images: z
    .array(
      z.object({
        src: caminhoLocal("bloco gallery: images[].src"),
        alt: textoObrigatorio("bloco gallery: images[].alt", 120),
      }),
    )
    .min(1, "o bloco gallery precisa de ao menos 1 imagem."),
}).strict();

/**
 * Resposta do concierge. Com `offer`, a recomendação mostra a oferta. Sem `offer` (ex.: "Ainda não sei"),
 * o final vira um convite para conversar: `title`, `cta` e `wa` personalizam esse final (todos opcionais).
 * Quem decide o final é o `decide` do bloco: a resposta do PRIMEIRO passo ("primeira", padrão) ou a
 * última resposta com `offer` ou `reason` ("ultima"). Fora disso estes campos só viram contexto.
 */
const ConciergeOpcaoSchema = z.object({
  id: slug("concierge: opção id"),
  label: textoObrigatorio("concierge: opção label", 40),
  offer: z.string().min(1, "concierge: offer não pode ser vazio (apague o campo para a resposta ir direto à conversa).").optional(),
  /** Explicação mostrada no final. Obrigatória na 1ª pergunta; nas outras, só no modo "ultima" e em resposta com `offer`. */
  reason: textoObrigatorio("concierge: opção reason").optional(),
  title: z.string().min(1, "concierge: title não pode ser vazio.").max(60, "concierge: title deve ter no máximo 60 caracteres.").optional(),
  cta: z.string().min(1, "concierge: cta não pode ser vazio.").max(30, "concierge: cta deve ter no máximo 30 caracteres.").optional(),
  wa: z.string().min(1, "concierge: wa não pode ser vazio.").max(500, "concierge: wa deve ter no máximo 500 caracteres.").optional(),
});

const ConciergePassoSchema = z.object({
  id: slug("concierge: passo id"),
  question: textoObrigatorio("concierge: passo question", 200),
  options: z
    .array(ConciergeOpcaoSchema)
    .min(2, "concierge: cada passo precisa de ao menos 2 opções.")
    .max(4, "concierge: cada passo aceita no máximo 4 opções."),
});

/** Destino de um botão: mensagem de WhatsApp (número da config) ou URL https. */
function acao(campo: string) {
  return z.union(
    [z.object({ wa: textoObrigatorio(`${campo}.wa`, 500) }), z.object({ url: urlExterna(`${campo}.url`) })],
    { message: `${campo} precisa ser { wa } ou { url }.` },
  );
}

/** Aviso em destaque (ex.: nova turma). Botão opcional. */
const BannerBlockSchema = z
  .object({
    type: z.literal("banner"),
    /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
    enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
    visivel: campoVisivel("bloco banner"),
    id: slug("bloco banner: id").optional(),
    title: textoObrigatorio("bloco banner: title", 80),
    text: z.string().max(140, "bloco banner: text deve ter no máximo 140 caracteres.").optional(),
    label: z.string().min(1, "bloco banner: label não pode ser vazio.").max(30, "bloco banner: label deve ter no máximo 30 caracteres.").optional(),
    action: acao("bloco banner: action").optional(),
  })
  .strict()
  .refine((b) => !b.label || b.action, { message: "bloco banner: label exige action (para onde o botão leva)." })
  .refine((b) => !b.action || b.label, { message: "bloco banner: action exige label (o texto do botão)." });

/** Cupom de desconto. Sem JavaScript: o código é selecionado inteiro com um toque. */
const CouponBlockSchema = z
  .object({
    type: z.literal("coupon"),
    /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
    enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
    visivel: campoVisivel("bloco coupon"),
    id: slug("bloco coupon: id").optional(),
    code: z
      .string()
      .regex(
        /^[A-Z0-9_-]{2,30}$/,
        'bloco coupon: code deve ter de 2 a 30 caracteres, só letras maiúsculas, números, "-" ou "_" (ex.: "BEMVINDA10").',
      ),
    /** O que o cupom dá (ex.: "10% na primeira compra"). */
    label: textoObrigatorio("bloco coupon: label", 60),
    /** Último dia de validade. O check avisa quando vencer. */
    expires: dataValida("bloco coupon: expires").optional(),
    /** Texto do botão. Padrão: "Usar cupom". */
    /** true = mostra o botão "Copiar" ao lado do código (usa um pouco de JavaScript). Padrão: desligado. */
    copy: z.boolean({ message: "bloco coupon: copy deve ser true ou false." }).optional(),
    cta: z.string().min(1, "bloco coupon: cta não pode ser vazio.").max(30, "bloco coupon: cta deve ter no máximo 30 caracteres.").optional(),
    action: acao("bloco coupon: action").optional(),
  })
  .strict()
  .refine((b) => !b.cta || b.action, { message: "bloco coupon: cta exige action (para onde o botão leva)." });

/** Texto da caixinha LGPD quando a pessoa não escreve o dela. */
export const CONSENTIMENTO_PADRAO =
  "Ao enviar, você concorda que eu use este contato só para te enviar o material e avisos sobre ele. Sem spam.";

/**
 * Formulário de contato (material grátis, lista de espera). O nome é sempre pedido.
 * Ligar este bloco já liga a captura: não precisa mexer em features.leads.
 */
const LeadBlockSchema = z.object({
  type: z.literal("lead"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco lead"),
  id: slug("bloco lead: id").optional(),
  title: textoObrigatorio("bloco lead: title", 80),
  text: z.string().max(200, "bloco lead: text deve ter no máximo 200 caracteres.").optional(),
  label: textoObrigatorio("bloco lead: label", 40),
  pedir: z.enum(["whatsapp", "email", "ambos"], {
    message: 'bloco lead: pedir deve ser "whatsapp", "email" ou "ambos".',
  }),
  sucesso: textoObrigatorio("bloco lead: sucesso", 200),
  /** Link https mostrado depois do envio (o PDF, a página do material). */
  entrega: z.object({ url: urlExterna("bloco lead: entrega.url") }).strict().optional(),
  consentimento: z
    .string()
    .min(10, "bloco lead: consentimento deve ter ao menos 10 caracteres.")
    .max(240, "bloco lead: consentimento deve ter no máximo 240 caracteres.")
    .default(CONSENTIMENTO_PADRAO),
}).strict();

/** Hora HH:MM que existe no relógio (recusa 24:00 e 19:60). */
function horaValida(campo: string) {
  return z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${campo} deve ser HH:MM (ex.: "19:00").`);
}

/**
 * Pix: a página mostra o QR e o copia-e-cola gerados no servidor (lib/pix.ts).
 * Nome e cidade podem ter acento na bio; o código do banco sai sem acento.
 */
const PixBlockSchema = z
  .object({
    type: z.literal("pix"),
    /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
    enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
    visivel: campoVisivel("bloco pix"),
    id: slug("bloco pix: id").optional(),
    chave: z.string().min(1, "bloco pix: chave é obrigatória.").superRefine((v, ctx) => {
      const msg = mensagemDaChave(v);
      if (msg) ctx.addIssue({ code: "custom", message: msg });
    }),
    nome: z
      .string()
      .min(1, "bloco pix: nome é obrigatório.")
      .max(25, "bloco pix: nome deve ter no máximo 25 caracteres.")
      .refine((v) => semAcento(v).length >= 1, {
        message: "bloco pix: nome precisa ter ao menos uma letra ou número. O Pix não leva acento.",
      }),
    cidade: z
      .string()
      .min(1, "bloco pix: cidade é obrigatória.")
      .max(15, "bloco pix: cidade deve ter no máximo 15 caracteres.")
      .refine((v) => semAcento(v).length >= 1, {
        message: "bloco pix: cidade precisa ter ao menos uma letra ou número. O Pix não leva acento.",
      }),
    /** Centavos, como os outros preços. Vazio: quem paga escolhe o valor no banco. */
    valor_cents: z
      .number()
      .int("bloco pix: valor_cents deve ser um número inteiro (centavos).")
      .min(1, "bloco pix: valor_cents deve ser maior que zero. Deixe vazio para a pessoa escolher o valor.")
      .max(999999999999, "bloco pix: valor_cents passa do que o Pix aceita.")
      .optional(),
    /** Vira o txid do BR Code. Vazio: ***. */
    txid: z
      .string()
      .regex(
        /^(\*\*\*|[A-Za-z0-9]{1,25})$/,
        'bloco pix: txid deve ter de 1 a 25 letras ou números, sem espaço nem acento (ex.: "consulta"). Vazio: o banco usa ***.',
      )
      .optional(),
    /** true = mostra o botão "Copiar" (um pouco de JavaScript). Padrão: desligado. */
    copy: z.boolean({ message: "bloco pix: copy deve ser true ou false." }).optional(),
  })
  .strict();

const EventoAgendaSchema = z
  .object({
    id: slug("bloco agenda: items[].id"),
    title: textoObrigatorio("bloco agenda: items[].title", 80),
    date: dataValida("bloco agenda: items[].date"),
    time: horaValida("bloco agenda: items[].time").optional(),
    duration: z
      .number()
      .int("bloco agenda: items[].duration deve ser um número inteiro (minutos).")
      .min(1, "bloco agenda: items[].duration deve ser de pelo menos 1 minuto.")
      .max(1440, "bloco agenda: items[].duration deve ser de no máximo 1440 minutos (24 horas).")
      .optional(),
    place: z
      .string()
      .min(1, "bloco agenda: items[].place não pode ser vazio.")
      .max(200, "bloco agenda: items[].place deve ter no máximo 200 caracteres.")
      .refine((v) => !/^https?:\/\//i.test(v) || v.startsWith("https://"), {
        message: "bloco agenda: items[].place deve começar com https quando for um link.",
      })
      .optional(),
    description: z.string().max(280, "bloco agenda: items[].description deve ter no máximo 280 caracteres.").optional(),
  })
  .strict();

/**
 * Agenda: eventos futuros, com Google Agenda e arquivo .ics.
 * A página é estática: evento passado some na publicação ou na atualização de hora em hora.
 */
const AgendaBlockSchema = z
  .object({
    type: z.literal("agenda"),
    /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
    enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
    visivel: campoVisivel("bloco agenda"),
    id: slug("bloco agenda: id").optional(),
    title: z.string().max(60, "bloco agenda: title deve ter no máximo 60 caracteres.").optional(),
    /** Link de agendamento (Cal.com, Calendly). Botão, além dos eventos. */
    url: urlExterna("bloco agenda: url").optional(),
    items: z
      .array(EventoAgendaSchema)
      .min(1, "o bloco agenda precisa de ao menos 1 evento.")
      .max(20, "o bloco agenda aceita no máximo 20 eventos."),
  })
  .strict();


/** Depoimentos reais de clientes. Não use texto inventado na página publicada. */
const TestimonialsBlockSchema = z.object({
  type: z.literal("testimonials"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco testimonials"),
  id: slug("bloco testimonials: id").optional(),
  title: z.string().max(60, "bloco testimonials: title deve ter no máximo 60 caracteres.").optional(),
  items: z
    .array(
      z
        .object({
          quote: textoObrigatorio("bloco testimonials: items[].quote", 280),
          name: textoObrigatorio("bloco testimonials: items[].name", 60),
          role: z.string().max(60, "bloco testimonials: items[].role deve ter no máximo 60 caracteres.").optional(),
          avatar: caminhoLocal("bloco testimonials: items[].avatar").optional(),
        })
        .strict(),
    )
    .min(1, "o bloco testimonials precisa de ao menos 1 depoimento.")
    .max(10, "o bloco testimonials aceita no máximo 10 depoimentos."),
}).strict();

/** Perguntas frequentes: abre e fecha sem JavaScript (details/summary). */
const FaqBlockSchema = z.object({
  type: z.literal("faq"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco faq"),
  id: slug("bloco faq: id").optional(),
  title: z.string().max(60, "bloco faq: title deve ter no máximo 60 caracteres.").optional(),
  openFirst: z.boolean().optional(),
  items: z
    .array(
      z
        .object({
          q: textoObrigatorio("bloco faq: items[].q", 160),
          a: textoObrigatorio("bloco faq: items[].a", 1000),
        })
        .strict(),
    )
    .min(1, "o bloco faq precisa de ao menos 1 pergunta.")
    .max(12, "o bloco faq aceita no máximo 12 perguntas."),
}).strict();

const ConciergeBlockSchema = z.object({
  type: z.literal("concierge"),
  /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
  enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
  visivel: campoVisivel("bloco concierge"),
  id: slug("bloco concierge: id").optional(),
  title: z.string().max(80, "bloco concierge: title deve ter no máximo 80 caracteres.").optional(),
  intro: z.string().max(200, "bloco concierge: intro deve ter no máximo 200 caracteres.").optional(),
  /** "roteiro" = só as perguntas. "ia" = as mesmas perguntas como reserva, mais uma dúvida livre. */
  mode: z.enum(["roteiro", "ia"], {
    message: 'bloco concierge: mode deve ser "roteiro" ou "ia".',
  }),
  flow: z
    .array(ConciergePassoSchema)
    .min(1, "o bloco concierge precisa de ao menos 1 passo em flow."),
  /**
   * Quem decide o final. "primeira" (padrão): a resposta da 1ª pergunta. "ultima": a última resposta
   * com `offer` ou `reason`; sem nenhuma depois da 1ª, vale a 1ª (que sempre tem `reason`).
   */
  decide: opcao("bloco concierge: decide", OPCOES.conciergeDecide).optional(),
  /** destaque = card escuro; leve = card claro com borda. Sem valor: vem do modelo. */
  variant: opcao("bloco concierge: variant", OPCOES.concierge).optional(),
  /** true = começa recolhido (só o título, abre ao tocar). Padrão: aberto. */
  collapsed: z.boolean().optional(),
}).strict();

/** Vitrine de produtos do catálogo. Filtro por categoria só em CSS (até 6 categorias). */
const ProductsBlockSchema = z
  .object({
    type: z.literal("products"),
    /** false = bloco desligado: sai da página, mas o conteúdo fica guardado na config. */
    enabled: z.boolean({ message: "enabled deve ser true ou false." }).optional(),
    visivel: campoVisivel("bloco products"),
    id: slug("bloco products: id").optional(),
    title: z.string().max(60, "bloco products: title deve ter no máximo 60 caracteres.").optional(),
    /** Sem valor: vem do modelo. */
    layout: opcao("bloco products: layout", OPCOES.productsLayout).optional(),
    /** true = mostra os filtros por categoria (a partir de 2 categorias). */
    filter: z.boolean().optional(),
    /** Ids do catalog, na ordem. Sem valor: o catálogo inteiro. */
    items: z
      .array(z.string().min(1, "bloco products: items não aceita id vazio."))
      .min(1, "bloco products: items precisa de ao menos 1 produto (ou apague items para mostrar o catálogo inteiro).")
      .optional(),
  })
  .strict();

export const BlockSchema = z.discriminatedUnion(
  "type",
  [
    ProfileBlockSchema,
    SocialBlockSchema,
    CtaBlockSchema,
    LinkBlockSchema,
    LinksBlockSchema,
    CardsBlockSchema,
    TextBlockSchema,
    DividerBlockSchema,
    YoutubeBlockSchema,
    GalleryBlockSchema,
    ConciergeBlockSchema,
    BannerBlockSchema,
    TestimonialsBlockSchema,
    FaqBlockSchema,
    ProductsBlockSchema,
    CouponBlockSchema,
    LeadBlockSchema,
    PixBlockSchema,
    AgendaBlockSchema,
  ],
  { message: "bloco com type desconhecido. Tipos válidos: profile, social, cta, link, links, cards, text, divider, youtube, gallery, concierge, banner, testimonials, faq, products, coupon, lead, pix, agenda." },
);

// ---------------------------------------------------------------------------
// Features + config raiz
// ---------------------------------------------------------------------------

/** Vazio ou só espaço vira null (desligado). Texto preenchido precisa do formato. */
function idDePixel(re: RegExp, mensagem: string) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (typeof v !== "string") return null;
      const t = v.trim();
      return t === "" ? null : t;
    })
    .refine((v) => v === null || re.test(v), { message: mensagem });
}

export const FeaturesSchema = z.object({
  /**
   * Legado. A captura liga pelo bloco `lead` (basta ele estar na página).
   * Se este flag estiver true, o check ainda exige o banco — quem só adiciona o bloco não precisa mexer aqui.
   */
  leads: z.boolean().default(false),
  analytics: z.boolean().default(false),
  pixel: z
    .object({
      meta: idDePixel(RE_META, MSG_META).default(null),
      ga4: idDePixel(RE_GA4, MSG_GA4).default(null),
    })
    .default({ meta: null, ga4: null }),
});

/** Máximo de categorias no filtro da vitrine (o CSS tem regra para cada uma). */
export const MAX_CATEGORIAS = 6;

/** Categorias na ordem em que aparecem (sem repetir). Produto sem categoria fica só em "Todos". */
export function categoriasDe(produtos: { category?: string }[]): string[] {
  return [...new Set(produtos.map((p) => p.category).filter((c): c is string => Boolean(c)))];
}

function duplicados(ids: string[]): string[] {
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

export const ConfigSchema = z
  .object({
    site: SiteSchema,
    theme: ThemeSchema,
    profile: ProfileSchema,
    contact: ContactSchema,
    /** Ofertas dos cards e do concierge. Opcional: bio só de links também vale. */
    offers: z.array(OfferSchema).default([]),
    /** Produtos da vitrine (bloco products). Opcional. */
    catalog: z.array(ProdutoSchema).max(60, "catalog aceita no máximo 60 produtos.").default([]),
    blocks: z.array(BlockSchema).min(1, "defina ao menos 1 bloco em blocks."),
    features: FeaturesSchema.default({ leads: false, analytics: false, pixel: { meta: null, ga4: null } }),
  })
  .superRefine((cfg, ctx) => {
    // Modo ou paleta que o modelo não tem (sobra de troca de modelo) não é erro: o motor ignora
    // (lib/resolver.ts, modoAceito) e o check avisa (semEfeitoNoTema). Assim publicar nunca trava por isso.
    const idsBlocos = cfg.blocks.map((b) => ("id" in b ? b.id : undefined)).filter((id): id is string => Boolean(id));
    duplicados(idsBlocos).forEach((id) =>
      ctx.addIssue({ code: "custom", path: ["blocks"], message: `blocks tem o id "${id}" repetido. Cada bloco precisa de um id único.` }),
    );
    const idsEventos = cfg.blocks.flatMap((b) => (b.type === "agenda" ? b.items.map((ev) => ev.id) : []));
    duplicados(idsEventos).forEach((id) =>
      ctx.addIssue({
        code: "custom",
        path: ["blocks"],
        message: `agenda tem o id "${id}" repetido. Cada evento precisa de um id único (o arquivo .ics usa esse id).`,
      }),
    );
    const ids = new Set(cfg.offers.map((o) => o.id));
    duplicados(cfg.offers.map((o) => o.id)).forEach((id) =>
      ctx.addIssue({ code: "custom", path: ["offers"], message: `offers tem o id "${id}" repetido. Cada oferta precisa de um id único.` }),
    );
    const produtos = new Map(cfg.catalog.map((p) => [p.id, p]));
    duplicados(cfg.catalog.map((p) => p.id)).forEach((id) =>
      ctx.addIssue({ code: "custom", path: ["catalog"], message: `catalog tem o id "${id}" repetido. Cada produto precisa de um id único.` }),
    );
    cfg.blocks.forEach((b, i) => {
      if (b.type === "cards") {
        b.items.forEach((offerId) => {
          if (!ids.has(offerId)) {
            ctx.addIssue({
              code: "custom",
              path: ["blocks", i, "items"],
              message: `bloco cards referencia a oferta "${offerId}", que não existe em offers. Ids disponíveis: ${[...ids].join(", ") || "(nenhum)"}.`,
            });
          }
        });
      }
      if (b.type === "products") {
        if (cfg.catalog.length === 0) {
          ctx.addIssue({
            code: "custom",
            path: ["blocks", i],
            message: "bloco products precisa de produtos em catalog (na raiz da config).",
          });
        }
        (b.items ?? []).forEach((pid) => {
          if (!produtos.has(pid)) {
            ctx.addIssue({
              code: "custom",
              path: ["blocks", i, "items"],
              message: `bloco products referencia o produto "${pid}", que não existe em catalog. Ids disponíveis: ${[...produtos.keys()].join(", ") || "(nenhum)"}.`,
            });
          }
        });
        if (b.filter) {
          const lista = b.items ? b.items.map((pid) => produtos.get(pid)) : cfg.catalog;
          const cats = categoriasDe(lista.filter((p): p is Produto => p !== undefined));
          if (cats.length > MAX_CATEGORIAS) {
            ctx.addIssue({
              code: "custom",
              path: ["blocks", i, "filter"],
              message: `o filtro da vitrine aceita até ${MAX_CATEGORIAS} categorias; este bloco tem ${cats.length} (${cats.join(", ")}). Junte categorias ou divida em dois blocos products.`,
            });
          }
        }
      }
      if (b.type === "concierge") {
        b.flow[0]?.options.forEach((op, k) => {
          if (op.reason === undefined) {
            ctx.addIssue({
              code: "custom",
              path: ["blocks", i, "flow", 0, "options", k, "reason"],
              message: `concierge: a resposta "${op.label}" da 1ª pergunta precisa de reason (a explicação mostrada no final).`,
            });
          }
        });
        // Modo "ultima": resposta de outra pergunta que leva a uma oferta também decide o final, então
        // precisa da explicação. Sem oferta e sem explicação ela é só contexto (vale a resposta anterior).
        if (b.decide === "ultima") {
          b.flow.forEach((passo, j) => {
            if (j === 0) return;
            passo.options.forEach((op, k) => {
              if (op.offer !== undefined && op.reason === undefined) {
                ctx.addIssue({
                  code: "custom",
                  path: ["blocks", i, "flow", j, "options", k, "reason"],
                  message: `concierge: a resposta "${op.label}" da ${j + 1}ª pergunta leva para uma oferta e precisa de reason (a explicação mostrada no final).`,
                });
              }
            });
          });
        }
        b.flow.forEach((passo, j) => {
          passo.options.forEach((op) => {
            if (op.offer !== undefined && !ids.has(op.offer)) {
              ctx.addIssue({
                code: "custom",
                path: ["blocks", i, "flow", j, "options"],
                message: `concierge (passo "${passo.id}") referencia a oferta "${op.offer}", que não existe em offers. Ids disponíveis: ${[...ids].join(", ") || "(nenhum)"}.`,
              });
            }
          });
        });
      }
    });
  });

export type LinkbioConfig = z.infer<typeof ConfigSchema>;
export type Produto = z.infer<typeof ProdutoSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Offer = z.infer<typeof OfferSchema>;

// ---------------------------------------------------------------------------
// defineConfig: valida na importação; erro quebra o build em PT-BR
// ---------------------------------------------------------------------------

function formataErro(campo: (string | number | symbol)[], mensagem: string): string {
  const caminho = campo.length > 0 ? String(campo.map(String).join(".")) : "(raiz)";
  return `  - ${caminho}: ${mensagem}`;
}

export function defineConfig(input: z.input<typeof ConfigSchema>): LinkbioConfig {
  const parsed = ConfigSchema.safeParse(input);
  if (!parsed.success) {
    const linhas = parsed.error.issues.map((issue) =>
      formataErro(issue.path, issue.message),
    );
    throw new Error(
      `Erro na linkbio.config.ts — corrija os campos abaixo:\n${linhas.join("\n")}`,
    );
  }
  return parsed.data;
}
