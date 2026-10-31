import { alvoContagem, hrefDoClique } from "@/lib/cliques";
import { quandoTermina } from "@/lib/contagem";
import { instanteUtc } from "@/lib/janela";
import { linkWhatsApp } from "@/lib/whatsapp";
import { ContagemRelogio } from "./contagem-relogio";

type Acao = { wa: string } | { url: string };

/** Quanto faltava quando o servidor montou a página: o primeiro desenho do relógio. */
function faltaAgora(alvo: number): number {
  return alvo - Date.now();
}

/**
 * Contagem regressiva até `quando` (fuso do site). Sem JavaScript, ficam a data e o que faltava
 * quando a página foi montada; leitor de tela ouve a data, não os segundos.
 */
export function ContagemBlock({
  quando,
  tz,
  title,
  text,
  aoZerar = "Começou.",
  cta,
  action,
  whatsapp,
  chave = null,
}: {
  quando: string;
  tz: string;
  title: string;
  text?: string;
  aoZerar?: string;
  cta?: string;
  action?: Acao;
  whatsapp: string;
  chave?: string | null;
}) {
  const alvo = instanteUtc(quando, tz);
  if (alvo === null) return null;
  const direto = action ? ("wa" in action ? linkWhatsApp(whatsapp, action.wa) : action.url) : undefined;
  const href = direto ? hrefDoClique(chave ? alvoContagem(chave) : null, direto) : undefined;
  const texto = quandoTermina(quando);
  return (
    <section className="bloco-contagem" aria-label={title}>
      <p className="contagem-titulo">{title}</p>
      <ContagemRelogio alvo={alvo} inicial={faltaAgora(alvo)} fim={aoZerar} />
      <p className="contagem-quando">
        <time dateTime={new Date(alvo).toISOString()}>{texto}</time>
      </p>
      {text && <p className="contagem-texto">{text}</p>}
      {href && cta && (
        <a className="contagem-acao" href={href} target="_blank" rel="noopener">
          {cta}
        </a>
      )}
    </section>
  );
}
