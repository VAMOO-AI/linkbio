/**
 * Conversões do painel: o que a pessoa digita do jeito dela vira o formato que a config exige.
 * Só dados (sem servidor): o editor client importa este arquivo. Testes em tests/admin-normalizar.test.ts.
 */

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Id de 11 caracteres a partir do link do YouTube (watch?v=, youtu.be, shorts, embed, live, celular).
 * Sem link reconhecível, devolve o texto como veio (o schema explica o erro).
 */
export function idDoYoutube(texto: string): string {
  const t = texto.trim();
  if (ID_YOUTUBE.test(t)) return t;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return t;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v");
    if (!id) {
      const [, tipo, valor] = url.pathname.split("/");
      if (tipo && ["shorts", "embed", "live", "v"].includes(tipo)) id = valor ?? null;
    }
  }
  return id && ID_YOUTUBE.test(id) ? id : t;
}

/**
 * WhatsApp só com dígitos e com o código do país. Aceita "(11) 98765-4321", "+55 11 98765-4321",
 * "0055...". Número brasileiro sem o 55 (10 ou 11 dígitos: DDD + número, sem "+") ganha o 55.
 */
export function normalizarWhatsapp(texto: string): string {
  // Com "+" ou "00" na frente, a pessoa já disse o país: nada é acrescentado.
  const comPais = /^\s*(\+|00)/.test(texto);
  let d = texto.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (!comPais && (d.length === 10 || d.length === 11)) d = `55${d}`;
  return d;
}

/**
 * Preço digitado em reais para centavos. Aceita "R$ 1.290,50", "1290,50", "1290.50", "1.290", "49,9".
 * Vazio: `undefined` (sem preço). Não deu para entender: `null`.
 */
export function lerPreco(texto: string): number | undefined | null {
  let t = texto.trim().replace(/^r\$\s*/i, "").replace(/\s/g, "");
  if (t === "") return undefined;
  if (/^gr[aá]tis$/i.test(t)) return 0;
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  if (virgula >= 0 && ponto >= 0) {
    // Os dois: o último é o separador dos centavos, o outro é de milhar.
    const decimal = virgula > ponto ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    t = t.split(milhar).join("").replace(decimal, ".");
  } else if (virgula >= 0) {
    // Só vírgula: centavos (padrão brasileiro). Mais de uma vírgula não é preço.
    if (t.indexOf(",") !== virgula) return null;
    t = t.replace(",", ".");
  } else if (ponto >= 0) {
    // Só ponto: "1290.50" (1 ou 2 casas depois do único ponto) é centavo; "1.290" e "1.290.000" são milhar.
    const casas = t.length - ponto - 1;
    if (t.indexOf(".") !== ponto || casas === 3) t = t.split(".").join("");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Centavos para o texto do campo: 129050 → "1.290,50". */
export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Link completo com https. "instagram.com/perfil" e "www.site.com" ganham o https://; "http://" vira
 * "https://". Texto que não parece endereço volta como veio (o schema explica o erro).
 */
export function normalizarUrl(texto: string): string {
  const t = texto.trim();
  if (!t) return t;
  if (/^http:\/\//i.test(t)) return `https://${t.slice(7)}`;
  if (/^https:\/\//i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  if (/^[^\s/@]+\.[a-z]{2,}(\/\S*)?$/i.test(t)) return `https://${t}`;
  return t;
}

/** Código do cupom como o schema pede: maiúsculas, sem espaço e sem acento. */
export function normalizarCupom(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

/** Id livre no formato `prefixo-N`, que o schema aceita e não repete nenhum dos usados. */
export function idLivre(prefixo: string, usados: unknown[]): string {
  const ocupados = new Set(usados.map(String));
  let n = 1;
  while (ocupados.has(`${prefixo}-${n}`)) n += 1;
  return `${prefixo}-${n}`;
}

/**
 * Chave Pix do jeito que a pessoa cola. CPF, CNPJ e telefone perdem a pontuação
 * (telefone ganha +55). E-mail e chave aleatória ficam em minúsculas.
 */
export function normalizarChavePix(texto: string): string {
  const t = texto.trim();
  if (!t) return t;
  if (t.includes("@")) return t.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return t.toLowerCase();
  const digitos = t.replace(/\D/g, "");
  if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(t)) return digitos;
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(t)) return digitos;
  const comPais = /^\s*(\+|00)/.test(texto);
  const pareceTelefone = comPais || /[()]/.test(t);
  if (pareceTelefone) {
    let d = digitos;
    if (d.startsWith("00")) d = d.slice(2);
    if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = `55${d}`;
    return d ? `+${d}` : t;
  }
  return t;
}

/** Descrição do Pix vira o txid: sem acento, sem espaço, no máximo 25. Vazio: o banco usa ***. */
export function normalizarTxid(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 25);
}

/** @ do perfil: "ana.leiga", "instagram.com/ana.leiga" e o link completo viram "@ana.leiga". */
export function normalizarArroba(texto: string): string {
  const t = texto.trim();
  if (!t || t.startsWith("@")) return t;
  const doLink = t.match(/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|tiktok\.com\/@?)\/?([A-Za-z0-9._]+)\/?(?:\?.*)?$/i);
  if (doLink) return `@${doLink[1]}`;
  return /^[A-Za-z0-9._]+$/.test(t) ? `@${t}` : t;
}
