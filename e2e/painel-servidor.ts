/**
 * Supabase de mentira, em memória, para os testes do painel (`e2e/painel.spec.ts`).
 *
 * Dois motivos: sem banco o /admin não abre, e os testes do painel ESCREVEM — contra o banco de
 * verdade eles sujariam a produção. Aqui escrevem e apagam à vontade, e o estado morre com o processo.
 *
 * Implementa só o que `lib/supabase.ts` usa, com a mesma forma de resposta do PostgREST: `select`
 * projetando as colunas (e recusando coluna que não existe, como o 42703), filtros `eq` e `gte`,
 * `order`, `limit`, `Prefer: return=representation` no insert, upsert por `on_conflict`, 204 em
 * update/delete. O Storage aceita upload autenticado e serve o arquivo na rota pública, como o bucket
 * `linkbio` de verdade.
 *
 * Roda como webServer do Playwright: `npx tsx e2e/painel-servidor.ts`.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { hashSenha } from "../lib/admin/cripto";
import { CHAVE_FALSA, EMAIL_TESTE, PORTA_FALSA, RESEND_FALSA, SENHA_TESTE, URL_FALSA } from "./painel-ambiente";

type Linha = Record<string, unknown>;

class Recusa extends Error {
  constructor(
    readonly situacao: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

const tabelas: Record<string, Linha[]> = {
  admin_users: [],
  admin_login_attempts: [],
  site_config: [],
  site_config_rascunho: [],
  // Linha única do keep-alive (migration 0003): a rota /api/keepalive faz upsert nela.
  keepalive: [],
  // Códigos de login (migration 0006). O texto do código não fica aqui: só o hash.
  admin_login_codes: [],
  // Contagem de cliques (migration 0004): uma linha por dia, botão e origem.
  cliques: [],
  leads: [],
};
const contadores: Record<string, number> = {};
const arquivos = new Map<string, { corpo: Buffer; tipo: string }>();

/**
 * Pedidos do app (PostgREST e Storage), sem contar os do próprio teste. É o que prova que o painel
 * está falando com este falso e não com outro banco — o que, num repo com Supabase de verdade no
 * `.env.local`, é a diferença entre testar e escrever em produção.
 */
let pedidos = 0;

/** Último código de 6 dígitos que o app pediu para enviar, por e-mail. Só o teste lê, pela rota de controle. */
const caixa = new Map<string, string>();

/** Tabelas com `id` e com `created_at` gerados na inserção, como no banco de verdade. */
const COM_ID = new Set(["admin_users", "admin_login_attempts", "site_config", "admin_login_codes", "leads"]);
const COM_DATA = new Set(["admin_login_attempts", "site_config", "admin_login_codes", "leads"]);

/**
 * Operadores aceitos. Só os dois que o app usa: um operador novo cai em erro alto em vez de filtrar
 * errado em silêncio, que é o pior jeito de um falso mentir.
 */
const OPERADORES: Record<string, (noBanco: unknown, valor: string) => boolean> = {
  eq: (noBanco, valor) => String(noBanco) === valor,
  gte: (noBanco, valor) => String(noBanco) >= valor,
  is: (noBanco, valor) => (valor === "null" ? noBanco == null : String(noBanco) === valor),
};

const RESERVADOS = new Set(["select", "order", "limit", "offset", "on_conflict"]);

const responderJson = (resp: ServerResponse, situacao: number, dados: unknown) => {
  const texto = JSON.stringify(dados);
  resp.writeHead(situacao, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(texto) });
  resp.end(texto);
};

const responderVazio = (resp: ServerResponse, situacao: number) => {
  resp.writeHead(situacao);
  resp.end();
};

async function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of req) partes.push(parte as Buffer);
  return Buffer.concat(partes);
}

function exigirChave(req: IncomingMessage) {
  if (req.headers.apikey !== CHAVE_FALSA) throw new Recusa(401, "chave do Supabase falso ausente ou errada");
}

/** Linhas da tabela que passam pelos filtros da URL, na ordem e no limite pedidos. */
function filtrar(tabela: string, params: URLSearchParams): Linha[] {
  let fora = [...tabelas[tabela]!];

  for (const [coluna, bruto] of params) {
    if (RESERVADOS.has(coluna)) continue;
    const ponto = bruto.indexOf(".");
    const operador = bruto.slice(0, ponto);
    const valor = bruto.slice(ponto + 1);
    const comparar = OPERADORES[operador];
    if (!comparar) throw new Recusa(400, `o Supabase falso não implementa o operador "${operador}" de "${coluna}"`);
    fora = fora.filter((linha) => comparar(linha[coluna], valor));
  }

  const ordem = params.get("order");
  if (ordem) {
    const [coluna = "", direcao = "asc"] = ordem.split(".");
    if (!coluna) throw new Recusa(400, `order inválido: "${ordem}"`);
    // Número com número compara como número, como no Postgres: como texto, a versão 9 vinha antes da 23
    // e, passadas 9 publicações, o falso servia uma versão velha como "a publicada".
    const comparar = (x: unknown, y: unknown) =>
      typeof x === "number" && typeof y === "number" ? x - y : String(x) > String(y) ? 1 : String(x) < String(y) ? -1 : 0;
    fora.sort((a, b) => comparar(a[coluna], b[coluna]));
    if (direcao === "desc") fora.reverse();
  }

  const limite = params.get("limit");
  return limite ? fora.slice(0, Number(limite)) : fora;
}

/** Só as colunas pedidas no `select`. Coluna que não existe é erro do banco (42703) e vira erro aqui. */
function projetar(tabela: string, linha: Linha, select: string | null): Linha {
  if (!select) return linha;
  const fora: Linha = {};
  for (const coluna of select.split(",")) {
    if (!(coluna in linha)) throw new Recusa(400, `coluna "${coluna}" não existe em ${tabela}`);
    fora[coluna] = linha[coluna];
  }
  return fora;
}

function proximoNumero(tabela: string): number {
  contadores[tabela] = (contadores[tabela] ?? 0) + 1;
  return contadores[tabela];
}

/** Insert, com upsert quando vem `on_conflict` (é como o rascunho se grava, por e-mail). */
function inserir(tabela: string, params: URLSearchParams, corpo: Linha): Linha {
  const conflito = params.get("on_conflict");
  const existente = conflito ? tabelas[tabela]!.findIndex((l) => l[conflito] === corpo[conflito]) : -1;
  if (existente >= 0) {
    Object.assign(tabelas[tabela]![existente]!, corpo);
    return tabelas[tabela]![existente]!;
  }
  const linha: Linha = { ...corpo };
  if (COM_ID.has(tabela) && linha.id === undefined) linha.id = proximoNumero(tabela);
  if (COM_DATA.has(tabela) && linha.created_at === undefined) linha.created_at = new Date().toISOString();
  tabelas[tabela]!.push(linha);
  return linha;
}

async function postgrest(
  tabela: string,
  params: URLSearchParams,
  req: IncomingMessage,
  corpo: Buffer,
  resp: ServerResponse,
): Promise<void> {
  if (!(tabela in tabelas)) throw new Recusa(404, `a tabela "${tabela}" não existe no Supabase falso`);
  const select = params.get("select");

  if (req.method === "GET" || req.method === "HEAD") {
    const linhas = filtrar(tabela, params).map((linha) => projetar(tabela, linha, select));
    return responderJson(resp, 200, linhas);
  }

  if (req.method === "POST") {
    if (!corpo.length) throw new Recusa(400, "POST sem corpo");
    const linha = inserir(tabela, params, JSON.parse(corpo.toString()) as Linha);
    // Como no PostgREST: sem o Prefer, o insert responde vazio.
    if (!String(req.headers.prefer ?? "").includes("return=representation")) return responderVazio(resp, 201);
    return responderJson(resp, 201, [projetar(tabela, linha, select)]);
  }

  if (req.method === "PATCH") {
    if (!corpo.length) throw new Recusa(400, "PATCH sem corpo");
    const alvos = filtrar(tabela, params);
    for (const alvo of alvos) Object.assign(alvo, JSON.parse(corpo.toString()) as Linha);
    if (String(req.headers.prefer ?? "").includes("return=representation")) {
      return responderJson(resp, 200, alvos.map((linha) => projetar(tabela, linha, select)));
    }
    return responderVazio(resp, 204);
  }

  if (req.method === "DELETE") {
    const alvos = new Set(filtrar(tabela, params));
    tabelas[tabela] = tabelas[tabela]!.filter((linha) => !alvos.has(linha));
    return responderVazio(resp, 204);
  }

  throw new Recusa(405, `o Supabase falso não atende ${req.method} em ${tabela}`);
}

async function subirArquivo(caminho: string, corpo: Buffer, req: IncomingMessage, resp: ServerResponse): Promise<void> {
  if (!caminho) throw new Recusa(400, "upload sem caminho");
  arquivos.set(caminho, { corpo, tipo: String(req.headers["content-type"] ?? "application/octet-stream") });
  return responderJson(resp, 200, { Key: caminho });
}

function baixarArquivo(caminho: string, resp: ServerResponse): void {
  const arquivo = arquivos.get(caminho);
  if (!arquivo) return responderJson(resp, 404, { message: `o Supabase falso não tem o arquivo "${caminho}"` });
  resp.writeHead(200, { "Content-Type": arquivo.tipo, "Content-Length": arquivo.corpo.length });
  resp.end(arquivo.corpo);
}

/** Soma 1 no total do dia, como a função `registrar_clique` da migration 0004. */
function rpc(nome: string, corpo: Buffer, resp: ServerResponse): void {
  if (nome !== "registrar_clique") throw new Recusa(404, `a função "${nome}" não existe no Supabase falso`);
  const pedido = JSON.parse(corpo.toString()) as { p_dia?: string; p_alvo?: string; p_origem?: string };
  if (!pedido.p_dia || !pedido.p_alvo || !pedido.p_origem) throw new Recusa(400, "registrar_clique sem dia, alvo ou origem");
  const linha = tabelas.cliques!.find((l) => l.dia === pedido.p_dia && l.alvo === pedido.p_alvo && l.origem === pedido.p_origem);
  if (linha) linha.total = Number(linha.total) + 1;
  else tabelas.cliques!.push({ dia: pedido.p_dia, alvo: pedido.p_alvo, origem: pedido.p_origem, total: 1 });
  return responderVazio(resp, 204);
}

/** Controle dos testes: zerar entre um caso e outro e conferir o que chegou ao "banco". */
function controle(acao: string, resp: ServerResponse): void {
  if (acao === "limpar") {
    for (const tabela of Object.keys(tabelas)) {
      if (tabela !== "admin_users") tabelas[tabela] = [];
    }
    contadores.admin_login_attempts = 0;
    contadores.site_config = 0;
    arquivos.clear();
    caixa.clear();
    pedidos = 0;
    return responderVazio(resp, 204);
  }
  if (acao === "estado") {
    return responderJson(resp, 200, {
      usuarios: tabelas.admin_users!.length,
      tentativas: tabelas.admin_login_attempts!.length,
      versoes: tabelas.site_config!,
      rascunhos: tabelas.site_config_rascunho!,
      keepalive: tabelas.keepalive!,
      cliques: tabelas.cliques!,
      leads: tabelas.leads!,
      arquivos: [...arquivos.keys()],
      pedidos,
    });
  }
  throw new Recusa(404, `o Supabase falso não conhece o controle "${acao}"`);
}

/** A Resend de mentira: guarda o código de 6 dígitos que o app mandou escrever no e-mail. */
function receberEmail(corpo: Buffer, req: IncomingMessage, resp: ServerResponse): void {
  if (req.headers.authorization !== `Bearer ${RESEND_FALSA}`) throw new Recusa(401, "chave de e-mail ausente ou errada");
  if (!corpo.length) throw new Recusa(400, "e-mail sem corpo");
  const json = JSON.parse(corpo.toString()) as { to?: string[]; text?: string };
  const para = (json.to?.[0] ?? "").toLowerCase();
  const codigo = (json.text ?? "").match(/\b(\d{6})\b/)?.[1];
  if (!para || !codigo) throw new Recusa(400, "e-mail sem destinatário ou sem código");
  caixa.set(para, codigo);
  responderJson(resp, 200, { id: "email-falso" });
}

async function atender(req: IncomingMessage, resp: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", URL_FALSA);
  const partes = url.pathname.split("/").filter(Boolean);
  const corpo = await lerCorpo(req);

  if (url.pathname === "/__saude") {
    const texto = "ok";
    resp.writeHead(200, { "Content-Type": "text/plain", "Content-Length": texto.length });
    resp.end(texto);
    return;
  }

  if (partes[0] === "__controle" && partes[1] === "codigo") {
    exigirChave(req);
    const email = (url.searchParams.get("email") ?? "").toLowerCase();
    const codigo = caixa.get(email);
    if (!codigo) return responderJson(resp, 404, { message: "sem código para esse e-mail" });
    return responderJson(resp, 200, { codigo });
  }

  if (partes[0] === "__controle") {
    exigirChave(req);
    return controle(partes[1] ?? "", resp);
  }

  if (partes[0] === "email") {
    pedidos += 1;
    return receberEmail(corpo, req, resp);
  }

  if (partes[0] === "rest" && partes[1] === "v1") {
    exigirChave(req);
    pedidos += 1;
    if (partes[2] === "rpc") return rpc(partes[3] ?? "", corpo, resp);
    return postgrest(partes[2] ?? "", url.searchParams, req, corpo, resp);
  }

  if (partes[0] === "storage" && partes[1] === "v1" && partes[2] === "object") {
    pedidos += 1;
    // A rota pública é livre (o bucket linkbio é público); o upload exige a chave, como o de verdade.
    if (partes[3] === "public") return baixarArquivo(partes.slice(5).join("/"), resp);
    exigirChave(req);
    return subirArquivo(partes.slice(4).join("/"), corpo, req, resp);
  }

  throw new Recusa(404, `o Supabase falso não conhece ${url.pathname}`);
}

async function principal() {
  tabelas.admin_users!.push({
    id: proximoNumero("admin_users"),
    email: EMAIL_TESTE,
    password_hash: await hashSenha(SENHA_TESTE),
    last_login_at: null,
  });

  const servidor = createServer((req, resp) => {
    atender(req, resp).catch((erro: unknown) => {
      if (erro instanceof Recusa) return responderJson(resp, erro.situacao, { message: erro.message });
      console.error("[supabase falso]", erro);
      responderJson(resp, 500, { message: String(erro) });
    });
  });

  // Com a suíte inteira em paralelo o cliente reaproveita conexões, e o padrão de 5s do Node fecha o
  // soquete ocioso — um pedido que sai nessa janela morre com "socket hang up" e derruba o teste por
  // motivo que não é do painel. Keep-alive folgado tira a janela.
  servidor.keepAliveTimeout = 60_000;
  servidor.headersTimeout = 65_000;

  const porta = Number(process.env.LINKBIO_PORTA_FALSA || PORTA_FALSA);
  servidor.listen(porta, "127.0.0.1", () => {
    console.log(`[supabase falso] http://127.0.0.1:${porta} — ${tabelas.admin_users!.length} usuário de teste, 0 versões`);
  });
}

void principal();
