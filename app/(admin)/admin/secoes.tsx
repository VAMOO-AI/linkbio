"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icone } from "./icones";
import { Interruptor, Objeto, temErroEm, type Ctx, type Esquema, type Obj } from "./campos";
import { EditorDeCards, EditorDoConcierge } from "./editores";
import { BLOCOS, resumoDoBloco } from "@/lib/admin/rotulos";
import { idLivre } from "@/lib/admin/normalizar";
import { AJUDA_BLOCO } from "@/lib/admin/ajuda";
import { resumoDaJanela, type Janela } from "@/lib/janela";

export type ModeloResumo = { id: string; nome: string; descricao: string; bg: string; surface: string; text: string; dim: string; ctaBg: string; ctaText: string; accent: string; line: string };
export type Versao = { id: number; created_at: string; created_by: string | null; nota: string | null };
export type ContatoPainel = {
  id: string;
  bloco: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  created_at: string;
};

function fusoDoPainel(cfg: Obj): string {
  const site = cfg.site;
  if (ehSite(site) && typeof site.tz === "string" && site.tz) return site.tz;
  return "America/Sao_Paulo";
}

function ehSite(v: unknown): v is Obj {
  return typeof v === "object" && v !== null;
}

function janelaDoBloco(b: Obj): Janela | undefined {
  const v = b.visivel;
  if (!v || typeof v !== "object") return undefined;
  const o = v as Obj;
  const de = typeof o.de === "string" ? o.de : undefined;
  const ate = typeof o.ate === "string" ? o.ate : undefined;
  if (!de && !ate) return undefined;
  return { de, ate };
}

/** Arraste em andamento: posição de partida, deslocamento e onde o bloco cairia se soltasse agora. */
type Arraste = { de: number; para: number; dy: number; vao: number };

/** Posição nova de um índice depois de tirar o item de `de` e pôr em `para`. */
function posicaoDepois(k: number, de: number, para: number): number {
  if (k === de) return para;
  if (de < para && k > de && k <= para) return k - 1;
  if (de > para && k >= para && k < de) return k + 1;
  return k;
}

export function SecaoBlocos({ ctx, esquema, esquemaOferta, abrir }: { ctx: Ctx; esquema: Esquema; esquemaOferta: Esquema; abrir?: { i: number; vez: number } | null }) {
  const blocos = (Array.isArray(ctx.cfg.blocks) ? ctx.cfg.blocks : []) as Obj[];
  const [aberto, setAberto] = useState<number | null>(abrir?.i ?? null);
  // Tocar num problema da lista "Corrija para publicar" abre o bloco dele (antes só trocava de seção
  // e o leigo tinha de adivinhar qual dos blocos era). `vez` muda a cada toque, mesmo no mesmo bloco.
  const [abrirVisto, setAbrirVisto] = useState(abrir?.vez);
  if (abrir && abrir.vez !== abrirVisto) {
    setAbrirVisto(abrir.vez);
    setAberto(abrir.i);
  }
  const [escolhendo, setEscolhendo] = useState(false);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [arraste, setArraste] = useState<Arraste | null>(null);
  // Frase lida pelo leitor de tela depois de mudar a ordem ("Vídeo agora na posição 3 de 8").
  const [anuncio, setAnuncio] = useState("");
  const idDicaAlca = useId();
  // Bloco recém-adicionado: a lista rola até ele. Sem isso, no celular, o fim da escolha encolhia a
  // página e o bloco novo aparecia pela metade, com o nome escondido atrás do topo grudado.
  const recemAdicionado = useRef<number | null>(null);
  // Depois de mudar a ordem ou fechar o menu, o foco vai para o controle certo na posição nova (as
  // linhas são pela posição: sem isso o foco ficava na linha antiga, agora de outro bloco).
  const focarDepois = useRef<{ i: number; seletor: string } | null>(null);
  const lista = useRef<HTMLOListElement>(null);
  // Medidas do começo do arraste, em coordenadas da página (a página pode rolar no meio).
  const medidas = useRef<{ topo: number; altura: number }[]>([]);
  const inicioY = useRef(0);
  useEffect(() => {
    if (recemAdicionado.current !== null) {
      lista.current?.children[recemAdicionado.current]?.scrollIntoView({ block: "start" });
      recemAdicionado.current = null;
    }
    if (focarDepois.current) {
      lista.current?.children[focarDepois.current.i]?.querySelector<HTMLElement>(focarDepois.current.seletor)?.focus();
      focarDepois.current = null;
    }
  });

  // Menu "..." fecha com clique fora dele (o Esc fica no próprio menu, que devolve o foco ao botão).
  useEffect(() => {
    if (menu === null) return;
    const fora = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest(".s-mais-caixa")) setMenu(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [menu]);

  const ofertas = ((Array.isArray(ctx.cfg.offers) ? ctx.cfg.offers : []) as Obj[]).map((o) => String(o.id));
  const eventos = blocos.flatMap((b) =>
    b.type === "agenda" && Array.isArray(b.items) ? (b.items as Obj[]).map((ev) => (typeof ev?.id === "string" ? ev.id : "")) : [],
  );
  const esquemaDe = (tipo: string) => esquema.oneOf?.find((v) => v.properties?.type?.const === tipo) ?? {};
  const nomeDe = (b: Obj) => BLOCOS[String(b.type)]?.nome ?? String(b.type);

  const mover = (de: number, para: number) => {
    if (de === para || para < 0 || para >= blocos.length) return false;
    const novo = [...blocos];
    const [x] = novo.splice(de, 1);
    novo.splice(para, 0, x!);
    ctx.set(["blocks"], novo);
    // O bloco aberto continua aberto, onde quer que tenha ido parar.
    setAberto(aberto === null ? null : posicaoDepois(aberto, de, para));
    setConfirmar(null);
    setAnuncio(`${nomeDe(blocos[de]!)} agora na posição ${para + 1} de ${blocos.length}.`);
    return true;
  };

  const duplicar = (i: number) => {
    const copia = { ...blocos[i]! };
    if (typeof copia.id === "string") {
      // O id não é obrigatório nem único pelo schema, mas repetido confunde âncora e
      // edição: duplicar o mesmo bloco duas vezes não pode dar dois "x-copia".
      const usados = new Set(blocos.map((x) => x.id));
      let livre = `${copia.id}-copia`;
      for (let n = 2; usados.has(livre); n += 1) livre = `${copia.id}-copia${n}`;
      copia.id = livre;
    }
    if (copia.type === "agenda" && Array.isArray(copia.items)) {
      const usados = [...eventos];
      copia.items = (copia.items as Obj[]).map((ev) => {
        const id = idLivre("evento", usados);
        usados.push(id);
        return { ...ev, id };
      });
    }
    ctx.set(["blocks"], [...blocos.slice(0, i + 1), copia, ...blocos.slice(i + 1)]);
    setAnuncio(`Cópia de ${nomeDe(blocos[i]!)} na posição ${i + 2} de ${blocos.length + 1}.`);
  };

  const fecharMenu = (i: number) => {
    setMenu(null);
    focarDepois.current = { i, seletor: ".s-mais" };
  };

  /** Setas dentro do menu andam entre os itens (os desabilitados ficam de fora); Esc e Tab fecham. */
  const teclaNoMenu = (e: React.KeyboardEvent<HTMLDivElement>, i: number) => {
    const itens = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
    const atual = itens.indexOf(document.activeElement as HTMLButtonElement);
    const ir = (k: number) => itens[(k + itens.length) % itens.length]?.focus();
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fecharMenu(i);
      return;
    }
    if (e.key === "Tab") return setMenu(null);
    const alvo = ({ ArrowDown: atual + 1, ArrowUp: atual - 1, Home: 0, End: itens.length - 1 } as Record<string, number>)[e.key];
    if (alvo === undefined) return;
    e.preventDefault();
    ir(alvo);
  };

  /** Setas na alça (ou Alt + setas em qualquer lugar da linha) sobem e descem o bloco, sem menu. */
  const teclaDeOrdem = (e: React.KeyboardEvent, i: number, seletor: string) => {
    const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    if (mover(i, i + d)) focarDepois.current = { i: i + d, seletor };
  };

  const comecarArraste = (e: React.PointerEvent<HTMLButtonElement>, i: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const itens = [...(lista.current?.children ?? [])];
    medidas.current = itens.map((el) => {
      const r = el.getBoundingClientRect();
      return { topo: r.top + scrollY, altura: r.height };
    });
    inicioY.current = e.clientY + scrollY;
    e.currentTarget.setPointerCapture(e.pointerId);
    setMenu(null);
    setArraste({ de: i, para: i, dy: 0, vao: medidas.current[i]!.altura + 8 });
  };
  const moverArraste = (e: React.PointerEvent) => {
    if (!arraste) return;
    // Perto da borda da janela a página rola junto, para levar o bloco a um lugar fora da tela.
    if (e.clientY < 90) scrollBy(0, -12);
    else if (e.clientY > innerHeight - 40) scrollBy(0, 12);
    const dy = e.clientY + scrollY - inicioY.current;
    const m = medidas.current;
    const centro = m[arraste.de]!.topo + m[arraste.de]!.altura / 2 + dy;
    const para = m.filter((x, k) => k !== arraste.de && x.topo + x.altura / 2 < centro).length;
    setArraste({ ...arraste, dy, para });
  };
  const soltarArraste = () => {
    if (!arraste) return;
    if (Math.abs(arraste.dy) > 4 && mover(arraste.de, arraste.para)) focarDepois.current = { i: arraste.para, seletor: ".s-alca" };
    setArraste(null);
  };
  /** Quanto cada linha se desloca durante o arraste: a arrastada segue o mouse, as outras abrem espaço. */
  const deslocamento = (k: number) => {
    if (!arraste) return undefined;
    if (k === arraste.de) return arraste.dy;
    const nova = posicaoDepois(k, arraste.de, arraste.para);
    return nova === k ? 0 : (nova - k) * arraste.vao;
  };

  return (
    <div className="s-blocos">
      <p id={idDicaAlca} className="sr">
        Arraste para mudar a ordem, ou use as setas para cima e para baixo.
      </p>
      <p className="sr" aria-live="polite">
        {anuncio}
      </p>
      <ol className={`s-lista${arraste ? " s-lista-arrastando" : ""}`} ref={lista}>
        {blocos.map((b, i) => {
          const tipo = String(b.type);
          const info = BLOCOS[tipo];
          const nome = info?.nome ?? tipo;
          const desligado = b.enabled === false;
          const janela = janelaDoBloco(b);
          const marca = resumoDaJanela(janela, new Date(), fusoDoPainel(ctx.cfg));
          const comErro = temErroEm(ctx.erros, ["blocks", i]);
          const dy = deslocamento(i);
          const alternar = () => setAberto(aberto === i ? null : i);
          return (
            <li
              key={i}
              data-caminho={`blocks.${i}`}
              className={`s-bloco${desligado ? " s-desligado" : ""}${comErro ? " c-com-erro" : ""}${aberto === i ? " s-aberto" : ""}${arraste?.de === i ? " s-arrastando" : ""}${menu === i ? " s-com-menu" : ""}`}
              style={dy ? { transform: `translateY(${dy}px)` } : undefined}
            >
              {/* A linha inteira abre e fecha a edição; alça, chave e menu têm a própria ação. */}
              <div
                className="s-bloco-topo"
                onClick={(e) => {
                  if (!(e.target instanceof Element) || !e.target.closest("button, [role=switch], .s-mais-caixa")) alternar();
                }}
                onKeyDown={(e) => {
                  if (e.altKey && e.target instanceof Element && !e.target.closest(".s-menu")) teclaDeOrdem(e, i, e.target.closest(".s-alca") ? ".s-alca" : ".s-bloco-nome");
                }}
              >
                <button
                  type="button"
                  className="s-alca"
                  aria-label={`Mudar a ordem: ${nome}, posição ${i + 1} de ${blocos.length}`}
                  aria-describedby={idDicaAlca}
                  title="Arraste para mudar a ordem (ou use as setas do teclado)"
                  onPointerDown={(e) => comecarArraste(e, i)}
                  onPointerMove={moverArraste}
                  onPointerUp={soltarArraste}
                  onPointerCancel={() => setArraste(null)}
                  onKeyDown={(e) => !e.altKey && teclaDeOrdem(e, i, ".s-alca")}
                >
                  <Icone nome="arrastar" tamanho={16} />
                </button>
                <span className="s-bloco-icone">
                  <Icone nome={tipo} tamanho={18} />
                </span>
                <button type="button" className="s-bloco-nome" aria-expanded={aberto === i} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" onClick={alternar}>
                  <strong>{nome}</strong>
                  <span>
                    {marca && <em className="s-janela">{marca}</em>}
                    {resumoDoBloco(b) || info?.descricao}
                  </span>
                </button>
                {/* Indicador de que a linha abre: sem ele, no computador, nada dizia que o nome era clicável. */}
                <span className="s-bloco-seta" aria-hidden="true">
                  <Icone nome={aberto === i ? "cima" : "baixo"} tamanho={14} />
                </span>
                {comErro && (
                  <span className="s-selo-erro" title="Há campo para corrigir">
                    <Icone nome="alerta" tamanho={16} />
                  </span>
                )}
                <span className="s-bloco-chave">
                  <span className="s-bloco-visivel" aria-hidden="true">
                    {desligado ? "Escondido" : "Na bio"}
                  </span>
                  <Interruptor ligado={!desligado} rotulo={`${nome} ligado`} onChange={(v) => ctx.set(["blocks", i, "enabled"], v ? undefined : false)} />
                </span>
                <div className="s-mais-caixa">
                  <button
                    type="button"
                    className="b-icone s-mais"
                    aria-label={`Mais ações: ${nome}`}
                    title="Mais ações: subir, descer, duplicar, apagar"
                    aria-haspopup="menu"
                    aria-expanded={menu === i}
                    onClick={() => {
                      if (menu === i) return fecharMenu(i);
                      setMenu(i);
                      focarDepois.current = { i, seletor: '.s-menu [role="menuitem"]:not(:disabled)' };
                    }}
                    onKeyDown={(e) => {
                      // Seta para baixo no botão fechado abre o menu, como num menu do sistema.
                      if (e.key === "ArrowDown" && menu !== i) {
                        e.preventDefault();
                        setMenu(i);
                        focarDepois.current = { i, seletor: '.s-menu [role="menuitem"]:not(:disabled)' };
                      }
                    }}
                  >
                    <Icone nome="reticencias" tamanho={18} />
                  </button>
                  {menu === i && (
                    <div className="s-menu" role="menu" aria-label={`Ações do bloco ${nome}`} onKeyDown={(e) => teclaNoMenu(e, i)}>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={i === 0}
                        onClick={() => {
                          mover(i, i - 1);
                          setMenu(null);
                          focarDepois.current = { i: i - 1, seletor: ".s-mais" };
                        }}
                      >
                        <Icone nome="cima" tamanho={16} /> Subir
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={i === blocos.length - 1}
                        onClick={() => {
                          mover(i, i + 1);
                          setMenu(null);
                          focarDepois.current = { i: i + 1, seletor: ".s-mais" };
                        }}
                      >
                        <Icone nome="baixo" tamanho={16} /> Descer
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          duplicar(i);
                          fecharMenu(i);
                        }}
                      >
                        <Icone nome="duplicar" tamanho={16} /> Duplicar
                      </button>
                      <span className="s-menu-fio" role="separator" />
                      <button
                        type="button"
                        role="menuitem"
                        className="s-menu-perigo"
                        onClick={() => {
                          setMenu(null);
                          setConfirmar(i);
                          focarDepois.current = { i, seletor: ".s-confirmar .b-sec" };
                        }}
                      >
                        <Icone nome="lixo" tamanho={16} /> Apagar
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {confirmar === i && (
                <div className="s-confirmar" role="alertdialog" aria-label="Confirmar exclusão">
                  <span>Apagar o bloco &quot;{nome}&quot;? Para só esconder, use a chave ao lado.</span>
                  <button
                    type="button"
                    className="b b-perigo-cheio b-pequeno"
                    onClick={() => {
                      ctx.set(["blocks"], blocos.filter((_, j) => j !== i));
                      setConfirmar(null);
                      setAberto(null);
                      setAnuncio(`Bloco ${nome} apagado.`);
                    }}
                  >
                    Apagar
                  </button>
                  <button type="button" className="b b-sec b-pequeno" onClick={() => {
                      setConfirmar(null);
                      focarDepois.current = { i, seletor: ".s-mais" };
                    }}>
                    Cancelar
                  </button>
                </div>
              )}
              {aberto === i && (
                <div className="s-bloco-corpo">
                  {AJUDA_BLOCO[tipo] && <p className="s-bloco-ajuda">{AJUDA_BLOCO[tipo]}</p>}
                  {/* Cards e concierge têm editor próprio: o genérico escondia o conteúdo (em Ofertas) e a lógica (em cada resposta). */}
                  <Objeto
                    e={esquemaDe(tipo)}
                    valor={b}
                    caminho={["blocks", i]}
                    ctx={ctx}
                    esconder={["type", "enabled", "mode", ...(tipo === "cards" ? ["items"] : tipo === "concierge" ? ["flow", "decide"] : [])]}
                    extra={
                      tipo === "cards" ? (
                        <EditorDeCards bloco={b} i={i} ctx={ctx} esquemaOferta={esquemaOferta} />
                      ) : tipo === "concierge" ? (
                        <div className="c-largo">
                          <EditorDoConcierge bloco={b} i={i} ctx={ctx} />
                        </div>
                      ) : undefined
                    }
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {escolhendo ? (
        <div className="s-escolha" role="dialog" aria-label="Escolher bloco">
          <div className="s-escolha-topo">
            <div>
              <strong>Adicionar bloco</strong>
              <p className="c-dica">O bloco novo entra no fim da bio. Depois, use o menu ··· (Subir e Descer) ou, no computador, arraste pela alça para levar ao lugar certo.</p>
            </div>
            <button type="button" className="b-icone" aria-label="Fechar" onClick={() => setEscolhendo(false)}>
              <Icone nome="fechar" tamanho={16} />
            </button>
          </div>
          <div className="s-escolha-grade">
            {Object.entries(BLOCOS).map(([t, info]) => (
              <button
                key={t}
                type="button"
                className="s-opcao"
                onClick={() => {
                  ctx.set(["blocks"], [...blocos, info.novo({ ofertas, eventos })]);
                  setAberto(blocos.length);
                  setEscolhendo(false);
                  recemAdicionado.current = blocos.length;
                }}
              >
                <span className="s-bloco-icone">
                  <Icone nome={t} tamanho={18} />
                </span>
                <strong>{info.nome}</strong>
                <span>{info.descricao}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" className="b b-tracejado b-largo" onClick={() => setEscolhendo(true)}>
          <Icone nome="mais" tamanho={16} />
          Adicionar bloco
        </button>
      )}
    </div>
  );
}

export function GaleriaDeModelos({ ctx, modelos }: { ctx: Ctx; modelos: ModeloResumo[] }) {
  const tema = (ctx.cfg.theme ?? {}) as Obj;
  const atual = String(tema.preset ?? "neutro").replace(/^neutro-(claro|escuro)$/, "neutro");
  return (
    <div className="s-modelos" role="radiogroup" aria-label="Modelo">
      {modelos.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={m.id === atual} className="s-modelo" onClick={() => ctx.set(["theme", "preset"], m.id)}>
          <span className="s-miniatura" style={{ background: m.bg }} aria-hidden="true">
            <span className="s-mini-avatar" style={{ background: m.accent }} />
            <span className="s-mini-linha" style={{ background: m.text }} />
            <span className="s-mini-linha s-curta" style={{ background: m.dim }} />
            <span className="s-mini-botao" style={{ background: m.ctaBg }} />
            <span className="s-mini-card" style={{ background: m.surface, borderColor: m.line }}>
              <span style={{ background: m.accent }} />
            </span>
          </span>
          <span className="s-modelo-texto">
            <strong>
              {m.nome}
              {m.id === atual && <Icone nome="ok" tamanho={14} />}
            </strong>
            <span>{m.descricao}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function SecaoVersoes({ versoes, restaurar, ocupado }: { versoes: Versao[]; restaurar: (id: number | "arquivo") => void; ocupado: boolean }) {
  const [confirmar, setConfirmar] = useState<number | "arquivo" | null>(null);
  if (!versoes.length) return <p className="c-dica">Nenhuma versão publicada ainda. Até o primeiro Publicar, a bio no ar mostra o conteúdo inicial; depois dele, dá para voltar a esse conteúdo aqui.</p>;
  return (
    <ol className="s-versoes">
      {versoes.map((v, i) => (
        <li key={v.id} className={i === 0 ? "s-no-ar" : undefined}>
          <span className="s-versao-marca" aria-hidden="true" />
          <div className="s-versao-texto">
            <strong>
              Versão {v.id}
              {i === 0 && <span className="s-selo">No ar</span>}
            </strong>
            <span>
              {new Date(v.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {v.created_by ?? "?"}
              {v.nota && ` · ${v.nota}`}
            </span>
          </div>
          {i > 0 &&
            (confirmar === v.id ? (
              <span className="s-versao-acoes">
                <button type="button" className="b b-primario b-pequeno" disabled={ocupado} onClick={() => restaurar(v.id)}>
                  Voltar a esta
                </button>
                <button type="button" className="b b-sec b-pequeno" onClick={() => setConfirmar(null)}>
                  Cancelar
                </button>
              </span>
            ) : (
              <button type="button" className="b b-sec b-pequeno" onClick={() => setConfirmar(v.id)}>
                Restaurar
              </button>
            ))}
        </li>
      ))}
      {/* A origem de tudo: o linkbio.config.ts. Restaurar publica o conteúdo dele como versão nova. */}
      <li className="s-versao-arquivo">
        <span className="s-versao-marca" aria-hidden="true" />
        <div className="s-versao-texto">
          <strong>Arquivo original</strong>
          <span>O conteúdo inicial da bio, de antes da primeira publicação pelo painel</span>
        </div>
        {confirmar === "arquivo" ? (
          <span className="s-versao-acoes">
            <button type="button" className="b b-primario b-pequeno" disabled={ocupado} onClick={() => restaurar("arquivo")}>
              Voltar ao arquivo
            </button>
            <button type="button" className="b b-sec b-pequeno" onClick={() => setConfirmar(null)}>
              Cancelar
            </button>
          </span>
        ) : (
          <button type="button" className="b b-sec b-pequeno" onClick={() => setConfirmar("arquivo")}>
            Restaurar
          </button>
        )}
      </li>
    </ol>
  );
}

export function SecaoResultados({
  ligado,
  noAr,
  erro,
  botoes,
  origens,
  links,
  onLigar,
}: {
  ligado: boolean;
  noAr: boolean;
  erro: boolean;
  botoes: { nome: string; dias7: number; dias30: number }[];
  origens: { rotulo: string; dias7: number; dias30: number }[];
  links: { rotulo: string; url: string }[];
  onLigar: (v: boolean) => void;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);
  return (
    <div className="r-resultados">
      <div className="r-ligar">
        <Interruptor ligado={ligado} rotulo="Contar cliques" onChange={onLigar} />
        <span>Contar cliques</span>
      </div>
      {!ligado && !noAr && (
        <p className="r-nota">A contagem está desligada. Ligue Contar cliques e toque em Publicar para ver quais botões as pessoas tocam.</p>
      )}
      {ligado && !noAr && <p className="r-nota">A contagem está ligada aqui, mas ainda não foi publicada. Toque em Publicar para valer na bio.</p>}
      {noAr && !ligado && <p className="r-nota">A contagem ainda está no ar. Toque em Publicar para desligar.</p>}
      {erro && <p className="r-nota">Não consegui ler os cliques agora. Tente de novo em instantes.</p>}
      {noAr && !erro && botoes.length === 0 && (
        <p className="r-nota">Ainda não há cliques. Use um dos links abaixo no Instagram e espere a primeira visita.</p>
      )}
      {noAr && !erro && botoes.length > 0 && (
        <>
          <h2 className="a-subtitulo">Por botão</h2>
          <div className="r-tabela-rola">
            <table className="r-tabela">
              <thead>
                <tr>
                  <th>Botão</th>
                  <th>7 dias</th>
                  <th>30 dias</th>
                </tr>
              </thead>
              <tbody>
                {botoes.map((b, i) => (
                  <tr key={`${b.nome}-${i}`}>
                    <td>{b.nome}</td>
                    <td>{b.dias7}</td>
                    <td>{b.dias30}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 className="a-subtitulo">De onde vieram</h2>
          <div className="r-tabela-rola">
            <table className="r-tabela">
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>7 dias</th>
                  <th>30 dias</th>
                </tr>
              </thead>
              <tbody>
                {origens.map((o) => (
                  <tr key={o.rotulo}>
                    <td>{o.rotulo}</td>
                    <td>{o.dias7}</td>
                    <td>{o.dias30}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <h2 className="a-subtitulo">Links para copiar</h2>
      <p className="c-dica">Coloque cada um no lugar certo do Instagram. Assim dá para ver de onde a pessoa veio.</p>
      <ul className="r-links">
        {links.map((l) => (
          <li key={l.rotulo} className="r-link">
            <span>
              <strong>{l.rotulo}</strong>
              <code>{l.url}</code>
            </span>
            <button
              type="button"
              className="b b-sec b-pequeno"
              onClick={() => {
                navigator.clipboard.writeText(l.url).then(
                  () => setCopiado(l.url),
                  () => setCopiado(null),
                );
              }}
            >
              {copiado === l.url ? "Copiado" : "Copiar"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function quando(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Últimos contatos gravados pelo formulário. A planilha baixa pela rota protegida. */
export function SecaoContatos({ contatos, erro }: { contatos: ContatoPainel[]; erro: boolean }) {
  return (
    <div className="s-contatos">
      <p>
        <a className="b b-sec a-baixar" href="/admin/contatos">
          Baixar planilha (CSV)
        </a>
      </p>
      {erro && <p className="a-vazio">Não foi possível carregar os contatos agora. Recarregue a página em instantes.</p>}
      {!erro && contatos.length === 0 && <p className="a-vazio">Ainda não chegou nenhum contato. Quando alguém enviar o formulário, o nome aparece aqui.</p>}
      {contatos.length > 0 && (
        <table className="a-contatos">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Nome</th>
              <th>WhatsApp</th>
              <th>E-mail</th>
              <th>Formulário</th>
            </tr>
          </thead>
          <tbody>
            {contatos.map((c) => (
              <tr key={c.id}>
                <td>{quando(c.created_at)}</td>
                <td>{c.nome}</td>
                <td>{c.whatsapp || "—"}</td>
                <td>{c.email || "—"}</td>
                <td>{c.bloco}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

    </div>
  );
}
