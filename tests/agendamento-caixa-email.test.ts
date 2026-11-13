import { afterEach, describe, expect, test, vi } from "vitest";
import {
  imapNoAmbiente,
  lerAvisosRecentes,
  textoDoEmail,
  type AbrirCaixa,
  type ClienteCaixa,
  type CredImap,
  type MensagemCaixa,
} from "@/lib/agendamento/caixa-email";

const CRED: CredImap = { host: "imap.exemplo.com", porta: 993, usuario: "dono@exemplo.com", senha: "x", remetente: null };
const DESDE = new Date("2026-11-10T12:00:00Z");

function fonte(assunto: string, corpo = "Você recebeu um Pix de R$ 300,17"): Buffer {
  return Buffer.from(`Subject: ${assunto}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${corpo}\r\n`);
}

function mensagem(uid: number, extra: Partial<MensagemCaixa> = {}): MensagemCaixa {
  return {
    uid,
    envelope: { messageId: `<m${uid}@banco.com>`, date: new Date(`2026-11-11T10:00:0${uid % 10}Z`) },
    internalDate: new Date(`2026-11-11T12:00:0${uid % 10}Z`),
    source: fonte(`Pix ${uid}`),
    ...extra,
  };
}

/** Cliente falso: guarda as chamadas e devolve as mensagens pelos uids pedidos. */
function falso(mensagens: MensagemCaixa[], opcoes: { erroNoFetch?: boolean; travar?: boolean } = {}) {
  const chamadas = {
    connect: 0,
    open: [] as { caminho: string; readOnly: boolean }[],
    search: [] as unknown[],
    fetch: [] as number[][],
    logout: 0,
    close: 0,
  };
  const cliente: ClienteCaixa = {
    async connect() {
      chamadas.connect++;
      if (opcoes.travar) await new Promise(() => {});
    },
    async mailboxOpen(caminho, op) {
      chamadas.open.push({ caminho, readOnly: op.readOnly });
      return { uidValidity: 777n };
    },
    async search(consulta) {
      chamadas.search.push(consulta);
      return mensagens.map((m) => m.uid);
    },
    async fetchAll(uids) {
      chamadas.fetch.push([...uids]);
      if (opcoes.erroNoFetch) throw new Error("conexão caiu no fetch");
      return mensagens.filter((m) => uids.includes(m.uid));
    },
    async logout() {
      chamadas.logout++;
    },
    close() {
      chamadas.close++;
    },
  };
  const abrir: AbrirCaixa = () => cliente;
  return { abrir, chamadas };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("lerAvisosRecentes", () => {
  test("abre a INBOX só leitura e passa SINCE sem FROM quando não há remetente", async () => {
    const { abrir, chamadas } = falso([mensagem(1)]);
    await lerAvisosRecentes(CRED, DESDE, abrir);
    expect(chamadas.open).toEqual([{ caminho: "INBOX", readOnly: true }]);
    expect(chamadas.search).toEqual([{ since: DESDE }]);
  });

  test("aplica o FROM quando há remetente", async () => {
    const { abrir, chamadas } = falso([mensagem(1)]);
    await lerAvisosRecentes({ ...CRED, remetente: "nubank.com.br" }, DESDE, abrir);
    expect(chamadas.search).toEqual([{ since: DESDE, from: "nubank.com.br" }]);
  });

  test("respeita o limite pegando as mais recentes (maiores uids)", async () => {
    const { abrir, chamadas } = falso([1, 2, 3, 4, 5].map((u) => mensagem(u)));
    const avisos = await lerAvisosRecentes(CRED, DESDE, abrir, 2);
    expect(chamadas.fetch).toEqual([[4, 5]]);
    expect(avisos.map((a) => a.id)).toEqual(["email:<m5@banco.com>", "email:<m4@banco.com>"]);
  });

  test("id pelo Message-ID e, sem ele, por uidValidity:uid; recebidoEm pela data interna", async () => {
    const semId = mensagem(9, { envelope: { date: new Date("2026-11-11T09:00:00Z") } });
    const { abrir } = falso([mensagem(3), semId]);
    const avisos = await lerAvisosRecentes(CRED, DESDE, abrir);
    const porId = Object.fromEntries(avisos.map((a) => [a.id, a]));
    expect(Object.keys(porId).sort()).toEqual(["email:777:9", "email:<m3@banco.com>"]);
    expect(porId["email:<m3@banco.com>"].recebidoEm).toBe("2026-11-11T12:00:03.000Z");
    expect(porId["email:<m3@banco.com>"].texto).toContain("R$ 300,17");
    expect(porId["email:<m3@banco.com>"].texto).toContain("Pix 3");
  });

  test("sem data interna, recebidoEm vem do envelope", async () => {
    const { abrir } = falso([mensagem(4, { internalDate: undefined })]);
    const [aviso] = await lerAvisosRecentes(CRED, DESDE, abrir);
    expect(aviso.recebidoEm).toBe("2026-11-11T10:00:04.000Z");
  });

  test("caixa sem mensagens não chama o fetch", async () => {
    const { abrir, chamadas } = falso([]);
    expect(await lerAvisosRecentes(CRED, DESDE, abrir)).toEqual([]);
    expect(chamadas.fetch).toEqual([]);
    expect(chamadas.logout).toBe(1);
  });

  test("faz logout mesmo quando o fetch falha", async () => {
    const { abrir, chamadas } = falso([mensagem(1)], { erroNoFetch: true });
    await expect(lerAvisosRecentes(CRED, DESDE, abrir)).rejects.toThrow("conexão caiu no fetch");
    expect(chamadas.logout).toBe(1);
  });

  test("rejeita depois de 15 s e encerra a conexão", async () => {
    vi.useFakeTimers();
    const { abrir, chamadas } = falso([mensagem(1)], { travar: true });
    const leitura = lerAvisosRecentes(CRED, DESDE, abrir);
    const verificacao = expect(leitura).rejects.toThrow(/15 s/);
    await vi.advanceTimersByTimeAsync(15_000);
    await verificacao;
    expect(chamadas.logout + chamadas.close).toBeGreaterThan(0);
  });
});

describe("imapNoAmbiente", () => {
  test("lê as variáveis, porta padrão 993 e remetente opcional", () => {
    expect(imapNoAmbiente({ IMAP_HOST: "imap.gmail.com", IMAP_USER: "a@b.com", IMAP_PASS: "senha app" })).toEqual({
      host: "imap.gmail.com",
      porta: 993,
      usuario: "a@b.com",
      senha: "senha app",
      remetente: null,
    });
    expect(
      imapNoAmbiente({ IMAP_HOST: "h", IMAP_PORT: "1993", IMAP_USER: "u", IMAP_PASS: "p", IMAP_REMETENTE: " nubank.com.br " }),
    ).toMatchObject({ porta: 1993, remetente: "nubank.com.br" });
  });

  test("sem variável obrigatória devolve null", () => {
    expect(imapNoAmbiente({})).toBeNull();
    expect(imapNoAmbiente({ IMAP_HOST: "h", IMAP_USER: "u" })).toBeNull();
    expect(imapNoAmbiente({ IMAP_HOST: "h", IMAP_USER: "u", IMAP_PASS: "" })).toBeNull();
  });
});

describe("textoDoEmail", () => {
  test("e-mail só HTML vira texto com o assunto no começo", async () => {
    const html =
      "<html><head><style>p{color:red}</style></head><body><p>Ol&aacute;!</p><p>Voc&ecirc; recebeu um Pix de <b>R$&nbsp;300,17</b> &amp; pronto.</p></body></html>";
    const bruto = [
      "From: Banco <avisos@banco.com>",
      "Subject: =?UTF-8?Q?Pix_recebido?=",
      "Message-ID: <x1@banco.com>",
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "",
      html,
      "",
    ].join("\r\n");
    const texto = await textoDoEmail(bruto);
    expect(texto.startsWith("Pix recebido")).toBe(true);
    expect(texto).toContain("R$ 300,17");
    expect(texto).not.toContain("<");
    expect(texto).not.toContain("color:red");
  });

  test("usa a parte texto quando existe", async () => {
    const texto = await textoDoEmail(fonte("Aviso", "Você recebeu um Pix de R$ 300,17"));
    expect(texto).toBe("Aviso\nVocê recebeu um Pix de R$ 300,17");
  });
});
