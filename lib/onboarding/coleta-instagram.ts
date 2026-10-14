/**
 * Coleta do Instagram na Apify, com o token da própria pessoa (APIFY_TOKEN), pelos atores oficiais
 * de perfil e de posts. A resposta bruta vira o resultado enxuto de ./instagram.
 */
import { LIMITE_POSTS, normalizarInstagram, type ResultadoInstagram } from "./instagram";

type Buscar = typeof fetch;

const APIFY = "https://api.apify.com/v2/acts";
const TEMPO_LIMITE_S = 180;

async function rodarAtor(buscar: Buscar, token: string, ator: string, entrada: object): Promise<unknown> {
  const url = `${APIFY}/${ator}/run-sync-get-dataset-items?timeout=${TEMPO_LIMITE_S}`;
  const r = await buscar(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(entrada),
    signal: AbortSignal.timeout((TEMPO_LIMITE_S + 20) * 1000),
  });
  if (r.status === 401 || r.status === 403) throw new Error("A Apify recusou o token (confira se copiou inteiro).");
  if (r.status === 402) throw new Error("O crédito da conta Apify acabou neste mês.");
  if (!r.ok) throw new Error(`A Apify respondeu ${r.status} ao buscar o Instagram.`);
  return r.json();
}

export type ColetaInstagram = { resultado: ResultadoInstagram; falhaPosts: string | null };

/**
 * Perfil e posts em paralelo. Se só os posts falharem, o perfil vale (com aviso); se o perfil
 * falhar, a coleta toda falha. Posts fixados ficam de fora: são antigos e não mostram a voz de hoje.
 */
export async function coletarDireto(token: string, usuario: string, buscar: Buscar = fetch): Promise<ColetaInstagram> {
  const [perfis, posts] = await Promise.allSettled([
    rodarAtor(buscar, token, "apify~instagram-profile-scraper", { usernames: [usuario], includeAboutSection: false }),
    rodarAtor(buscar, token, "apify~instagram-post-scraper", { username: [usuario], resultsLimit: LIMITE_POSTS, skipPinnedPosts: true }),
  ]);
  if (perfis.status === "rejected") throw perfis.reason;
  const falhaPosts = posts.status === "rejected" ? (posts.reason as Error).message : null;
  return { resultado: normalizarInstagram(usuario, perfis.value, posts.status === "fulfilled" ? posts.value : []), falhaPosts };
}
