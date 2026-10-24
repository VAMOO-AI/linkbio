import "server-only";
import { obterConfig } from "@/lib/config-fonte";
import { abertoDoCookie, ipDoPedido } from "@/lib/lead";
import { lerSupabase } from "@/lib/supabase-chave";
import { ErroGoogle } from "@/lib/agendamento/google";
import { acharBlocoAgendamento } from "@/lib/agendamento/regra";
import { horariosLivres, reservar, type ResultadoReserva } from "@/lib/agendamento/reserva";
import { agendamentoNoAmbiente, depsDoServidor } from "@/lib/agendamento/servidor";

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

/** Horários livres: GET /api/agendamento?bloco=<id>&servico=<id>. Sem nome nem dado de ninguém. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const idBloco = url.searchParams.get("bloco") ?? "";
  const servico = url.searchParams.get("servico") ?? "";
  if (!agendamentoNoAmbiente()) return json({ ok: false, motivo: "desligado", mensagem: DESLIGADO }, 503);
  const config = await obterConfig();
  const bloco = acharBlocoAgendamento(config.blocks, idBloco);
  if (!bloco) return json({ ok: false, motivo: "sumiu", mensagem: "Esta agenda não está mais disponível." }, 404);

  const chave = `${idBloco}:${servico}`;
  const guardado = cache.get(chave);
  if (guardado && Date.now() - guardado.em < CACHE_MS) return json(guardado.corpo);

  try {
    const horarios = await horariosLivres(bloco, config.site.tz, servico, depsDoServidor(config.site.tz), Date.now());
    if (!horarios) return json({ ok: false, motivo: "servico", mensagem: "Escolha um dos serviços da lista." }, 400);
    const corpo = { ok: true, tz: config.site.tz, horarios: horarios.map(({ inicio, dia, hora }) => ({ inicio, dia, hora })) };
    cache.set(chave, { em: Date.now(), corpo });
    return json(corpo);
  } catch (e) {
    // Falha fechada: sem o Google, nenhum horário (melhor que marcar por cima de compromisso).
    const motivo = e instanceof ErroGoogle && e.tipo === "token" ? "desconectado" : "falha";
    console.error(`agendamento: horários indisponíveis (${motivo})`, e instanceof Error ? e.message : e);
    return json({ ok: false, motivo, mensagem: DESLIGADO }, 503);
  }
}

function status(r: ResultadoReserva): number {
  if (r.tipo === "ok" || r.tipo === "isca") return 200;
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
  if (!agendamentoNoAmbiente()) return json({ ok: false, mensagem: DESLIGADO }, 503);

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

  const r = await reservar(bruto, {
    bloco,
    idBloco,
    tz: config.site.tz,
    agora: Date.now(),
    ip: ipDoPedido(request),
    sal: process.env.ADMIN_SESSION_SECRET || lerSupabase(process.env)?.url || "linkbio-agenda",
    referer: request.headers.get("referer"),
    deps: depsDoServidor(config.site.tz),
  });
  if (r.tipo === "ok") cache.clear();
  if (r.tipo === "isca") return json({ ok: true });
  if (r.tipo === "ok") return json({ ok: true, ...r.confirmacao });
  return json({ ok: false, motivo: r.tipo, mensagem: mensagem(r) }, status(r));
}
