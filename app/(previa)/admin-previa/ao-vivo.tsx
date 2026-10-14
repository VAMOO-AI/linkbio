"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfigSchema, type LinkbioConfig } from "@/config/schema";
import { renderBlock } from "@/blocks/registry";
import { seloDaJanela } from "@/lib/janela";
import { modoExibido, resolverTema, type TemaForcado } from "@/lib/resolver";
import { themeParaCss } from "@/lib/theme";
import { alvoValido, type AlvoDaPrevia, type RecadoDaPrevia } from "@/lib/previa";
import { seguirAlvo } from "./seguir";

/**
 * O conteúdo da prévia: abre com a config que o servidor mandou e, daí em diante, desenha o que o
 * editor empurra por postMessage. A validação é a mesma do build, então um estado inválido no meio
 * da digitação não chega à tela — a prévia continua mostrando a última coisa que publicaria.
 */
export function PreviaAoVivo({ inicial }: { inicial: LinkbioConfig }) {
  const [config, setConfig] = useState(inicial);
  // ?tema=claro|escuro também vale aqui: é o que o link direto da prévia carrega.
  const [tema, setTema] = useState<TemaForcado>(() => {
    if (typeof window === "undefined") return "";
    const daUrl = new URLSearchParams(window.location.search).get("tema");
    return daUrl === "claro" || daUrl === "escuro" ? daUrl : "";
  });
  const resolvido = useMemo(() => resolverTema(config.theme), [config]);
  // O que o painel está editando: rola até lá depois de desenhar (o alvo pode ter vindo junto de uma config nova).
  const [foco, setFoco] = useState<{ alvo: AlvoDaPrevia; abriu: boolean; vez: number } | null>(null);
  const configAtual = useRef(config);
  useEffect(() => {
    configAtual.current = config;
  }, [config]);

  useEffect(() => {
    function aoReceber(e: MessageEvent<RecadoDaPrevia>) {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const recado = e.data;
      if (recado?.tipo === "foco") {
        if (alvoValido(recado.alvo)) setFoco((f) => ({ alvo: recado.alvo, abriu: recado.abriu === true, vez: (f?.vez ?? 0) + 1 }));
        return;
      }
      if (recado?.tipo !== "config") return;
      const r = ConfigSchema.safeParse(recado.config);
      if (!r.success) return;
      setConfig(r.data);
      setTema(recado.tema);
    }
    addEventListener("message", aoReceber);
    // Só a partir daqui o editor pode mandar: antes deste aviso, um recado cairia no vazio.
    window.parent.postMessage({ tipo: "pronta" }, location.origin);
    return () => removeEventListener("message", aoReceber);
  }, []);

  // O tema vive no <html> e numa <style> do layout; editar cor ou modelo precisa mexer nos dois.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.lang = config.site.locale;
    raiz.dataset.fundo = resolvido.background;
    raiz.dataset.botoes = resolvido.buttons;
    const modo = modoExibido(resolvido, tema);
    if (modo) raiz.dataset.theme = modo;
    else delete raiz.dataset.theme;
    const estilo = document.getElementById("lb-tema");
    if (estilo) estilo.textContent = themeParaCss(resolvido);
  }, [config, resolvido, tema]);

  // Só a mudança de alvo rola: editar a config (cada tecla) não mexe na rolagem.
  useEffect(() => {
    if (!foco) return;
    const quadro = requestAnimationFrame(() => seguirAlvo(foco.alvo, configAtual.current, foco.abriu));
    return () => cancelAnimationFrame(quadro);
  }, [foco]);

  // Cada bloco num invólucro `display: contents` com o índice dele em `config.blocks` (contando os
  // desligados, como o painel conta): é por ele que a prévia acha o que está sendo editado. Existe só
  // aqui; a bio publicada desenha os blocos direto. O índice passado ao bloco é o desta lista.
  // Desligado some, como na bio. Fora da janela continua aqui, com o selo: o dono precisa achar o bloco.
  const linhas = config.blocks.flatMap((block, indice) =>
    block.enabled === false ? [] : [{ block, indice, selo: seloDaJanela(block.visivel, new Date(), config.site.tz) }],
  );
  return (
    <>
      {linhas.map(({ block, indice, selo }, i) => (
        <div key={("id" in block && block.id) || `${block.type}-${i}`} className="previa-bloco" data-bloco-indice={indice}>
          {selo && (
            <p className="previa-fora" role="status">
              {selo}
            </p>
          )}
          {renderBlock(block, i, config, resolvido)}
        </div>
      ))}
    </>
  );
}
