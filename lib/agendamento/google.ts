/**
 * Google Agenda do dono, só pelo servidor: lê o ocupado (freeBusy) e cria o evento com Meet.
 * Sem SDK: fetch na API REST. O refresh token vem da tabela agenda_google (npm run google:conectar);
 * o client id e o secret vêm do ambiente. Nada aqui vai para o navegador.
 */
import { paredeParaUtc, type Ocupado } from "./horarios";

export const ESCOPOS_GOOGLE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";

export type Busca = (url: string, init?: RequestInit) => Promise<Response>;
export type CredenciaisGoogle = { clientId: string; clientSecret: string; refreshToken: string };

/** "token": a conexão caiu (senha trocada, acesso removido, app em Teste há 7 dias). Reconecte. */
export class ErroGoogle extends Error {
  constructor(
    public tipo: "token" | "api",
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroGoogle";
  }
}

// atalho: cache do access token na memória da função (some a cada cold start); suficiente para 1 dono.
const cacheToken = new Map<string, { token: string; expira: number }>();

export async function tokenDeAcesso(cred: CredenciaisGoogle, busca: Busca, agora = Date.now()): Promise<string> {
  const guardado = cacheToken.get(cred.refreshToken);
  if (guardado && guardado.expira > agora + 60_000) return guardado.token;
  const resp = await busca(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cred.clientId,
      client_secret: cred.clientSecret,
      refresh_token: cred.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    signal: AbortSignal.timeout(8_000),
  });
  const corpo = (await resp.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!resp.ok || !corpo.access_token) {
    const tipo = corpo.error === "invalid_grant" || corpo.error === "invalid_client" || corpo.error === "unauthorized_client" ? "token" : "api";
    throw new ErroGoogle(tipo, `Google recusou a renovação do acesso (${resp.status} ${corpo.error ?? ""}).`);
  }
  cacheToken.set(cred.refreshToken, { token: corpo.access_token, expira: agora + (corpo.expires_in ?? 3600) * 1000 });
  return corpo.access_token;
}

async function chamar<T>(cred: CredenciaisGoogle, busca: Busca, caminho: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenDeAcesso(cred, busca);
  const resp = await busca(`${API}${caminho}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (resp.status === 401) {
    cacheToken.delete(cred.refreshToken);
    throw new ErroGoogle("token", "Google recusou o acesso à agenda (401).");
  }
  if (!resp.ok) throw new ErroGoogle("api", `Google Agenda respondeu ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

type RespostaFreeBusy = { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason?: string }[] }> };

/**
 * Ocupado da agenda principal. Agenda que volta com erro derruba a consulta: liberar o horário em
 * silêncio deixaria marcar por cima de compromisso.
 */
export function ocupadoDoFreeBusy(resp: RespostaFreeBusy): Ocupado[] {
  const agenda = resp.calendars?.primary;
  if (!agenda) throw new ErroGoogle("api", "freeBusy: a agenda principal não veio na resposta.");
  if (agenda.errors?.length) throw new ErroGoogle("api", `freeBusy: ${agenda.errors.map((e) => e.reason).join(", ")}`);
  return (agenda.busy ?? []).map((b) => ({ inicioMs: Date.parse(b.start), fimMs: Date.parse(b.end) }));
}

type EventoDiaInteiro = {
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  status?: string;
  eventType?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
};

/**
 * Evento de dia inteiro fecha o dia, mesmo marcado como "Disponível" (o padrão do Google para dia
 * inteiro, que o freeBusy ignora). Ficam de fora o que o próprio Google cria (local de trabalho,
 * aniversário), cancelado e convite recusado.
 */
export function diasInteirosOcupados(eventos: EventoDiaInteiro[], tz: string): Ocupado[] {
  const saida: Ocupado[] = [];
  for (const ev of eventos) {
    const ini = ev.start?.date?.slice(0, 10);
    const fim = ev.end?.date?.slice(0, 10);
    if (!ini || !fim) continue;
    if (ev.status === "cancelled") continue;
    if (ev.eventType && ev.eventType !== "default") continue;
    if (ev.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
    const [a1, m1, d1] = ini.split("-").map(Number) as [number, number, number];
    const [a2, m2, d2] = fim.split("-").map(Number) as [number, number, number];
    saida.push({ inicioMs: paredeParaUtc(a1, m1, d1, 0, tz), fimMs: paredeParaUtc(a2, m2, d2, 0, tz) });
  }
  return saida;
}

export async function ocupadoGoogle(
  cred: CredenciaisGoogle,
  deIso: string,
  ateIso: string,
  tz: string,
  busca: Busca,
): Promise<Ocupado[]> {
  const fb = await chamar<RespostaFreeBusy>(cred, busca, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: deIso, timeMax: ateIso, timeZone: tz, items: [{ id: "primary" }] }),
  });
  const eventos: EventoDiaInteiro[] = [];
  let pagina: string | undefined;
  do {
    const qs = new URLSearchParams({ singleEvents: "true", timeMin: deIso, timeMax: ateIso, maxResults: "250" });
    if (pagina) qs.set("pageToken", pagina);
    const r = await chamar<{ items?: EventoDiaInteiro[]; nextPageToken?: string }>(cred, busca, `/calendars/primary/events?${qs}`);
    eventos.push(...(r.items ?? []));
    pagina = r.nextPageToken;
  } while (pagina);
  return [...ocupadoDoFreeBusy(fb), ...diasInteirosOcupados(eventos, tz)];
}

export type EventoNovo = {
  titulo: string;
  descricao: string;
  inicio: string;
  fim: string;
  tz: string;
  convidado?: string | null;
  /** Texto ou link. Sem ele, o evento ganha um Google Meet. */
  local?: string | null;
  requestId: string;
};

export async function criarEventoGoogle(
  cred: CredenciaisGoogle,
  ev: EventoNovo,
  busca: Busca,
): Promise<{ id: string; meetUrl: string | null }> {
  const corpo: Record<string, unknown> = {
    summary: ev.titulo,
    description: ev.descricao,
    start: { dateTime: ev.inicio, timeZone: ev.tz },
    end: { dateTime: ev.fim, timeZone: ev.tz },
    attendees: ev.convidado ? [{ email: ev.convidado }] : [],
    transparency: "opaque",
    extendedProperties: { private: { origem: "linkbio", request_id: ev.requestId } },
  };
  if (ev.local) corpo.location = ev.local;
  else corpo.conferenceData = { createRequest: { requestId: ev.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } };
  const qs = `${ev.local ? "" : "conferenceDataVersion=1&"}sendUpdates=${ev.convidado ? "all" : "none"}`;
  const criado = await chamar<{
    id: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  }>(cred, busca, `/calendars/primary/events?${qs}`, { method: "POST", body: JSON.stringify(corpo) });
  const meetUrl = criado.hangoutLink ?? criado.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? null;
  return { id: criado.id, meetUrl };
}

/** E-mail da conta conectada (o id da agenda principal). Usado só para mostrar "conectado como". */
export async function contaGoogle(cred: CredenciaisGoogle, busca: Busca): Promise<string> {
  const r = await chamar<{ id: string }>(cred, busca, "/calendars/primary");
  return r.id;
}
