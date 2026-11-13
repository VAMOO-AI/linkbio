import { describe, expect, test } from "vitest";
import { paredeParaUtc } from "@/lib/agendamento/horarios";
import {
  ESCOPOS_MICROSOFT,
  ErroMicrosoft,
  contaMicrosoft,
  criarEventoMicrosoft,
  msNoAmbiente,
  ocupadoMicrosoft,
  tokenMicrosoft,
  trocarCodigoMicrosoft,
  urlDeAutorizacaoMicrosoft,
  type CredMicrosoft,
} from "@/lib/agendamento/microsoft";

type Chamada = { url: string; init?: RequestInit };

/** fetch falso: cada rota responde pelo primeiro trecho de URL que casar. */
function falso(rotas: [string, (c: Chamada) => unknown, number?][]) {
  const chamadas: Chamada[] = [];
  const busca = async (url: string, init?: RequestInit) => {
    const c = { url, init };
    chamadas.push(c);
    const rota = rotas.find(([trecho]) => url.includes(trecho));
    if (!rota) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(rota[1](c)), { status: rota[2] ?? 200 });
  };
  return { busca, chamadas };
}

let seq = 0;
/** Refresh token único por teste: o cache do access token é por refresh token. */
const cred = (): CredMicrosoft => ({ clientId: "cid", tenant: "common", refreshToken: `rt-${++seq}` });
const token = (refresh?: string) => ["/oauth2/v2.0/token", () => ({ access_token: "at", expires_in: 3600, refresh_token: refresh })] as [string, () => unknown];

describe("token da Microsoft", () => {
  test("refresh token girou: grava o novo; sem client_secret no pedido", async () => {
    const c = cred();
    const { busca, chamadas } = falso([token("rt-novo")]);
    const salvos: string[] = [];
    expect(await tokenMicrosoft(c, busca, async (n) => void salvos.push(n))).toBe("at");
    expect(salvos).toEqual(["rt-novo"]);
    const corpo = new URLSearchParams(String(chamadas[0]!.init?.body));
    expect(chamadas[0]!.url).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/token");
    expect(corpo.get("grant_type")).toBe("refresh_token");
    expect(corpo.get("refresh_token")).toBe(c.refreshToken);
    expect(corpo.has("client_secret")).toBe(false);
  });

  test("refresh token igual ou ausente: não grava nada", async () => {
    const c = cred();
    const salvos: string[] = [];
    await tokenMicrosoft(c, falso([token(c.refreshToken)]).busca, async (n) => void salvos.push(n));
    await tokenMicrosoft(cred(), falso([token(undefined)]).busca, async (n) => void salvos.push(n));
    expect(salvos).toEqual([]);
  });

  test("access token fica em cache até perto de vencer", async () => {
    const c = cred();
    const { busca, chamadas } = falso([token()]);
    await tokenMicrosoft(c, busca, async () => {}, 1_000_000);
    await tokenMicrosoft(c, busca, async () => {}, 1_000_000 + 60_000);
    expect(chamadas).toHaveLength(1);
    await tokenMicrosoft(c, busca, async () => {}, 1_000_000 + 3_600_000);
    expect(chamadas).toHaveLength(2);
  });

  test("invalid_grant e interaction_required viram ErroMicrosoft do tipo token; 500 vira api", async () => {
    for (const error of ["invalid_grant", "interaction_required"]) {
      const { busca } = falso([["/token", () => ({ error }), 400]]);
      const erro = await tokenMicrosoft(cred(), busca, async () => {}).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroMicrosoft);
      expect((erro as ErroMicrosoft).tipo).toBe("token");
    }
    const { busca } = falso([["/token", () => ({ error: "temporarily_unavailable" }), 503]]);
    const erro = await tokenMicrosoft(cred(), busca, async () => {}).catch((e: unknown) => e);
    expect((erro as ErroMicrosoft).tipo).toBe("api");
  });
});

describe("ocupado no Outlook (calendarView)", () => {
  const tz = "America/Sao_Paulo";
  const ev = (inicio: string, fim: string, extra: Record<string, unknown> = {}) => ({
    start: { dateTime: `${inicio}.0000000`, timeZone: "UTC" },
    end: { dateTime: `${fim}.0000000`, timeZone: "UTC" },
    showAs: "busy",
    isAllDay: false,
    isCancelled: false,
    ...extra,
  });

  test("segue o nextLink, ignora cancelado e livre, conta provisório e fecha o dia inteiro no fuso do dono", async () => {
    const proxima = "https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=abc";
    const { busca, chamadas } = falso([
      token(),
      [
        "$skiptoken=abc",
        () => ({
          value: [
            ev("2026-11-20T15:00:00", "2026-11-20T16:00:00", { showAs: "tentative" }),
            ev("2026-11-21T00:00:00", "2026-11-22T00:00:00", { isAllDay: true, showAs: "oof" }),
          ],
        }),
      ],
      [
        "/me/calendarView",
        () => ({
          value: [
            ev("2026-11-20T12:00:00", "2026-11-20T13:00:00"),
            ev("2026-11-20T13:00:00", "2026-11-20T14:00:00", { isCancelled: true }),
            ev("2026-11-20T14:00:00", "2026-11-20T15:00:00", { showAs: "free" }),
          ],
          "@odata.nextLink": proxima,
        }),
      ],
    ]);
    const ocupado = await ocupadoMicrosoft(cred(), "2026-11-20T03:00:00.000Z", "2026-11-23T03:00:00.000Z", tz, busca, async () => {});
    expect(ocupado).toEqual([
      { inicioMs: Date.parse("2026-11-20T12:00:00Z"), fimMs: Date.parse("2026-11-20T13:00:00Z") },
      { inicioMs: Date.parse("2026-11-20T15:00:00Z"), fimMs: Date.parse("2026-11-20T16:00:00Z") },
      { inicioMs: paredeParaUtc(2026, 11, 21, 0, tz), fimMs: paredeParaUtc(2026, 11, 22, 0, tz) },
    ]);

    const primeira = chamadas.find((c) => c.url.includes("/me/calendarView") && !c.url.includes("skiptoken"))!;
    const u = new URL(primeira.url);
    expect(u.searchParams.get("startDateTime")).toBe("2026-11-20T03:00:00.000Z");
    expect(u.searchParams.get("endDateTime")).toBe("2026-11-23T03:00:00.000Z");
    expect(u.searchParams.get("$select")).toBe("start,end,showAs,isAllDay,isCancelled");
    const h = new Headers(primeira.init?.headers);
    expect(h.get("prefer")).toBe('outlook.timezone="UTC"');
    expect(h.get("authorization")).toBe("Bearer at");
    expect(chamadas.some((c) => c.url === proxima)).toBe(true);
  });

  test("passou de 10 páginas: erro em vez de liberar horário em silêncio", async () => {
    const { busca } = falso([token(), ["/me/calendarView", () => ({ value: [], "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/calendarView?p=1" })]]);
    const erro = await ocupadoMicrosoft(cred(), "a", "b", tz, busca, async () => {}).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroMicrosoft);
  });

  test("401 do Graph vira erro de token", async () => {
    const { busca } = falso([token(), ["/me/calendarView", () => ({}), 401]]);
    const erro = await ocupadoMicrosoft(cred(), "a", "b", tz, busca, async () => {}).catch((e: unknown) => e);
    expect((erro as ErroMicrosoft).tipo).toBe("token");
  });
});

describe("criar evento no Outlook", () => {
  const base = {
    titulo: "Mentoria",
    descricao: "Com Ana",
    inicio: "2026-11-20T13:00:00.000Z",
    fim: "2026-11-20T14:00:00.000Z",
    tz: "America/Sao_Paulo",
    convidado: "ana@exemplo.com",
    requestId: "req-1",
  };
  const montar = (provedores: string[]) =>
    falso([
      token(),
      ["/me/calendar?", () => ({ allowedOnlineMeetingProviders: provedores })],
      ["/me/events", () => ({ id: "ev1", onlineMeeting: provedores.includes("teamsForBusiness") ? { joinUrl: "https://teams.microsoft.com/l/x" } : null })],
    ]);
  const corpoDoEvento = (chamadas: Chamada[]) => {
    const post = chamadas.find((c) => c.url.includes("/me/events"))!;
    expect(post.init?.method).toBe("POST");
    return JSON.parse(String(post.init?.body)) as Record<string, unknown>;
  };

  test("agenda permite Teams e não há local: pede reunião do Teams e devolve o link", async () => {
    const { busca, chamadas } = montar(["teamsForBusiness"]);
    const r = await criarEventoMicrosoft(cred(), base, busca, async () => {});
    expect(r).toEqual({ id: "ev1", meetUrl: "https://teams.microsoft.com/l/x" });
    const corpo = corpoDoEvento(chamadas);
    expect(corpo).toMatchObject({
      subject: "Mentoria",
      body: { contentType: "text", content: "Com Ana" },
      start: { dateTime: "2026-11-20T13:00:00.000Z", timeZone: "UTC" },
      end: { dateTime: "2026-11-20T14:00:00.000Z", timeZone: "UTC" },
      transactionId: "req-1",
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
      attendees: [{ emailAddress: { address: "ana@exemplo.com" }, type: "required" }],
    });
    expect(corpo.location).toBeUndefined();
  });

  test("conta pessoal (sem Teams): evento sem reunião online e sem link", async () => {
    const { busca, chamadas } = montar([]);
    const r = await criarEventoMicrosoft(cred(), { ...base, convidado: null }, busca, async () => {});
    expect(r).toEqual({ id: "ev1", meetUrl: null });
    const corpo = corpoDoEvento(chamadas);
    expect(corpo.isOnlineMeeting).toBeUndefined();
    expect(corpo.onlineMeetingProvider).toBeUndefined();
    expect(corpo.attendees).toBeUndefined();
    expect(corpo.transactionId).toBe("req-1");
  });

  test("com local: usa o local e não pede Teams, mesmo permitido", async () => {
    const { busca, chamadas } = montar(["teamsForBusiness"]);
    await criarEventoMicrosoft(cred(), { ...base, local: "Rua A, 10" }, busca, async () => {});
    const corpo = corpoDoEvento(chamadas);
    expect(corpo.location).toEqual({ displayName: "Rua A, 10" });
    expect(corpo.isOnlineMeeting).toBeUndefined();
    expect(corpo.transactionId).toBe("req-1");
  });
});

describe("conexão com a Microsoft", () => {
  test("URL de autorização: PKCE S256, escopos, redirect local e nenhum client_secret", () => {
    const u = new URL(urlDeAutorizacaoMicrosoft({ clientId: "cid", tenant: "common", redirect: "http://localhost:5555/", desafio: "d", state: "s" }));
    expect(u.origin + u.pathname).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(u.searchParams.get("code_challenge")).toBe("d");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("scope")?.split(" ")).toEqual(ESCOPOS_MICROSOFT);
    expect(ESCOPOS_MICROSOFT).toEqual(["offline_access", "Calendars.ReadWrite", "User.Read"]);
    expect(u.searchParams.get("redirect_uri")).toBe("http://localhost:5555/");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("state")).toBe("s");
    expect(u.toString()).not.toContain("secret");
  });

  test("troca do código sem secret devolve o refresh token; erro explica", async () => {
    const { busca, chamadas } = falso([["/token", () => ({ access_token: "a", refresh_token: "r" })]]);
    const o = { clientId: "cid", tenant: "contoso", redirect: "http://localhost:5555/", codigo: "c", verificador: "v" };
    expect(await trocarCodigoMicrosoft(o, busca)).toEqual({ ok: true, refreshToken: "r", accessToken: "a" });
    expect(chamadas[0]!.url).toBe("https://login.microsoftonline.com/contoso/oauth2/v2.0/token");
    const corpo = new URLSearchParams(String(chamadas[0]!.init?.body));
    expect(corpo.get("code_verifier")).toBe("v");
    expect(corpo.get("grant_type")).toBe("authorization_code");
    expect(String(chamadas[0]!.init?.body)).not.toContain("secret");

    const semRefresh = await trocarCodigoMicrosoft(o, falso([["/token", () => ({ access_token: "a" })]]).busca);
    expect(semRefresh.ok).toBe(false);
    const recusado = await trocarCodigoMicrosoft(o, falso([["/token", () => ({ error: "invalid_grant", error_description: "AADSTS70000" }), 400]]).busca);
    expect(recusado).toEqual({ ok: false, erro: "invalid_grant: AADSTS70000" });
  });

  test("conta conectada: userPrincipalName, ou mail quando vier", async () => {
    const { busca, chamadas } = falso([token(), ["/me?", () => ({ userPrincipalName: "dono@contoso.com", mail: null })]]);
    expect(await contaMicrosoft(cred(), busca, async () => {})).toBe("dono@contoso.com");
    expect(chamadas.find((c) => c.url.includes("/me?"))!.url).toContain("$select=userPrincipalName,mail");
  });

  test("ambiente: MS_CLIENT_ID obrigatório, tenant padrão common", () => {
    expect(msNoAmbiente({})).toBeNull();
    expect(msNoAmbiente({ MS_CLIENT_ID: " cid " })).toEqual({ clientId: "cid", tenant: "common" });
    expect(msNoAmbiente({ MS_CLIENT_ID: "cid", MS_TENANT: "contoso" })).toEqual({ clientId: "cid", tenant: "contoso" });
  });
});
