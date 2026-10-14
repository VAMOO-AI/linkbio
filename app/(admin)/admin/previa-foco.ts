"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { AlvoDaPrevia } from "@/lib/previa";
import type { Obj } from "./campos";

/**
 * "A prévia segue a edição": abrir um bloco, uma oferta ou um produto, ou pôr o cursor num campo
 * deles, diz à prévia onde ir. O painel não precisa saber nada da prévia além disso: cada pedaço do
 * formulário marca de onde é com `data-caminho` ("blocks.3", "offers.1", "profile"...), e aqui se
 * junta essa cadeia (de dentro para fora) num alvo. Quem rola e realça é o quadro da prévia.
 */

const ehObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

function idDoItem(lista: unknown, i: number): string | undefined {
  const el = Array.isArray(lista) ? lista[i] : undefined;
  return ehObj(el) && typeof el.id === "string" && el.id ? el.id : undefined;
}

/**
 * Cadeia de caminhos (do mais de dentro para o mais de fora) → alvo da prévia. Função pura.
 * O bloco manda: uma oferta aberta dentro do bloco de cards vai ao card daquele bloco, não ao
 * primeiro card da oferta na página. Aparência, Site e Versões não têm alvo (mudam a página toda).
 */
export function alvoDoCaminho(caminhos: readonly string[], cfg: Obj): AlvoDaPrevia | null {
  let bloco: number | undefined;
  let oferta: string | undefined;
  let produto: string | undefined;
  let perfil = false;
  let whatsapp = false;
  for (const c of caminhos) {
    const [raiz, indice] = c.split(".");
    const i = Number(indice);
    const temIndice = indice !== undefined && indice !== "" && Number.isInteger(i) && i >= 0;
    if (raiz === "blocks" && temIndice) bloco ??= i;
    else if (raiz === "offers" && temIndice) oferta ??= idDoItem(cfg.offers, i);
    else if (raiz === "catalog" && temIndice) produto ??= idDoItem(cfg.catalog, i);
    else if (raiz === "profile") perfil = true;
    else if (raiz === "contact") whatsapp = true;
  }
  if (bloco !== undefined) return { bloco, ...(oferta ? { oferta } : {}), ...(produto ? { produto } : {}) };
  if (oferta) return { oferta };
  if (produto) return { produto };
  if (perfil) return { perfil: true };
  if (whatsapp) return { whatsapp: true };
  return null;
}

/** Os `data-caminho` de `el` para cima, até `raiz` (exclusive). */
function caminhosAcima(el: Element, raiz: Element): string[] {
  const lista: string[] = [];
  for (let x = el.closest("[data-caminho]"); x && raiz.contains(x) && x !== raiz; x = x.parentElement?.closest("[data-caminho]") ?? null) {
    const c = x.getAttribute("data-caminho");
    if (c) lista.push(c);
  }
  return lista;
}

/** Campos que, ao receber o cursor, levam a prévia junto (botões de ação como Subir e Apagar, não). */
const CAMPO = 'input, textarea, select, [role="radio"], [role="switch"]';

export type FocoDaPrevia = { alvo: AlvoDaPrevia; abriu: boolean; vez: number };

/**
 * Escuta o formulário dentro de `raiz` e devolve o último alvo pedido. `vez` muda a cada pedido, para
 * reabrir o mesmo bloco rolar de novo. Abrir é um clique num `aria-expanded="false"`; pôr o cursor
 * num campo também pede, e o quadro ignora quando é o mesmo alvo e ele já está na tela (passar de um
 * campo a outro do mesmo bloco não pisca o realce a cada Tab).
 */
export function usePreviaFoco(raiz: RefObject<HTMLElement | null>, cfg: Obj): FocoDaPrevia | null {
  const [foco, setFoco] = useState<FocoDaPrevia | null>(null);
  const cfgAtual = useRef(cfg);
  useEffect(() => {
    cfgAtual.current = cfg;
  }, [cfg]);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let vez = 0;
    const pedir = (de: Element, abriu: boolean) => {
      const alvo = alvoDoCaminho(caminhosAcima(de, el), cfgAtual.current);
      if (!alvo) return;
      vez += 1;
      setFoco({ alvo, abriu, vez });
    };
    // Na captura: roda antes do React trocar o aria-expanded, então "false" aqui quer dizer "vai abrir".
    const aoClicar = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const abre = e.target.closest('[aria-expanded="false"]');
      // A seta "Editar" da linha do bloco abre também (é um span sem aria, ao lado do nome).
      const seta = e.target.closest(".s-bloco-editar");
      if (abre) pedir(abre, true);
      else if (seta && !seta.closest(".s-aberto")) pedir(seta, true);
    };
    const aoFocar = (e: FocusEvent) => {
      if (e.target instanceof Element && e.target.matches(CAMPO)) pedir(e.target, false);
    };
    el.addEventListener("click", aoClicar, true);
    el.addEventListener("focusin", aoFocar);
    return () => {
      el.removeEventListener("click", aoClicar, true);
      el.removeEventListener("focusin", aoFocar);
    };
  }, [raiz]);

  return foco;
}
