/**
 * Onboarding: perfil e posts públicos do Instagram da própria pessoa, já enxutos.
 * Entrada: o que os atores oficiais da Apify devolvem (instagram-profile-scraper e
 * instagram-post-scraper). Saída: só o necessário para aprender a voz e montar a bio.
 * Fica de fora tudo que é de terceiros: comentários, marcações, seguidores.

 */

export type PostInstagram = {
  data: string;
  tipo: "imagem" | "video" | "carrossel";
  legenda: string;
  hashtags: string[];
  curtidas: number | null;
  comentarios: number | null;
  /** Conta que publicou e escreveu a legenda. */
  autor: string;
  /**
   * false quando outra conta escreveu a legenda e pôs a pessoa como coautora (parceria, homenagem).
   * Só conta para a voz se a pessoa disser que é ela quem escreve naquela conta.
   */
  proprio: boolean;
  url: string;
  /** Imagem do post (endereço temporário do Instagram): o script baixa as dos posts próprios. */
  imagem: string | null;
};

export type LinkPerfil = { titulo: string; url: string };

export type ResultadoInstagram = {
  usuario: string;
  nome: string;
  bio: string;
  links: LinkPerfil[];
  categoria: string | null;
  foto: string | null;
  privado: boolean;
  seguidores: number | null;
  totalPosts: number | null;
  /** Mais novo primeiro. */
  posts: PostInstagram[];
  coletadoEm: string;
};

export const LIMITE_POSTS = 15;

/** Aceita "@perfil", "perfil" ou o link do perfil. Devolve só o nome de usuário, em minúsculas. */
export function limparUsuario(entrada: string): string {
  let t = entrada.trim();
  const url = t.match(/instagram\.com\/([^/?#\s]+)/i);
  if (url?.[1]) t = url[1];
  t = t.replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(t)) {
    throw new Error(`"${entrada}" não parece um @ do Instagram (só letras, números, ponto e _).`);
  }
  return t;
}

type Bruto = Record<string, unknown>;

const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function tipoDoPost(v: unknown): PostInstagram["tipo"] {
  if (v === "Video") return "video";
  if (v === "Sidecar") return "carrossel";
  return "imagem";
}

/** Tira o rastreador do Instagram (l.instagram.com/?u=...) e devolve a URL de verdade. */
export function urlReal(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "l.instagram.com") return u.searchParams.get("u") ?? url;
  } catch {
    return url;
  }
  return url;
}

function linksDoPerfil(p: Bruto): LinkPerfil[] {
  const lista = Array.isArray(p.externalUrls) ? (p.externalUrls as Bruto[]) : [];
  const links = lista
    .map((l) => ({ titulo: texto(l.title).trim(), url: urlReal(texto(l.url) || texto(l.lynx_url)) }))
    .filter((l) => l.url);
  const solto = texto(p.externalUrl);
  if (solto && !links.some((l) => l.url === solto)) links.push({ titulo: "", url: solto });
  return links;
}

/**
 * Junta perfil e posts brutos num resultado enxuto. Lança erro com mensagem clara quando o
 * perfil não existe ou não veio (a skill cai no modo manual).
 */
export function normalizarInstagram(
  usuario: string,
  perfisBrutos: unknown,
  postsBrutos: unknown,
  agora: Date = new Date(),
): ResultadoInstagram {
  const perfis = Array.isArray(perfisBrutos) ? (perfisBrutos as Bruto[]) : [];
  // Só o perfil pedido: outro @ no resultado nunca vira "o seu".
  const p = perfis.find((x) => texto(x.username).toLowerCase() === usuario);
  if (!p || p.error || !texto(p.username)) {
    throw new Error(`Não encontrei o perfil @${usuario} no Instagram (confira o @ ou se a conta existe).`);
  }
  const posts = (Array.isArray(postsBrutos) ? (postsBrutos as Bruto[]) : [])
    .filter((x) => !x.error && texto(x.timestamp))
    .map<PostInstagram>((x) => ({
      data: texto(x.timestamp),
      tipo: tipoDoPost(x.type),
      legenda: texto(x.caption).trim(),
      hashtags: Array.isArray(x.hashtags) ? (x.hashtags as unknown[]).filter((h): h is string => typeof h === "string") : [],
      curtidas: numero(x.likesCount),
      comentarios: numero(x.commentsCount),
      autor: (texto(x.ownerUsername) || usuario).toLowerCase(),
      proprio: !texto(x.ownerUsername) || texto(x.ownerUsername).toLowerCase() === usuario,
      url: texto(x.url),
      imagem: texto(x.displayUrl) || null,
    }))
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, LIMITE_POSTS);
  const categoria = texto(p.businessCategoryName);
  return {
    usuario: texto(p.username).toLowerCase(),
    // NFKC desfaz letras "estilizadas" de teclado de fonte (𝐓𝐮𝐝𝐨 → Tudo); as de outros alfabetos ficam.
    nome: texto(p.fullName).normalize("NFKC").trim(),
    bio: texto(p.biography).normalize("NFKC").trim(),
    links: linksDoPerfil(p),
    categoria: categoria && categoria !== "None" ? categoria : null,
    foto: texto(p.profilePicUrlHD) || texto(p.profilePicUrl) || null,
    privado: p.private === true,
    seguidores: numero(p.followersCount),
    totalPosts: numero(p.postsCount),
    posts,
    coletadoEm: agora.toISOString(),
  };
}
