"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icone } from "./icones";
import { ehObj, type Obj } from "./campos";
import { PROPORCAO_CAPA, ehEnderecoDoExemplo, textosDoLink } from "@/lib/compartilhar";
import type { PreviaDaCapa } from "@/lib/admin/capa-previa";

const nada = () => () => {};
/** Endereço deste painel (o mesmo site da bio). Vazio no servidor, sem descompasso na hidratação. */
const useOrigem = () => useSyncExternalStore(nada, () => location.origin, () => "");

const lerJson = (json: string): Obj => {
  try {
    const v: unknown = JSON.parse(json);
    return ehObj(v) ? v : {};
  } catch {
    return {};
  }
};
const texto = (v: unknown) => (typeof v === "string" ? v : "");

/** Só o que muda a capa: perfil, aparência e a capa ao compartilhar. Mexer no resto não gera de novo. */
function chaveDaCapa(cfg: Obj): string {
  const site = ehObj(cfg.site) ? cfg.site : {};
  return JSON.stringify([cfg.profile ?? null, cfg.theme ?? null, site.share ?? null]);
}

/**
 * "Assim aparece no WhatsApp": o cartão do link (capa 1,91:1, título, texto e domínio) com o que está
 * no rascunho, ao vivo. A imagem é a mesma que o /capa.jpg vai gerar (rota /admin/capa-previa), pedida 700 ms
 * depois da última mudança; título e texto mudam na hora. Embaixo, o porquê de o WhatsApp mostrar a
 * capa antiga e o link com final novo para ver a nova.
 */
export function PreviaCompartilhar({ cfg, noAr }: { cfg: Obj; noAr: string }) {
  const [previa, setPrevia] = useState<PreviaDaCapa | null>(null);
  // Chave da capa que está na tela: diferente da atual, uma nova está a caminho.
  const [chaveGerada, setChaveGerada] = useState<string | null>(null);
  // Último link copiado (ou "falhou"): o "Link copiado" some quando o link muda (ex.: depois de publicar).
  const [copiou, setCopiou] = useState("");
  // Publicar muda o que está no ar (o link novo e o "falta publicar"): a chave inclui a versão no ar.
  const chaveNoAr = useMemo(() => chaveDaCapa(lerJson(noAr)), [noAr]);
  const chave = `${chaveDaCapa(cfg)}|${chaveNoAr}`;
  const gerando = chaveGerada !== chave;
  const cfgAtual = useRef(cfg);
  useEffect(() => {
    cfgAtual.current = cfg;
  }, [cfg]);

  // Pedido por fetch (rota /admin/capa-previa), não por server action: as actions saem uma de cada vez
  // e a capa seguraria o salvamento do rascunho. Mudou de novo antes de chegar: o pedido velho é cancelado.
  useEffect(() => {
    const parar = new AbortController();
    const t = setTimeout(async () => {
      const c = cfgAtual.current;
      const site = ehObj(c.site) ? c.site : {};
      let r: PreviaDaCapa;
      try {
        const resp = await fetch("/admin/capa-previa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: c.profile, theme: c.theme, site: { share: site.share } }),
          signal: parar.signal,
        });
        r = resp.ok ? ((await resp.json()) as PreviaDaCapa) : { ok: false };
      } catch {
        if (parar.signal.aborted) return;
        r = { ok: false };
      }
      if (parar.signal.aborted) return;
      setPrevia(r);
      setChaveGerada(chave);
    }, 700);
    return () => {
      parar.abort();
      clearTimeout(t);
    };
  }, [chave]);

  const perfil = ehObj(cfg.profile) ? cfg.profile : {};
  const site = ehObj(cfg.site) ? cfg.site : {};
  const share = ehObj(site.share) ? site.share : {};
  const { titulo, descricao } = textosDoLink(
    { name: texto(perfil.name), handle: texto(perfil.handle), bio: texto(perfil.bio) },
    { title: texto(share.title), description: texto(share.description) },
  );
  const origem = useOrigem();
  const servidor = previa?.ok ? previa : null;
  // Endereço da bio ainda o do exemplo (e fora da Vercel): o link usa o endereço deste painel, que é
  // o mesmo site. Sem isso, o botão copiaria um link que não abre.
  const ok =
    servidor && origem && ehEnderecoDoExemplo(servidor.linkNovo)
      ? { ...servidor, dominio: new URL(origem).hostname, linkNovo: `${origem}/${new URL(servidor.linkNovo).search}` }
      : servidor;
  const dominio = ok?.dominio ?? (origem ? new URL(origem).hostname : "");
  const temImagemPropria = Boolean(texto(share.image));
  const formato = ok?.encaixe === "encaixar" && ok.largura && ok.altura ? (ok.largura / ok.altura > PROPORCAO_CAPA ? "mais larga" : "mais alta") : null;

  const copiado = ok && copiou === ok.linkNovo ? "ok" : copiou === "falhou" ? "falhou" : "";
  const copiar = async () => {
    if (!ok) return;
    try {
      await navigator.clipboard.writeText(ok.linkNovo);
      setCopiou(ok.linkNovo);
    } catch {
      setCopiou("falhou");
    }
  };

  return (
    // div, não section com nome: "Assim aparece no WhatsApp" viraria rótulo e o campo WhatsApp de
    // Contato deixaria de ser o único com esse nome para leitor de tela (e para os testes).
    <div className="c-largo cz">
      <h3 className="c-rotulo">
        Assim aparece no WhatsApp
      </h3>
      <div className="cz-conversa">
        <div className="cz-balao" data-testid="cartao-do-link">
          <div className="cz-cartao">
            <div className="cz-imagem" aria-busy={gerando}>
              {ok ? (
                // eslint-disable-next-line @next/next/no-img-element -- prévia no painel, imagem em data URL
                <img src={ok.imagem} alt={ok.origem === "propria" ? "Capa enviada, como vai aparecer" : "Capa automática: foto, nome e bio"} />
              ) : (
                <span className="cz-carregando">{previa ? "Não deu para montar a capa agora." : "Montando a capa..."}</span>
              )}
            </div>
            <div className="cz-textos">
              <strong className="cz-titulo">{titulo}</strong>
              <span className="cz-descricao">{descricao}</span>
              <span className="cz-dominio">{dominio}</span>
            </div>
          </div>
          <span className="cz-link">{ok ? ok.linkNovo.replace(/\?v=.*$/, "") : dominio}</span>
        </div>
      </div>

      {temImagemPropria && ok?.shareValido && ok.origem === "automatica" && !gerando && (
        <p className="c-erro" role="status">
          <Icone nome="alerta" tamanho={14} />
          Não consegui abrir a imagem da capa: vai a capa automática. Envie a imagem de novo pelo botão.
        </p>
      )}
      {formato && (
        <p className="cz-aviso" role="status" data-testid="aviso-formato">
          <Icone nome="alerta" tamanho={14} />
          Sua imagem ({ok!.largura} x {ok!.altura}) é {formato} que o formato do WhatsApp: ela vai aparecer inteira, com um fundo nas sobras. Para ocupar o cartão todo, use 1200 x 630.
        </p>
      )}
      {!temImagemPropria && <p className="c-dica">Sem imagem própria, a capa mostra sua foto, nome e bio no visual da página. Para usar outra, ideal 1200 x 630.</p>}

      <div className="cz-cache">
        <strong>Mandou o link e a capa antiga continua aparecendo?</strong>
        <p>
          O WhatsApp guarda a prévia de cada link na primeira vez que ele é mandado e repete essa prévia por um tempo. Para ver a capa nova na hora, mande o link com um final diferente. Ele abre a mesma página.
        </p>
        {ok?.faltaPublicar && <p className="cz-pendente">A capa acima tem mudanças ainda não publicadas: publique antes de mandar o link.</p>}
        <div className="cz-acoes">
          <input className="cz-link-novo" readOnly value={ok?.linkNovo ?? ""} aria-label="Endereço com prévia nova" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="b b-sec" onClick={copiar} disabled={!ok}>
            <Icone nome={copiado === "ok" ? "ok" : "link"} tamanho={16} />
            {copiado === "ok" ? "Link copiado" : "Copiar link com prévia nova"}
          </button>
        </div>
        {copiado === "falhou" && <p className="c-dica">Não deu para copiar sozinho: toque no link acima e copie.</p>}
        {ok && (
          <p className="c-dica">
            Facebook e Instagram também guardam a prévia. Para atualizar lá, abra o{" "}
            <a href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(ok.linkNovo.replace(/\?v=.*$/, ""))}`} target="_blank" rel="noopener noreferrer">
              Depurador de Compartilhamento do Facebook
            </a>{" "}
            (pede login no Facebook) e toque em &quot;Extrair novamente&quot;.
          </p>
        )}
      </div>
    </div>
  );
}
