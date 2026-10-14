import { linkWhatsApp } from "@/lib/whatsapp";

type Pedir = "whatsapp" | "email" | "ambos";

/**
 * Formulário de contato em HTML puro (POST). Sem JavaScript a pessoa envia do mesmo jeito.
 * Sem banco, vira só o botão de WhatsApp: a página não quebra.
 */
export function LeadBlock({
  id,
  title,
  text,
  label,
  pedir,
  consentimento,
  whatsapp,
  captura,
  abertoEm,
}: {
  id: string;
  title: string;
  text?: string;
  label: string;
  pedir: Pedir;
  consentimento: string;
  whatsapp: string;
  captura: boolean;
  abertoEm: number;
}) {
  const pedeWhatsapp = pedir === "whatsapp" || pedir === "ambos";
  const pedeEmail = pedir === "email" || pedir === "ambos";
  return (
    <section className="bloco-lead" id={`lead-${id}`} aria-label={title}>
      <h2 className="lead-titulo">{title}</h2>
      {text && <p className="lead-texto">{text}</p>}
      {captura ? (
        <form method="post" action="/api/lead">
          <input type="hidden" name="bloco" value={id} />
          <input type="hidden" name="aberto" value={String(abertoEm)} />
          <div className="lead-isca" aria-hidden="true">
            <label>
              Empresa
              <input name="empresa" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="lead-campo">
            Nome
            <input name="nome" required maxLength={80} autoComplete="name" />
          </label>
          {pedeWhatsapp && (
            <label className="lead-campo">
              WhatsApp
              <input name="whatsapp" required maxLength={20} inputMode="tel" autoComplete="tel" placeholder="(11) 98765-4321" />
            </label>
          )}
          {pedeEmail && (
            <label className="lead-campo">
              E-mail
              <input name="email" type="email" required maxLength={120} autoComplete="email" />
            </label>
          )}
          <label className="lead-concorda">
            <input type="checkbox" name="consentimento" value="sim" required />
            <span>{consentimento}</span>
          </label>
          <button className="bloco-cta" type="submit">
            {label}
          </button>
        </form>
      ) : (
        <a className="bloco-cta" href={linkWhatsApp(whatsapp, `Oi! Quero saber mais: ${title}`)}>
          Chamar no WhatsApp
        </a>
      )}
    </section>
  );
}
