import "server-only";
import { after } from "next/server";
import { obterConfig } from "@/lib/config-fonte";
import { abertoDoCookie, ipDoPedido } from "@/lib/lead";
import { qrSvg } from "@/lib/qr";
import { acharBlocoAgendamento, type BlocoAgendamento } from "@/lib/agendamento/regra";
import { remarcar } from "@/lib/agendamento/remarcar";
import { horariosLivres, reservar, type ResultadoReserva } from "@/lib/agendamento/reserva";
import {
  agendamentoNoAmbiente,
  dadosDosBlocos,
  depsDeRemarcar,
  depsDeStatus,
  depsDoServidor,
  erroDeConexao,
  pagamentoNoAmbiente,
  salDaAgenda,
} from "@/lib/agendamento/servidor";
import { consultarStatus, varrerCaixa } from "@/lib/agendamento/status";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "cache-control": "no-store" };
const LIMITE_CORPO = 10_000;
const DESLIGADO = "A agenda online não está disponível agora. Chame no WhatsApp para marcar.";

// atalho: cache da lista de horários na memória da função, por 60 s; poupa a cota do Google. Revisitar com muito tráfego.
const cache = new Map<string, { em: number; corpo: unknown }>();
const CACHE_MS = 60_000;

function json(corpo: unknown, status = 200): Response {
  return Response.json(corpo, { status, headers: SEM_CACHE });
}

const TOKEN = /^[A-Za-z0-9_-]{32,64}$/;

function provedorDe(bloco: BlocoAgendamento) {
  return bloco.provedor ?? "google";
}

/** Bloco que cobra mas falta segredo no ambiente: fica desligado (vira WhatsApp), nunca marca de graça. */
function blocoPronto(bloco: BlocoAgendamento): boolean {
  if (!agendamentoNoAmbiente(provedorDe(bloco))) return false;
  const falta = pagamentoNoAmbiente(bloco);
  if (falta.length) console.error(`agendamento: cobrança sem ${falta.join(", ")} no ambiente; bloco desligado.`);
  return falta.length === 0;
}

/**
 * Horários livres: GET /api/agendamento?bloco=<id>&servico=<id>. Sem nome nem dado de ninguém.
 * Estado da reserva paga: GET /api/agendamento?bloco=<id>&token=<token> (a tela do Pix pergunta a cada ~10 s).
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const idBloco = url.searchParams.get("bloco") ?? "";
  const servico = url.searchParams.get("servico") ?? "";
  const token = url.searchParams.get("token");
  const config = await obterConfig();
  const bloco = acharBlocoAgendamento(config.blocks, idBloco);
  if (!bloco) return json({ ok: false, motivo: "sumiu", mensagem: "Esta agenda não está mais disponível." }, 404);
  if (!blocoPronto(bloco)) return json({ ok: false, motivo: "desligado", mensagem: DESLIGADO }, 503);

  const tz = config.site.tz;
  const ctxStatus = () => ({ tz, agora: Date.now(), dados: dadosDosBlocos(config.blocks, config.site.url), deps: depsDeStatus(tz, provedorDe(bloco)) });

  if (token !== null) {
    if (!TOKEN.test(token)) return json({ ok: false, mensagem: "Link inválido." }, 400);
    try {
      const estado = await consultarStatus(token, ctxStatus());
      if (!estado) return json({ ok: false, mensagem: "Reserva não encontrada." }, 404);
      if (estado.estado === "confirmado") cache.clear();
      return json({ ok: true, ...estado });
    } catch (e) {
      console.error("agendamento: status indisponível", e instanceof Error ? e.message : e);
      return json({ ok: false, mensagem: "Não deu para conferir agora. Tente de novo em instantes." }, 503);
    }
  }

  // Modo e-mail: quem abre a bio também move a leitura da caixa (com trava de 20 s), depois da resposta.
  if (bloco.pagamento?.modo === "email") {
    after(() => varrerCaixa(ctxStatus()).catch((e) => console.error("agendamento: varredura da caixa falhou", e instanceof Error ? e.message : e)));
  }

  const chave = `${idBloco}:${servico}`;
  const guardado = cache.get(chave);
  if (guardado && Date.now() - guardado.em < CACHE_MS) return json(guardado.corpo);

  try {
    const horarios = await horariosLivres(bloco, tz, servico, depsDoServidor(tz, provedorDe(bloco)), Date.now());
    if (!horarios) return json({ ok: false, motivo: "servico", mensagem: "Escolha um dos serviços da lista." }, 400);
    const corpo = { ok: true, tz: config.site.tz, horarios: horarios.map(({ inicio, dia, hora }) => ({ inicio, dia, hora })) };
    cache.set(chave, { em: Date.now(), corpo });
    return json(corpo);
  } catch (e) {
    // Falha fechada: sem o Google, nenhum horário (melhor que marcar por cima de compromisso).
    const motivo = erroDeConexao(e) ? "desconectado" : "falha";
    console.error(`agendamento: horários indisponíveis (${motivo})`, e instanceof Error ? e.message : e);
    return json({ ok: false, motivo, mensagem: DESLIGADO }, 503);
  }
}

function status(r: ResultadoReserva): number {
  if (r.tipo === "ok" || r.tipo === "pagar" || r.tipo === "isca") return 200;
  if (r.tipo === "ocupado") return 409;
  if (r.tipo === "limite") return 429;
  if (r.tipo === "falha") return 503;
  return 400;
}

function mensagem(r: ResultadoReserva): string {
  if (r.tipo === "cedo") return "Espere um instante e confirme de novo.";
  if (r.tipo === "limite") return "Você já marcou horários demais hoje. Chame no WhatsApp.";
  if ("mensagem" in r) return r.mensagem;
  return "";
}

/** Reserva: POST /api/agendamento (JSON). */
export async function POST(request: Request): Promise<Response> {
  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(tamanho) && tamanho > LIMITE_CORPO) return json({ ok: false, mensagem: "Envio grande demais." }, 400);

  let bruto: Record<string, unknown>;
  try {
    const lido = (await request.json()) as unknown;
    bruto = lido && typeof lido === "object" && !Array.isArray(lido) ? (lido as Record<string, unknown>) : {};
  } catch {
    return json({ ok: false, mensagem: "Não foi possível ler o pedido." }, 400);
  }
  // A página pode estar em cache: a hora da visita vem do cookie, senão do campo escondido.
  const peloCookie = abertoDoCookie(request.headers.get("cookie"));
  if (peloCookie) bruto.aberto = peloCookie;

  const config = await obterConfig();
  const idBloco = typeof bruto.bloco === "string" ? bruto.bloco : "";
  const bloco = acharBlocoAgendamento(config.blocks, idBloco);
  if (!bloco) return json({ ok: false, mensagem: "Esta agenda não está mais disponível." }, 404);
  if (!blocoPronto(bloco)) return json({ ok: false, mensagem: DESLIGADO }, 503);

  // Trocar horário pelo link do convite: { acao: "remarcar", bloco, token, inicio }.
  if (bruto.acao === "remarcar") {
    const token = typeof bruto.token === "string" ? bruto.token : "";
    if (!TOKEN.test(token)) return json({ ok: false, mensagem: "Link inválido." }, 400);
    const m = await remarcar(token, typeof bruto.inicio === "string" ? bruto.inicio : "", {
      bloco,
      tz: config.site.tz,
      agora: Date.now(),
      deps: depsDeRemarcar(config.site.tz, provedorDe(bloco)),
    });
    if (m.tipo === "ok") {
      cache.clear();
      return json({ ok: true, ...m.confirmacao });
    }
    const codigo = { invalido: 404, prazo: 409, ocupado: 409, falha: 503 }[m.tipo];
    return json({ ok: false, motivo: m.tipo, mensagem: m.mensagem }, codigo);
  }

  const r = await reservar(bruto, {
    bloco,
    idBloco,
    tz: config.site.tz,
    agora: Date.now(),
    ip: ipDoPedido(request),
    sal: salDaAgenda(),
    referer: request.headers.get("referer"),
    deps: depsDoServidor(config.site.tz, provedorDe(bloco)),
  });
  if (r.tipo === "ok" || r.tipo === "pagar") cache.clear();
  if (r.tipo === "isca") return json({ ok: true });
  if (r.tipo === "ok") return json({ ok: true, ...r.confirmacao });
  if (r.tipo === "pagar") {
    const { qrBase64, ...pagamento } = r.pagamento;
    return json({
      ok: true,
      pagar: true,
      ...r.confirmacao,
      pagamento: {
        ...pagamento,
        // O Mercado Pago manda o QR em PNG; no modo e-mail o QR sai do copia-e-cola.
        qr: qrBase64 ? `data:image/png;base64,${qrBase64}` : `data:image/svg+xml;base64,${Buffer.from(qrSvg(pagamento.copiaECola)).toString("base64")}`,
      },
    });
  }
  return json({ ok: false, motivo: r.tipo, mensagem: mensagem(r) }, status(r));
}
