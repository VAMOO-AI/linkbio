import arquivo from "@/public/youtube/videos.json";

/**
 * Últimos vídeos de um canal do YouTube, gravados por `npm run youtube` em public/youtube/.
 * Import estático (não fs): o registro dos blocos também roda na prévia do /admin, no navegador.
 */
export type VideoDoCanal = {
  id: string;
  titulo: string;
  /** Data de publicação, AAAA-MM-DD. */
  publicado: string;
  url: string;
  /** Caminho em public/ (ex.: "/youtube/ABC.webp"). */
  imagem: string;
  short: boolean;
};

export type Canal = { canal: string; coletadoEm: string; videos: VideoDoCanal[] };

const ID = /^[A-Za-z0-9_-]{11}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Só o que tem cara de vídeo válido: arquivo editado à mão não derruba a página. */
export function lerCanal(bruto: unknown): Canal {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const videos = (Array.isArray(o.videos) ? o.videos : []).filter((v): v is VideoDoCanal => {
    if (!v || typeof v !== "object") return false;
    const x = v as VideoDoCanal;
    return (
      ID.test(String(x.id)) &&
      typeof x.titulo === "string" &&
      x.titulo.trim() !== "" &&
      DATA.test(String(x.publicado)) &&
      /^https:\/\/www\.youtube\.com\//.test(String(x.url)) &&
      String(x.imagem).startsWith("/") &&
      typeof x.short === "boolean"
    );
  });
  return {
    canal: typeof o.canal === "string" ? o.canal.toLowerCase() : "",
    coletadoEm: typeof o.coletadoEm === "string" ? o.coletadoEm : "",
    videos,
  };
}

/** Vídeos do @ pedido, no máximo `limite`; sem `shorts`, os Shorts ficam de fora. Outro canal no arquivo devolve lista vazia. */
export function videosDo(canal: string, limite: number, shorts = false, dados: Canal = lerCanal(arquivo)): VideoDoCanal[] {
  const nome = canal.replace(/^@+/, "").toLowerCase();
  if (!nome || dados.canal !== nome) return [];
  return dados.videos.filter((v) => shorts || !v.short).slice(0, limite);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-11-10" vira "10 nov 2026" (sem fuso: a data já vem pronta do feed). */
export function dataCurta(publicado: string): string {
  const [a, m, d] = publicado.split("-").map(Number);
  if (!a || !m || !d || m > 12) return "";
  return `${d} ${MESES[m - 1]} ${a}`;
}
