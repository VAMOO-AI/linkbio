import type { LinkbioConfig } from "@/config/schema";
import { BLOCOS, resumoDoBloco } from "./admin/rotulos";
import { blocosAtivos } from "./blocos";
import { chavesDosBlocos, diaMenos, normalizarOrigem, rotuloOrigem, type LinhaClique, type LinhaVisita, type TotalBotao } from "./cliques";
import type { CalorDaPrevia } from "./previa";

/**
 * Até onde as pessoas rolam, onde tocam sem ter link e quem sai em menos de 3 segundos.
 * Mesma regra dos cliques: só o total por dia, sem IP, sem navegador, sem cookie. O script do
 * <head> (lib/origem.ts) marca na sessão do navegador o que já mandou, então cada visita conta
 * uma vez por seção. A chave da seção é a mesma da contagem de cliques (chavesDosBlocos).
 */

export const TIPOS_ENGAJAMENTO = ["secao", "toque_sem_link", "saida_rapida"] as const;
export type TipoEngajamento = (typeof TIPOS_ENGAJAMENTO)[number];

export type EnvioEngajamento = { origem: string; secoes: string[]; toques: string[]; rapida: boolean };

/** Corpo do POST, já limpo: só chave que existe na bio, sem repetir, no máximo uma por bloco. */
export function lerEnvioEngajamento(bruto: unknown, chaves: readonly string[]): EnvioEngajamento {
  const corpo = bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : {};
  const validas = new Set(chaves);
  const lista = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    const vistas = new Set<string>();
    for (const item of v.slice(0, 200)) {
      if (typeof item === "string" && validas.has(item)) vistas.add(item);
    }
    return [...vistas].slice(0, chaves.length);
  };
  return {
    origem: normalizarOrigem(typeof corpo.origem === "string" ? corpo.origem : null),
    secoes: lista(corpo.secoes),
    toques: lista(corpo.toques),
    rapida: corpo.rapida === true,
  };
}

/** Blocos que estão na bio agora, na ordem da página, com o nome que a pessoa reconhece. */
export function nomesDasSecoes(config: LinkbioConfig, agora: Date = new Date()): { chave: string; nome: string }[] {
  const chaves = chavesDosBlocos(config.blocks);
  // Divisor é só uma linha: não é parte que alguém procura.
  return blocosAtivos(config.blocks, agora, config.site.tz).filter((b) => b.type !== "divider").map((b) => {
    const tipo = BLOCOS[b.type]?.nome ?? b.type;
    const resumo = resumoDoBloco(b as unknown as Record<string, unknown>);
    return { chave: chaves[config.blocks.indexOf(b)]!, nome: resumo ? `${tipo}: ${resumo}` : tipo };
  });
}

export type LinhaEngajamento = { dia: string; tipo: TipoEngajamento; chave: string; origem: string; total: number };
export type SecaoRolagem = { chave: string; nome: string; vistas30: number; pct: number | null; toques30: number; cliques30: number };
export type SaidaOrigem = { origem: string; rotulo: string; saidas30: number; visitas30: number; pct: number | null };
export type Alerta = {
  tipo: "campeao" | "toque_sem_link" | "queda" | "saida_rapida";
  nivel: "bom" | "atencao" | "ruim";
  titulo: string;
  texto: string;
  numero?: number;
};
export type ResumoEngajamento = {
  visitas30: number;
  secoes: SecaoRolagem[];
  saidas: SaidaOrigem[];
  alertas: Alerta[];
  poucasVisitas: boolean;
};

/** Abaixo disso, qualquer alerta seria palpite. */
export const MIN_VISITAS_ALERTA = 30;

const pctDe = (parte: number, todo: number): number | null => (todo > 0 ? Math.min(100, Math.round((parte / todo) * 100)) : null);

/** Últimos 30 dias (incluindo hoje), como os cliques. */
export function resumirEngajamento(
  linhas: readonly LinhaEngajamento[],
  visitas: readonly LinhaVisita[],
  secoesAtuais: readonly { chave: string; nome: string }[],
  botoes: readonly TotalBotao[],
  hoje: string,
  cliquesPorChave: ReadonlyMap<string, number> = new Map(),
): ResumoEngajamento {
  const desde = diaMenos(hoje, 29);
  const dentro = (dia: string) => dia >= desde && dia <= hoje;

  // Visita de antes da rolagem existir (bio que já contava e acabou de atualizar) não tinha como virar
  // seção vista: dividir por ela derruba todo %. Conta só do primeiro dia com rolagem medida em diante.
  // atalho: o primeiro dia inclui as visitas de antes do deploy naquele dia; some sozinho no dia seguinte.
  const inicio = linhas.reduce<string | null>((m, l) => (dentro(l.dia) && (m === null || l.dia < m) ? l.dia : m), null);

  let visitas30 = 0;
  const visitasPorOrigem = new Map<string, number>();
  for (const v of visitas) {
    if (!dentro(v.dia) || inicio === null || v.dia < inicio) continue;
    visitas30 += v.total;
    visitasPorOrigem.set(v.origem, (visitasPorOrigem.get(v.origem) ?? 0) + v.total);
  }

  const vistas = new Map<string, number>();
  const toques = new Map<string, number>();
  const saidasPorOrigem = new Map<string, number>();
  for (const l of linhas) {
    if (!dentro(l.dia)) continue;
    if (l.tipo === "secao") vistas.set(l.chave, (vistas.get(l.chave) ?? 0) + l.total);
    else if (l.tipo === "toque_sem_link") toques.set(l.chave, (toques.get(l.chave) ?? 0) + l.total);
    else if (l.tipo === "saida_rapida") saidasPorOrigem.set(l.origem, (saidasPorOrigem.get(l.origem) ?? 0) + l.total);
  }

  const secoes: SecaoRolagem[] = secoesAtuais.map((s) => {
    const v = vistas.get(s.chave) ?? 0;
    return {
      chave: s.chave,
      nome: s.nome,
      vistas30: v,
      pct: pctDe(v, visitas30),
      toques30: toques.get(s.chave) ?? 0,
      cliques30: cliquesPorChave.get(s.chave) ?? 0,
    };
  });

  const saidas: SaidaOrigem[] = [...saidasPorOrigem.entries()]
    .map(([origem, saidas30]) => {
      const v = visitasPorOrigem.get(origem) ?? 0;
      return { origem, rotulo: rotuloOrigem(origem), saidas30, visitas30: v, pct: pctDe(saidas30, v) };
    })
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.saidas30 - a.saidas30);

  const poucasVisitas = visitas30 < MIN_VISITAS_ALERTA;
  const alertas = poucasVisitas ? [] : alertasDe({ visitas30, secoes, saidas, botoes });
  return { visitas30, secoes, saidas, alertas, poucasVisitas };
}

function alertasDe({
  visitas30,
  secoes,
  saidas,
  botoes,
}: {
  visitas30: number;
  secoes: SecaoRolagem[];
  saidas: SaidaOrigem[];
  botoes: readonly TotalBotao[];
}): Alerta[] {
  const alertas: Alerta[] = [];

  const somaToques = botoes.reduce((s, b) => s + b.dias30, 0);
  const campeao = [...botoes].sort((a, b) => b.dias30 - a.dias30)[0];
  if (campeao && campeao.dias30 >= 10) {
    alertas.push({
      tipo: "campeao",
      nivel: "bom",
      titulo: `«${campeao.nome}» é o botão mais tocado`,
      texto: `${pctDe(campeao.dias30, somaToques)}% dos toques dos últimos 30 dias. Se ele não estiver no começo da página, vale subir.`,
      numero: campeao.dias30,
    });
  }

  const perdido = [...secoes].sort((a, b) => b.toques30 - a.toques30)[0];
  if (perdido && perdido.toques30 >= 5 && perdido.toques30 / visitas30 >= 0.03) {
    alertas.push({
      tipo: "toque_sem_link",
      nivel: "atencao",
      titulo: `Tocam em «${perdido.nome}» esperando abrir algo`,
      texto: "Visitas que tocaram numa parte dessa seção que não é link. Vale transformar a foto ou o texto em botão.",
      numero: perdido.toques30,
    });
  }

  // Seção com 0 fica de fora: pode estar escondida para aquela origem, e não é queda de verdade.
  const vistas = secoes.filter((s) => s.vistas30 > 0 && s.pct !== null);
  let queda: { de: SecaoRolagem; para: SecaoRolagem; pontos: number } | null = null;
  for (let i = 1; i < vistas.length; i++) {
    const de = vistas[i - 1]!;
    const para = vistas[i]!;
    const pontos = de.pct! - para.pct!;
    if (de.pct! >= 20 && pontos >= 25 && (!queda || pontos > queda.pontos)) queda = { de, para, pontos };
  }
  if (queda) {
    alertas.push({
      tipo: "queda",
      nivel: "atencao",
      titulo: `Muita gente para antes de «${queda.para.nome}»`,
      texto: `${queda.de.pct}% chegam em «${queda.de.nome}», só ${queda.para.pct}% chegam em «${queda.para.nome}». O que vem depois daí quase ninguém vê: suba o que mais importa.`,
    });
  }

  const rapida = saidas.find((s) => s.visitas30 >= 20 && (s.pct ?? 0) >= 30);
  if (rapida) {
    alertas.push({
      tipo: "saida_rapida",
      nivel: "ruim",
      titulo: `Quem vem de ${rapida.rotulo} sai rápido`,
      texto: `${rapida.pct}% saem em menos de 3 segundos (estimativa). Confira se o topo da bio mostra o que você prometeu lá.`,
      numero: rapida.saidas30,
    });
  }

  return alertas;
}

type BlocoDoMapa = { type: string; id?: string; items?: readonly unknown[] };

// Botões que levam a chave do bloco logo depois do tipo (lib/cliques.ts: alvoCta, alvoItemLinks...).
const COM_CHAVE = new Set(["cta", "banner", "link", "links", "cupom", "contagem", "rede", "concierge"]);

/**
 * De qual seção da bio veio um clique. Oferta e produto não carregam o bloco: caem no primeiro que
 * mostra aquele card (a mesma conta do CardsBlock e do ProductsBlock); rede do perfil cai no perfil.
 */
export function secaoDoClique(alvo: string, blocks: readonly BlocoDoMapa[]): string | null {
  const chaves = chavesDosBlocos(blocks);
  const [tipo, segundo] = alvo.split(".");
  if (!tipo || !segundo) return null;
  if (COM_CHAVE.has(tipo)) return chaves.includes(segundo) ? segundo : null;
  const achar = (ok: (b: BlocoDoMapa) => boolean) => {
    const i = blocks.findIndex(ok);
    return i < 0 ? null : chaves[i]!;
  };
  if (tipo === "oferta") return achar((b) => b.type === "cards" && !!b.items?.includes(segundo));
  if (tipo === "produto") return achar((b) => b.type === "products" && (!b.items || b.items.includes(segundo)));
  if (tipo === "perfil") return achar((b) => b.type === "profile");
  return null;
}

/** Cliques dos últimos 30 dias somados por seção. Alvo que não cai em nenhum bloco fica de fora. */
export function cliquesPorSecao(linhas: readonly LinhaClique[], blocks: readonly BlocoDoMapa[], hoje: string): Map<string, number> {
  const desde = diaMenos(hoje, 29);
  const soma = new Map<string, number>();
  for (const l of linhas) {
    if (l.dia < desde || l.dia > hoje) continue;
    const chave = secaoDoClique(l.alvo, blocks);
    if (chave) soma.set(chave, (soma.get(chave) ?? 0) + l.total);
  }
  return soma;
}

/** A partir de quanto % das visitas chegando a seção fica quente ou morna no mapa. */
export const CALOR_QUENTE = 60;
export const CALOR_MORNO = 30;

/**
 * Mapa de calor da prévia: cada seção com dado, ligada ao índice do bloco em `blocks` (o rascunho
 * que a prévia desenha, contando os desligados). Bloco novo, ainda sem visita, fica sem cor.
 */
export function mapaDeCalor(blocks: readonly BlocoDoMapa[], secoes: readonly SecaoRolagem[]): CalorDaPrevia[] {
  const chaves = chavesDosBlocos(blocks);
  const mapa: CalorDaPrevia[] = [];
  for (const s of secoes) {
    const indice = chaves.indexOf(s.chave);
    if (indice < 0 || s.pct === null) continue;
    const nivel = s.pct >= CALOR_QUENTE ? "quente" : s.pct >= CALOR_MORNO ? "morno" : "frio";
    mapa.push({ indice, pct: s.pct, cliques: s.cliques30, toques: s.toques30, nivel });
  }
  return mapa.sort((a, b) => a.indice - b.indice);
}
