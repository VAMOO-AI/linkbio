import type { Block } from "@/config/schema";
import { DIAS_DA_SEMANA, minutosDe, type Regra } from "./horarios";

export type BlocoAgendamento = Extract<Block, { type: "agendamento" }>;
export type Servico = BlocoAgendamento["servicos"][number];

/** Padrões do bloco (os mesmos que o README e o painel citam). */
export const PADRAO = {
  dias: ["seg", "ter", "qua", "qui", "sex"] as const,
  inicio: "09:00",
  fim: "18:00",
  antecedencia: 12,
  janela: 14,
  intervalo: 15,
  passo: 30,
};

/** Config do bloco → regra do motor, com os padrões aplicados. */
export function regraDoBloco(bloco: BlocoAgendamento, tz: string): Regra {
  return {
    tz,
    dias: (bloco.dias ?? PADRAO.dias).map((d) => DIAS_DA_SEMANA.indexOf(d)),
    inicio: minutosDe(bloco.inicio ?? PADRAO.inicio),
    fim: minutosDe(bloco.fim ?? PADRAO.fim),
    pausas: (bloco.pausas ?? []).map((p) => ({ inicio: minutosDe(p.inicio), fim: minutosDe(p.fim) })),
    antecedenciaMin: (bloco.antecedencia ?? PADRAO.antecedencia) * 60,
    janelaDias: bloco.janela ?? PADRAO.janela,
    intervaloMin: bloco.intervalo ?? PADRAO.intervalo,
    passoMin: bloco.passo ?? PADRAO.passo,
    maxPorDia: bloco.maxPorDia ?? null,
  };
}

/** Id do bloco na página: o `id` da config ou o tipo com a posição (como o lead). */
export function idDoBloco(bloco: { id?: string }, indice: number): string {
  return bloco.id ?? `agendamento-${indice}`;
}

/** Acha o bloco ligado pelo id que o navegador mandou. */
export function acharBlocoAgendamento(
  blocos: readonly Block[],
  id: string,
): BlocoAgendamento | undefined {
  let achado: BlocoAgendamento | undefined;
  blocos.forEach((b, i) => {
    if (b.type === "agendamento" && b.enabled !== false && idDoBloco(b, i) === id) achado = b;
  });
  return achado;
}
