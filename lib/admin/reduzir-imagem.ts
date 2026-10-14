/**
 * Foto grande demais para o envio (limite em lib/admin/limites.ts) é reduzida no navegador antes de
 * subir: a foto do celular costuma passar de 4 MB e o leigo não sabe reduzir. Lado maior de até
 * 2400 px (depois 1800 e 1200, se ainda passar), JPG para foto e WebP para PNG (guarda a
 * transparência). GIF não é reduzido: perderia a animação.
 *
 * Só navegador (canvas). Devolve `null` quando não dá: formato sem redução, arquivo que não é imagem
 * de verdade ou que continua grande. Coberto pelo e2e do painel (e2e/painel.spec.ts).
 */
const REDUZIVEIS = new Set(["image/jpeg", "image/png", "image/webp"]);
const LADOS = [2400, 1800, 1200];

const paraBlob = (canvas: HTMLCanvasElement, tipo: string) =>
  new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, 0.85));

export async function reduzirImagem(arquivo: File, limite: number): Promise<File | null> {
  if (!REDUZIVEIS.has(arquivo.type)) return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    return null;
  }
  try {
    const tipo = arquivo.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    for (const lado of LADOS) {
      const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * escala));
      canvas.height = Math.max(1, Math.round(bitmap.height * escala));
      const pincel = canvas.getContext("2d");
      if (!pincel) return null;
      pincel.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      // Navegador sem WebP no canvas devolve PNG: serve, se couber.
      const blob = await paraBlob(canvas, tipo);
      if (blob && blob.size <= limite && REDUZIVEIS.has(blob.type)) {
        const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/png" ? "png" : "webp";
        return new File([blob], `${arquivo.name.replace(/\.[^.]+$/, "")}.${ext}`, { type: blob.type });
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}
