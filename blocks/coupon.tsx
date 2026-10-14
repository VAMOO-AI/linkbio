import { alvoCupom, hrefDoClique } from "@/lib/cliques";
import { linkWhatsApp } from "@/lib/whatsapp";
import { BotaoCopiar } from "./copiar";

type Acao = { wa: string } | { url: string };

/** "2026-12-31" → "31/12/2026", sem passar por Date (evita erro de fuso). */
function formataData(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Cupom: o código tem user-select: all, então um toque seleciona tudo e o celular
 * oferece "Copiar", sem JavaScript. Com copy: true, aparece também o botão "Copiar".
 */
export function CouponBlock({
  id,
  code,
  label,
  expires,
  cta,
  action,
  copy = false,
  whatsapp,
  chave = null,
}: {
  id: string;
  code: string;
  label: string;
  expires?: string;
  cta?: string;
  action?: Acao;
  copy?: boolean;
  whatsapp: string;
  chave?: string | null;
}) {
  const codigoId = `${id}-codigo`;
  const direto = action ? ("wa" in action ? linkWhatsApp(whatsapp, action.wa) : action.url) : undefined;
  const href = direto ? hrefDoClique(chave ? alvoCupom(chave) : null, direto) : undefined;
  return (
    <aside className="bloco-cupom" aria-label={`Cupom: ${label}`}>
      <div className="cupom-info">
        <p className="cupom-rotulo">{label}</p>
        <span className="cupom-linha">
          <code className="cupom-codigo" id={codigoId} translate="no">
            {code}
          </code>
          {copy && <BotaoCopiar code={code} alvo={codigoId} />}
        </span>
        <p className="cupom-dica">
          {expires && <>Válido até {formataData(expires)}. </>}
          {copy ? "Toque em Copiar ou no código." : "Toque no código para selecionar e copiar."}
        </p>
      </div>
      {href && (
        <a className="cupom-acao" href={href} target="_blank" rel="noopener">
          {cta ?? "Usar cupom"}
        </a>
      )}
    </aside>
  );
}
