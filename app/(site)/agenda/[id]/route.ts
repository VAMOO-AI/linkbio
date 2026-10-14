import { gerarIcs } from "@/lib/agenda";
import { obterConfig } from "@/lib/config-fonte";

/**
 * Arquivo .ics de um evento (`/agenda/encontro.ics`).
 * A página é estática: este arquivo acompanha a config publicada e também
 * atualiza de hora em hora, para a duração e o fuso não ficarem presos no build.
 * `params` é uma Promise nesta versão do Next (route.md).
 */
export const revalidate = 3600;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: bruto } = await ctx.params;
  const id = decodeURIComponent(bruto).replace(/\.ics$/i, "");
  const config = await obterConfig();
  for (const bloco of config.blocks) {
    if (bloco.type !== "agenda" || bloco.enabled === false) continue;
    const evento = bloco.items.find((item) => item.id === id);
    if (!evento) continue;
    const corpo = gerarIcs(evento, config.site.tz);
    return new Response(corpo, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${id}.ics"`,
      },
    });
  }
  return new Response("Evento não encontrado.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
