import type { ReactNode } from "react";
import type { RegraOrigem } from "@/lib/origem";

/**
 * Bloco com regra de origem: um invólucro sem caixa (display: contents) que o CSS de cssDeOrigem
 * esconde ou mostra. Bloco sem regra sai como sempre, sem invólucro.
 */
export function PorOrigem({ origem, pos, children }: { origem?: RegraOrigem; pos: number; children: ReactNode }) {
  if (!origem?.mostrar?.length && !origem?.esconder?.length) return <>{children}</>;
  return (
    <div className="por-origem" data-bloco-origem={pos}>
      {children}
    </div>
  );
}
