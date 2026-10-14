"use client";

import dynamic from "next/dynamic";
import type { Offer } from "@/config/schema";
import type { DecideConcierge, RespostaConcierge } from "@/lib/concierge";
import { ConciergeBlock } from "./concierge";

// No servidor o Next não separa o chunk. Aqui, no cliente, a dúvida livre só baixa se `ia` for verdadeiro.
const ConciergeIa = dynamic(() => import("./concierge-ia").then((m) => m.ConciergeIa));

type Passo = { id: string; question: string; options: RespostaConcierge[] };

export function ConciergeModo({
  ia,
  teste = false,
  ...props
}: {
  ia: boolean;
  teste?: boolean;
  title?: string;
  intro?: string;
  variant?: "destaque" | "leve";
  collapsed?: boolean;
  decide?: DecideConcierge;
  flow: Passo[];
  offers: Offer[];
  whatsapp: string;
  chave?: string | null;
}) {
  if (ia) return <ConciergeIa {...props} teste={teste} />;
  return <ConciergeBlock {...props} />;
}
