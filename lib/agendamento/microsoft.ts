/**
 * Agenda do dono no Microsoft 365 / Outlook, só pelo servidor: lê o ocupado (calendarView) e cria
 * o evento (com Teams quando a conta permite). Sem SDK: fetch no Microsoft Graph.
 * App do Entra como cliente público (sem client secret, PKCE). O refresh token mora na tabela
 * agenda_conexao (npm run microsoft:conectar) e GIRA a cada renovação: quem chama grava o novo
 * por `salvarRefresh`. Client id e tenant vêm do ambiente. Nada aqui vai para o navegador.
 */
import { diasInteirosOcupados, type Busca, type EventoNovo } from "./google";
import type { Ocupado } from "./horarios";

export const ESCOPOS_MICROSOFT = ["offline_access", "Calendars.ReadWrite", "User.Read"];
const LOGIN = "https://login.microsoftonline.com";
const GRAPH = "https://graph.microsoft.com/v1.0";
const MAX_PAGINAS = 10;

export type CredMicrosoft = { clientId: string; tenant: string; refreshToken: string };
export type SalvarRefresh = (novo: string) => Promise<void>;

/** "token": a conexão caiu (senha trocada, acesso removido, 90 dias sem uso). Reconecte. */
export class ErroMicrosoft extends Error {
  constructor(
    public tipo: "token" | "api",
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroMicrosoft";
  }
}

/** Client id e tenant no ambiente (o refresh token fica no banco). Tenant padrão: common. */
export function msNoAmbiente(env: Record<string, string | undefined> = process.env): { clientId: string; tenant: string } | null {
  const clientId = env.MS_CLIENT_ID?.trim();
  if (!clientId) return null;
  return { clientId, tenant: env.MS_TENANT?.trim() || "common" };
}

const urlDoToken = (tenant: string) => `${LOGIN}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
const ERROS_DE_TOKEN = new Set(["invalid_grant", "interaction_required", "invalid_client", "unauthorized_client"]);

// atalho: cache do access token na memória da função (some a cada cold start); suficiente para 1 dono.
const cacheToken = new Map<string, { token: string; expira: number }>();

export async function tokenMicrosoft(cred: CredMicrosoft, busca: Busca, salvarRefresh: SalvarRefresh, agora = Date.now()): Promise<string> {
  const guardado = cacheToken.get(cred.refreshToken);
  if (guardado && guardado.expira > agora + 60_000) return guardado.token;
  const resp = await busca(urlDoToken(cred.tenant), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cred.clientId,
      refresh_token: cred.refreshToken,
      grant_type: "refresh_token",
      scope: ESCOPOS_MICROSOFT.join(" "),
    }).toString(),
    signal: AbortSignal.timeout(8_000),
  });
  const corpo = (await resp.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!resp.ok || !corpo.access_token) {
    const tipo = corpo.error && ERROS_DE_TOKEN.has(corpo.error) ? "token" : "api";
    throw new ErroMicrosoft(tipo, `Microsoft recusou a renovação do acesso (${resp.status} ${corpo.error ?? ""}).`);
  }
  const entrada = { token: corpo.access_token, expira: agora + (corpo.expires_in ?? 3600) * 1000 };
  cacheToken.set(cred.refreshToken, entrada);
  if (corpo.refresh_token && corpo.refresh_token !== cred.refreshToken) {
    cacheToken.set(corpo.refresh_token, entrada);
    try {
      await salvarRefresh(corpo.refresh_token);
    } catch (e) {
      // O token antigo segue valendo até vencer; falhar a reserva por isso seria pior.
      console.error("agenda microsoft: não deu para gravar o refresh token novo", e);
    }
  }
  return corpo.access_token;
}

type Ctx = { cred: CredMicrosoft; busca: Busca; salvarRefresh: SalvarRefresh };

/** `caminho` relativo ao Graph v1.0 ou URL absoluta (o @odata.nextLink). */
async function chamar<T>(ctx: Ctx, caminho: string, init: RequestInit = {}, extras: Record<string, string> = {}): Promise<T> {
  const token = await tokenMicrosoft(ctx.cred, ctx.busca, ctx.salvarRefresh);
  const url = caminho.startsWith("https://") ? caminho : `${GRAPH}${caminho}`;
  const resp = await ctx.busca(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...extras },
    signal: AbortSignal.timeout(10_000),
  });
  if (resp.status === 401) {
    cacheToken.delete(ctx.cred.refreshToken);
    throw new ErroMicrosoft("token", "Microsoft recusou o acesso à agenda (401).");
  }
  if (!resp.ok) throw new ErroMicrosoft("api", `Microsoft Graph respondeu ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

type EventoGraph = {
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  showAs?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
};

/** Com `Prefer: outlook.timezone="UTC"` o Graph devolve "2026-11-20T13:00:00.0000000", sem o Z. */
function utc(dataHora: string | undefined): number {
  return dataHora ? Date.parse(`${dataHora.slice(0, 19)}Z`) : NaN;
}

/**
 * Ocupado da agenda principal. Conta tudo que não está cancelado nem "livre" (provisório, ocupado,
 * ausente, trabalhando em outro lugar, desconhecido). Dia inteiro fecha o dia no fuso do dono.
 */
export function ocupadoDosEventos(eventos: EventoGraph[], tz: string): Ocupado[] {
  const saida: Ocupado[] = [];
  const diasInteiros: { start: { date: string }; end: { date: string } }[] = [];
  for (const ev of eventos) {
    if (ev.isCancelled || ev.showAs === "free") continue;
    if (ev.isAllDay) {
      const ini = ev.start?.dateTime?.slice(0, 10);
      const fim = ev.end?.dateTime?.slice(0, 10);
      if (ini && fim) diasInteiros.push({ start: { date: ini }, end: { date: fim } });
      continue;
    }
    const inicioMs = utc(ev.start?.dateTime);
    const fimMs = utc(ev.end?.dateTime);
    if (Number.isNaN(inicioMs) || Number.isNaN(fimMs)) throw new ErroMicrosoft("api", "calendarView: evento sem início ou fim.");
    saida.push({ inicioMs, fimMs });
  }
  return [...saida, ...diasInteirosOcupados(diasInteiros, tz)];
}

export async function ocupadoMicrosoft(
  cred: CredMicrosoft,
  deIso: string,
  ateIso: string,
  tz: string,
  busca: Busca,
  salvarRefresh: SalvarRefresh,
): Promise<Ocupado[]> {
  const ctx = { cred, busca, salvarRefresh };
  const qs = new URLSearchParams({
    startDateTime: deIso,
    endDateTime: ateIso,
    $select: "start,end,showAs,isAllDay,isCancelled",
    $top: "100",
  });
  const eventos: EventoGraph[] = [];
  let proxima: string | undefined = `/me/calendarView?${qs}`;
  for (let pagina = 0; proxima; pagina++) {
    // Liberar o horário em silêncio deixaria marcar por cima de compromisso.
    if (pagina >= MAX_PAGINAS) throw new ErroMicrosoft("api", `calendarView: mais de ${MAX_PAGINAS} páginas de eventos.`);
    const r: { value?: EventoGraph[]; "@odata.nextLink"?: string } = await chamar(ctx, proxima, {}, { Prefer: 'outlook.timezone="UTC"' });
    eventos.push(...(r.value ?? []));
    proxima = r["@odata.nextLink"];
  }
  return ocupadoDosEventos(eventos, tz);
}

/**
 * Cria o evento na agenda principal. Sem local e com Teams liberado na agenda (conta de trabalho),
 * vira reunião do Teams. Conta pessoal não tem Teams pela API: o evento sai sem link.
 * `transactionId` faz o Graph não duplicar o evento se a chamada for repetida.
 */
export async function criarEventoMicrosoft(
  cred: CredMicrosoft,
  ev: EventoNovo & { tz: string },
  busca: Busca,
  salvarRefresh: SalvarRefresh,
): Promise<{ id: string; meetUrl: string | null }> {
  const ctx = { cred, busca, salvarRefresh };
  const corpo: Record<string, unknown> = {
    subject: ev.titulo,
    body: { contentType: "text", content: ev.descricao },
    start: { dateTime: ev.inicio, timeZone: "UTC" },
    end: { dateTime: ev.fim, timeZone: "UTC" },
    transactionId: ev.requestId,
  };
  if (ev.convidado) corpo.attendees = [{ emailAddress: { address: ev.convidado }, type: "required" }];
  if (ev.local) {
    corpo.location = { displayName: ev.local };
  } else {
    const agenda = await chamar<{ allowedOnlineMeetingProviders?: string[] }>(ctx, "/me/calendar?$select=allowedOnlineMeetingProviders");
    if (agenda.allowedOnlineMeetingProviders?.includes("teamsForBusiness")) {
      corpo.isOnlineMeeting = true;
      corpo.onlineMeetingProvider = "teamsForBusiness";
    }
  }
  const criado = await chamar<{ id: string; onlineMeeting?: { joinUrl?: string } | null }>(ctx, "/me/events", {
    method: "POST",
    body: JSON.stringify(corpo),
  });
  return { id: criado.id, meetUrl: criado.onlineMeeting?.joinUrl ?? null };
}

/** Remarcar: troca o horário do evento (a reunião do Teams continua a mesma). */
export async function moverEventoMicrosoft(
  cred: CredMicrosoft,
  ev: { id: string; inicio: string; fim: string },
  busca: Busca,
  salvarRefresh: SalvarRefresh,
): Promise<void> {
  await chamar(
    { cred, busca, salvarRefresh },
    `/me/events/${encodeURIComponent(ev.id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ start: { dateTime: ev.inicio, timeZone: "UTC" }, end: { dateTime: ev.fim, timeZone: "UTC" } }),
    },
  );
}

/** E-mail da conta conectada. Usado só para mostrar "conectado como". */
export async function contaMicrosoft(cred: CredMicrosoft, busca: Busca, salvarRefresh: SalvarRefresh): Promise<string> {
  const r = await chamar<{ userPrincipalName?: string; mail?: string | null }>(
    { cred, busca, salvarRefresh },
    "/me?$select=userPrincipalName,mail",
  );
  return r.mail || r.userPrincipalName || "";
}

/** Cliente público: sem client secret; o PKCE (S256) protege o código. */
export function urlDeAutorizacaoMicrosoft(o: { clientId: string; tenant: string; redirect: string; desafio: string; state: string }): string {
  const p = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirect,
    response_type: "code",
    response_mode: "query",
    scope: ESCOPOS_MICROSOFT.join(" "),
    prompt: "select_account",
    code_challenge: o.desafio,
    code_challenge_method: "S256",
    state: o.state,
  });
  return `${LOGIN}/${encodeURIComponent(o.tenant)}/oauth2/v2.0/authorize?${p}`;
}

export type TrocaMicrosoft = { ok: true; refreshToken: string; accessToken: string } | { ok: false; erro: string };

export async function trocarCodigoMicrosoft(
  o: { clientId: string; tenant: string; redirect: string; codigo: string; verificador: string },
  busca: Busca,
): Promise<TrocaMicrosoft> {
  const resp = await busca(urlDoToken(o.tenant), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: o.clientId,
      redirect_uri: o.redirect,
      code: o.codigo,
      code_verifier: o.verificador,
      grant_type: "authorization_code",
      scope: ESCOPOS_MICROSOFT.join(" "),
    }).toString(),
  });
  const corpo = (await resp.json().catch(() => ({}))) as {
    refresh_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!resp.ok) return { ok: false, erro: `${corpo.error ?? resp.status}: ${corpo.error_description ?? ""}`.trim() };
  if (!corpo.access_token) return { ok: false, erro: "a Microsoft não devolveu o acesso." };
  if (!corpo.refresh_token) {
    return { ok: false, erro: "a Microsoft não devolveu o refresh token. Confira se o app pede offline_access e rode de novo." };
  }
  return { ok: true, refreshToken: corpo.refresh_token, accessToken: corpo.access_token };
}
