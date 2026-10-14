import "server-only";
import { obterConfig } from "./config-fonte";
import {
  LIMITE_IP_DIA,
  MODELO_PADRAO,
  atender,
  diaEm,
  extrairFatos,
  hashIp,
  lerLimiteDia,
  pedidoAnthropic,
  reservarUso,
  type ResultadoAtendimento,
} from "./concierge-ia";
import { rest, supabaseConfigurado } from "./supabase";

/** Contagem do processo. Com Supabase, a tabela é a fonte; a memória cobre a falha do banco. */
const memoria = new Map<string, number>();
const TIMEOUT_MS = 8_000;

export function ipDoPedido(request: Request): string {
  const encaminhado = request.headers.get("x-forwarded-for");
  const primeiro = encaminhado?.split(",")[0]?.trim();
  return primeiro || request.headers.get("x-real-ip")?.trim() || "";
}

/** Cabeçalho só vale com ANTHROPIC_BASE_URL, que existe para o teste apontar a API falsa. */
export function testeLiberado(request: Request): boolean {
  return Boolean(process.env.ANTHROPIC_BASE_URL) && request.headers.get("x-linkbio-concierge-teste") === "1";
}

async function reservar(dia: string, ipHash: string, limiteIp: number, limiteDia: number): Promise<boolean> {
  if (supabaseConfigurado()) {
    try {
      const ok = await rest<boolean>("rpc/concierge_uso_reservar", {
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({ p_dia: dia, p_ip_hash: ipHash, p_teto_ip: limiteIp, p_teto_dia: limiteDia }),
      });
      return ok === true;
    } catch {
      console.error("[linkbio] concierge ia: limite no banco indisponível; usando memória");
    }
  }
  return reservarUso(memoria, dia, ipHash, limiteIp, limiteDia);
}

export async function responderDuvida(pergunta: unknown, ip: string, teste: boolean): Promise<ResultadoAtendimento> {
  const config = await obterConfig();
  const modoIa = config.blocks.some((b) => b.type === "concierge" && b.enabled !== false && b.mode === "ia");
  if (!modoIa && !teste) return { tipo: "roteiro" };
  const dia = diaEm(config.site.tz);
  const sal = process.env.ADMIN_SESSION_SECRET || "concierge";
  const ipHash = hashIp(ip || "sem-ip", sal);
  const limiteDia = lerLimiteDia(process.env.CONCIERGE_IA_LIMITE_DIA);
  const chave = process.env.ANTHROPIC_API_KEY;
  return atender({
    chave,
    pergunta,
    fatos: extrairFatos(config),
    idsOfertas: config.offers.map((o) => o.id),
    dia,
    ipHash,
    limiteIp: LIMITE_IP_DIA,
    limiteDia,
    memoria,
    reservar: () => reservar(dia, ipHash, LIMITE_IP_DIA, limiteDia),
    chamar: async ({ system, user }) => {
      const pedido = pedidoAnthropic({
        chave: chave ?? "",
        modelo: process.env.ANTHROPIC_MODEL?.trim() || MODELO_PADRAO,
        system,
        user,
        baseUrl: process.env.ANTHROPIC_BASE_URL,
      });
      const resp = await fetch(pedido.url, {
        method: "POST",
        headers: pedido.headers,
        body: pedido.body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resp.ok) throw new Error(`anthropic ${resp.status}`);
      const json = (await resp.json()) as { content?: { type?: string; text?: string }[] };
      const texto = json.content?.find((c) => c.type === "text")?.text;
      if (typeof texto !== "string" || !texto.trim()) throw new Error("anthropic sem texto");
      return texto;
    },
  });
}
