/**
 * Contagem regressiva (bloco `contagem`): a parte que é só conta, sem React, para ser testada.
 * O alvo vem da config no fuso `site.tz` e vira instante UTC no servidor (lib/janela.ts, instanteUtc).
 */
import { partesDoInstante } from "./janela";

export type Restante = { dias: number; horas: number; min: number; seg: number };

/** O que falta em dias, horas, minutos e segundos. Zero ou negativo: acabou (null). */
export function partesRestantes(ms: number): Restante | null {
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    min: Math.floor((total % 3600) / 60),
    seg: total % 60,
  };
}

/** "2026-11-11T18:30" → "11/11/2026 às 18:30"; só a data → "11/11/2026". */
export function quandoTermina(v: string): string {
  const p = partesDoInstante(v);
  if (!p) return v;
  const dois = (n: number) => String(n).padStart(2, "0");
  const data = `${dois(p.d)}/${dois(p.m)}/${p.y}`;
  return p.temHora ? `${data} às ${dois(p.hh)}:${dois(p.mm)}` : data;
}
