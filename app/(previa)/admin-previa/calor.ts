import type { CalorDaPrevia } from "@/lib/previa";

/**
 * Dentro do quadro da prévia: pinta o mapa de calor por cima de cada bloco (aba Resultados).
 * Como o realce de `seguir.ts`, fica fora do bloco: um retângulo por cima, que não muda o layout
 * nem recebe clique. Redesenha a cada mudança de config ou de tamanho (o bloco anda).
 */

const visivel = (el: Element): el is HTMLElement => el.getClientRects().length > 0;

function caixaDoBloco(indice: number) {
  const w = document.querySelector(`.previa-bloco[data-bloco-indice="${indice}"]`);
  const els = w ? [...w.children].filter(visivel).filter((e) => !e.classList.contains("previa-fora")) : [];
  if (!els.length) return null;
  const rs = els.map((e) => e.getBoundingClientRect());
  const top = Math.min(...rs.map((r) => r.top));
  const left = Math.min(...rs.map((r) => r.left));
  return { top, left, width: Math.max(...rs.map((r) => r.right)) - left, height: Math.max(...rs.map((r) => r.bottom)) - top };
}

function textoDoSelo(s: CalorDaPrevia): string {
  const partes = [`${s.pct}% chegam`];
  if (s.cliques) partes.push(`${s.cliques} ${s.cliques === 1 ? "clique" : "cliques"}`);
  if (s.toques) partes.push(`${s.toques} ${s.toques === 1 ? "toque" : "toques"} fora de link`);
  return partes.join(" · ");
}

export function pintarCalor(secoes: readonly CalorDaPrevia[] | null) {
  for (const el of document.querySelectorAll(".previa-calor")) el.remove();
  if (!secoes) return;
  const folga = 4;
  for (const s of secoes) {
    const r = caixaDoBloco(s.indice);
    if (!r) continue;
    const el = document.createElement("div");
    el.className = "previa-calor";
    el.dataset.nivel = s.nivel;
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      top: `${r.top + scrollY - folga}px`,
      left: `${r.left + scrollX - folga}px`,
      width: `${r.width + folga * 2}px`,
      height: `${r.height + folga * 2}px`,
    });
    const selo = document.createElement("span");
    selo.className = "previa-calor-selo";
    selo.textContent = textoDoSelo(s);
    el.appendChild(selo);
    document.body.appendChild(el);
  }
}
