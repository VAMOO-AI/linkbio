/**
 * Cores marcantes de uma imagem (foto do perfil, que em loja costuma ser o logo).
 * Para quem não tem site: dá de onde tirar a cor de destaque sem chute.
 * Ignora branco, preto e cinzas; agrupa tons parecidos; devolve até 3, da mais presente à menos.
 */
import sharp from "sharp";

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;

export function coresMarcantes(pixels: Uint8Array | Buffer, canais: number, limite = 3): string[] {
  const grupos = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i + 2 < pixels.length; i += canais) {
    const r = pixels[i]!, g = pixels[i + 1]!, b = pixels[i + 2]!;
    if (canais === 4 && pixels[i + 3]! < 128) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    // Sem saturação (cinza), quase branco ou quase preto: não é cor de marca.
    if (max - min < 40 || max < 40 || min > 225) continue;
    const chave = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const gr = grupos.get(chave) ?? { r: 0, g: 0, b: 0, n: 0 };
    gr.r += r; gr.g += g; gr.b += b; gr.n++;
    grupos.set(chave, gr);
  }
  // Tons quase iguais que caíram em grupos vizinhos viram um só (o mais presente absorve).
  const media = (g: { r: number; g: number; b: number; n: number }) => [g.r / g.n, g.g / g.n, g.b / g.n] as const;
  const juntos: { r: number; g: number; b: number; n: number }[] = [];
  for (const g of [...grupos.values()].sort((a, b) => b.n - a.n)) {
    const [r, gg, b] = media(g);
    const perto = juntos.find((j) => {
      const [jr, jg, jb] = media(j);
      return Math.hypot(r - jr, gg - jg, b - jb) < 48;
    });
    if (perto) {
      perto.r += g.r; perto.g += g.g; perto.b += g.b; perto.n += g.n;
    } else juntos.push({ ...g });
  }
  const total = juntos.reduce((s, g) => s + g.n, 0);
  return juntos
    .filter((g) => g.n >= Math.max(3, total * 0.04))
    .sort((a, b) => b.n - a.n)
    .slice(0, limite)
    .map((g) => hex(g.r / g.n, g.g / g.n, g.b / g.n));
}

export async function coresDaImagem(arquivo: string): Promise<string[]> {
  const { data, info } = await sharp(arquivo).resize(48, 48, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return coresMarcantes(data, info.channels);
}
