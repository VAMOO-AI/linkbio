"use client";

import { useState } from "react";

/**
 * Botão "Copiar" do cupom (opcional: coupon.copy). Só recebe o código, nunca a config.
 * Sem permissão de área de transferência, seleciona o código para o dono copiar.
 */
export function BotaoCopiar({ code, alvo }: { code: string; alvo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(code);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      const el = document.getElementById(alvo);
      if (el) window.getSelection()?.selectAllChildren(el);
    }
  }

  return (
    <button type="button" className="cupom-copiar" onClick={copiar} aria-live="polite">
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}
