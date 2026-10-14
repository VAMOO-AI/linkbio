"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { acaoDescartar, acaoRascunho, acaoRestaurar, acaoRestaurarArquivo, acaoSair, acaoSalvar } from "./acoes";
import { Icone } from "./icones";
import { FALTA_PREENCHER, Objeto, Valor, chaveDe, ehObj, rotulo, type Caminho, type Ctx, type Esquema, type Obj, type Opcoes } from "./campos";
import { GaleriaDeModelos, SecaoBlocos, SecaoContatos, SecaoResultados, SecaoVersoes, type ContatoPainel, type ModeloResumo, type Versao } from "./secoes";
import { Previa } from "./previa";
import { PreviaCompartilhar } from "./previa-compartilhar";
import { usePreviaFoco } from "./previa-foco";
import { BLOCOS } from "@/lib/admin/rotulos";
import { AJUDA_SECAO } from "@/lib/admin/ajuda";
import { acompanharCantos, acompanharModelo, acompanharReferencias } from "@/lib/admin/referencias";
import { linksDeOrigem, type TotalBotao, type TotalOrigem } from "@/lib/cliques";

type Problema = { caminho: string; mensagem: string };
type Estado = "igual" | "salvando" | "rascunho" | "invalido" | "erro";
/** "pendente": só falta preencher item novo, ainda sem tocar nem tentar publicar (não é erro à vista). */
type EstadoVisivel = Estado | "pendente";

const SECOES = [
  { id: "blocos", nome: "Blocos", icone: "blocos" },
  { id: "perfil", nome: "Perfil", icone: "perfil" },
  { id: "aparencia", nome: "Aparência", icone: "aparencia" },
  { id: "ofertas", nome: "Ofertas", icone: "ofertas" },
  { id: "vitrine", nome: "Vitrine", icone: "vitrine" },
  { id: "contato", nome: "Contato e site", icone: "contato" },
  { id: "resultados", nome: "Resultados", icone: "resultados" },
  { id: "contatos", nome: "Contatos", icone: "contatos" },
  { id: "versoes", nome: "Versões", icone: "versoes" },
] as const;
type IdSecao = (typeof SECOES)[number]["id"];

function definir(raiz: unknown, caminho: (string | number)[], valor: unknown): unknown {
  if (caminho.length === 0) return valor;
  const [cab, ...resto] = caminho;
  if (typeof cab === "number") {
    const arr = Array.isArray(raiz) ? [...raiz] : [];
    arr[cab] = definir(arr[cab], resto, valor);
    return arr;
  }
  const obj: Obj = ehObj(raiz) ? { ...raiz } : {};
  const novo = definir(obj[cab!], resto, valor);
  if (novo === undefined) delete obj[cab!];
  else obj[cab!] = novo;
  return obj;
}

function secaoDoCaminho(c: string): IdSecao {
  const raiz = c.split(".")[0] ?? "";
  if (raiz === "features") return c.startsWith("features.analytics") ? "resultados" : "contato";
  const mapa: Record<string, IdSecao> = { blocks: "blocos", profile: "perfil", theme: "aparencia", offers: "ofertas", catalog: "vitrine", contact: "contato", site: "contato" };
  return mapa[raiz] ?? "blocos";
}

function nomeDoCaminho(c: string, cfg: Obj): string {
  const nomes: string[] = [];
  let atual: unknown = cfg;
  for (const p of c.split(".")) {
    const i = Number(p);
    if (Number.isInteger(i) && Array.isArray(atual)) {
      const el = atual[i];
      // Bloco pelo tipo; oferta, produto e demais itens pelo título, que é o que a pessoa reconhece.
      const titulo = ehObj(el) ? [el.title, el.name, el.label, el.question, el.q, el.rotulo].find((x) => typeof x === "string" && x.trim()) : undefined;
      nomes.push(ehObj(el) && typeof el.type === "string" ? (BLOCOS[el.type]?.nome ?? el.type) : typeof titulo === "string" ? `"${titulo}"` : `item ${i + 1}`);
      atual = el;
    } else {
      nomes.push(rotulo(p));
      atual = ehObj(atual) ? atual[p] : undefined;
    }
  }
  return nomes.join(" › ");
}

/** Fecha a prévia desfazendo a entrada que ela pôs no histórico (o `popstate` fecha); sem ela, fecha direto. */
function sairDaPrevia(fechar: () => void) {
  if ((history.state as { previa?: boolean } | null)?.previa) history.back();
  else fechar();
}

function valorEm(raiz: unknown, caminho: Caminho): unknown {
  let atual = raiz;
  for (const p of caminho) atual = Array.isArray(atual) ? atual[Number(p)] : ehObj(atual) ? atual[p] : undefined;
  return atual;
}

/**
 * Campo de texto sem nada ainda (inclusive o "https://" com que o link novo nasce), ou obrigatório
 * ausente: falta preencher, não é erro de quem digitou. Mensagens que explicam outra coisa (ex.: "a
 * vitrine precisa de produtos") ficam como estão.
 */
function faltaPreencher(cfg: Obj, p: Problema): boolean {
  if (!p.caminho) return false;
  const v = valorEm(cfg, p.caminho.split("."));
  if (typeof v === "string") return /^(https?:\/\/)?$/.test(v.trim());
  return v === undefined && /obrigat/i.test(p.mensagem);
}

/** Tem `prefixo` como começo de caminho ("blocks.3" vale para "blocks.3.url", não para "blocks.31"). */
const dentroDe = (c: string, prefixo: string) => c === prefixo || c.startsWith(`${prefixo}.`);

/**
 * Uma lista mudou (item novo, apagado, ordem trocada): os caminhos guardados que apontam para itens
 * dela seguem o item para a posição nova, pela identidade do objeto (mover e apagar não copiam o item).
 * Item que sumiu leva junto os caminhos dele.
 */
function seguirItens(conjunto: Set<string>, base: string, antes: unknown[], depois: unknown[]): Set<string> {
  const novo = new Set<string>();
  for (const c of conjunto) {
    if (!dentroDe(c, base) || c === base) {
      novo.add(c);
      continue;
    }
    const resto = c.slice(base.length + 1).split(".");
    const j = depois.indexOf(antes[Number(resto[0])]);
    if (j >= 0) novo.add([base, j, ...resto.slice(1)].join("."));
  }
  return novo;
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function Editor({
  inicial,
  publicada,
  rascunhoEm,
  schema,
  opcoes,
  modelos,
  versoes,
  email,
  cliques,
  contatos,
  contatosErro,
}: {
  inicial: Obj;
  publicada: Obj;
  rascunhoEm: string | null;
  schema: Esquema;
  opcoes: Opcoes;
  modelos: ModeloResumo[];
  versoes: Versao[];
  email: string;
  cliques: { erro: boolean; botoes: TotalBotao[]; origens: TotalOrigem[] };
  contatos: ContatoPainel[];
  contatosErro: boolean;
}) {
  const [cfg, setCfg] = useState<Obj>(inicial);
  const [base, setBase] = useState<string>(() => JSON.stringify(publicada));
  const [secao, setSecao] = useState<IdSecao>("blocos");
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [estado, setEstado] = useState<Estado>(rascunhoEm && JSON.stringify(inicial) !== JSON.stringify(publicada) ? "rascunho" : "igual");
  const [salvoEm, setSalvoEm] = useState<string | null>(rascunhoEm);
  const [aviso, setAviso] = useState("");
  const [ocupado, start] = useTransition();
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  // Bloco, oferta ou item criado agora nasce com campo obrigatório vazio: o erro dele só aparece
  // depois que a pessoa sai do campo (`tocados`) ou tenta publicar (`tentou`). A validação não muda.
  const [novos, setNovos] = useState<Set<string>>(() => new Set());
  const [tocados, setTocados] = useState<Set<string>>(() => new Set());
  const [tentou, setTentou] = useState(false);
  const [previaAberta, setPreviaAberta] = useState(false);
  // Problema tocado na lista "Corrija para publicar": abre a seção, o bloco (se for um) e rola até o campo.
  const [irPara, setIrPara] = useState<{ caminho: string; vez: number } | null>(null);
  const vezesIrPara = useRef(0);
  // Último conteúdo enviado como rascunho: só salva de novo quando algo realmente mudou.
  const enviado = useRef(JSON.stringify(inicial));

  const diferente = JSON.stringify(cfg) !== base;

  // Rascunho automático 600 ms depois da última edição. A prévia é ao vivo e não espera por ele.
  useEffect(() => {
    const atualJson = JSON.stringify(cfg);
    if (atualJson === enviado.current) return;
    setEstado("salvando");
    const t = setTimeout(async () => {
      const r = await acaoRascunho(cfg);
      enviado.current = atualJson;
      if (r.ok) {
        setProblemas([]);
        // Tudo válido: o que era novo deixa de ser (um campo apagado depois disso é erro de verdade).
        setNovos(new Set());
        setTocados(new Set());
        setTentou(false);
        setSalvoEm(r.em);
        setEstado(JSON.stringify(cfg) === base ? "igual" : "rascunho");
      } else {
        setProblemas(r.problemas);
        setEstado(r.problemas.some((p) => p.caminho) ? "invalido" : "erro");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [cfg, base]);

  // No celular, trocar de app ou bloquear a tela antes dos 600 ms perderia a última edição:
  // ao esconder a página, salva o rascunho na hora (o efeito acima ainda confirma o estado depois).
  const cfgAtual = useRef(cfg);
  useEffect(() => {
    cfgAtual.current = cfg;
  }, [cfg]);
  useEffect(() => {
    const salvarJa = () => {
      const json = JSON.stringify(cfgAtual.current);
      if (json === enviado.current) return;
      enviado.current = json;
      void acaoRascunho(cfgAtual.current);
    };
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "hidden") salvarJa();
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("pagehide", salvarJa);
    return () => {
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("pagehide", salvarJa);
    };
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(""), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const pendente = (p: Problema) => !tentou && !!p.caminho && !tocados.has(p.caminho) && [...novos].some((n) => dentroDe(p.caminho, n));
  const visiveis = problemas.filter((p) => !pendente(p));
  const faltam = problemas.length - visiveis.length;
  const falta = (p: Problema) => faltaPreencher(cfg, p);
  const erros = new Map(visiveis.map((p) => [p.caminho, falta(p) ? FALTA_PREENCHER : p.mensagem]));
  // Oferta ou produto apagado (ou com identificador trocado): os blocos que apontavam para ele acompanham.
  const ctx: Ctx = {
    set: (c, v) => {
      // Lista que ainda não existia (ex.: o primeiro produto de uma bio sem vitrine) conta como vazia.
      const velho = valorEm(cfg, c);
      const antes = Array.isArray(velho) ? velho : velho === undefined ? [] : null;
      if (Array.isArray(v) && antes) {
        const base = chaveDe(c);
        setTocados((s) => seguirItens(s, base, antes, v));
        setNovos((s) => {
          const n = seguirItens(s, base, antes, v);
          // Item que não existia antes, numa lista que cresceu: é novo.
          if (v.length > antes.length) v.forEach((x, j) => !antes.includes(x) && n.add(`${base}.${j}`));
          return n;
        });
      }
      setCfg((prev) => acompanharModelo(prev, acompanharCantos(prev, acompanharReferencias(prev, definir(prev, c, v) as Obj))));
    },
    opcoes,
    cfg,
    erros,
  };
  // Saiu de um campo: o erro dele (se houver) passa a aparecer.
  const aoSairDeCampo = (e: React.FocusEvent) => {
    const k = e.target instanceof Element ? e.target.closest("[data-caminho]")?.getAttribute("data-caminho") : null;
    if (k) setTocados((s) => (s.has(k) ? s : new Set(s).add(k)));
  };

  function irParaProblema(caminho: string) {
    setSecao(secaoDoCaminho(caminho));
    vezesIrPara.current += 1;
    setIrPara({ caminho, vez: vezesIrPara.current });
  }
  // Depois de abrir a seção (e o bloco), leva a tela até o primeiro campo marcado em vermelho.
  useEffect(() => {
    if (!irPara) return;
    const t = setTimeout(() => {
      // O campo em si; se ele estiver dentro de um item fechado, o item.
      const alvo = document.querySelector(".a-cartao :is(.c-campo, .c-linha-switch).c-com-erro") ?? document.querySelector(".a-cartao .c-com-erro");
      alvo?.scrollIntoView({ block: "center" });
      alvo?.querySelector<HTMLElement>("input, textarea, select")?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [irPara]);
  const blocoDoProblema = irPara && /^blocks\.(\d+)/.exec(irPara.caminho);

  function publicar() {
    // Só falta preencher o item novo: o Publicar mostra a lista do que falta, em vez de publicar.
    if (estado === "invalido") {
      setTentou(true);
      scrollTo({ top: 0 });
      return;
    }
    if (!diferente) return;
    start(async () => {
      const r = await acaoSalvar(cfg);
      if (r.ok) {
        // Publicar já limpa o rascunho no banco: o que está na tela não precisa ir de novo como rascunho.
        enviado.current = JSON.stringify(cfg);
        setBase(JSON.stringify(cfg));
        setProblemas([]);
        setEstado("igual");
        setAviso(`Publicado. A bio já mostra a versão ${r.versao}.`);
      } else {
        setProblemas(r.problemas);
        setEstado("invalido");
        setTentou(true);
        if (r.problemas[0]?.caminho) setSecao(secaoDoCaminho(r.problemas[0].caminho));
      }
    });
  }

  function descartar() {
    start(async () => {
      await acaoDescartar();
      window.location.reload();
    });
  }

  function restaurar(id: number | "arquivo") {
    start(async () => {
      const r = id === "arquivo" ? await acaoRestaurarArquivo() : await acaoRestaurar(id);
      if (r.ok) window.location.reload();
      else setAviso(r.problemas[0]?.mensagem ?? "Não foi possível restaurar.");
    });
  }

  // Publicar não espera o rascunho: no celular a pessoa digita e toca direto em Publicar, e com o botão
  // travado em "Salvando rascunho..." o toque se perdia em silêncio. Se um rascunho que já estava a
  // caminho responder depois da publicação, o selo não volta a dizer "não publicado".
  const estadoVisivel: EstadoVisivel = estado === "rascunho" && !diferente ? "igual" : estado === "invalido" && !visiveis.length ? "pendente" : estado;
  const campos = (n: number) => `${n} ${n === 1 ? "campo" : "campos"}`;

  const textoEstado: Record<EstadoVisivel, string> = {
    igual: "Tudo publicado",
    salvando: "Salvando rascunho...",
    rascunho: `Rascunho salvo${salvoEm ? ` às ${hora(salvoEm)}` : ""}, não publicado`,
    invalido: `${visiveis.length} ${visiveis.length === 1 ? "campo para corrigir" : "campos para corrigir"}`,
    pendente: `Falta preencher ${campos(faltam)}`,
    erro: problemas[0]?.mensagem ?? "Erro ao salvar",
  };

  // A barra de abas do celular gruda logo abaixo do topo, que muda de altura quando quebra linha.
  const app = useRef<HTMLDivElement>(null);
  const topo = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = topo.current;
    if (!el) return;
    // Altura exata (com fração): `offsetHeight` arredonda e deixava meia linha de fresta entre topo e abas.
    const medir = () => app.current?.style.setProperty("--altura-topo", `${el.getBoundingClientRect().height}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Digitando no celular, o teclado ocupa metade da tela e o topo + abas grudados, mais de um terço: o
  // campo sumia atrás deles. Com um campo em foco eles rolam com a página (CSS em `.a-digitando`).
  // A volta espera um pouco: ao tocar em Publicar direto de um campo, o topo não muda de lugar no meio
  // do toque (senão o toque cai fora do botão).
  const [digitando, setDigitando] = useState(false);
  useEffect(() => {
    const el = app.current;
    if (!el) return;
    const ehCampo = (x: EventTarget | null) =>
      x instanceof HTMLElement && x.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]), textarea, select');
    let t: ReturnType<typeof setTimeout> | undefined;
    const entrou = (e: FocusEvent) => {
      clearTimeout(t);
      if (ehCampo(e.target)) setDigitando(true);
    };
    const saiu = () => {
      clearTimeout(t);
      t = setTimeout(() => setDigitando(ehCampo(document.activeElement)), 400);
    };
    el.addEventListener("focusin", entrou);
    el.addEventListener("focusout", saiu);
    return () => {
      clearTimeout(t);
      el.removeEventListener("focusin", entrou);
      el.removeEventListener("focusout", saiu);
    };
  }, []);

  // Prévia no celular é uma tela por cima: abrir põe uma entrada no histórico, e o voltar do Android
  // (ou do navegador) fecha a prévia em vez de sair do painel. Fechar pelo botão ou pelo Esc desfaz a
  // entrada, para o voltar seguinte ser o de sempre. Com a prévia fechada, o histórico fica intocado.
  const abrirPrevia = () => {
    setPreviaAberta(true);
    history.pushState({ previa: true }, "");
  };
  const fecharPrevia = () => sairDaPrevia(() => setPreviaAberta(false));
  useEffect(() => {
    if (!previaAberta) return;
    const aoVoltar = () => setPreviaAberta(false);
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") sairDaPrevia(() => setPreviaAberta(false));
    };
    addEventListener("popstate", aoVoltar);
    addEventListener("keydown", aoTeclar);
    return () => {
      removeEventListener("popstate", aoVoltar);
      removeEventListener("keydown", aoTeclar);
    };
  }, [previaAberta]);

  // A prévia segue a edição: abrir um bloco (ou oferta, produto) ou focar um campo dele rola a prévia até ele.
  const conteudo = useRef<HTMLElement>(null);
  const foco = usePreviaFoco(conteudo, cfg);

  const atual = SECOES.find((s) => s.id === secao)!;
  const props = schema.properties ?? {};

  return (
    <div className={`a-app${digitando ? " a-digitando" : ""}`} ref={app} onBlur={aoSairDeCampo}>
      <header className="a-topo" ref={topo}>
        <div className="a-marca">
          <strong>Painel da bio</strong>
          <span className="a-marca-links">
            <a href="/" target="_blank" rel="noopener" className="a-link-bio">
              Ver bio no ar <Icone nome="externo" tamanho={14} />
            </a>
            {/* No celular o menu lateral (com o Sair do rodapé) vira barra de abas: o Sair mora aqui. */}
            <form action={acaoSair} className="a-sair-topo">
              <button type="submit" className="a-link-bio">
                <Icone nome="sair" tamanho={14} /> Sair
              </button>
            </form>
          </span>
        </div>
        <div className="a-topo-acoes">
          <span className={`a-estado a-estado-${estadoVisivel}`} role="status">
            <Icone nome={estadoVisivel === "invalido" || estadoVisivel === "erro" || estadoVisivel === "pendente" ? "alerta" : "ok"} tamanho={14} />
            {textoEstado[estadoVisivel]}
          </span>
          {diferente &&
            (confirmarDescarte ? (
              <span className="a-confirmar" role="alertdialog" aria-label="Confirmar descarte">
                <span className="a-confirmar-texto">Voltar tudo ao que está no ar?</span>
                <button type="button" className="b b-sec b-pequeno" onClick={() => setConfirmarDescarte(false)}>
                  Cancelar
                </button>
                <button type="button" className="b b-perigo-cheio b-pequeno" onClick={descartar} disabled={ocupado}>
                  Descartar
                </button>
              </span>
            ) : (
              <button type="button" className="b b-sec" title="Apaga o rascunho e volta ao que está no ar" onClick={() => setConfirmarDescarte(true)}>
                Descartar
              </button>
            ))}
          {/* "Nada para publicar" fica em aria-disabled, não em disabled: campo que só grava ao sair (preço,
              link) muda a página no mesmo toque que sai dele, e um botão disabled nesse instante engolia o toque. */}
          <button
            type="button"
            className="b b-primario"
            onClick={publicar}
            disabled={ocupado || (estado === "invalido" && faltam === 0)}
            aria-disabled={!diferente || undefined}
            title={
              faltam > 0
                ? "Falta preencher: clique para ver o quê"
                : estado === "invalido"
                  ? "Corrija os campos marcados para publicar"
                  : !diferente
                    ? "Nada novo para publicar"
                    : "Coloca o rascunho no ar"
            }
          >
            {ocupado ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </header>

      <div className="a-corpo">
        <nav className="a-menu" aria-label="Seções">
          {SECOES.map((s) => {
            const comErro = s.id !== "versoes" && visiveis.some((p) => p.caminho && secaoDoCaminho(p.caminho) === s.id);
            return (
              <button key={s.id} type="button" aria-current={s.id === secao ? "page" : undefined} onClick={() => { setSecao(s.id); setIrPara(null); }}>
                <Icone nome={s.icone} />
                <span>{s.nome}</span>
                {comErro && <span className="a-ponto-erro" aria-label="com erro" />}
              </button>
            );
          })}
          <form action={acaoSair} className="a-menu-rodape">
            <span title={email}>{email}</span>
            <button type="submit" className="b b-fantasma b-pequeno">
              <Icone nome="sair" tamanho={14} /> Sair
            </button>
          </form>
        </nav>

        <main className="a-conteudo" ref={conteudo}>
          <div className="a-cabecalho">
            <h1>{atual.nome}</h1>
            <p>{AJUDA_SECAO[atual.id]}</p>
          </div>

          {visiveis.length > 0 && estado !== "salvando" && (
            <div className="a-problemas" role="alert">
              <strong>
                <Icone nome="alerta" tamanho={16} /> {visiveis.every(falta) ? "Falta preencher para publicar" : "Corrija para publicar"}
              </strong>
              <ul>
                {visiveis.map((p, i) => (
                  <li key={i}>
                    {p.caminho && (
                      <button type="button" className="b-link" onClick={() => irParaProblema(p.caminho)}>
                        {nomeDoCaminho(p.caminho, cfg)}
                      </button>
                    )}
                    {p.caminho ? ": " : ""}
                    {falta(p) ? "falta preencher" : p.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="a-cartao">
            {secao === "blocos" && (
              <SecaoBlocos
                ctx={ctx}
                esquema={props.blocks?.items ?? {}}
                esquemaOferta={props.offers?.items ?? {}}
                abrir={blocoDoProblema ? { i: Number(blocoDoProblema[1]), vez: irPara!.vez } : null}
              />
            )}
            {secao === "perfil" && <Objeto e={props.profile ?? {}} valor={cfg.profile} caminho={["profile"]} ctx={ctx} />}
            {secao === "aparencia" && (
              <>
                <h2 className="a-subtitulo">Modelo</h2>
                <GaleriaDeModelos ctx={ctx} modelos={modelos} />
                <h2 className="a-subtitulo">Ajustes finos</h2>
                <Objeto e={props.theme ?? {}} valor={cfg.theme} caminho={["theme"]} ctx={ctx} esconder={["preset"]} />
              </>
            )}
            {secao === "ofertas" && !(Array.isArray(cfg.offers) && cfg.offers.length) && (
              <p className="a-vazio">Nenhuma oferta ainda: crie uma aqui. Depois, ela entra num bloco Ofertas ou numa resposta do Concierge.</p>
            )}
            {secao === "ofertas" && <Valor e={props.offers ?? {}} valor={cfg.offers} caminho={["offers"]} chave="offers" ctx={ctx} obrigatorio />}
            {secao === "vitrine" && !(Array.isArray(cfg.catalog) && cfg.catalog.length) && (
              <p className="a-vazio">Nenhum produto ainda: crie um aqui. Depois, ele aparece na bio pelo bloco Vitrine.</p>
            )}
            {secao === "vitrine" && <Valor e={props.catalog ?? {}} valor={cfg.catalog} caminho={["catalog"]} chave="catalog" ctx={ctx} obrigatorio />}
            {secao === "contato" && (
              <>
                <Objeto e={props.contact ?? {}} valor={cfg.contact} caminho={["contact"]} ctx={ctx} />
                <h2 className="a-subtitulo">Site</h2>
                {/* A prévia do link fica logo depois da Capa ao compartilhar, antes do Avançado. */}
                <Objeto e={props.site ?? {}} valor={cfg.site} caminho={["site"]} ctx={ctx} extra={<PreviaCompartilhar cfg={cfg} noAr={base} />} />
                <h2 className="a-subtitulo">Medição de visitas</h2>
                <p className="c-dica">Opcional. A bio só carrega o Pixel ou o Google depois que a pessoa aceitar o aviso de cookies.</p>
                <Objeto
                  e={props.features?.properties?.pixel ?? {}}
                  valor={ehObj(cfg.features) && ehObj((cfg.features as Obj).pixel) ? (cfg.features as Obj).pixel : {}}
                  caminho={["features", "pixel"]}
                  ctx={ctx}
                />
              </>
            )}
            {secao === "resultados" && (
              <SecaoResultados
                ligado={ehObj(cfg.features) && cfg.features.analytics === true}
                noAr={(() => {
                  try {
                    const publicadaAgora = JSON.parse(base) as Obj;
                    return ehObj(publicadaAgora.features) && publicadaAgora.features.analytics === true;
                  } catch {
                    return false;
                  }
                })()}
                erro={cliques.erro}
                botoes={cliques.botoes}
                origens={cliques.origens}
                links={linksDeOrigem(ehObj(cfg.site) && typeof cfg.site.url === "string" ? cfg.site.url : "")}
                onLigar={(v) => ctx.set(["features", "analytics"], v)}
              />
            )}
            {secao === "contatos" && <SecaoContatos contatos={contatos} erro={contatosErro} />}
            {secao === "versoes" && <SecaoVersoes versoes={versoes} restaurar={restaurar} ocupado={ocupado} />}
          </div>
        </main>

        <aside className={`a-previa${previaAberta ? " a-previa-aberta" : ""}`} aria-label="Prévia">
          <button type="button" className="b b-sec a-fechar-previa" onClick={fecharPrevia}>
            <Icone nome="fechar" tamanho={16} /> Fechar prévia
          </button>
          <Previa config={cfg} foco={foco} aberta={previaAberta} estado={diferente ? "Com as suas alterações, ainda não publicadas" : "Igual ao que está no ar"} />
        </aside>
      </div>

      <button type="button" className="b b-primario a-botao-previa" onClick={abrirPrevia}>
        <Icone nome="olho" tamanho={16} /> Ver prévia
      </button>
      {aviso && (
        <div className="a-toast" role="status">
          <Icone nome="ok" tamanho={16} /> {aviso}
        </div>
      )}
    </div>
  );
}
