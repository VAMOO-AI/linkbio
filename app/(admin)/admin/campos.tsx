"use client";

import { useId, useRef, useState, useTransition } from "react";
import { acaoEnviarImagem } from "./acoes";
import { reduzirImagem } from "@/lib/admin/reduzir-imagem";
import { Icone } from "./icones";
import { ERRO_IMAGEM_GRANDE, TAMANHO_MAX_IMAGEM, TAMANHO_MAX_IMAGEM_ROTULO } from "@/lib/admin/limites";
import { AVANCADO, CAMPOS, COMPARTILHAR, CONCIERGE_OPCAO, DICAS, GRUPOS, IMAGEM, NOVO_ITEM, PREFIXO_ID, TEXTO_LONGO, VALORES } from "@/lib/admin/rotulos";
import { DICA_POR_LUGAR, ITEM_SINGULAR } from "@/lib/admin/ajuda";
import { formatarPreco, idDoYoutube, idLivre, lerPreco, normalizarArroba, normalizarChavePix, normalizarCupom, normalizarTxid, normalizarUrl, normalizarWhatsapp } from "@/lib/admin/normalizar";
import { janelaCoerente } from "@/lib/janela";

/** Pedaço de JSON Schema gerado do ConfigSchema (z.toJSONSchema), só o que o editor usa. */
export type Esquema = {
  type?: string;
  properties?: Record<string, Esquema>;
  required?: string[];
  items?: Esquema;
  enum?: string[];
  oneOf?: Esquema[];
  anyOf?: Esquema[];
  const?: unknown;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
};
export type Caminho = (string | number)[];
export type Obj = Record<string, unknown>;
export type Opcoes = Record<string, Record<string, { rotulo: string; descricao: string }>>;

export type Ctx = {
  set: (c: Caminho, v: unknown) => void;
  opcoes: Opcoes;
  cfg: Obj;
  erros: Map<string, string>;
};

export const ehObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
export const chaveDe = (c: Caminho) => c.map(String).join(".");
/**
 * Há erro neste caminho ou dentro dele? Compara com o ponto no fim: sem ele, o erro do bloco 14
 * ("blocks.14.videoId") acendia também o bloco 1 ("blocks.1"), e o leigo ia corrigir o bloco errado.
 */
export const temErroEm = (erros: Map<string, string>, c: Caminho) => {
  const k = chaveDe(c);
  return [...erros.keys()].some((x) => x === k || x.startsWith(`${k}.`));
};
/**
 * Mensagem de campo obrigatório ainda vazio. Não é erro de quem digitou: a dica do campo continua
 * visível embaixo dela, e a lista do topo diz "falta preencher".
 */
export const FALTA_PREENCHER = "Falta preencher.";
export const rotulo = (chave: string | number) => (typeof chave === "number" ? `Item ${chave + 1}` : (CAMPOS[chave] ?? chave));

/** Valor inicial de um item novo, a partir do schema. */
export function vazio(e: Esquema): unknown {
  const v = e.oneOf?.[0] ?? e.anyOf?.[0] ?? e;
  if (v.type === "object") {
    const o: Obj = {};
    for (const k of v.required ?? []) o[k] = vazio(v.properties?.[k] ?? {});
    return o;
  }
  if (v.type === "array") return [];
  if (v.type === "boolean") return false;
  if (v.type === "integer" || v.type === "number") return 0;
  if (v.enum?.length) return v.enum[0];
  return "";
}

/** Nome e descrição de um valor de enum: do catálogo config/opcoes.ts ou do dicionário VALORES. */
export function infoDoValor(opcoes: Opcoes, lista: string[], valor: string): { nome: string; descricao?: string } {
  for (const grupo of Object.values(opcoes)) {
    const chaves = Object.keys(grupo);
    if (lista.every((v) => chaves.includes(v)) && grupo[valor]) return { nome: grupo[valor].rotulo, descricao: grupo[valor].descricao };
  }
  return { nome: VALORES[valor] ?? valor.charAt(0).toUpperCase() + valor.slice(1) };
}

/** Rótulo + dica + erro em volta de um controle. */
export function Campo({
  rotulo: texto,
  dica,
  erro,
  obrigatorio,
  children,
  id,
  largo,
  caminho,
  rotuloOculto,
}: {
  rotulo: string;
  dica?: string;
  erro?: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
  id?: string;
  largo?: boolean;
  /** Caminho na config: o editor usa para saber de qual campo a pessoa saiu (erro só depois disso). */
  caminho?: string;
  /** O título do grupo já diz o nome do campo: o rótulo fica só para leitor de tela. */
  rotuloOculto?: boolean;
}) {
  return (
    <div className={`c-campo${erro ? " c-com-erro" : ""}${largo ? " c-largo" : ""}`} data-caminho={caminho}>
      <label className={rotuloOculto ? "c-rotulo sr" : "c-rotulo"} htmlFor={id}>
        {texto}
        {obrigatorio && <span className="c-obrig" aria-label="obrigatório">*</span>}
      </label>
      {children}
      {dica && (!erro || erro === FALTA_PREENCHER) && <p className="c-dica">{dica}</p>}
      {erro && (
        <p className="c-erro">
          <Icone nome="alerta" tamanho={14} />
          {erro}
        </p>
      )}
    </div>
  );
}

export function Interruptor({ ligado, onChange, rotulo: texto, id }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string; id?: string }) {
  return (
    <button type="button" id={id} role="switch" aria-checked={ligado} aria-label={texto} className="c-switch" onClick={() => onChange(!ligado)}>
      <span className="c-switch-bola" />
    </button>
  );
}

function Segmentado({ valores, valor, onChange, opcoes, id, permitirPadrao, nome }: { valores: string[]; valor: string; onChange: (v: string) => void; opcoes: Opcoes; id: string; permitirPadrao: boolean; nome: string }) {
  // O <label for> não nomeia um radiogroup: sem aria-label o leitor de tela anuncia só "grupo".
  return (
    <div className="c-seg" role="radiogroup" id={id} aria-label={nome}>
      {permitirPadrao && (
        <button type="button" role="radio" aria-checked={valor === ""} className="c-seg-op" onClick={() => onChange("")}>
          Padrão
        </button>
      )}
      {valores.map((v) => (
        <button key={v} type="button" role="radio" aria-checked={valor === v} className="c-seg-op" onClick={() => onChange(v)}>
          {infoDoValor(opcoes, valores, v).nome}
        </button>
      ))}
    </div>
  );
}

/** Tira o item da posição `de` e põe em `para`. */
export function mover<T>(itens: T[], de: number, para: number): T[] {
  const novo = [...itens];
  const [x] = novo.splice(de, 1);
  novo.splice(para, 0, x!);
  return novo;
}

function Etiquetas({ valor, onChange, id, max }: { valor: string[]; onChange: (v: string[]) => void; id: string; max?: number }) {
  const [texto, setTexto] = useState("");
  const adicionar = () => {
    const t = texto.trim();
    if (!t || valor.includes(t) || (max !== undefined && valor.length >= max)) return;
    onChange([...valor, t]);
    setTexto("");
  };
  return (
    <div className="c-etiquetas">
      {valor.map((t, i) => (
        <span key={`${t}-${i}`} className="c-etiqueta">
          {/* Mudar a ordem: a etiqueta troca de lugar com a vizinha, como o Subir/Descer das outras listas. */}
          {valor.length > 1 && (
            <button type="button" className="c-etiqueta-mover" aria-label={`Mover ${t} para antes`} disabled={i === 0} onClick={() => onChange(mover(valor, i, i - 1))}>
              <Icone nome="esquerda" tamanho={12} />
            </button>
          )}
          {t}
          {valor.length > 1 && (
            <button type="button" className="c-etiqueta-mover" aria-label={`Mover ${t} para depois`} disabled={i === valor.length - 1} onClick={() => onChange(mover(valor, i, i + 1))}>
              <Icone nome="seta" tamanho={12} />
            </button>
          )}
          <button type="button" aria-label={`Remover ${t}`} onClick={() => onChange(valor.filter((_, j) => j !== i))}>
            <Icone nome="fechar" tamanho={12} />
          </button>
        </span>
      ))}
      {(max === undefined || valor.length < max) && (
        <input
          id={id}
          className="c-etiqueta-input"
          value={texto}
          placeholder="Digite e tecle Enter"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              adicionar();
            }
          }}
          onBlur={adicionar}
        />
      )}
    </div>
  );
}

export function CampoImagem({ valor, onChange, id }: { valor: string; onChange: (v: string | undefined) => void; id: string }) {
  const [enviando, start] = useTransition();
  const [erro, setErro] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const enviar = (original: File) => {
    setErro("");
    start(async () => {
      // Acima do limite o pedido nem chega à Server Action (o Next e a Vercel cortam antes): a foto é
      // reduzida aqui; o que não dá para reduzir (GIF, arquivo que não é imagem) é recusado com o motivo.
      const f = original.size > TAMANHO_MAX_IMAGEM ? await reduzirImagem(original, TAMANHO_MAX_IMAGEM) : original;
      if (!f) {
        setErro(ERRO_IMAGEM_GRANDE);
        return;
      }
      const dados = new FormData();
      dados.set("arquivo", f);
      try {
        const r = await acaoEnviarImagem(dados);
        if (r.ok) onChange(r.url);
        else setErro(r.erro);
      } catch {
        setErro("Não foi possível enviar a imagem agora. Tente de novo em instantes.");
      }
    });
  };
  return (
    <div
      className={`c-imagem${arrastando ? " c-arrastando" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        const f = e.dataTransfer.files?.[0];
        if (f) enviar(f);
      }}
    >
      <div className="c-imagem-previa">
        {valor ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura no painel, fora da página pública
          <img src={valor} alt="" />
        ) : (
          <Icone nome="imagem" tamanho={22} />
        )}
      </div>
      <div className="c-imagem-acoes">
        <div className="c-imagem-botoes">
          <button type="button" className="b b-sec" onClick={() => input.current?.click()} disabled={enviando}>
            {enviando ? "Enviando..." : valor ? "Trocar imagem" : "Enviar imagem"}
          </button>
          {valor && (
            <button type="button" className="b b-fantasma" onClick={() => onChange(undefined)}>
              Remover
            </button>
          )}
        </div>
        <p className="c-dica">Arraste a imagem aqui. JPG, PNG, WebP ou GIF. Foto acima de {TAMANHO_MAX_IMAGEM_ROTULO} é reduzida sozinha (GIF, só até {TAMANHO_MAX_IMAGEM_ROTULO}).</p>
        <input id={id} className="c-imagem-url" type="text" value={valor} onChange={(e) => onChange(e.target.value || undefined)} placeholder="ou cole um link / caminho" />
        {erro && <p className="c-erro">{erro}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) enviar(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * Preço em reais, guardado em centavos. Aceita "R$ 1.290,50", "1290,50" e "1290.50". O que não dá
 * para entender fica no campo com o aviso, em vez de sumir em silêncio (ou virar outro valor).
 */
function Preco({ valor, onChange, id }: { valor: number | undefined; onChange: (v: number | undefined) => void; id: string }) {
  const txt = valor === undefined ? "" : formatarPreco(valor);
  const [erro, setErro] = useState("");
  return (
    <>
      <div className="c-prefixo">
        <span>R$</span>
        <input
          id={id}
          key={txt}
          type="text"
          inputMode="decimal"
          defaultValue={txt}
          placeholder="0,00"
          aria-invalid={erro ? true : undefined}
          onBlur={(e) => {
            const n = lerPreco(e.target.value);
            if (n === null) {
              setErro("Não entendi este preço. Escreva só o valor em reais, ex.: 1.290,50.");
              return;
            }
            setErro("");
            onChange(n);
            // Mesmo valor de antes (a `key` não muda): mostra o formato padrão.
            e.target.value = n === undefined ? "" : formatarPreco(n);
          }}
        />
      </div>
      {erro && (
        <p className="c-erro" role="alert">
          <Icone nome="alerta" tamanho={14} />
          {erro}
        </p>
      )}
    </>
  );
}

/** De/até com o calendário do aparelho. Vazio nos dois tira a janela (o bloco fica sempre no ar). */
function CampoJanela({
  valor,
  onChange,
  erro,
  caminho,
  dica,
}: {
  valor: unknown;
  onChange: (v: unknown) => void;
  erro?: string;
  caminho: string;
  dica?: string;
}) {
  const obj = ehObj(valor) ? valor : {};
  const de = typeof obj.de === "string" ? obj.de : "";
  const ate = typeof obj.ate === "string" ? obj.ate : "";
  const gravar = (proxDe: string, proxAte: string) => {
    const v: Obj = {};
    if (proxDe) v.de = proxDe;
    if (proxAte) v.ate = proxAte;
    onChange(Object.keys(v).length ? v : undefined);
  };
  const soData = (v: string) => (v.includes("T") ? v.slice(0, 10) : v);
  const trocado = Boolean(de && ate && !janelaCoerente({ de, ate }));
  return (
    <fieldset className="c-janela" data-caminho={caminho}>
      <legend>Mostrar só entre datas</legend>
      {dica && <p className="c-dica">{dica}</p>}
      <div className="c-janela-datas">
        <label>
          De
          <input type="date" aria-label="Mostrar a partir de" value={soData(de)} onChange={(e) => gravar(e.target.value, ate)} />
        </label>
        <label>
          Até
          <input type="date" aria-label="Mostrar até" value={soData(ate)} onChange={(e) => gravar(de, e.target.value)} />
        </label>
      </div>
      {trocado && <p className="c-erro">O início é depois do fim. Troque uma das datas.</p>}
      {erro && !trocado && (
        <p className="c-erro" role="alert">
          {erro}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Campo de texto de uma linha. Alguns campos consertam o que o leigo cola ou digita:
 * link do YouTube vira o código do vídeo, WhatsApp perde os símbolos e ganha o 55, link sem
 * https ganha o https, cupom vira maiúsculo, @ do perfil ganha o @. Data usa o calendário do aparelho.
 */
function Texto({ chave, valor, onChange, id }: { chave: string | number; valor: string; onChange: (v: string) => void; id: string }) {
  if (chave === "expires" || chave === "date") return <input id={id} type="date" value={valor} onChange={(ev) => onChange(ev.target.value)} />;
  if (chave === "time") return <input id={id} type="time" value={valor} onChange={(ev) => onChange(ev.target.value)} />;
  const aoDigitar = chave === "videoId" ? idDoYoutube : chave === "code" ? normalizarCupom : (v: string) => v;
  const aoSair =
    chave === "whatsapp"
      ? normalizarWhatsapp
      : chave === "chave"
        ? normalizarChavePix
        : chave === "txid"
          ? normalizarTxid
          : chave === "url" || chave === "more_url"
            ? normalizarUrl
            : chave === "handle"
              ? normalizarArroba
              : undefined;
  const modo = chave === "whatsapp" ? "tel" : chave === "url" || chave === "more_url" ? "url" : undefined;
  return (
    <input
      id={id}
      type="text"
      inputMode={modo}
      autoCapitalize={chave === "code" ? "characters" : undefined}
      value={valor}
      onChange={(ev) => onChange(aoDigitar(ev.target.value))}
      onBlur={aoSair ? (ev) => { const n = aoSair(ev.target.value); if (n !== ev.target.value) onChange(n); } : undefined}
    />
  );
}

function Cor({ valor, onChange, id, permitirVazio }: { valor: string; onChange: (v: string | undefined) => void; id: string; permitirVazio: boolean }) {
  return (
    <div className="c-cor">
      <label className="c-cor-amostra" style={{ background: /^#[0-9a-f]{6}$/i.test(valor) ? valor : "transparent" }}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(valor) ? valor : "#000000"} onChange={(e) => onChange(e.target.value)} aria-label="Escolher cor" />
      </label>
      <input id={id} type="text" value={valor} onChange={(e) => onChange(e.target.value || undefined)} placeholder={permitirVazio ? "Cor do modelo" : "#000000"} />
      {permitirVazio && valor && (
        <button type="button" className="b b-fantasma" onClick={() => onChange(undefined)}>
          Usar a do modelo
        </button>
      )}
    </div>
  );
}

/**
 * Lista de ids (products → catálogo) como pílulas de marcar. Com dois ou mais marcados, a ordem em
 * que aparecem na página ganha Subir/Descer logo abaixo.
 */
function ListaDeIds({ valor, onChange, fonte, vazioSignificaTudo }: { valor: string[]; onChange: (v: string[] | undefined) => void; fonte: Obj[]; vazioSignificaTudo: boolean }) {
  if (!fonte.length) return <p className="c-dica">Nada cadastrado ainda.</p>;
  const nomeDe = (id: string) => String(fonte.find((o) => String(o.id) === id)?.title ?? id);
  return (
    <div className="c-lista-ids">
      <div className="c-pilulas">
        {fonte.map((o) => {
          const id = String(o.id);
          const marcado = valor.includes(id);
          return (
            <button
              key={id}
              type="button"
              className="c-pilula"
              aria-pressed={marcado}
              onClick={() => {
                const novo = marcado ? valor.filter((x) => x !== id) : [...valor, id];
                onChange(novo.length || !vazioSignificaTudo ? novo : undefined);
              }}
            >
              {marcado && <Icone nome="ok" tamanho={14} />}
              {String(o.title ?? id)}
            </button>
          );
        })}
      </div>
      {valor.length > 1 && <p className="c-dica c-ordem-titulo">Ordem na vitrine (use as setas para mudar):</p>}
      {valor.length > 1 && (
        <ol className="c-ordem" aria-label="Ordem na vitrine">
          {valor.map((id, i) => (
            <li key={id}>
              <span>{nomeDe(id)}</span>
              <span className="c-item-acoes">
                <button type="button" className="b-icone" aria-label={`Subir ${nomeDe(id)}`} disabled={i === 0} onClick={() => onChange(mover(valor, i, i - 1))}>
                  <Icone nome="cima" tamanho={16} />
                </button>
                <button type="button" className="b-icone" aria-label={`Descer ${nomeDe(id)}`} disabled={i === valor.length - 1} onClick={() => onChange(mover(valor, i, i + 1))}>
                  <Icone nome="baixo" tamanho={16} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function tituloDoItem(v: unknown, i: number): string {
  if (!ehObj(v)) return `Item ${i + 1}`;
  // Resposta do concierge: o nome na lista é o texto da resposta, não o título do final (sem oferta).
  if ("reason" in v && typeof v.label === "string" && v.label.trim()) return v.label;
  for (const k of ["title", "name", "q", "label", "question", "rotulo", "alt", "id"]) {
    const x = v[k];
    if (typeof x === "string" && x.trim()) return x;
  }
  return `Item ${i + 1}`;
}

/**
 * Pergunta antes de apagar o que dá trabalho refazer (oferta, produto, depoimento). Os outros itens
 * saem na hora, e o Descartar do topo ainda recupera o que foi apagado sem publicar.
 */
function perguntaAoApagar(caminho: Caminho, cfg: Obj, v: unknown, i: number): string | undefined {
  const titulo = tituloDoItem(v, i);
  if (caminho.length === 1 && caminho[0] === "offers") return `Apagar a oferta "${titulo}"? Ela sai também dos cards.`;
  if (caminho.length === 1 && caminho[0] === "catalog") return `Apagar o produto "${titulo}"? Ele sai também das vitrines.`;
  const bloco = caminho[0] === "blocks" && caminho[2] === "items" ? (cfg.blocks as Obj[] | undefined)?.[caminho[1] as number] : undefined;
  if (bloco?.type === "testimonials") {
    const nome = ehObj(v) && typeof v.name === "string" ? v.name.trim() : "";
    return nome ? `Apagar o depoimento de ${nome}?` : "Apagar este depoimento?";
  }
  return undefined;
}

/** Segunda linha do item fechado: preço e categoria de oferta e produto, para achar sem abrir. */
function resumoDoItem(caminho: Caminho, v: unknown): string {
  if (!ehObj(v) || caminho.length !== 1 || (caminho[0] !== "offers" && caminho[0] !== "catalog")) return "";
  const partes: string[] = [];
  if (typeof v.price_label === "string" && v.price_label.trim()) partes.push(v.price_label.trim());
  else if (typeof v.price_cents === "number") partes.push(v.price_cents === 0 ? "Grátis" : `R$ ${formatarPreco(v.price_cents)}`);
  if (typeof v.category === "string" && v.category.trim()) partes.push(v.category.trim());
  return partes.join(" · ");
}

/** "Adicionar oferta", "Adicionar rede", "Adicionar depoimento": o nome do item, no singular. */
function nomeDoNovo(caminho: Caminho, chave: string | number, cfg: Obj): string {
  if (typeof chave !== "string") return "item";
  if (chave === "items" && caminho[0] === "blocks") {
    const tipo = (cfg.blocks as Obj[] | undefined)?.[caminho[1] as number]?.type;
    const nome = ITEM_SINGULAR[`items:${String(tipo)}`];
    if (nome) return nome;
  }
  return ITEM_SINGULAR[chave] ?? rotulo(chave).toLowerCase();
}

function ListaDeObjetos({ e, valor, caminho, chave, ctx }: { e: Esquema; valor: unknown[]; caminho: Caminho; chave: string | number; ctx: Ctx }) {
  const item = e.items ?? {};
  const [abertos, setAbertos] = useState<Set<number>>(() => new Set(valor.length <= 2 ? valor.map((_, i) => i) : []));
  const [confirmar, setConfirmar] = useState<number | null>(null);
  const apagar = (i: number) => {
    ctx.set(caminho, valor.filter((_, j) => j !== i));
    setConfirmar(null);
    // Os de baixo sobem uma posição: o que estava aberto continua aberto.
    setAbertos((s) => new Set([...s].filter((j) => j !== i).map((j) => (j > i ? j - 1 : j))));
  };
  const mover = (i: number, d: number) => {
    const novo = [...valor];
    const [x] = novo.splice(i, 1);
    novo.splice(i + d, 0, x);
    ctx.set(caminho, novo);
    setAbertos(new Set());
    setConfirmar(null);
  };
  const cheio = e.maxItems !== undefined && valor.length >= e.maxItems;
  return (
    <div className="c-itens">
      {valor.map((v, i) => {
        const aberto = abertos.has(i);
        const comErro = temErroEm(ctx.erros, [...caminho, i]);
        const resumo = resumoDoItem(caminho, v);
        const pergunta = perguntaAoApagar(caminho, ctx.cfg, v, i);
        return (
          <div key={i} className={`c-item${comErro ? " c-com-erro" : ""}`} data-caminho={[...caminho, i].join(".")}>
            <div className="c-item-topo">
              <button
                type="button"
                className="c-item-titulo"
                aria-expanded={aberto}
                onClick={() => setAbertos((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
              >
                <span className={`c-chevron${aberto ? " c-aberto" : ""}`}>
                  <Icone nome="seta" tamanho={14} />
                </span>
                <span className="c-item-nome">{tituloDoItem(v, i)}</span>
                {resumo && <span className="c-item-resumo">{resumo}</span>}
              </button>
              <div className="c-item-acoes">
                <button type="button" className="b-icone" aria-label="Subir" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>
                  <Icone nome="cima" tamanho={16} />
                </button>
                <button type="button" className="b-icone" aria-label="Descer" title="Descer" disabled={i === valor.length - 1} onClick={() => mover(i, 1)}>
                  <Icone nome="baixo" tamanho={16} />
                </button>
                <button type="button" className="b-icone b-perigo" aria-label="Remover" title="Remover" onClick={() => (pergunta ? setConfirmar(i) : apagar(i))}>
                  <Icone nome="lixo" tamanho={16} />
                </button>
              </div>
            </div>
            {confirmar === i && pergunta && (
              <div className="s-confirmar" role="alertdialog" aria-label="Confirmar exclusão">
                <span>{pergunta}</span>
                <button type="button" className="b b-perigo-cheio b-pequeno" onClick={() => apagar(i)}>
                  Apagar
                </button>
                <button type="button" className="b b-sec b-pequeno" onClick={() => setConfirmar(null)}>
                  Cancelar
                </button>
              </div>
            )}
            {aberto && (
              <div className="c-item-corpo">
                <Valor e={item} valor={v} caminho={[...caminho, i]} chave={i} ctx={ctx} obrigatorio />
              </div>
            )}
          </div>
        );
      })}
      {!cheio && (
        <button
          type="button"
          className="b b-tracejado"
          onClick={() => {
            const bloco = caminho[0] === "blocks" ? (ctx.cfg.blocks as Obj[] | undefined)?.[caminho[1] as number] : undefined;
            let novo: unknown =
              typeof chave === "string" && NOVO_ITEM[chave]
                ? NOVO_ITEM[chave](idLivre(PREFIXO_ID[chave] ?? "item", valor.map((x) => (ehObj(x) ? x.id : undefined))))
                : vazio(item);
            if (ehObj(novo) && bloco?.type === "agenda" && chave === "items") {
              const usados = ((ctx.cfg.blocks as Obj[] | undefined) ?? []).flatMap((b) =>
                b?.type === "agenda" && Array.isArray(b.items) ? (b.items as Obj[]).map((ev) => ev.id) : [],
              );
              novo = { id: idLivre("evento", usados), title: "Encontro", date: "2099-12-31" };
            }
            ctx.set(caminho, [...valor, novo]);
            setAbertos((s) => new Set([...s, valor.length]));
          }}
        >
          <Icone nome="mais" tamanho={16} />
          Adicionar {nomeDoNovo(caminho, chave, ctx.cfg)}
        </button>
      )}
    </div>
  );
}

/** Campos de um objeto; os de AVANCADO vão para uma área recolhida. */
export function Objeto({ e, valor, caminho, ctx, esconder = [], extra }: { e: Esquema; valor: unknown; caminho: Caminho; ctx: Ctx; esconder?: string[]; extra?: React.ReactNode }) {
  const obj = ehObj(valor) ? valor : {};
  const req = new Set(e.required ?? []);
  const naTheme = caminho[0] === "theme";
  const todos = Object.entries(e.properties ?? {}).filter(([k]) => !esconder.includes(k));
  const avancado = (k: string) => AVANCADO.has(k) && !(naTheme && k === "mode");
  const normais = todos.filter(([k]) => !avancado(k));
  const extras = todos.filter(([k]) => avancado(k));
  const extrasComErro = extras.some(([k]) => temErroEm(ctx.erros, [...caminho, k]));
  const campo = ([k, sub]: [string, Esquema], rotuloOculto?: boolean) => (
    <Valor key={k} e={sub} valor={obj[k]} caminho={[...caminho, k]} chave={k} ctx={ctx} obrigatorio={req.has(k)} comRotulo rotuloOculto={rotuloOculto} />
  );
  // Oferta e produto (itens da raiz, onde quer que sejam editados): campos em grupos com título.
  const grupos = caminho.length === 2 && typeof caminho[0] === "string" ? GRUPOS[caminho[0]] : undefined;
  const agrupados = new Set(grupos?.flatMap((g) => g.campos));
  return (
    <div className="c-objeto" data-caminho={caminho.join(".")}>
      {grupos
        ? [
            ...grupos.map((g) => {
              const deles = normais.filter(([k]) => g.campos.includes(k));
              if (!deles.length) return null;
              // Grupo de um campo só com o mesmo nome (Capa, Foto): o título já diz, o rótulo sai da tela.
              const soUm = deles.length === 1 && rotulo(deles[0]![0]) === g.titulo;
              return (
                <fieldset key={g.titulo} className="c-secao">
                  <legend className="c-secao-titulo">{g.titulo}</legend>
                  {g.dica && <p className="c-dica c-secao-dica">{g.dica}</p>}
                  <div className="c-objeto">{deles.map((x) => campo(x, soUm))}</div>
                </fieldset>
              );
            }),
            ...normais.filter(([k]) => !agrupados.has(k)).map((x) => campo(x)),
          ]
        : normais.map((x) => campo(x))}
      {extra}
      {extras.length > 0 && (
        <details className="c-avancado" open={extrasComErro}>
          <summary>Avançado</summary>
          <div className="c-objeto">
            {extras.map(([k, sub]) => (
              <Valor key={k} e={sub} valor={obj[k]} caminho={[...caminho, k]} chave={k} ctx={ctx} obrigatorio={req.has(k)} comRotulo />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** Qualquer valor da config, decidido pelo schema. */
export function Valor({
  e,
  valor,
  caminho,
  chave,
  ctx,
  obrigatorio,
  comRotulo,
  rotuloOculto,
}: {
  e: Esquema;
  valor: unknown;
  caminho: Caminho;
  chave: string | number;
  ctx: Ctx;
  obrigatorio: boolean;
  comRotulo?: boolean;
  rotuloOculto?: boolean;
}) {
  const id = useId();
  const set = (v: unknown) => ctx.set(caminho, v);
  const erro = ctx.erros.get(chaveDe(caminho));
  // Dentro de uma resposta do concierge (flow[].options[]), os campos ganham nome e dica próprios.
  const naResposta =
    typeof chave !== "string" ? undefined : caminho.includes("options") ? CONCIERGE_OPCAO[chave] : caminho[1] === "share" ? COMPARTILHAR[chave] : undefined;
  const tipoBloco = caminho[0] === "blocks" && typeof caminho[1] === "number" ? (ctx.cfg.blocks as Obj[] | undefined)?.[caminho[1]]?.type : undefined;
  const nomeAgenda =
    tipoBloco === "agenda" && chave === "description"
      ? "Descrição"
      : tipoBloco === "agenda" && chave === "url"
        ? "Link para agendar"
        : undefined;
  const nome = nomeAgenda ?? naResposta?.nome ?? (chave === "body" && caminho.includes("font") ? "Fonte do texto" : rotulo(chave));
  const lugar = caminho.filter((p) => typeof p === "string").join(".");
  const dica = naResposta?.dica ?? DICA_POR_LUGAR[lugar] ?? (typeof chave === "string" ? DICAS[chave] : undefined);
  if (chave === "visivel") {
    return <CampoJanela valor={valor} onChange={set} erro={erro} caminho={chaveDe(caminho)} dica={dica} />;
  }
  const naAparencia = caminho[0] === "theme";
  let esquema = e;
  let seletor: React.ReactNode = null;

  if (e.oneOf) {
    // União de objetos com chaves diferentes (ex.: { wa } ou { url }): a chave presente escolhe a variante.
    const vs = e.oneOf;
    const atual = ehObj(valor) ? Object.keys(valor) : [];
    const idx = Math.max(0, vs.findIndex((v) => (v.required ?? []).every((r) => atual.includes(r))));
    esquema = vs[idx] ?? vs[0]!;
    if (vs.every((v) => v.type === "object" && !v.properties?.type)) {
      seletor = (
        <div className="c-seg" role="radiogroup" aria-label={nome}>
          {vs.map((v, i) => (
            <button key={i} type="button" role="radio" aria-checked={i === idx} className="c-seg-op" onClick={() => i !== idx && set(vazio(v))}>
              {(v.required ?? []).map((r) => (r === "wa" ? "WhatsApp" : r === "url" ? "Link" : rotulo(r))).join(", ")}
            </button>
          ))}
        </div>
      );
    }
  } else if (e.anyOf) {
    const objeto = e.anyOf.find((v) => v.type === "object");
    const lista = e.anyOf.find((v) => v.enum);
    esquema = ehObj(valor) && objeto ? objeto : (lista ?? e.anyOf[0]!);
    // Fonte: uma para tudo, ou uma para os títulos e outra para o texto (antes só pelo arquivo).
    if (chave === "font" && objeto && lista?.enum?.length) {
      const opcoesFonte = lista.enum;
      const separado = ehObj(valor);
      const umaSo = typeof valor === "string" && opcoesFonte.includes(valor) ? valor : opcoesFonte[0]!;
      seletor = (
        <div className="c-seg" role="radiogroup" aria-label="Como usar a fonte">
          <button type="button" role="radio" aria-checked={!separado} className="c-seg-op" onClick={() => separado && set((valor as Obj).display)}>
            Uma fonte para tudo
          </button>
          <button type="button" role="radio" aria-checked={separado} className="c-seg-op" onClick={() => !separado && set({ display: umaSo, body: umaSo })}>
            Títulos e texto separados
          </button>
        </div>
      );
    }
  }

  let controle: React.ReactNode;
  let largo = false;
  if (esquema.type === "object") {
    if (valor === undefined && !obrigatorio) {
      controle = (
        <button type="button" className="b b-tracejado" onClick={() => set(vazio(esquema))}>
          <Icone nome="mais" tamanho={16} />
          Adicionar {nome.toLowerCase()}
        </button>
      );
    } else {
      controle = (
        <div className="c-grupo">
          <Objeto e={esquema} valor={valor} caminho={caminho} ctx={ctx} />
          {!obrigatorio && (
            <button type="button" className="b b-fantasma b-pequeno" onClick={() => set(undefined)}>
              Remover {nome.toLowerCase()}
            </button>
          )}
        </div>
      );
    }
    largo = true;
  } else if (esquema.type === "array") {
    const itens = Array.isArray(valor) ? valor : [];
    const item = esquema.items ?? {};
    const bloco = caminho[0] === "blocks" ? ((ctx.cfg.blocks as Obj[] | undefined)?.[caminho[1] as number] ?? {}) : {};
    if (chave === "items" && (bloco.type === "cards" || bloco.type === "products")) {
      const origem = bloco.type === "cards" ? "offers" : "catalog";
      controle = (
        <ListaDeIds
          valor={itens as string[]}
          onChange={set}
          fonte={(Array.isArray(ctx.cfg[origem]) ? ctx.cfg[origem] : []) as Obj[]}
          vazioSignificaTudo={bloco.type === "products"}
        />
      );
    } else if (item.type === "string" && !item.enum) {
      controle = <Etiquetas valor={itens as string[]} onChange={set} id={id} max={esquema.maxItems} />;
    } else {
      controle = <ListaDeObjetos e={esquema} valor={itens} caminho={caminho} chave={chave} ctx={ctx} />;
      largo = true;
    }
  } else if (esquema.type === "boolean") {
    return (
      <div className={`c-linha-switch${erro ? " c-com-erro" : ""}`} data-caminho={chaveDe(caminho)}>
        <div>
          <label className="c-rotulo" htmlFor={id}>
            {nome}
          </label>
          {dica && <p className="c-dica">{dica}</p>}
        </div>
        <Interruptor id={id} ligado={valor === true} rotulo={nome} onChange={(v) => set(v ? true : obrigatorio ? false : undefined)} />
      </div>
    );
  } else if (esquema.type === "integer" || esquema.type === "number") {
    controle =
      chave === "price_cents" || chave === "valor_cents" ? (
        <Preco id={id} valor={typeof valor === "number" ? valor : undefined} onChange={chave === "valor_cents" ? (n) => set(n ? n : undefined) : set} />
      ) : (
        <input id={id} type="number" value={typeof valor === "number" ? valor : ""} onChange={(ev) => set(ev.target.value === "" ? undefined : Number(ev.target.value))} />
      );
  } else {
    const s = typeof valor === "string" ? valor : "";
    const limpar = (v: string | undefined) => set(v === "" || v === undefined ? (obrigatorio ? "" : undefined) : v);
    if (esquema.enum) {
      const lista = esquema.enum;
      const info = s ? infoDoValor(ctx.opcoes, lista, s) : undefined;
      controle =
        lista.length <= 4 ? (
          <Segmentado id={id} nome={nome} valores={lista} valor={s} onChange={limpar} opcoes={ctx.opcoes} permitirPadrao={!obrigatorio} />
        ) : (
          <select id={id} value={s} onChange={(ev) => limpar(ev.target.value)}>
            {!obrigatorio && <option value="">{chave === "icon" ? "Sem ícone" : "Padrão do modelo"}</option>}
            {(lista.includes(s) || !s ? lista : [s, ...lista]).map((v) => (
              <option key={v} value={v}>
                {infoDoValor(ctx.opcoes, lista, v).nome}
              </option>
            ))}
          </select>
        );
      // Quatro opções ou mais (contando o Padrão) quebravam em duas linhas em meia coluna: ocupam a linha toda.
      const segLargo = lista.length <= 4 && lista.length + (obrigatorio ? 0 : 1) >= 4;
      const padrao = naAparencia ? "Padrão: o que o modelo escolhido acima usa." : "Padrão: segue o modelo escolhido em Aparência.";
      if (info?.descricao) return <Campo id={id} rotulo={nome} obrigatorio={obrigatorio} dica={info.descricao} erro={erro} largo={segLargo} caminho={chaveDe(caminho)}>{seletor}{controle}</Campo>;
      if (!s && !obrigatorio && chave !== "icon") return <Campo id={id} rotulo={nome} dica={dica ?? padrao} erro={erro} largo={segLargo} caminho={chaveDe(caminho)}>{seletor}{controle}</Campo>;
      if (segLargo) largo = true;
    } else if (chave === "offer") {
      const ofertas = (Array.isArray(ctx.cfg.offers) ? ctx.cfg.offers : []) as Obj[];
      controle = (
        <select id={id} value={s} onChange={(ev) => limpar(ev.target.value)}>
          <option value="">{obrigatorio ? "Escolha a oferta" : "Nenhuma (vai direto para a conversa)"}</option>
          {ofertas.map((o) => (
            <option key={String(o.id)} value={String(o.id)}>
              {String(o.title ?? o.id)}
            </option>
          ))}
        </select>
      );
    } else if (typeof chave === "string" && IMAGEM.has(chave)) {
      controle = <CampoImagem id={id} valor={s} onChange={limpar} />;
      largo = true;
    } else if (esquema.pattern?.includes("#")) {
      controle = <Cor id={id} valor={s} onChange={limpar} permitirVazio={!obrigatorio} />;
    } else if (typeof chave === "string" && (TEXTO_LONGO.has(chave) || caminho[1] === "share")) {
      // Título e texto do link (capa ao compartilhar) também: numa linha só, o texto ficava cortado na caixa.
      // No WhatsApp eles são uma linha corrida: Enter vira espaço, e o contador mostra quanto cabe.
      const doLink = caminho[1] === "share";
      controle = (
        <>
          <textarea
            id={id}
            value={s}
            rows={3}
            className={doLink ? "c-texto-do-link" : undefined}
            maxLength={doLink ? esquema.maxLength : undefined}
            onChange={(ev) => limpar(doLink ? ev.target.value.replace(/[\r\n]+/g, " ") : ev.target.value)}
          />
          {doLink && esquema.maxLength && (
            <p className="c-dica c-contador" aria-live="polite">
              {s.length} de {esquema.maxLength} caracteres
            </p>
          )}
        </>
      );
      largo = true;
    } else {
      controle = <Texto id={id} chave={chave} valor={s} onChange={limpar} />;
    }
  }

  if (!comRotulo) {
    return (
      <div className={erro ? "c-com-erro" : undefined} data-caminho={chaveDe(caminho)}>
        {seletor}
        {controle}
        {erro && <p className="c-erro">{erro}</p>}
      </div>
    );
  }
  return (
    <Campo id={id} rotulo={nome} obrigatorio={obrigatorio} dica={dica} erro={erro} largo={largo} caminho={chaveDe(caminho)} rotuloOculto={rotuloOculto}>
      {seletor}
      {controle}
    </Campo>
  );
}
