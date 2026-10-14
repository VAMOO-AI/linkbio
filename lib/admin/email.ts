/**
 * E-mail do código do /admin, pela Resend (a mesma RESEND_API_KEY do aviso de lead).
 * Sem `server-only`: o teste injeta o fetch. Quem chama no painel é `lib/admin/sessao.ts`.
 *
 * Remetente padrão `onboarding@resend.dev`: a Resend só entrega esse endereço no e-mail
 * da própria conta, o que basta para um dono só, sem verificar domínio.
 */
const URL_PADRAO = "https://api.resend.com/emails";
const DE_PADRAO = "onboarding@resend.dev";

export function montarMensagemCodigo(codigo: string): { subject: string; text: string } {
  return {
    subject: "Seu código para entrar no painel",
    text: `Seu código para entrar no painel: ${codigo}\n\nEle vale por 10 minutos e só pode ser usado uma vez.\nSe você não pediu este código, ignore este e-mail.\n`,
  };
}

export async function enviarCodigoPorEmail(
  para: string,
  codigo: string,
  opts: { chave?: string; url?: string; de?: string; fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const chave = (opts.chave ?? process.env.RESEND_API_KEY ?? "").trim();
  if (!chave) throw new Error("RESEND_API_KEY ausente.");
  const msg = montarMensagemCodigo(codigo);
  const buscar = opts.fetchImpl ?? fetch;
  const resp = await buscar(opts.url ?? process.env.EMAIL_API_URL ?? URL_PADRAO, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: opts.de ?? process.env.EMAIL_FROM ?? DE_PADRAO,
      to: [para],
      subject: msg.subject,
      text: msg.text,
    }),
  });
  if (!resp.ok) throw new Error(`Falha ao enviar o código (${resp.status}).`);
}
