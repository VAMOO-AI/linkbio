import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { novoPkce, trocarCodigo, urlDeAutorizacao } from "@/lib/agendamento/conectar";
import { ESCOPOS_GOOGLE } from "@/lib/agendamento/google";

const base = { clientId: "id.apps.googleusercontent.com", clientSecret: "s", redirect: "http://127.0.0.1:5555/", codigo: "c", verificador: "v" };
const responde = (corpo: unknown, status = 200) => async () => new Response(JSON.stringify(corpo), { status });

describe("conexão com o Google", () => {
  test("PKCE: o desafio é o SHA-256 do verificador; state muda a cada vez", () => {
    const a = novoPkce();
    const b = novoPkce();
    const esperado = createHash("sha256").update(a.verificador).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(a.desafio).toBe(esperado);
    expect(a.state).not.toBe(b.state);
  });

  test("URL pede acesso offline, consentimento, os dois escopos e volta para o endereço local", () => {
    const u = new URL(urlDeAutorizacao({ clientId: base.clientId, redirect: base.redirect, desafio: "d", state: "s" }));
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("redirect_uri")).toBe(base.redirect);
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("scope")?.split(" ")).toEqual(ESCOPOS_GOOGLE);
  });

  test("troca com sucesso devolve o refresh token", async () => {
    const r = await trocarCodigo(base, responde({ access_token: "a", refresh_token: "r", scope: ESCOPOS_GOOGLE.join(" ") }));
    expect(r).toEqual({ ok: true, refreshToken: "r", accessToken: "a" });
  });

  test("sem refresh token, sem escopo da agenda ou com erro do Google: explica o que fazer", async () => {
    const semRefresh = await trocarCodigo(base, responde({ access_token: "a", scope: ESCOPOS_GOOGLE.join(" ") }));
    expect(semRefresh.ok === false && semRefresh.erro).toContain("myaccount.google.com/permissions");
    const semEscopo = await trocarCodigo(base, responde({ access_token: "a", refresh_token: "r", scope: ESCOPOS_GOOGLE[1] }));
    expect(semEscopo.ok === false && semEscopo.erro).toContain("marque todas");
    const recusado = await trocarCodigo(base, responde({ error: "invalid_grant", error_description: "Bad Request" }, 400));
    expect(recusado).toEqual({ ok: false, erro: "invalid_grant: Bad Request" });
  });
});
