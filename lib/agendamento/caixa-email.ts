/**
 * Caixa de e-mail do dono por IMAP, só pelo servidor (Node runtime): lê os avisos de Pix recebido
 * que o banco manda e devolve o texto. Quem tira o valor do texto é `lerAvisoPix` (pagamento.ts).
 *
 * Abre a INBOX só leitura e baixa a fonte com BODY.PEEK: nada é marcado como lido nem apagado.
 * Não loga conteúdo de e-mail (é dado pessoal); o logger do ImapFlow fica desligado.
 *
 * Provedores: Gmail (com 2FA + senha de app), Zoho, iCloud e Yahoo aceitam IMAP com senha de app.
 * Contas Microsoft (Outlook.com, Hotmail, Microsoft 365) NÃO aceitam: a Microsoft desligou a
 * autenticação básica no IMAP e só aceita OAuth, que este módulo não implementa.
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export type CredImap = { host: string; porta: number; usuario: string; senha: string; remetente: string | null };
export type AvisoRecebido = { id: string; recebidoEm: string; texto: string };

/** Só o pedaço do ImapFlow que usamos; o teste injeta um falso sem rede. */
export type MensagemCaixa = {
  uid: number;
  envelope?: { messageId?: string; date?: Date | string };
  internalDate?: Date | string;
  source?: Buffer;
};
export type ClienteCaixa = {
  connect(): Promise<void>;
  mailboxOpen(caminho: string, opcoes: { readOnly: boolean }): Promise<{ uidValidity: bigint }>;
  search(consulta: { since: Date; from?: string }, opcoes: { uid: true }): Promise<number[] | false | undefined>;
  fetchAll(
    uids: number[],
    consulta: { uid: true; envelope: true; internalDate: true; source: true },
    opcoes: { uid: true },
  ): Promise<MensagemCaixa[]>;
  logout(): Promise<void>;
  close(): void;
};
export type AbrirCaixa = (cred: CredImap) => ClienteCaixa;

const PRAZO_MS = 15_000;
const PRAZO_LOGOUT_MS = 3_000;

export function imapNoAmbiente(env: Record<string, string | undefined> = process.env): CredImap | null {
  const host = env.IMAP_HOST?.trim();
  const usuario = env.IMAP_USER?.trim();
  const senha = env.IMAP_PASS;
  if (!host || !usuario || !senha) return null;
  const porta = Number(env.IMAP_PORT?.trim() || 993);
  if (!Number.isInteger(porta) || porta <= 0 || porta > 65_535) return null;
  return { host, porta, usuario, senha, remetente: env.IMAP_REMETENTE?.trim() || null };
}

/** TLS sempre (IMAPS); sem STARTTLS em texto aberto. */
export const abrirImapFlow: AbrirCaixa = (cred) =>
  new ImapFlow({
    host: cred.host,
    port: cred.porta,
    secure: true,
    auth: { user: cred.usuario, pass: cred.senha },
    logger: false,
    disableAutoIdle: true,
  });

function iso(data: Date | string | undefined): string | null {
  if (!data) return null;
  const d = data instanceof Date ? data : new Date(data);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function ler(cliente: ClienteCaixa, cred: CredImap, desde: Date, limite: number): Promise<AvisoRecebido[]> {
  await cliente.connect();
  const caixa = await cliente.mailboxOpen("INBOX", { readOnly: true });
  const consulta = cred.remetente ? { since: desde, from: cred.remetente } : { since: desde };
  const achados = (await cliente.search(consulta, { uid: true })) || [];
  // UID cresce com a chegada: os maiores são os mais recentes.
  const uids = [...achados].sort((a, b) => a - b).slice(-Math.max(0, limite));
  if (!uids.length || limite <= 0) return [];
  const mensagens = await cliente.fetchAll(
    uids,
    { uid: true, envelope: true, internalDate: true, source: true },
    { uid: true },
  );
  const avisos: AvisoRecebido[] = [];
  for (const m of [...mensagens].sort((a, b) => b.uid - a.uid)) {
    if (!m.source) continue;
    const messageId = m.envelope?.messageId?.trim();
    avisos.push({
      id: messageId ? `email:${messageId}` : `email:${caixa.uidValidity}:${m.uid}`,
      // atalho: sem data interna nem no envelope, usa a hora da leitura; o IMAP sempre manda INTERNALDATE.
      recebidoEm: iso(m.internalDate) ?? iso(m.envelope?.date) ?? new Date().toISOString(),
      texto: await textoDoEmail(m.source),
    });
  }
  return avisos;
}

/** Logout educado com prazo; se não sair, derruba o socket. Erro aqui nunca sobe. */
async function encerrar(cliente: ClienteCaixa, educado: boolean): Promise<void> {
  if (educado) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ok = await Promise.race([
      cliente.logout().then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), PRAZO_LOGOUT_MS);
      }),
    ]);
    clearTimeout(timer);
    if (ok) return;
  }
  try {
    cliente.close();
  } catch {
    // socket já fechado
  }
}

/**
 * Avisos recebidos desde `desde` (filtrando pelo remetente, se houver), do mais recente para o
 * mais antigo, até `limite`. Rejeita se a conversa com o servidor passar de 15 s.
 */
export async function lerAvisosRecentes(
  cred: CredImap,
  desde: Date,
  abrir: AbrirCaixa = abrirImapFlow,
  limite = 50,
): Promise<AvisoRecebido[]> {
  const cliente = abrir(cred);
  let estourou = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const trabalho = ler(cliente, cred, desde, limite);
  trabalho.catch(() => {}); // depois do prazo o erro tardio não vira unhandled rejection
  const prazo = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => {
      estourou = true;
      rejeitar(new Error(`IMAP: a leitura da caixa passou de ${PRAZO_MS / 1000} s.`));
    }, PRAZO_MS);
  });
  try {
    return await Promise.race([trabalho, prazo]);
  } finally {
    clearTimeout(timer);
    await encerrar(cliente, !estourou);
  }
}

const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  aacute: "á",
  agrave: "à",
  acirc: "â",
  atilde: "ã",
  eacute: "é",
  ecirc: "ê",
  iacute: "í",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  uacute: "ú",
  ccedil: "ç",
  Aacute: "Á",
  Eacute: "É",
  Oacute: "Ó",
  Ccedil: "Ç",
};

function htmlParaTexto(html: string): string {
  return html
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (todo: string, nome: string) => ENTIDADES[nome] ?? todo);
}

function limpar(texto: string): string {
  return texto
    .replace(/ /g, " ")
    .split(/\r?\n/)
    .map((linha) => linha.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Assunto + corpo em texto puro (parte text/plain; sem ela, o HTML sem tags). */
export async function textoDoEmail(fonte: Buffer | string): Promise<string> {
  const email = await simpleParser(fonte);
  const corpo = email.text?.trim() ? email.text : typeof email.html === "string" ? htmlParaTexto(email.html) : "";
  return limpar([email.subject ?? "", corpo].join("\n"));
}
