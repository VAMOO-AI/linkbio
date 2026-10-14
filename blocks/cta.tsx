import { alvoCta, hrefDoClique } from "@/lib/cliques";
import { linkWhatsApp } from "@/lib/whatsapp";

type Acao = { wa: string } | { url: string };

type Props = {
  label: string;
  action: Acao;
  variant?: "primario" | "secundario";
  note?: string;
  pulse?: boolean;
  whatsapp: string;
  /** Chave do bloco quando a contagem está ligada; sem ela o link continua direto. */
  chave?: string | null;
};

export function CtaBlock({ label, action, variant = "primario", note, pulse, whatsapp, chave = null }: Props) {
  const direto = "wa" in action ? linkWhatsApp(whatsapp, action.wa) : action.url;
  const href = hrefDoClique(chave ? alvoCta(chave) : null, direto);
  const externo = href.startsWith("https://");
  return (
    <>
      <a
        className="bloco-cta"
        data-variant={variant}
        href={href}
        {...(externo ? { target: "_blank", rel: "noopener" } : {})}
      >
        {pulse && <span className="cta-pulso" aria-hidden="true" />}
        {label}
      </a>
      {note && <p className="cta-nota">{note}</p>}
    </>
  );
}
