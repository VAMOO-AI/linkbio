import { describe, expect, test } from "vitest";
import { ConfigSchema } from "../config/schema";
import { mensagemConcierge, respostaQueDecide, type RespostaConcierge } from "../lib/concierge";
import exemplo from "./fixtures/config-exemplo";
import { flow, ofertas } from "./fixtures/concierge-duas-perguntas";

/** Quem decide o final do concierge (`decide`) e o texto que vai para o WhatsApp. */

const resposta = (passo: number, id: string) => flow[passo]!.options.find((o) => o.id === id)! as RespostaConcierge;

/** Config válida com o concierge da bio real e o `decide` pedido. */
function configCom(decide?: string, flowNovo: unknown = flow): unknown {
  const cfg = JSON.parse(JSON.stringify(exemplo)) as Record<string, unknown>;
  cfg.offers = ofertas;
  cfg.blocks = [{ type: "concierge", mode: "roteiro", ...(decide === undefined ? {} : { decide }), flow: flowNovo }];
  return cfg;
}

const mensagens = (r: ReturnType<typeof ConfigSchema.safeParse>) => (r.success ? [] : r.error.issues.map((i) => i.message));

describe("respostaQueDecide", () => {
  const respostas = [resposta(0, "servicos"), resposta(1, "gestor")];

  test('"primeira" (padrão): a 1ª resposta decide, as outras são contexto (o comportamento de antes)', () => {
    expect(respostaQueDecide(respostas)).toBe(respostas[0]);
    expect(respostaQueDecide(respostas, "primeira")).toBe(respostas[0]);
    // Bio real: "Aprender" + "Lidero um time" continua levando à Mentoria, com o motivo da 1ª.
    const r = respostaQueDecide([resposta(0, "mentoria"), resposta(1, "gestor")]);
    expect(r?.offer).toBe("mentoria");
    expect(r?.reason).toBe(resposta(0, "mentoria").reason);
  });

  test('"ultima": "Lidero um time" leva a Serviços, com o motivo dela', () => {
    const r = respostaQueDecide([resposta(0, "mentoria"), resposta(1, "gestor")], "ultima");
    expect(r?.offer).toBe("servicos");
    expect(r?.reason).toBe("Liderando um time, a Estúdio Norte entende a sua operação, projeta a solução e entrega o sistema funcionando.");
    // E "Sou dono(a)" leva à Mentoria mesmo quem escolheu "Receber um sistema pronto".
    expect(respostaQueDecide([resposta(0, "servicos"), resposta(1, "dono")], "ultima")?.offer).toBe("mentoria");
  });

  test('"ultima": resposta sem destino não muda o final; vale a anterior com destino, ou a 1ª', () => {
    const contexto: RespostaConcierge = { id: "agora", label: "Agora" };
    const r1 = resposta(0, "conteudo");
    const r2 = resposta(1, "gestor");
    expect(respostaQueDecide([r1, r2, contexto], "ultima")).toBe(r2);
    expect(respostaQueDecide([r1, contexto], "ultima")).toBe(r1);
    expect(respostaQueDecide([r1], "ultima")).toBe(r1);
  });

  test('"ultima": resposta só com explicação (sem oferta) leva à conversa no WhatsApp', () => {
    const conversa: RespostaConcierge = { id: "nao-sei", label: "Não sei", reason: "Numa conversa eu entendo o seu caso.", title: "Vamos conversar" };
    const r = respostaQueDecide([resposta(0, "mentoria"), conversa], "ultima");
    expect(r).toBe(conversa);
    expect(r?.offer).toBeUndefined();
  });
});

describe("mensagemConcierge", () => {
  test("contexto na 1ª linha, linha em branco e o texto-modelo inteiro depois (campos a preencher no fim)", () => {
    const modelo = ofertas.find((o) => o.id === "servicos")!.wa!;
    const texto = mensagemConcierge(modelo, [resposta(0, "servicos"), resposta(1, "gestor")]);
    expect(texto).toBe(
      "(Vim pelo concierge: Receber um sistema pronto · Lidero um time ou área)\n\n" +
        "Oi, Marina! Quero avaliar um software 100% sob medida para a minha empresa.\n\n" +
        "O processo que quero melhorar:\nHoje ele funciona assim:\nO principal gargalo ou impacto:",
    );
    // Antes o contexto era colado no fim: "O principal gargalo ou impacto: (Vim pelo concierge: ...)".
    expect(texto.endsWith("O principal gargalo ou impacto:")).toBe(true);
  });
});

describe('schema: campo "decide" do concierge', () => {
  test("a bio real é válida sem decide, com \"primeira\" e com \"ultima\"", () => {
    for (const d of [undefined, "primeira", "ultima"]) expect(mensagens(ConfigSchema.safeParse(configCom(d)))).toEqual([]);
  });

  test("valor fora da lista é recusado, em português", () => {
    const msgs = mensagens(ConfigSchema.safeParse(configCom("meio")));
    expect(msgs.join("\n")).toMatch(/bloco concierge: decide/);
    expect(msgs.join("\n")).toMatch(/"primeira"/);
  });

  test('"ultima": resposta de outra pergunta que leva a uma oferta precisa da explicação', () => {
    const semMotivo = JSON.parse(JSON.stringify(flow));
    delete semMotivo[1].options[1].reason;
    const msgs = mensagens(ConfigSchema.safeParse(configCom("ultima", semMotivo)));
    expect(msgs).toEqual([
      'concierge: a resposta "Lidero um time ou área" da 2ª pergunta leva para uma oferta e precisa de reason (a explicação mostrada no final).',
    ]);
    // No modo "primeira" ela é ignorada: nada a corrigir.
    expect(mensagens(ConfigSchema.safeParse(configCom("primeira", semMotivo)))).toEqual([]);
  });

  test('"ultima": resposta sem oferta e sem explicação é contexto (válida); a 1ª pergunta continua pedindo explicação', () => {
    const f = JSON.parse(JSON.stringify(flow));
    f[1].options = f[1].options.map((o: Record<string, unknown>) => ({ id: o.id, label: o.label }));
    expect(mensagens(ConfigSchema.safeParse(configCom("ultima", f)))).toEqual([]);
    delete f[0].options[0].reason;
    expect(mensagens(ConfigSchema.safeParse(configCom("ultima", f))).join("\n")).toMatch(/da 1ª pergunta precisa de reason/);
  });

  test("oferta citada precisa existir em qualquer pergunta, nos dois modos", () => {
    const f = JSON.parse(JSON.stringify(flow));
    f[1].options[0].offer = "nao-existe";
    for (const d of ["primeira", "ultima"]) {
      expect(mensagens(ConfigSchema.safeParse(configCom(d, f))).join("\n")).toMatch(/concierge \(passo "role"\) referencia a oferta "nao-existe"/);
    }
  });
});
