"use client";

import { useEffect, useRef, useState } from "react";
import { Icone } from "./icones";
import type { Obj } from "./campos";
import type { TemaForcado } from "@/lib/resolver";
import type { RecadoDaPrevia } from "@/lib/previa";
import type { FocoDaPrevia } from "./previa-foco";

const APARELHOS = {
  celular: { w: 390, h: 844, nome: "Celular" },
  tablet: { w: 768, h: 1024, nome: "Tablet" },
  computador: { w: 1280, h: 800, nome: "Computador" },
} as const;
type Aparelho = keyof typeof APARELHOS;

/**
 * Prévia do que está sendo editado (rascunho), não do que está no ar.
 * O quadro carrega uma vez e daí em diante recebe cada alteração por postMessage: nada de recarregar
 * o iframe nem de esperar o servidor a cada tecla.
 */
export function Previa({ config, estado, foco, aberta }: { config: Obj; estado: string; foco: FocoDaPrevia | null; aberta: boolean }) {
  const [aparelho, setAparelho] = useState<Aparelho>("celular");
  const [tema, setTema] = useState<TemaForcado>("");
  const [pronta, setPronta] = useState(false);
  const quadro = useRef<HTMLIFrameElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(400);

  useEffect(() => {
    function aoReceber(e: MessageEvent<RecadoDaPrevia>) {
      if (e.origin !== window.location.origin || e.source !== quadro.current?.contentWindow) return;
      if (e.data?.tipo === "pronta") setPronta(true);
    }
    addEventListener("message", aoReceber);
    return () => removeEventListener("message", aoReceber);
  }, []);

  // O quadro só escuta depois do "pronta" — antes disso, o recado cairia no vazio.
  useEffect(() => {
    if (!pronta) return;
    const recado: RecadoDaPrevia = { tipo: "config", config, tema };
    quadro.current?.contentWindow?.postMessage(recado, window.location.origin);
  }, [pronta, config, tema]);

  // A prévia segue a edição. Só com o quadro na tela: no celular, com a prévia fechada, o pedido fica
  // guardado e vale ao abrir (`aberta` refaz o envio). O foco continua no campo: o quadro só rola.
  useEffect(() => {
    const q = quadro.current;
    if (!pronta || !foco || !q || q.getClientRects().length === 0) return;
    const recado: RecadoDaPrevia = { tipo: "foco", alvo: foco.alvo, abriu: foco.abriu };
    q.contentWindow?.postMessage(recado, window.location.origin);
  }, [pronta, foco, aberta]);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setLargura(e!.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { w, h } = APARELHOS[aparelho];
  const escala = Math.min(1, largura / w);

  return (
    <div className="p-painel">
      <div className="p-barra">
        <div className="c-seg c-seg-icones" role="radiogroup" aria-label="Tamanho da tela">
          {(Object.keys(APARELHOS) as Aparelho[]).map((a) => (
            <button key={a} type="button" role="radio" aria-checked={a === aparelho} className="c-seg-op" title={APARELHOS[a].nome} onClick={() => setAparelho(a)}>
              <Icone nome={a} tamanho={16} />
              <span className="sr">{APARELHOS[a].nome}</span>
            </button>
          ))}
        </div>
        <div className="c-seg" role="radiogroup" aria-label="Claro ou escuro">
          {([["", "Auto"], ["claro", "Claro"], ["escuro", "Escuro"]] as const).map(([v, n]) => (
            <button key={v} type="button" role="radio" aria-checked={tema === v} className="c-seg-op" onClick={() => setTema(v)}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <p className="p-estado">
        <span className="p-ponto" aria-hidden="true" />
        {estado}
      </p>
      <div ref={caixa} className="p-caixa" style={{ height: h * escala }}>
        <div className={`p-moldura p-${aparelho}`} style={{ width: w, height: h, transform: `scale(${escala})` }}>
          <iframe
            ref={quadro}
            src="/admin-previa"
            title="Prévia do que você está editando"
            className={pronta ? "p-visivel" : "p-escondida"}
            tabIndex={pronta ? 0 : -1}
          />
        </div>
      </div>
    </div>
  );
}
