/**
 * Motor de horários livres do bloco agendamento. Puro, sem rede: a rota junta o ocupado do Google
 * e as reservas do banco e chama estas funções. Vale para qualquer fuso (site.tz).
 */

export type Faixa = { inicio: number; fim: number };

/** Regra da agenda já em números (minutos e dias da semana, 0 = domingo). */
export type Regra = {
  tz: string;
  dias: number[];
  /** Expediente em minutos desde a meia-noite. */
  inicio: number;
  fim: number;
  /** Faixas fechadas todo dia (almoço). Não ganham intervalo em volta. */
  pausas: Faixa[];
  antecedenciaMin: number;
  janelaDias: number;
  /** Respiro antes e depois de compromisso ocupado. */
  intervaloMin: number;
  /** De quantos em quantos minutos os horários começam. */
  passoMin: number;
  maxPorDia: number | null;
};

export type Ocupado = { inicioMs: number; fimMs: number };

export type Horario = {
  /** ISO UTC */
  inicio: string;
  fim: string;
  /** AAAA-MM-DD no fuso da agenda */
  dia: string;
  /** HH:MM no fuso da agenda */
  hora: string;
};

const DIA_MS = 24 * 60 * 60 * 1000;
const SEMANA: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
export type DiaDaSemana = (typeof DIAS_DA_SEMANA)[number];

function dois(n: number): string {
  return String(n).padStart(2, "0");
}

export function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

export function hhmm(minutos: number): string {
  return `${dois(Math.floor(minutos / 60))}:${dois(minutos % 60)}`;
}

/** Ano, mês, dia, hora, minuto e dia da semana de um instante, no fuso. */
export function partesNoFuso(ms: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, x.value]),
  );
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour) % 24,
    minuto: Number(p.minute),
    semana: SEMANA[p.weekday as string] ?? 0,
  };
}

export function chaveDoDia(ms: number, tz: string): string {
  const p = partesNoFuso(ms, tz);
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`;
}

/**
 * Hora de parede no fuso (data + minutos) → instante UTC. Descobre o deslocamento pelo Intl,
 * então vale em fuso com horário de verão.
 */
export function paredeParaUtc(ano: number, mes: number, dia: number, minutos: number, tz: string): number {
  const desejado = Date.UTC(ano, mes - 1, dia, Math.floor(minutos / 60), minutos % 60);
  let palpite = desejado;
  for (let i = 0; i < 3; i++) {
    const p = partesNoFuso(palpite, tz);
    const mostrado = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
    const delta = desejado - mostrado;
    if (delta === 0) break;
    palpite += delta;
  }
  return palpite;
}

function cruza(aIni: number, aFim: number, bIni: number, bFim: number): boolean {
  return aIni < bFim && bIni < aFim;
}

/**
 * Horários livres de agora até a janela, para um serviço de `duracaoMin`.
 * Tira: dia fora da regra, pausa, antecedência, dia que bateu o teto e o ocupado (com o intervalo).
 */
export function calcularHorarios(opts: {
  regra: Regra;
  duracaoMin: number;
  ocupado: Ocupado[];
  /** Reservas já confirmadas por dia (AAAA-MM-DD), para o teto diário. */
  porDia?: Record<string, number>;
  agora: number;
  /** Começa a procurar daqui (padrão: agora). */
  deMs?: number;
  /** Quantos dias olhar a partir de `deMs` (padrão: a janela da regra). */
  dias?: number;
}): Horario[] {
  const { regra, duracaoMin } = opts;
  if (!Number.isFinite(duracaoMin) || duracaoMin <= 0) return [];
  const minimo = opts.agora + regra.antecedenciaMin * 60_000;
  const limite = opts.agora + (regra.janelaDias + 1) * DIA_MS;
  const de = Math.max(opts.deMs ?? opts.agora, minimo);
  const ocupado = opts.ocupado.map((o) => ({
    inicioMs: o.inicioMs - regra.intervaloMin * 60_000,
    fimMs: o.fimMs + regra.intervaloMin * 60_000,
  }));
  const hoje = partesNoFuso(de, regra.tz);
  const meioDia = paredeParaUtc(hoje.ano, hoje.mes, hoje.dia, 12 * 60, regra.tz);
  const total = opts.dias ?? regra.janelaDias;
  const saida: Horario[] = [];

  for (let n = 0; n <= total; n++) {
    const d = partesNoFuso(meioDia + n * DIA_MS, regra.tz);
    if (!regra.dias.includes(d.semana)) continue;
    const dia = `${d.ano}-${dois(d.mes)}-${dois(d.dia)}`;
    if (regra.maxPorDia !== null && (opts.porDia?.[dia] ?? 0) >= regra.maxPorDia) continue;
    const pausas = regra.pausas.map((p) => ({
      inicioMs: paredeParaUtc(d.ano, d.mes, d.dia, p.inicio, regra.tz),
      fimMs: paredeParaUtc(d.ano, d.mes, d.dia, p.fim, regra.tz),
    }));
    for (let m = regra.inicio; m + duracaoMin <= regra.fim; m += regra.passoMin) {
      const ini = paredeParaUtc(d.ano, d.mes, d.dia, m, regra.tz);
      const fim = ini + duracaoMin * 60_000;
      if (ini < de || ini > limite) continue;
      if (pausas.some((p) => cruza(ini, fim, p.inicioMs, p.fimMs))) continue;
      if (ocupado.some((o) => cruza(ini, fim, o.inicioMs, o.fimMs))) continue;
      saida.push({ inicio: new Date(ini).toISOString(), fim: new Date(fim).toISOString(), dia, hora: hhmm(m) });
    }
  }
  return saida;
}

/**
 * O horário pedido cabe na regra (dia, expediente, pausa, grade, antecedência e janela)?
 * Checagem do servidor: quem decide é a regra, não o que veio do navegador. Ignora o ocupado.
 */
export function dentroDaRegra(opts: { regra: Regra; inicioMs: number; duracaoMin: number; agora: number }): boolean {
  if (opts.inicioMs > opts.agora + (opts.regra.janelaDias + 1) * DIA_MS) return false;
  return calcularHorarios({
    regra: { ...opts.regra, maxPorDia: null },
    duracaoMin: opts.duracaoMin,
    ocupado: [],
    agora: opts.agora,
    deMs: opts.inicioMs - 60_000,
    dias: 1,
  }).some((h) => Math.abs(Date.parse(h.inicio) - opts.inicioMs) < 1000);
}

/** Conta as reservas por dia no fuso (para o teto diário). */
export function contarPorDia(inicios: string[], tz: string): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const iso of inicios) {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) continue;
    const dia = chaveDoDia(ms, tz);
    contagem[dia] = (contagem[dia] ?? 0) + 1;
  }
  return contagem;
}
