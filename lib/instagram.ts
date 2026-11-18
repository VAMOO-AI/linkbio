import arquivo from "@/public/instagram/posts.json";

/**
 * Últimos posts do Instagram, gravados por `npm run instagram` em public/instagram/.
 * Import estático (não fs): o registro dos blocos também roda na prévia do /admin, no navegador.
 */
export type PostDoFeed = {
  codigo: string;
  tipo: "imagem" | "video" | "carrossel";
  url: string;
  /** Caminho em public/ (ex.: "/instagram/ABC.webp"). */
  imagem: string;
  legenda: string;
};

export type Feed = { usuario: string; coletadoEm: string; posts: PostDoFeed[] };

const TIPOS = new Set(["imagem", "video", "carrossel"]);

/** Só o que tem cara de post válido: arquivo editado à mão não derruba a página. */
export function lerFeed(bruto: unknown): Feed {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const posts = (Array.isArray(o.posts) ? o.posts : []).filter(
    (p): p is PostDoFeed =>
      !!p &&
      typeof p === "object" &&
      typeof (p as PostDoFeed).codigo === "string" &&
      TIPOS.has((p as PostDoFeed).tipo) &&
      /^https:\/\/www\.instagram\.com\//.test(String((p as PostDoFeed).url)) &&
      String((p as PostDoFeed).imagem).startsWith("/") &&
      typeof (p as PostDoFeed).legenda === "string",
  );
  return {
    usuario: typeof o.usuario === "string" ? o.usuario.toLowerCase() : "",
    coletadoEm: typeof o.coletadoEm === "string" ? o.coletadoEm : "",
    posts,
  };
}

/** Posts do @ pedido (com ou sem "@"), no máximo `limite`. Outro @ no arquivo devolve lista vazia. */
export function postsDo(handle: string, limite: number, feed: Feed = lerFeed(arquivo)): PostDoFeed[] {
  const usuario = handle.replace(/^@+/, "").toLowerCase();
  if (!usuario || feed.usuario !== usuario) return [];
  return feed.posts.slice(0, limite);
}

/** Texto alternativo: a primeira linha da legenda, curta. */
export function textoAlternativo(post: PostDoFeed): string {
  const linha = post.legenda.split("\n").find((l) => l.trim())?.trim() ?? "";
  const curta = linha.length > 110 ? `${linha.slice(0, 107).trimEnd()}…` : linha;
  const tipo = post.tipo === "video" ? "Reel" : post.tipo === "carrossel" ? "Carrossel" : "Post";
  return curta ? `${tipo}: ${curta}` : `${tipo} do Instagram`;
}
