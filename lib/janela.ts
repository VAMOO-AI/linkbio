/**
 * Janela de exibição de um bloco (`visivel.de` / `visivel.ate`), no fuso `site.tz`.
 * Sem hora, `de` começa à meia-noite e `ate` inclui o dia inteiro (até 23:59).
 * Com hora, o minuto marcado entra. A comparação é do relógio local, não de UTC.
 */

export const FUSO_PADRAO = "America/Sao_Paulo";

export type Janela = { de?: string; ate?: string };

const RE_INSTANTE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

type Partes = { y: number; m: number; d: number; hh: number; mm: number; temHora: boolean };

export function partesDoInstante(v: string): Partes | null {
  const m = RE_INSTANTE.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mes = Number(m[2]);
  const d = Number(m[3]);
  const temHora = m[4] !== undefined;
  const hh = temHora ? Number(m[4]) : 0;
  const mm = temHora ? Number(m[5]) : 0;
  if (!dataExiste(y, mes, d) || (temHora && (hh > 23 || mm > 59))) return null;
  return { y, m: mes, d, hh, mm, temHora };
}

function dataExiste(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** YYYYMMDDHHmm: ordem de relógio, independente do fuso (os dois lados estão no mesmo). */
function marco(y: number, m: number, d: number, hh: number, mm: number): number {
  return (((y * 100 + m) * 100 + d) * 100 + hh) * 100 + mm;
}

export function marcoInicio(v: string): number | null {
  const p = partesDoInstante(v);
  if (!p) return null;
  return marco(p.y, p.m, p.d, p.temHora ? p.hh : 0, p.temHora ? p.mm : 0);
}

export function marcoFim(v: string): number | null {
  const p = partesDoInstante(v);
  if (!p) return null;
  return marco(p.y, p.m, p.d, p.temHora ? p.hh : 23, p.temHora ? p.mm : 59);
}

/** `de` não pode começar depois do fim de `ate` (o dia de `ate` sem hora vai até 23:59). */
export function janelaCoerente(v: Janela | undefined): boolean {
  if (!v?.de || !v.ate) return true;
  const ini = marcoInicio(v.de);
  const fim = marcoFim(v.ate);
  if (ini === null || fim === null) return false;
  return ini <= fim;
}

export function partesNoFuso(agora: Date, tz: string): { y: number; m: number; d: number; hh: number; mm: number } {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    if (tz === FUSO_PADRAO) throw new Error("fuso padrão inválido");
    return partesNoFuso(agora, FUSO_PADRAO);
  }
  const map = Object.fromEntries(fmt.formatToParts(agora).map((p) => [p.type, p.value]));
  const hh = Number(map.hour);
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    hh: hh === 24 ? 0 : hh,
    mm: Number(map.minute),
  };
}

export type Situacao = "dentro" | "antes" | "depois";

export function situacaoDaJanela(visivel: Janela | undefined, agora: Date, tz = FUSO_PADRAO): Situacao {
  if (!visivel?.de && !visivel?.ate) return "dentro";
  const local = partesNoFuso(agora, tz);
  const agoraMarco = marco(local.y, local.m, local.d, local.hh, local.mm);
  if (visivel.de) {
    const ini = marcoInicio(visivel.de);
    if (ini !== null && agoraMarco < ini) return "antes";
  }
  if (visivel.ate) {
    const fim = marcoFim(visivel.ate);
    if (fim !== null && agoraMarco > fim) return "depois";
  }
  return "dentro";
}

export function dentroDaJanela(visivel: Janela | undefined, agora: Date, tz = FUSO_PADRAO): boolean {
  return situacaoDaJanela(visivel, agora, tz) === "dentro";
}

export function diaMes(v: string): string {
  const p = partesDoInstante(v);
  if (!p) return v;
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}`;
}

export function seloDaJanela(visivel: Janela | undefined, agora: Date, tz = FUSO_PADRAO): string | null {
  const s = situacaoDaJanela(visivel, agora, tz);
  if (s === "antes" && visivel?.de) return `Fora do ar até ${diaMes(visivel.de)}`;
  if (s === "depois" && visivel?.ate) return `Saiu do ar em ${diaMes(visivel.ate)}`;
  return null;
}

export function resumoDaJanela(visivel: Janela | undefined, agora: Date, tz = FUSO_PADRAO): "Programado" | "Expirado" | "" {
  const s = situacaoDaJanela(visivel, agora, tz);
  if (s === "antes") return "Programado";
  if (s === "depois") return "Expirado";
  return "";
}

/** Instante UTC em que o relógio de `tz` marca essa data e hora. */
function utcDoRelogio(y: number, m: number, d: number, hh: number, mm: number, tz: string): number {
  const alvo = Date.UTC(y, m - 1, d, hh, mm);
  let utc = alvo;
  for (let i = 0; i < 3; i++) {
    const local = partesNoFuso(new Date(utc), tz);
    const comoUtc = Date.UTC(local.y, local.m - 1, local.d, local.hh, local.mm);
    const ajuste = alvo - comoUtc;
    if (ajuste === 0) break;
    utc += ajuste;
  }
  return utc;
}

function somarMinuto(y: number, m: number, d: number, hh: number, mm: number) {
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm + 1));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), hh: dt.getUTCHours(), mm: dt.getUTCMinutes() };
}

function diaSeguinte(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Momento em que a fronteira passa: `de` abre, `ate` fecha (o minuto ou o dia marcado ainda conta). */
function fronteiraUtc(v: string, lado: "de" | "ate", tz: string): number | null {
  const p = partesDoInstante(v);
  if (!p) return null;
  if (lado === "de") return utcDoRelogio(p.y, p.m, p.d, p.temHora ? p.hh : 0, p.temHora ? p.mm : 0, tz);
  if (p.temHora) {
    const n = somarMinuto(p.y, p.m, p.d, p.hh, p.mm);
    return utcDoRelogio(n.y, n.m, n.d, n.hh, n.mm, tz);
  }
  const n = diaSeguinte(p.y, p.m, p.d);
  return utcDoRelogio(n.y, n.m, n.d, 0, 0, tz);
}

const MIN_SEG = 60;
const MAX_SEG = 60 * 60 * 24 * 365;

/**
 * Segundos até a próxima abertura ou fechamento. `null` se não há fronteira pela frente
 * (a página pode continuar estática). Entre 1 minuto e 1 ano.
 */
export function segundosAteProximaFronteira(
  blocks: readonly { visivel?: Janela }[],
  agora: Date,
  tz = FUSO_PADRAO,
): number | null {
  const agoraMs = agora.getTime();
  let menor: number | null = null;
  for (const b of blocks) {
    if (!b.visivel) continue;
    for (const lado of ["de", "ate"] as const) {
      const valor = b.visivel[lado];
      if (!valor) continue;
      const ms = fronteiraUtc(valor, lado, tz);
      if (ms === null || ms <= agoraMs) continue;
      const seg = Math.ceil((ms - agoraMs) / 1000);
      if (menor === null || seg < menor) menor = seg;
    }
  }
  if (menor === null) return null;
  return Math.min(MAX_SEG, Math.max(MIN_SEG, menor));
}
