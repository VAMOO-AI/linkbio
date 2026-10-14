"use client";

import { useState, useSyncExternalStore } from "react";
import { avisoInApp } from "@/lib/inapp";

const semAssinatura = () => () => {};
const uaDoCliente = () => navigator.userAgent;
const uaDoServidor = () => "";

/**
 * Banner discreto "Abrir no navegador" para in-app browsers (IG/TikTok/FB).
 * Só é montado quando a página tem bloco que sofre no in-app.
 * O UA é lido via useSyncExternalStore: o HTML estático sai sem banner e o
 * client só o mostra depois da hidratação, sem mismatch.
 */
export function BannerInApp() {
  const ua = useSyncExternalStore(semAssinatura, uaDoCliente, uaDoServidor);
  const [fechado, setFechado] = useState(false);
  const aviso = ua ? avisoInApp(ua, window.location.href) : null;

  if (!aviso || fechado) return null;

  return (
    <div className="banner-inapp" role="note">
      <p>
        <strong>Abrir no navegador</strong>
        <br />
        {aviso.intent ? <a href={aviso.intent}>{aviso.texto} Abrir no Chrome</a> : aviso.texto}
      </p>
      <button type="button" onClick={() => setFechado(true)} aria-label="Fechar aviso">
        ✕
      </button>
    </div>
  );
}
