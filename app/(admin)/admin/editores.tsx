"use client";

import { useId, useState } from "react";
import { Icone } from "./icones";
import { Campo, Objeto, chaveDe, mover, temErroEm, vazio, type Caminho, type Ctx, type Esquema, type Obj } from "./campos";
import { idLivre } from "@/lib/admin/normalizar";

/**
 * Editores próprios de dois blocos em que o formulário genérico escondia o que importa:
 * - concierge: a lógica (qual resposta leva a qual final) fica visível. Quem decide o final é escolhido
 *   no topo ("Só a 1ª pergunta" ou "A última resposta com destino"); os campos de recomendação aparecem
 *   nas perguntas que podem decidir, e destino guardado onde não vale é mostrado, com opção de limpar;
 * - cards: cada oferta do bloco é editada ali mesmo, sem precisar ir à seção Ofertas.
 */

const texto = (v: unknown) => (typeof v === "string" ? v : "");
const lista = (v: unknown) => (Array.isArray(v) ? (v as Obj[]) : []);

function Acoes({ rotulo, i, total, onMover, onRemover, podeRemover = true }: { rotulo: string; i: number; total: number; onMover: (d: number) => void; onRemover: () => void; podeRemover?: boolean }) {
  return (
    <div className="c-item-acoes">
      <button type="button" className="b-icone" aria-label={`Subir ${rotulo}`} title="Subir" disabled={i === 0} onClick={() => onMover(-1)}>
        <Icone nome="cima" tamanho={16} />
      </button>
      <button type="button" className="b-icone" aria-label={`Descer ${rotulo}`} title="Descer" disabled={i === total - 1} onClick={() => onMover(1)}>
        <Icone nome="baixo" tamanho={16} />
      </button>
      <button type="button" className="b-icone b-perigo" aria-label={`Remover ${rotulo}`} title="Remover" disabled={!podeRemover} onClick={onRemover}>
        <Icone nome="lixo" tamanho={16} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ concierge */

const MAX_RESPOSTAS = 4;
const MIN_RESPOSTAS = 2;
const SEM_OFERTA = "";
/** Valor do "Leva para" nas outras perguntas do modo "ultima": a resposta não muda o final. */
const SO_CONTEXTO = "__contexto";
/** Campos que dão destino a uma resposta; no modo "primeira", fora da 1ª pergunta, são ignorados. */
const DE_DESTINO = ["offer", "reason", "title", "cta", "wa"] as const;

type Decide = "primeira" | "ultima";

/** Resposta sem os campos de destino (vira só contexto). */
function soContexto(op: Obj): Obj {
  const resto = { ...op };
  for (const k of DE_DESTINO) delete resto[k];
  return resto;
}

export function EditorDoConcierge({ bloco, i, ctx }: { bloco: Obj; i: number; ctx: Ctx }) {
  const base: Caminho = ["blocks", i, "flow"];
  const flow = lista(bloco.flow);
  const erro = (c: Caminho) => ctx.erros.get(chaveDe(c));
  const decide: Decide = bloco.decide === "ultima" ? "ultima" : "primeira";
  const modoIa = bloco.mode === "ia";
  const nomes = ctx.opcoes.conciergeDecide ?? {};
  const idDecide = useId();
  const idModo = useId();

  return (
    <div className="k-conc">
      <div className="k-decide-escolha">
        <p className="c-rotulo" id={idModo}>
          Como a pessoa pergunta
        </p>
        <div className="c-seg" role="radiogroup" aria-labelledby={idModo}>
          <button type="button" role="radio" aria-checked={!modoIa} className="c-seg-op" onClick={() => modoIa && ctx.set(["blocks", i, "mode"], "roteiro")}>
            Roteiro
          </button>
          <button type="button" role="radio" aria-checked={modoIa} className="c-seg-op" onClick={() => !modoIa && ctx.set(["blocks", i, "mode"], "ia")}>
            Roteiro + dúvida livre (IA)
          </button>
        </div>
        <p className="c-dica">
          {modoIa
            ? "Cada dúvida livre gasta um pedido pequeno. Para ligar, a chave da Anthropic precisa estar no ambiente do site. Vale na página publicada. Sem a chave, ou se passar do limite do dia, quem visita vê só as perguntas."
            : "A pessoa só responde as perguntas prontas. Não gasta nada."}
        </p>
      </div>

      <div className="k-decide-escolha">
        <p className="c-rotulo" id={idDecide}>
          Quem decide o final
        </p>
        <div className="c-seg" role="radiogroup" aria-labelledby={idDecide}>
          {(["primeira", "ultima"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={decide === v}
              className="c-seg-op"
              // "primeira" é o padrão: sai do arquivo em vez de gravar o valor.
              onClick={() => decide !== v && ctx.set(["blocks", i, "decide"], v === "primeira" ? undefined : v)}
            >
              {nomes[v]?.rotulo ?? v}
            </button>
          ))}
        </div>
        <p className="c-dica">
          {decide === "primeira"
            ? 'A resposta da 1ª pergunta escolhe a oferta e a explicação. Ex.: "Estou começando" leva à Mentoria, seja qual for a resposta seguinte.'
            : 'Vale a última resposta que leva para algum lugar; sem nenhuma, vale a 1ª. Ex.: "Estou começando" e depois "Tenho 15 min por dia" leva ao Guia, se essa resposta levar a ele.'}
        </p>
        {erro(["blocks", i, "decide"]) && <p className="c-erro">{erro(["blocks", i, "decide"])}</p>}
      </div>

      <div className="k-regra">
        <span className="k-regra-icone" aria-hidden="true">
          <Icone nome="concierge" tamanho={18} />
        </span>
        {decide === "primeira" ? (
          <p>
            <strong>Como o concierge decide.</strong> A pessoa responde as perguntas na ordem. A resposta da <b>1ª pergunta</b> decide o final: a oferta
            recomendada com a sua explicação, ou uma conversa direto no WhatsApp. As outras perguntas não mudam o final; as respostas delas vão junto
            na mensagem do WhatsApp, para você já saber o contexto.
          </p>
        ) : (
          <p>
            <strong>Como o concierge decide.</strong> A pessoa responde as perguntas na ordem. Vale a <b>última resposta com destino</b> (uma oferta ou
            a conversa no WhatsApp, com a sua explicação). Resposta marcada como &quot;Não muda o final&quot; só vai como contexto; se nenhuma depois
            da 1ª tiver destino, vale a 1ª. Todas as respostas vão junto na mensagem do WhatsApp.
          </p>
        )}
      </div>

      {lista(ctx.cfg.offers).length === 0 && (
        <p className="c-dica">Nenhuma oferta ainda: cada resposta leva para uma conversa no WhatsApp. Para indicar uma oferta, crie uma na seção Ofertas.</p>
      )}

      {flow.map((passo, j) => (
        <PassoDoConcierge
          key={j}
          passo={passo}
          j={j}
          total={flow.length}
          decideModo={decide}
          caminho={[...base, j]}
          ctx={ctx}
          erro={erro}
          onMover={(d) => ctx.set(base, mover(flow, j, j + d))}
          onRemover={() => ctx.set(base, flow.filter((_, x) => x !== j))}
        />
      ))}
      {erro(base) && <p className="c-erro">{erro(base)}</p>}

      <button
        type="button"
        className="b b-tracejado"
        onClick={() =>
          ctx.set(base, [
            ...flow,
            { id: idLivre("pergunta", flow.map((p) => p.id)), question: "", options: [{ id: "resposta-1", label: "" }, { id: "resposta-2", label: "" }] },
          ])
        }
      >
        <Icone nome="mais" tamanho={16} />
        {decide === "primeira" ? "Adicionar pergunta de contexto" : "Adicionar pergunta"}
      </button>
    </div>
  );
}

function PassoDoConcierge({
  passo,
  j,
  total,
  decideModo,
  caminho,
  ctx,
  erro,
  onMover,
  onRemover,
}: {
  passo: Obj;
  j: number;
  total: number;
  decideModo: Decide;
  caminho: Caminho;
  ctx: Ctx;
  erro: (c: Caminho) => string | undefined;
  onMover: (d: number) => void;
  onRemover: () => void;
}) {
  const id = useId();
  const primeira = j === 0;
  /** Esta pergunta mostra "Leva para" e "Explicação": a 1ª sempre; as outras só no modo "ultima". */
  const comDestino = primeira || decideModo === "ultima";
  const opcoes = lista(passo.options);
  const cOpcoes: Caminho = [...caminho, "options"];
  const ofertas = lista(ctx.cfg.offers);
  // Modo "primeira": destino guardado numa pergunta de contexto não vale. Mostra em vez de esconder.
  const ignoradas = comDestino ? [] : opcoes.filter((op) => DE_DESTINO.some((k) => op[k] !== undefined));

  const novaResposta = (): Obj => {
    const idNovo = idLivre("resposta", opcoes.map((o) => o.id));
    return primeira ? { id: idNovo, label: "", offer: String(ofertas[0]?.id ?? "") || undefined, reason: "" } : { id: idNovo, label: "" };
  };

  const selo = primeira ? (decideModo === "primeira" ? "Decide o final" : "Decide se nenhuma outra decidir") : decideModo === "primeira" ? "Contexto" : "Pode decidir o final";

  return (
    <section className={`k-passo${primeira ? " k-decide" : ""}`} aria-label={`${j + 1}ª pergunta`}>
      <div className="k-passo-topo">
        <span className="k-passo-num">{j + 1}ª pergunta</span>
        <span className={`k-selo${primeira ? " k-selo-decide" : ""}`}>{selo}</span>
        <Acoes rotulo={`${j + 1}ª pergunta`} i={j} total={total} onMover={onMover} onRemover={onRemover} podeRemover={total > 1} />
      </div>

      <Campo id={`${id}-q`} rotulo="Pergunta" obrigatorio erro={erro([...caminho, "question"])} largo>
        <input id={`${id}-q`} type="text" value={texto(passo.question)} onChange={(ev) => ctx.set([...caminho, "question"], ev.target.value)} />
      </Campo>

      {primeira && total > 1 && (
        <p className="c-dica">
          {decideModo === "primeira"
            ? "Movendo outra pergunta para o topo, ela passa a decidir o final e pede oferta e explicação em cada resposta."
            : "A 1ª pergunta sempre tem destino e explicação em cada resposta: é o final quando as outras não decidem."}
        </p>
      )}

      {ignoradas.length > 0 && (
        <div className="k-ignorado" role="note">
          <p>
            <strong>Destino ignorado.</strong> {ignoradas.length === 1 ? "Uma resposta desta pergunta tem" : `${ignoradas.length} respostas desta pergunta têm`}{" "}
            para onde levar ou explicação no final, mas com &quot;Só a 1ª pergunta&quot; isso não muda o final:{" "}
            {ignoradas
              .map((op) => {
                const oferta = ofertas.find((o) => String(o.id) === texto(op.offer));
                return `"${texto(op.label) || "sem texto"}"${op.offer !== undefined ? ` leva para ${String(oferta?.title ?? op.offer)}` : ""}`;
              })
              .join("; ")}
            . Para usar, escolha &quot;A última resposta com destino&quot; acima.
          </p>
          <button type="button" className="b b-pequeno" onClick={() => ctx.set(cOpcoes, opcoes.map(soContexto))}>
            Limpar destino destas respostas
          </button>
        </div>
      )}

      <div className="k-respostas" role="list" aria-label={`Respostas da ${j + 1}ª pergunta`}>
        {opcoes.map((op, k) => {
          const c: Caminho = [...cOpcoes, k];
          const semOferta = op.offer === undefined;
          // Fora da 1ª pergunta (modo "ultima"), resposta sem oferta e sem explicação não muda o final.
          const contexto = !primeira && semOferta && op.reason === undefined;
          const valorDestino = contexto ? SO_CONTEXTO : semOferta ? SEM_OFERTA : texto(op.offer);
          const rotuloResposta = texto(op.label) || `resposta ${k + 1}`;
          const mudarDestino = (v: string) => {
            if (v === SO_CONTEXTO) return ctx.set(c, soContexto(op));
            const comMotivo: Obj = { ...op, reason: op.reason ?? "" };
            if (v === SEM_OFERTA) {
              delete comMotivo.offer;
              return ctx.set(c, comMotivo);
            }
            ctx.set(c, { ...comMotivo, offer: v });
          };
          return (
            <div key={k} className="k-resposta" role="listitem">
              <div className="k-linha">
                <Campo id={`${id}-l${k}`} rotulo="Texto da resposta" obrigatorio erro={erro([...c, "label"])}>
                  <input id={`${id}-l${k}`} type="text" value={texto(op.label)} maxLength={40} onChange={(ev) => ctx.set([...c, "label"], ev.target.value)} />
                </Campo>
                <Acoes
                  rotulo={rotuloResposta}
                  i={k}
                  total={opcoes.length}
                  onMover={(d) => ctx.set(cOpcoes, mover(opcoes, k, k + d))}
                  onRemover={() => ctx.set(cOpcoes, opcoes.filter((_, x) => x !== k))}
                  podeRemover={opcoes.length > MIN_RESPOSTAS}
                />
              </div>
              {comDestino && (
                <Campo id={`${id}-o${k}`} rotulo="Leva para" erro={erro([...c, "offer"])}>
                  <select id={`${id}-o${k}`} value={valorDestino} onChange={(ev) => mudarDestino(ev.target.value)}>
                    {!primeira && <option value={SO_CONTEXTO}>Não muda o final (só contexto)</option>}
                    {/* Oferta que não existe mais: sem esta opção o navegador mostraria a primeira da lista como escolhida, e escolhê-la não mudaria nada. */}
                    {!semOferta && !ofertas.some((o) => String(o.id) === texto(op.offer)) && (
                      <option value={texto(op.offer)} disabled>
                        Oferta apagada: escolha outra
                      </option>
                    )}
                    {ofertas.map((o) => (
                      <option key={String(o.id)} value={String(o.id)}>
                        Oferta: {String(o.title ?? o.id)}
                      </option>
                    ))}
                    <option value={SEM_OFERTA}>Conversa no WhatsApp (sem oferta)</option>
                  </select>
                </Campo>
              )}
              {comDestino && !contexto && (
                <Campo id={`${id}-r${k}`} rotulo="Explicação no final" obrigatorio erro={erro([...c, "reason"])} largo>
                  <textarea id={`${id}-r${k}`} rows={2} value={texto(op.reason)} onChange={(ev) => ctx.set([...c, "reason"], ev.target.value)} />
                </Campo>
              )}
              {comDestino && semOferta && !contexto && <ConversaSemOferta op={op} c={c} ctx={ctx} erro={erro} idBase={`${id}-s${k}`} />}
            </div>
          );
        })}
        {erro(cOpcoes) && <p className="c-erro">{erro(cOpcoes)}</p>}
      </div>

      {opcoes.length < MAX_RESPOSTAS ? (
        <button type="button" className="b b-tracejado b-pequeno" onClick={() => ctx.set(cOpcoes, [...opcoes, novaResposta()])}>
          <Icone nome="mais" tamanho={16} />
          Adicionar resposta
        </button>
      ) : (
        <p className="c-dica">Máximo de {MAX_RESPOSTAS} respostas por pergunta.</p>
      )}
    </section>
  );
}

function ConversaSemOferta({ op, c, ctx, erro, idBase }: { op: Obj; c: Caminho; ctx: Ctx; erro: (c: Caminho) => string | undefined; idBase: string }) {
  const campo = (k: string, rotulo: string, padrao: string, longo = false) => (
    <Campo id={`${idBase}-${k}`} rotulo={rotulo} erro={erro([...c, k])} dica={`Vazio, usa o texto de exemplo: "${padrao}".`} largo={longo}>
      {longo ? (
        <textarea id={`${idBase}-${k}`} rows={2} placeholder={padrao} value={texto(op[k])} onChange={(ev) => ctx.set([...c, k], ev.target.value || undefined)} />
      ) : (
        <input id={`${idBase}-${k}`} type="text" placeholder={padrao} value={texto(op[k])} onChange={(ev) => ctx.set([...c, k], ev.target.value || undefined)} />
      )}
    </Campo>
  );
  return (
    <div className="k-conversa">
      <p className="k-conversa-titulo">Final sem oferta: botão para conversar no WhatsApp</p>
      <div className="c-objeto">
        {campo("title", "Título do final", "Vamos conversar")}
        {campo("cta", "Texto do botão", "Falar no WhatsApp")}
        {campo("wa", "Mensagem do WhatsApp", "Oi! Quero entender qual caminho faz sentido pra mim.", true)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- cards */

export function EditorDeCards({ bloco, i, ctx, esquemaOferta }: { bloco: Obj; i: number; ctx: Ctx; esquemaOferta: Esquema }) {
  const cItens: Caminho = ["blocks", i, "items"];
  const itens = (Array.isArray(bloco.items) ? bloco.items : []).map(String);
  const ofertas = lista(ctx.cfg.offers);
  const [aberto, setAberto] = useState<string | null>(null);
  const fora = ofertas.filter((o) => !itens.includes(String(o.id)));
  const erroItens = ctx.erros.get(chaveDe(cItens));

  const criar = () => {
    // Nasce com destino (a oferta exige link ou WhatsApp): a mensagem padrão pode ser trocada depois.
    const nova = {
      ...(vazio(esquemaOferta) as Obj),
      id: idLivre("oferta", ofertas.map((o) => o.id)),
      title: "Nova oferta",
      wa: "Oi! Vim pela bio e quero saber mais sobre esta oferta.",
    };
    ctx.set(["offers"], [...ofertas, nova]);
    ctx.set(cItens, [...itens, nova.id]);
    setAberto(nova.id);
  };

  return (
    <div className="k-cards c-largo">
      <div className="k-cards-topo">
        <span className="c-rotulo">Cards deste bloco</span>
        <p className="c-dica">
          Cada card é uma oferta. Editar aqui muda a oferta em todo lugar, inclusive no concierge. Para apagar uma oferta de vez, use a seção Ofertas.
        </p>
      </div>
      <div className="c-itens">
        {itens.length === 0 && (
          <p className="a-vazio">
            {ofertas.length ? "Nenhum card ainda: inclua uma oferta abaixo." : "Nenhuma oferta ainda: crie uma aqui."} Sem card, o bloco não aparece na página.
          </p>
        )}
        {itens.map((idOferta, k) => {
          const idx = ofertas.findIndex((o) => String(o.id) === idOferta);
          const oferta = ofertas[idx];
          const estaAberto = aberto === idOferta;
          const comErro = idx >= 0 && temErroEm(ctx.erros, ["offers", idx]);
          return (
            <div key={idOferta} className={`c-item${comErro || !oferta ? " c-com-erro" : ""}`} data-caminho={idx >= 0 ? `offers.${idx}` : undefined}>
              <div className="c-item-topo">
                <button type="button" className="c-item-titulo" aria-expanded={estaAberto} disabled={!oferta} onClick={() => setAberto(estaAberto ? null : idOferta)}>
                  <span className={`c-chevron${estaAberto ? " c-aberto" : ""}`}>
                    <Icone nome="seta" tamanho={14} />
                  </span>
                  {oferta ? String(oferta.title || idOferta) : `Oferta "${idOferta}" não existe mais`}
                </button>
                <Acoes
                  rotulo={`card ${oferta ? String(oferta.title || idOferta) : idOferta}`}
                  i={k}
                  total={itens.length}
                  onMover={(d) => ctx.set(cItens, mover(itens, k, k + d))}
                  onRemover={() => ctx.set(cItens, itens.filter((x) => x !== idOferta))}
                />
              </div>
              {estaAberto && oferta && (
                <div className="c-item-corpo">
                  <Objeto e={esquemaOferta} valor={oferta} caminho={["offers", idx]} ctx={ctx} />
                </div>
              )}
            </div>
          );
        })}
        {erroItens && <p className="c-erro">{erroItens}</p>}
      </div>
      <div className="k-cards-mais">
        {fora.length > 0 && <span className="c-dica">Incluir no bloco:</span>}
        {fora.map((o) => (
          <button key={String(o.id)} type="button" className="c-pilula" onClick={() => ctx.set(cItens, [...itens, String(o.id)])}>
            <Icone nome="mais" tamanho={14} />
            {String(o.title || o.id)}
          </button>
        ))}
        <button type="button" className="b b-tracejado b-pequeno" onClick={criar}>
          <Icone nome="mais" tamanho={16} />
          Criar oferta nova
        </button>
      </div>
    </div>
  );
}
