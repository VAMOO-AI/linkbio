/**
 * Gera a config de "outra pessoa" a partir do exemplo: sem ofertas, outro nome e concierge só com
 * finais de WhatsApp. O CI do template troca o linkbio.config.ts por ela e roda os testes e o check:
 * teste que só passa com os ids do exemplo quebraria a bio de cada pessoa, e é aqui que ele aparece.
 * Uso: npx tsx scripts/config-outra-pessoa.ts > linkbio.config.ts
 */
import { ConfigSchema } from "../config/schema";
import exemplo from "../linkbio.config";

type Obj = Record<string, unknown>;
const cfg = JSON.parse(JSON.stringify(exemplo)) as Obj;

cfg.offers = [];
cfg.profile = { ...(cfg.profile as Obj), name: "Outra Pessoa", handle: "@outra.pessoa", tags: [] };
cfg.contact = { ...(cfg.contact as Obj), whatsapp: "5511987654321" };
cfg.blocks = (cfg.blocks as Obj[]).map((b) => {
  if (b.type === "cards") return { ...b, items: [] };
  if (b.type === "concierge") {
    const flow = (b.flow as Obj[]).map((p) => ({
      ...p,
      options: (p.options as Obj[]).map(({ offer: _offer, ...o }) => o),
    }));
    return { ...b, flow };
  }
  return b;
});

const r = ConfigSchema.safeParse(cfg);
if (!r.success) {
  console.error("config de outra pessoa inválida:", r.error.issues.slice(0, 5));
  process.exit(1);
}
process.stdout.write(`import { defineConfig } from "./config/schema";\n\nexport default defineConfig(${JSON.stringify(cfg, null, 2)});\n`);
