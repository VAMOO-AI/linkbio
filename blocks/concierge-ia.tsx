"use client";

import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import type { Offer } from "@/config/schema";
import { alvoConciergeMais, hrefConcierge, hrefDoClique } from "@/lib/cliques";
import { destinoConcierge, type DecideConcierge, type RespostaConcierge } from "@/lib/concierge";
import { ConciergeBlock } from "./concierge";

type Passo = { id: string; question: string; options: RespostaConcierge[] };
const semAssinatura = () => () => {};
const PERGUNTA_MAX = 300;

/**
 * Dúvida livre. O roteiro (ConciergeBlock) só entra se a rota pedir fallback —
 * sem chave, no limite ou se a chamada falhar. Este arquivo não vai no bundle do modo roteiro.
 */
export function ConciergeIa({
  title,
  intro,
  variant = "destaque",
  collapsed = false,
  decide = "primeira",
  flow,
  offers,
  whatsapp,
  chave = null,
  teste = false,
}: {
  title?: string;
  intro?: string;
  variant?: "destaque" | "leve";
  collapsed?: boolean;
  decide?: DecideConcierge;
  flow: Passo[];
  offers: Offer[];
  whatsapp: string;
  chave?: string | null;
  /** Só o teste manda o cabeçalho que libera a rota com a API falsa. */
  teste?: boolean;
}) {
  const [fase, setFase] = useState<"pergunta" | "final" | "roteiro">("pergunta");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [final, setFinal] = useState<{ texto: string; offerId: string | null; pergunta: string } | null>(null);
  const [aberto, setAberto] = useState(!collapsed);
  const pronto = useSyncExternalStore(semAssinatura, () => true, () => false);
  const corpoId = useId();
  const campoId = useId();

  if (fase === "roteiro") {
    return (
      <ConciergeBlock
        title={title}
        intro={intro}
        variant={variant}
        collapsed={collapsed}
        decide={decide}
        flow={flow}
        offers={offers.filter((o) => flow.some((p) => p.options.some((op) => op.offer === o.id)))}
        whatsapp={whatsapp}
        chave={chave}
      />
    );
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const pergunta = texto.trim();
    if (!pergunta || enviando) return;
    setEnviando(true);
    try {
      const resp = await fetch("/api/concierge", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(teste ? { "x-linkbio-concierge-teste": "1" } : {}),
        },
        body: JSON.stringify({ pergunta }),
      });
      const json = (await resp.json()) as { tipo?: string; texto?: string; offerId?: string | null };
      if (!resp.ok || json.tipo !== "final" || typeof json.texto !== "string") {
        setFase("roteiro");
        return;
      }
      setFinal({ texto: json.texto, offerId: json.offerId ?? null, pergunta });
      setFase("final");
    } catch {
      setFase("roteiro");
    } finally {
      setEnviando(false);
    }
  }

  const cabecalho = (
    <>
      <span className="concierge-icone" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      </span>
      <span className="concierge-cabecalho-texto">
        {title && (collapsed ? <span className="concierge-titulo">{title}</span> : <h2 className="concierge-titulo">{title}</h2>)}
        {intro && <span className="concierge-intro">{intro}</span>}
      </span>
    </>
  );

  let conteudo: React.ReactNode = null;
  if (fase === "final" && final) {
    const oferta = final.offerId ? offers.find((o) => o.id === final.offerId) : undefined;
    const respostas = [{ id: "duvida", label: final.pergunta.replace(/\s+/g, " ").trim().slice(0, 120) }];
    const direto = destinoConcierge({
      whatsapp,
      respostas,
      oferta: oferta ? { title: oferta.title, url: oferta.url, wa: oferta.wa } : undefined,
    });
    const href = chave ? hrefConcierge(chave, respostas.map((r) => r.id), direto) : direto;
    const mais = oferta?.more_url ? hrefDoClique(chave ? alvoConciergeMais(chave, oferta.id) : null, oferta.more_url) : undefined;
    conteudo = (
      <>
        <div className="concierge-recomendacao" data-testid="cc-recomendacao">
          <span className="concierge-eyebrow">Seu caminho</span>
          <p className="concierge-oferta" tabIndex={-1}>
            {oferta ? oferta.title : "Vamos conversar"}
          </p>
          <p className="concierge-motivo">{final.texto}</p>
          <a href={href} target="_blank" rel="noopener" className="bloco-cta" data-testid="cc-cta">
            {oferta ? (oferta.cta ?? "Quero essa") : "Falar no WhatsApp"}
          </a>
          {mais && (
            <a href={mais} target="_blank" rel="noopener" className="concierge-mais">
              {oferta?.more_label ?? "Saiba mais"}
            </a>
          )}
        </div>
        <button
          type="button"
          className="concierge-recomecar"
          onClick={() => {
            setFase("pergunta");
            setFinal(null);
            setTexto("");
          }}
        >
          Recomeçar
        </button>
      </>
    );
  } else {
    conteudo = (
      <form className="concierge-duvida" onSubmit={enviar}>
        <label htmlFor={campoId}>Escreva sua dúvida</label>
        <textarea
          id={campoId}
          name="duvida"
          maxLength={PERGUNTA_MAX}
          required
          rows={3}
          value={texto}
          data-testid="cc-duvida"
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="bloco-cta" data-testid="cc-enviar" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar"}
        </button>
        <button type="button" className="concierge-recomecar" onClick={() => setFase("roteiro")}>
          Prefiro as perguntas
        </button>
      </form>
    );
  }

  return (
    <section
      className="bloco-concierge"
      data-variant={variant}
      data-aberto={aberto}
      data-modo="ia"
      aria-label={title ?? "Concierge"}
      data-testid="concierge"
      data-pronto={pronto || undefined}
    >
      {collapsed ? (
        <button type="button" className="concierge-cabecalho" aria-expanded={aberto} aria-controls={corpoId} onClick={() => setAberto((a) => !a)}>
          {cabecalho}
          <span className="concierge-seta" aria-hidden="true">
            ›
          </span>
        </button>
      ) : (
        <div className="concierge-cabecalho">{cabecalho}</div>
      )}
      <div className="concierge-corpo" id={corpoId} hidden={!aberto} aria-live="polite">
        {conteudo}
      </div>
    </section>
  );
}
