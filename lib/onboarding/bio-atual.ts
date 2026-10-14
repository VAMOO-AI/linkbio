/**
 * Onboarding: importa os links da bio que a pessoa já usa (Linktree, Beacons e afins).
 * Linktree traz os links num JSON dentro da página; nas outras ferramentas, lê os links da página.
 */

export type LinkImportado = { titulo: string; url: string };

export type BioAtual = { ferramenta: string; url: string; titulo: string; links: LinkImportado[] };

const FERRAMENTAS: Record<string, string> = {
  "linktr.ee": "Linktree",
  "beacons.ai": "Beacons",
  "bio.site": "Bio.site",
  "lnk.bio": "Lnk.Bio",
  "taplink.cc": "Taplink",
  "taplink.at": "Taplink",
  "linkin.bio": "Linkin.bio",
  "campsite.bio": "Campsite",
  "solo.to": "solo.to",
  "carrd.co": "Carrd",
  "linkme.bio": "Linkme",
  "msha.ke": "Milkshake",
  "allmylinks.com": "AllMyLinks",
  "bento.me": "Bento",
  "snipfeed.co": "Snipfeed",
  "stan.store": "Stan",
  "hoo.be": "Hoo.be",
  "komi.io": "Komi",
  "linklist.ai": "Linklist",
  "linkr.bio": "Linkr",
  "flowcode.com": "Flowcode",
};

/** Nome da ferramenta de link na bio, ou null se o endereço não for de uma delas. */
export function ferramentaDeBio(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  for (const [dominio, nome] of Object.entries(FERRAMENTAS)) {
    if (host === dominio || host.endsWith(`.${dominio}`)) return nome;
  }
  return null;
}

const decodificar = (t: string) =>
  t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const semTags = (t: string) => decodificar(t.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function doLinktree(html: string): { titulo: string; links: LinkImportado[] } | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const pp = (JSON.parse(m[1]!) as { props?: { pageProps?: Record<string, unknown> } }).props?.pageProps ?? {};
    const brutos = [
      ...((pp.links as Record<string, unknown>[] | undefined) ?? []),
      ...((pp.socialLinks as Record<string, unknown>[] | undefined) ?? []),
    ];
    const links = brutos
      .map((l) => ({ titulo: String(l.title ?? l.type ?? "").trim(), url: String(l.url ?? "").trim() }))
      .filter((l) => /^https?:\/\//.test(l.url));
    return { titulo: String(pp.pageTitle ?? pp.username ?? ""), links };
  } catch {
    return null;
  }
}

export function lerBioAtual(html: string, url: string): BioAtual {
  const ferramenta = ferramentaDeBio(url) ?? "outra";
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* fica vazio */
  }
  const lt = ferramenta === "Linktree" ? doLinktree(html) : null;
  let links = lt?.links;
  if (!links || links.length === 0) {
    links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => ({ titulo: semTags(m[2]!), url: decodificar(m[1]!) }))
      .filter((l) => {
        if (!/^https?:\/\//.test(l.url)) return false;
        try {
          const h = new URL(l.url).hostname.replace(/^www\./, "");
          // Fora: links da própria ferramenta (cadastro, denúncia, termos).
          return h !== host && !h.endsWith(`.${host}`) && ferramentaDeBio(l.url) === null;
        } catch {
          return false;
        }
      });
  }
  const vistos = new Set<string>();
  const unicos = links.filter((l) => (vistos.has(l.url) ? false : (vistos.add(l.url), true)));
  const titulo = lt?.titulo || semTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  return { ferramenta, url, titulo, links: unicos.slice(0, 40) };
}
