"use client";

import { useEffect, useState } from "react";
import { partesRestantes } from "@/lib/contagem";

const dois = (n: number) => String(n).padStart(2, "0");

/**
 * Os números da contagem. `inicial` é o que faltava quando o servidor montou a página (o primeiro
 * desenho bate com o HTML); no navegador, o relógio corrige na hora e anda de segundo em segundo.
 */
export function ContagemRelogio({ alvo, inicial, fim }: { alvo: number; inicial: number; fim: string }) {
  const [restante, setRestante] = useState(inicial);

  useEffect(() => {
    const id = setInterval(() => {
      const r = alvo - Date.now();
      setRestante(r);
      if (r <= 0) clearInterval(id);
    }, 1000);
    // Primeira correção logo depois de abrir: o HTML pode ter vindo do cache, com minutos de atraso.
    const agora = setTimeout(() => setRestante(alvo - Date.now()), 0);
    return () => {
      clearInterval(id);
      clearTimeout(agora);
    };
  }, [alvo]);

  const p = partesRestantes(restante);
  if (!p) return <p className="contagem-fim">{fim}</p>;
  const unidades: [number, string][] = [
    [p.dias, p.dias === 1 ? "dia" : "dias"],
    [p.horas, p.horas === 1 ? "hora" : "horas"],
    [p.min, "min"],
    [p.seg, "seg"],
  ];
  return (
    <div className="contagem-relogio" role="timer" aria-hidden="true">
      {unidades.map(([n, rotulo]) => (
        <span key={rotulo.slice(0, 2)} className="contagem-unidade">
          <strong>{dois(n)}</strong>
          <small>{rotulo}</small>
        </span>
      ))}
    </div>
  );
}
