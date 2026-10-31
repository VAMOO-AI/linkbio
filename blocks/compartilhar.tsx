"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Botões dentro do painel "Compartilhar" do perfil. O painel em si é um <details> (abre sem
 * JavaScript, com o QR e o link de baixar); aqui ficam Copiar, Enviar (se o aparelho tiver) e Esc fecha.
 */
export function AcoesCompartilhar({ url, titulo }: { url: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const [podeEnviar, setPodeEnviar] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setPodeEnviar(typeof navigator.share === "function"), 0);
    const detalhes = raiz.current?.closest("details");
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape" && detalhes?.open) {
        detalhes.open = false;
        detalhes.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  async function enviar() {
    try {
      await navigator.share({ title: titulo, url });
    } catch {
      // A pessoa fechou a janela de envio: nada a fazer.
    }
  }

  return (
    <div className="compartilhar-acoes" ref={raiz}>
      <button type="button" onClick={copiar} aria-live="polite">
        {copiado ? "Copiado" : "Copiar link"}
      </button>
      {podeEnviar && (
        <button type="button" onClick={enviar}>
          Enviar
        </button>
      )}
    </div>
  );
}
