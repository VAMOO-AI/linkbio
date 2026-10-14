import { describe, expect, test } from "vitest";
import {
  MSG_BLOQUEIO,
  MSG_CODIGO_RUIM,
  MSG_ENVIO,
  conferirCodigo,
  decidirConfirmacao,
  decidirPedido,
  expirado,
  hashCodigo,
} from "../lib/admin/codigo";
import { enviarCodigoPorEmail, montarMensagemCodigo } from "../lib/admin/email";
import { interpretarPedido } from "../lib/admin/usuario";

const SEGREDO = "s".repeat(48);
const CODIGO = "123456";

describe("/admin: hash do código", () => {
  test("guarda hash, confere o certo e recusa o errado, outro segredo ou lixo", () => {
    const h = hashCodigo(CODIGO, SEGREDO);
    expect(h.startsWith("hmac-sha256$")).toBe(true);
    expect(h).not.toContain(CODIGO);
    expect(conferirCodigo(CODIGO, h, SEGREDO)).toBe(true);
    expect(conferirCodigo("123457", h, SEGREDO)).toBe(false);
    expect(conferirCodigo(CODIGO, h, "o".repeat(48))).toBe(false);
    expect(conferirCodigo(CODIGO, "lixo", SEGREDO)).toBe(false);
    expect(conferirCodigo(CODIGO, "", SEGREDO)).toBe(false);
  });
});

describe("/admin: expiração e uso único", () => {
  const base = { formatoOk: true, falhas: 0, cadastrado: true, confere: true, expirado: false, usado: false };

  test("código dentro do prazo entra; no instante do fim, não", () => {
    expect(expirado(1_000, 999)).toBe(false);
    expect(expirado(1_000, 1_000)).toBe(true);
  });

  test("código vencido ou já usado recebe a mesma resposta de código errado", () => {
    const vencido = decidirConfirmacao({ ...base, expirado: true });
    const usado = decidirConfirmacao({ ...base, usado: true });
    const errado = decidirConfirmacao({ ...base, confere: false });
    expect(vencido).toEqual({ ok: false, erro: MSG_CODIGO_RUIM, contaFalha: true });
    expect(usado).toEqual(errado);
  });
});

describe("/admin: limite e enumeração", () => {
  test("5 falhas bloqueiam pelo mesmo texto, cadastrado ou não", () => {
    const comConta = decidirPedido({ emailValido: true, falhas: 5, envios: 0, cadastrado: true });
    const semConta = decidirPedido({ emailValido: true, falhas: 5, envios: 0, cadastrado: false });
    expect(comConta).toEqual({ tipo: "bloqueado", erro: MSG_BLOQUEIO });
    expect(semConta).toEqual(comConta);
  });

  test("5 envios na janela também bloqueiam, sem dizer se o e-mail existe", () => {
    const comConta = decidirPedido({ emailValido: true, falhas: 0, envios: 5, cadastrado: true });
    const semConta = decidirPedido({ emailValido: true, falhas: 0, envios: 5, cadastrado: false });
    expect(comConta.tipo).toBe("bloqueado");
    expect(semConta).toEqual(comConta);
  });

  test("pedido aceito devolve a mesma frase para e-mail cadastrado ou não", () => {
    const comConta = decidirPedido({ emailValido: true, falhas: 0, envios: 0, cadastrado: true });
    const semConta = decidirPedido({ emailValido: true, falhas: 0, envios: 0, cadastrado: false });
    expect(comConta).toEqual({ tipo: "enviar", mensagem: MSG_ENVIO });
    expect(semConta).toEqual({ tipo: "fingir", mensagem: MSG_ENVIO });
  });

  test("código errado de quem não tem conta usa a mesma frase de quem tem", () => {
    const semConta = decidirConfirmacao({
      formatoOk: true,
      falhas: 0,
      cadastrado: false,
      confere: true,
      expirado: false,
      usado: false,
    });
    const errado = decidirConfirmacao({
      formatoOk: true,
      falhas: 0,
      cadastrado: true,
      confere: false,
      expirado: false,
      usado: false,
    });
    expect(semConta).toEqual(errado);
    expect(semConta.erro).toBe(MSG_CODIGO_RUIM);
  });

  test("a 6ª tentativa não chega a conferir: já está bloqueada", () => {
    const r = decidirConfirmacao({
      formatoOk: true,
      falhas: 5,
      cadastrado: true,
      confere: true,
      expirado: false,
      usado: false,
    });
    expect(r).toEqual({ ok: false, erro: MSG_BLOQUEIO, contaFalha: false });
  });
});

describe("cadastro do painel sem senha", () => {
  test("só o e-mail não gera senha", () => {
    expect(interpretarPedido(["Dona@Exemplo.com"])).toEqual({
      ok: true,
      email: "dona@exemplo.com",
      senha: null,
      gerar: false,
    });
  });

  test("--senha gera; --senha com valor usa esse valor", () => {
    expect(interpretarPedido(["dona@exemplo.com", "--senha"])).toMatchObject({ ok: true, gerar: true, senha: null });
    expect(interpretarPedido(["dona@exemplo.com", "--senha", "senha-forte-1"])).toEqual({
      ok: true,
      email: "dona@exemplo.com",
      senha: "senha-forte-1",
      gerar: false,
    });
  });

  test("e-mail inválido não cadastra", () => {
    expect(interpretarPedido(["nao-e-email"]).ok).toBe(false);
  });
});

describe("e-mail do código", () => {
  test("a mensagem traz o código e o prazo, e o erro de envio não repete o código", async () => {
    const msg = montarMensagemCodigo(CODIGO);
    expect(msg.subject).toBe("Seu código para entrar no painel");
    expect(msg.text).toContain(CODIGO);
    expect(msg.text).toMatch(/10 minutos/);

    let corpo = "";
    let auth = "";
    const fetchImpl: typeof fetch = async (_url, init) => {
      corpo = String(init?.body ?? "");
      auth = new Headers(init?.headers).get("authorization") ?? "";
      return new Response("falhou", { status: 500 });
    };
    let erro = "";
    try {
      await enviarCodigoPorEmail("dona@exemplo.com", CODIGO, { chave: "re_teste", url: "https://exemplo.test/email", fetchImpl });
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    }
    const enviado = JSON.parse(corpo) as { to: string[]; text: string; from: string };
    expect(enviado.to).toEqual(["dona@exemplo.com"]);
    expect(enviado.from).toBe("onboarding@resend.dev");
    expect(enviado.text).toContain(CODIGO);
    expect(auth).toBe("Bearer re_teste");
    expect(erro).toMatch(/500/);
    expect(erro).not.toContain(CODIGO);
  });
});
