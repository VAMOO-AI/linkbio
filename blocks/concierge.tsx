"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { Offer } from "@/config/schema";
import { alvoConciergeMais, hrefConcierge, hrefDoClique } from "@/lib/cliques";
import { destinoConcierge, respostaQueDecide, type DecideConcierge, type RespostaConcierge } from "@/lib/concierge";

type Opcao = RespostaConcierge;
type Passo = { id: string; question: string; options: Opcao[] };
const semAssinatura = () => () => {};

/**
 * Concierge em modo ROTEIRO: fluxo determinístico da config, sem custo.
 * pergunta → chips → recomendação com motivo → CTA. Ilha client isolada:
 * recebe só props (a config inteira e o zod não vão para o navegador).
 */
export function ConciergeBlock({
  title,
  intro,
  variant = "destaque",
  collapsed = false,
  decide = "primeira",
  flow,
  offers,
  whatsapp,
  chave = null,
}: {
  title?: string;
  intro?: string;
  variant?: "destaque" | "leve";
  collapsed?: boolean;
  /** Quem decide o final: a 1ª resposta ou a última com destino (lib/concierge.ts). */
  decide?: DecideConcierge;
  flow: Passo[];
  /** Só as ofertas que o fluxo referencia. */
  offers: Offer[];
  whatsapp: string;
  /** Chave do bloco quando a contagem está ligada. Sem ela, o botão final continua o link direto. */
  chave?: string | null;
}) {
  const [aberto, setAberto] = useState(!collapsed);
  const [passoAtual, setPassoAtual] = useState(0);
  const [respostas, setRespostas] = useState<Opcao[]>([]);
  const concluido = passoAtual >= flow.length;
  const corpoId = useId();
  // Foco vai para a nova pergunta (ou para a recomendação) depois de cada resposta, não no carregamento.
  const interagiu = useRef(false);
  const alvoFoco = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (interagiu.current) alvoFoco.current?.focus();
  }, [passoAtual]);

  // Marca a ilha como pronta depois da hidratação: antes disso um toque não faz nada, e os testes esperam por ela.
  const pronto = useSyncExternalStore(semAssinatura, () => true, () => false);

  function responder(opcao: Opcao) {
    interagiu.current = true;
    setRespostas((atual) => [...atual, opcao]);
    setPassoAtual((atual) => atual + 1);
  }

  function recomecar() {
    interagiu.current = true;
    setPassoAtual(0);
    setRespostas([]);
  }

  const cabecalho = (
    <>
      <span className="concierge-icone" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      </span>
      <span className="concierge-cabecalho-texto">
        {/* Título não pode ficar dentro de <button>: h2 só quando o cabeçalho não é botão. */}
        {title && (collapsed ? <span className="concierge-titulo">{title}</span> : <h2 className="concierge-titulo">{title}</h2>)}
        {intro && <span className="concierge-intro">{intro}</span>}
      </span>
    </>
  );

  let conteudo: React.ReactNode = null;
  if (concluido) {
    // A recomendação segue a resposta que decide (a 1ª, ou a última com destino); todas viram contexto.
    // Nenhuma resposta com destino (modo "ultima") vale a última dada: o final nunca fica vazio.
    const decisiva = respostaQueDecide(respostas, decide) ?? respostas.at(-1);
    // Resposta sem oferta (ex.: "Ainda não sei") ou com oferta que não existe mais (apagada, ainda não
    // publicada): o final vira convite para conversar no WhatsApp, em vez de não mostrar nada.
    const oferta = decisiva?.offer ? offers.find((o) => o.id === decisiva.offer) : undefined;
    if (decisiva) {
      const direto = destinoConcierge({
        whatsapp,
        respostas,
        oferta: oferta ? { url: oferta.url, wa: oferta.wa, title: oferta.title } : undefined,
        waSemOferta: decisiva.wa,
      });
      const destino = chave ? hrefConcierge(chave, respostas.map((r) => r.id), direto) : direto;
      const mais = oferta?.more_url ? hrefDoClique(chave ? alvoConciergeMais(chave, oferta.id) : null, oferta.more_url) : undefined;
      conteudo = (
        <>
          <div className="concierge-recomendacao" data-testid="cc-recomendacao">
            <span className="concierge-eyebrow">Seu caminho</span>
            <p className="concierge-oferta" ref={alvoFoco} tabIndex={-1}>
              {oferta ? oferta.title : (decisiva.title ?? "Vamos conversar")}
            </p>
            {decisiva.reason && <p className="concierge-motivo">{decisiva.reason}</p>}
            <a href={destino} target="_blank" rel="noopener" className="bloco-cta" data-testid="cc-cta">
              {oferta ? (oferta.cta ?? "Quero essa") : (decisiva.cta ?? "Falar no WhatsApp")}
            </a>
            {mais && (
              <a href={mais} target="_blank" rel="noopener" className="concierge-mais">
                {oferta?.more_label ?? "Saiba mais"}
              </a>
            )}
          </div>
          <button type="button" className="concierge-recomecar" onClick={recomecar}>
            Recomeçar
          </button>
        </>
      );
    }
  } else {
    const passo = flow[passoAtual];
    if (passo) {
      conteudo = (
        <>
          <div className="concierge-progresso" aria-hidden="true">
            {flow.map((p, i) => (
              <span key={p.id} data-feito={i <= passoAtual || undefined} />
            ))}
          </div>
          <p className="concierge-contagem">
            Pergunta {passoAtual + 1} de {flow.length}
          </p>
          <p className="concierge-pergunta" ref={alvoFoco} tabIndex={-1}>
            {passo.question}
          </p>
          <div className="concierge-chips" role="group" aria-label={passo.question}>
            {passo.options.map((opcao) => (
              <button key={opcao.id} type="button" data-testid={`cc-chip-${opcao.id}`} onClick={() => responder(opcao)}>
                {opcao.label}
              </button>
            ))}
          </div>
        </>
      );
    }
  }

  return (
    <section
      className="bloco-concierge"
      data-variant={variant}
      data-aberto={aberto}
      aria-label={title ?? "Concierge"}
      data-testid="concierge"
      data-pronto={pronto || undefined}
    >
      {collapsed ? (
        <button
          type="button"
          className="concierge-cabecalho"
          aria-expanded={aberto}
          aria-controls={corpoId}
          onClick={() => setAberto((a) => !a)}
        >
          {cabecalho}
          <span className="concierge-seta" aria-hidden="true">
            ›
          </span>
        </button>
      ) : (
        <div className="concierge-cabecalho">{cabecalho}</div>
      )}
      {/* hidden tira o corpo recolhido da leitura e do foco (QA B5). */}
      <div className="concierge-corpo" id={corpoId} hidden={!aberto} aria-live="polite">
        {conteudo}
      </div>
    </section>
  );
}
