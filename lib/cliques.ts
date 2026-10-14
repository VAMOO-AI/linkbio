/**
 * Contagem de cliques da bio, sem cookie e sem ferramenta de fora.
 *
 * A página publicada continua estática (revalidateTag). O `?src=` fica na URL da bio;
 * o atalho `/r/` lê essa origem no Referer (navegação no mesmo site manda a URL inteira)
 * ou num `?src=` do próprio atalho. Assim o HTML não precisa saber de onde a pessoa veio.
 *
 * Bloco sem `id`: a chave é `tipo-N` (N = posição entre os blocos daquele tipo, contando
 * os desligados). Mudar a ordem muda a chave e o histórico daquele botão recomeça.
 * Com `id`, a chave não muda.
 */

export function hrefDoClique(alvo: string | null | undefined, direto: string): string {
  return alvo ? `/r/${alvo}` : direto;
}

/** Botão final do concierge: as respostas vão no `r` (ids da config, não um endereço livre). */
export function hrefConcierge(chave: string, opcoes: readonly string[]): string {
  return `/r/concierge.${chave}?r=${opcoes.join(".")}`;
}

export function alvoCta(chave: string): string {
  return `cta.${chave}`;
}
export function alvoBanner(chave: string): string {
  return `banner.${chave}`;
}
export function alvoLink(chave: string): string {
  return `link.${chave}`;
}
export function alvoItemLinks(chave: string, indice: number): string {
  return `links.${chave}.${indice}`;
}
export function alvoCupom(chave: string): string {
  return `cupom.${chave}`;
}
export function alvoPerfil(indice: number): string {
  return `perfil.${indice}`;
}
export function alvoRede(chave: string, indice: number): string {
  return `rede.${chave}.${indice}`;
}
export function alvoOfertaUrl(id: string): string {
  return `oferta.${id}.url`;
}
export function alvoOfertaMais(id: string): string {
  return `oferta.${id}.mais`;
}
export function alvoOfertaWa(id: string): string {
  return `oferta.${id}.wa`;
}
export function alvoProduto(id: string): string {
  return `produto.${id}`;
}
export function alvoConciergeMais(chave: string, offerId: string): string {
  return `concierge.${chave}.mais.${offerId}`;
}

export function chavesDosBlocos(blocks: readonly { type: string; id?: string }[]): string[] {
  const n: Record<string, number> = {};
  return blocks.map((b) => {
    const i = n[b.type] ?? 0;
    n[b.type] = i + 1;
    return b.id ? b.id : `${b.type}-${i}`;
  });
}

/** `bio`, `stories`, `reels` e qualquer origem curta. O resto vira "direto". */
export function normalizarOrigem(bruto: string | null | undefined): string {
  const s = (bruto ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{1,20}$/.test(s) ? s : "direto";
}

/** Origem do clique: `?src=` do atalho, senão o `?src=` da página de onde a pessoa veio. */
export function origemDoPedido(url: string, referer: string | null): string {
  let daUrl: string | null = null;
  try {
    daUrl = new URL(url).searchParams.get("src");
  } catch {
    daUrl = null;
  }
  if (daUrl) return normalizarOrigem(daUrl);
  if (!referer) return "direto";
  try {
    return normalizarOrigem(new URL(referer).searchParams.get("src"));
  } catch {
    return "direto";
  }
}

/**
 * Preview do WhatsApp/Facebook e crawler não contam. O navegador do WhatsApp (a pessoa
 * tocou de verdade) traz "Mozilla" junto: esse conta.
 */
export function ehRobo(
  ua: string | null,
  extras?: { purpose?: string | null; secPurpose?: string | null; xPurpose?: string | null; xMoz?: string | null },
): boolean {
  const marcas = [extras?.purpose, extras?.secPurpose, extras?.xPurpose, extras?.xMoz].filter(Boolean).join(" ").toLowerCase();
  if (/\bprefetch\b|\bpreview\b/.test(marcas)) return true;
  const u = (ua ?? "").toLowerCase();
  if (!u) return false;
  if (/whatsapp\/\d/.test(u) && !u.includes("mozilla")) return true;
  return (
    /facebookexternalhit|facebot|embedly|slackbot|discordbot|telegrambot|twitterbot|linkedinbot|pinterestbot|googlebot|bingbot|applebot|baiduspider|yandexbot|duckduckbot|semrushbot|ahrefsbot|petalbot|bytespider|gptbot|claudebot|amazonbot|crawler|spider|slurp/.test(
      u,
    ) || /bot\b/.test(u)
  );
}

/** Dia AAAA-MM-DD no fuso da bio. Data inválida de fuso cai no de São Paulo. */
export function diaNoFuso(tz: string, agora = new Date()): string {
  const fmt = (zona: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  try {
    return fmt(tz);
  } catch {
    return fmt("America/Sao_Paulo");
  }
}

export function diaMenos(hoje: string, dias: number): string {
  const [a, m, d] = hoje.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(a, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dias);
  return dt.toISOString().slice(0, 10);
}

const ROTULO_ORIGEM: Record<string, string> = {
  bio: "Bio",
  stories: "Stories",
  reels: "Reels",
  direto: "Direto",
};

export function rotuloOrigem(origem: string): string {
  return ROTULO_ORIGEM[origem] ?? origem;
}

export type LinhaClique = { dia: string; alvo: string; origem: string; total: number };
export type TotalBotao = { nome: string; dias7: number; dias30: number };
export type TotalOrigem = { origem: string; rotulo: string; dias7: number; dias30: number };

/** Soma os últimos 7 e 30 dias (incluindo hoje). Linha fora da janela fica de fora. */
export function resumirCliques(linhas: readonly LinhaClique[], nomes: ReadonlyMap<string, string>, hoje: string): {
  botoes: TotalBotao[];
  origens: TotalOrigem[];
} {
  const desde7 = diaMenos(hoje, 6);
  const desde30 = diaMenos(hoje, 29);
  const botoes = new Map<string, TotalBotao>();
  const origens = new Map<string, TotalOrigem>();
  for (const l of linhas) {
    if (l.dia < desde30 || l.dia > hoje) continue;
    const no7 = l.dia >= desde7;
    const nome = nomes.get(l.alvo) ?? "Botão que saiu da bio";
    const b = botoes.get(l.alvo) ?? { nome, dias7: 0, dias30: 0 };
    b.dias30 += l.total;
    if (no7) b.dias7 += l.total;
    botoes.set(l.alvo, b);
    const o = origens.get(l.origem) ?? { origem: l.origem, rotulo: rotuloOrigem(l.origem), dias7: 0, dias30: 0 };
    o.dias30 += l.total;
    if (no7) o.dias7 += l.total;
    origens.set(l.origem, o);
  }
  const porTotal = (a: { dias30: number }, b: { dias30: number }) => b.dias30 - a.dias30 || 0;
  return { botoes: [...botoes.values()].sort(porTotal), origens: [...origens.values()].sort(porTotal) };
}

export function linksDeOrigem(siteUrl: string): { rotulo: string; url: string }[] {
  const base = siteUrl.replace(/\/$/, "");
  return [
    { rotulo: "Bio", url: `${base}/?src=bio` },
    { rotulo: "Stories", url: `${base}/?src=stories` },
    { rotulo: "Reels", url: `${base}/?src=reels` },
  ];
}
