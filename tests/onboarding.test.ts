import { describe, expect, it } from "vitest";
import { ferramentaDeBio, lerBioAtual } from "../lib/onboarding/bio-atual";
import { coletarDireto } from "../lib/onboarding/coleta-instagram";
import { limparUsuario, normalizarInstagram, urlReal } from "../lib/onboarding/instagram";
import { corParaHex, lerCss, lerHtml } from "../lib/onboarding/site";
import { classificarLinks, comEsquema, estilosEmHex, explicarErro } from "../scripts/analisar";

// Formato real dos atores da Apify (campos conferidos em 01/10/2026), com dados inventados.
const PERFIL = [
  {
    username: "studio.exemplo",
    fullName: "Ana - Studio Exemplo",
    biography: "Ajudo pequenas marcas a vender pelo Instagram ✨",
    businessCategoryName: "None",
    private: false,
    followersCount: 1200,
    postsCount: 80,
    profilePicUrlHD: "https://cdn.exemplo.com/foto.jpg",
    externalUrl: "https://linktr.ee/studioexemplo",
    externalUrls: [
      { title: "Meus links", url: "https://linktr.ee/studioexemplo", lynx_url: "https://l.instagram.com/?u=x" },
      { title: "Site", url: "", lynx_url: "https://l.instagram.com/?u=https%3A%2F%2Fstudio.exemplo.com%2F&e=abc" },
    ],
    latestPosts: [{ caption: "não deveria aparecer" }],
  },
];

const post = (dia: number, extra: Record<string, unknown> = {}) => ({
  timestamp: `2026-09-${String(dia).padStart(2, "0")}T12:00:00.000Z`,
  type: "Sidecar",
  caption: `Legenda do dia ${dia}`,
  hashtags: ["marca"],
  likesCount: dia * 10,
  commentsCount: 2,
  ownerUsername: "studio.exemplo",
  url: `https://www.instagram.com/p/${dia}/`,
  latestComments: [{ text: "comentário de terceiro" }],
  taggedUsers: [{ username: "outra.pessoa" }],
  ...extra,
});

describe("limparUsuario", () => {
  it("aceita @, nome solto e link do perfil", () => {
    expect(limparUsuario("@Studio.Exemplo")).toBe("studio.exemplo");
    expect(limparUsuario("studio_exemplo")).toBe("studio_exemplo");
    expect(limparUsuario("https://www.instagram.com/studio.exemplo/?hl=pt")).toBe("studio.exemplo");
  });
  it("recusa o que não é @", () => {
    expect(() => limparUsuario("meu perfil")).toThrow(/não parece um @/);
  });
});

describe("normalizarInstagram", () => {
  const brutos = [post(3), post(20, { ownerUsername: "amiga.da.ana", caption: "Parabéns @studio.exemplo" }), post(10, { type: "Video" }), post(1, { type: "Image" })];
  const r = normalizarInstagram("studio.exemplo", PERFIL, brutos, new Date("2026-10-01T00:00:00Z"));

  it("traz perfil enxuto, sem categoria 'None' e com o link real do rastreador", () => {
    expect(r.nome).toBe("Ana - Studio Exemplo");
    expect(r.categoria).toBeNull();
    expect(r.links).toEqual([
      { titulo: "Meus links", url: "https://linktr.ee/studioexemplo" },
      { titulo: "Site", url: "https://studio.exemplo.com/" },
    ]);
    expect(r.coletadoEm).toBe("2026-10-01T00:00:00.000Z");
  });

  it("ordena do mais novo, marca post de outra conta e traduz o tipo", () => {
    expect(r.posts.map((p) => p.data.slice(8, 10))).toEqual(["20", "10", "03", "01"]);
    expect(r.posts[0]!.proprio).toBe(false);
    expect(r.posts[0]!.autor).toBe("amiga.da.ana");
    expect(r.posts[1]!.autor).toBe("studio.exemplo");
    expect(r.posts.slice(1).every((p) => p.proprio)).toBe(true);
    expect(r.posts.map((p) => p.tipo)).toEqual(["carrossel", "video", "carrossel", "imagem"]);
  });

  it("não guarda dado de terceiros", () => {
    const json = JSON.stringify(r);
    expect(json).not.toContain("comentário de terceiro");
    expect(json).not.toContain("outra.pessoa");
    expect(json).not.toContain("não deveria aparecer");
  });

  it("guarda no máximo 15 posts", () => {
    const muitos = Array.from({ length: 30 }, (_, i) => post(i + 1));
    expect(normalizarInstagram("studio.exemplo", PERFIL, muitos).posts).toHaveLength(15);
  });

  it("perfil inexistente vira erro claro", () => {
    expect(() => normalizarInstagram("nao.existe", [{ error: "not_found" }], [])).toThrow(/Não encontrei o perfil @nao.existe/);
    expect(() => normalizarInstagram("nao.existe", [], [])).toThrow(/Não encontrei/);
    expect(() => normalizarInstagram("outro.perfil", PERFIL, [])).toThrow(/Não encontrei o perfil @outro.perfil/);
  });

  it("urlReal deixa link comum como está", () => {
    expect(urlReal("https://exemplo.com/a")).toBe("https://exemplo.com/a");
    expect(urlReal("não é url")).toBe("não é url");
  });
});

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

describe("coleta", () => {
  it("direto: chama os dois atores com o token no cabeçalho e 15 posts", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const falso = (async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return respostaJson(url.includes("profile") ? PERFIL : [post(5)]);
    }) as unknown as typeof fetch;
    const { resultado: r, falhaPosts } = await coletarDireto("token-de-teste", "studio.exemplo", falso);
    expect(r.posts).toHaveLength(1);
    expect(falhaPosts).toBeNull();
    expect(chamadas).toHaveLength(2);
    expect(chamadas.every((c) => (c.init.headers as Record<string, string>).Authorization === "Bearer token-de-teste")).toBe(true);
    expect(chamadas.every((c) => !c.url.includes("token-de-teste"))).toBe(true);
    const posts = chamadas.find((c) => c.url.includes("post-scraper"))!;
    expect(JSON.parse(String(posts.init.body))).toEqual({ username: ["studio.exemplo"], resultsLimit: 15, skipPinnedPosts: true });
  });

  it("direto: token recusado e crédito acabado viram mensagem clara", async () => {
    const com = (status: number) => (async () => respostaJson({}, status)) as unknown as typeof fetch;
    await expect(coletarDireto("x", "a", com(401))).rejects.toThrow(/recusou o token/);
    await expect(coletarDireto("x", "a", com(402))).rejects.toThrow(/crédito/);
  });

  it("direto: posts falharam, perfil vale com aviso", async () => {
    const falso = (async (url: string) =>
      url.includes("profile") ? respostaJson(PERFIL) : respostaJson({}, 500)) as unknown as typeof fetch;
    const { resultado, falhaPosts } = await coletarDireto("x", "studio.exemplo", falso);
    expect(resultado.nome).toBe("Ana - Studio Exemplo");
    expect(resultado.posts).toEqual([]);
    expect(falhaPosts).toMatch(/500/);
  });
});

describe("site", () => {
  it("converte hex, rgb, hsl e oklch para hex e ignora transparente", () => {
    expect(corParaHex("#ABC")).toBe("#aabbcc");
    expect(corParaHex("#112233cc")).toBe("#112233");
    expect(corParaHex("#0000")).toBeNull();
    expect(corParaHex("rgb(5, 5, 5)")).toBe("#050505");
    expect(corParaHex("rgba(0,0,0,0)")).toBeNull();
    expect(corParaHex("hsl(0 100% 50%)")).toBe("#ff0000");
    expect(corParaHex("oklch(62.8% 0.2577 29.23)")).toBe("#ff0000");
    expect(corParaHex("oklch(1 0 0)")).toBe("#ffffff");
    expect(corParaHex("currentColor")).toBeNull();
  });

  it("CSS: cores por uso, variáveis da marca sem as do Tailwind e fontes sem as genéricas", () => {
    const css = `:root{--color-ink:#050505;--color-paper:oklch(1 0 0);--color-blue-500:#2b7fff;--tw-ring-color:#123456}
      body{background:#050505;color:#f0efe8;font-family:"Manrope Variable",sans-serif}
      h1{color:#f0efe8;font-family:'Playfair Display',serif} .x{color:#050505;font-family:system-ui}
      .y{--tw-shadow:0 0 #abcdef}`;
    const r = lerCss(css);
    expect(r.variaveis).toEqual({ "--color-ink": "#050505", "--color-paper": "#ffffff" });
    expect(r.cores[0]).toEqual({ valor: "#050505", vezes: 3 });
    expect(r.cores.map((c) => c.valor)).not.toContain("#abcdef");
    expect(r.cores.map((c) => c.valor)).not.toContain("#123456");
    expect(r.fontes.map((f) => f.valor)).toEqual(["Manrope", "Playfair Display"]);
  });

  it("CSS: shadcn (HSL solto e var()), WordPress filtrado, seletor de id não é cor", () => {
    const css = `:root{--primary:222 47% 11%;--brand:#e11d48;--accent:var(--brand);--wp--preset--color--vivid-red:#cf2e2e}
      #face{color:rgb(none 0 0)} .a{background:url(x.svg#deadbe) #fafafa}`;
    const r = lerCss(css);
    expect(r.variaveis).toEqual({ "--primary": "#0f1729", "--brand": "#e11d48", "--accent": "#e11d48" });
    const cores = r.cores.map((c) => c.valor);
    expect(cores).toContain("#fafafa");
    expect(cores).not.toContain("#ffaacc");
    expect(cores).not.toContain("#deadbe");
    expect(cores).not.toContain("#cf2e2e");
    expect(cores.some((c) => c.includes("NaN"))).toBe(false);
    expect(corParaHex("oklch(none 0 0)")).toBeNull();
  });

  it("CSS: Roboto e Arial contam; next/font vira o nome da fonte e a reserva some", () => {
    const r = lerCss(`body{font-family:Roboto,sans-serif} h1{font-family:'__Inter_d65c78','__Inter_Fallback_d65c78'} p{font-family:Arial}`);
    expect(r.fontes.map((f) => f.valor).sort()).toEqual(["Arial", "Inter", "Roboto"]);
  });

  it("HTML: meta, ícone, logo, títulos, textos, links e Google Fonts", () => {
    const html = `<!doctype html><html><head><title>Studio Exemplo | Marcas que vendem</title>
      <meta name="description" content="Estratégia &amp; design para pequenas marcas.">
      <meta property="og:image" content="/og.png"><meta name="theme-color" content="#0a0a0a">
      <link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/estilo.css">
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&amp;family=Inter:wght@400;700" rel="stylesheet">
      <style>body{color:#111}</style></head><body>
      <header><img src="/img/logo-studio.png" alt="Studio"><a href="/servicos">Serviços</a><a href="#topo">Topo</a></header>
      <h1>Marcas que <em>vendem</em></h1><h2>Como funciona</h2>
      <p>Eu cuido da estratégia e do visual para a sua marca vender todo dia pelo Instagram.</p><p>curto</p>
      <script>window.x = "<p>texto de script que não conta como conteúdo visível da página</p>"</script>
      </body></html>`;
    const r = lerHtml(html, "https://studio.exemplo.com/");
    expect(r.titulo).toBe("Studio Exemplo | Marcas que vendem");
    expect(r.descricao).toBe("Estratégia & design para pequenas marcas.");
    expect(r.ogImagem).toBe("https://studio.exemplo.com/og.png");
    expect(r.corTema).toBe("#0a0a0a");
    expect(r.icones).toEqual(["https://studio.exemplo.com/favicon.svg"]);
    expect(r.folhas).toContain("https://studio.exemplo.com/estilo.css");
    expect(r.fontesGoogle).toEqual(["DM Serif Display", "Inter"]);
    expect(r.logos).toEqual(["https://studio.exemplo.com/img/logo-studio.png"]);
    expect(r.titulos).toEqual(["Marcas que vendem", "Como funciona"]);
    expect(r.textos).toEqual(["Eu cuido da estratégia e do visual para a sua marca vender todo dia pelo Instagram."]);
    expect(r.links).toEqual([{ texto: "Serviços", url: "https://studio.exemplo.com/servicos" }]);
    expect(r.estilosInternos).toContain("#111");
    expect(r.precisaNavegador).toBe(true);
  });

  it("HTML: página com conteúdo de verdade não pede navegador", () => {
    const corpo = "<p>" + "Texto de verdade escrito na página. ".repeat(10) + "</p>";
    expect(lerHtml(`<html><body>${corpo}</body></html>`, "https://a.com/").precisaNavegador).toBe(false);
  });
});

describe("comando analisar", () => {
  it("põe https em link sem esquema e mantém http", () => {
    expect(comEsquema("linktr.ee/ana")).toBe("https://linktr.ee/ana");
    expect(comEsquema(" www.site.com ")).toBe("https://www.site.com");
    expect(comEsquema("http://site.com")).toBe("http://site.com");
  });

  it("traduz erro técnico e fecha a frase", () => {
    expect(explicarErro(new Error("The operation was aborted due to timeout"))).toBe("Demorou demais para responder.");
    expect(explicarErro(new TypeError("fetch failed"))).toMatch(/Não consegui abrir/);
    expect(explicarErro(new TypeError("Failed to parse URL from x"))).toMatch(/incompleto/);
    expect(explicarErro(new Error("Algo deu errado"))).toBe("Algo deu errado.");
  });

  it("links do perfil: 1ª ferramenta de bio é a bio atual; rede, encurtador e checkout não são site", () => {
    const r = classificarLinks([
      { url: "https://bit.ly/abc" },
      { url: "https://loja.short.gy/promo" },
      { url: "https://pay.hotmart.com/x" },
      { url: "https://linktr.ee/ana" },
      { url: "https://beacons.ai/ana" },
      { url: "https://instagram.com/outra" },
      { url: "https://studio.exemplo.com" },
    ]);
    expect(r).toEqual({ bioAtual: "https://linktr.ee/ana", site: "https://studio.exemplo.com" });
  });

  it("estilos do navegador saem em hex; transparente vira vazio", () => {
    expect(estilosEmHex({ fundo: "rgb(5, 5, 5)", botaoFundo: "rgba(0, 0, 0, 0)", botaoCanto: "8px" })).toEqual({
      fundo: "#050505",
      botaoFundo: "",
      botaoCanto: "8px",
    });
  });
});

describe("bio atual", () => {
  it("reconhece as ferramentas de link na bio", () => {
    expect(ferramentaDeBio("https://linktr.ee/ana")).toBe("Linktree");
    expect(ferramentaDeBio("https://www.beacons.ai/ana")).toBe("Beacons");
    expect(ferramentaDeBio("https://ana.carrd.co")).toBe("Carrd");
    expect(ferramentaDeBio("https://linklist.ai/Ana")).toBe("Linklist");
    expect(ferramentaDeBio("https://studio.exemplo.com")).toBeNull();
    expect(ferramentaDeBio("lixo")).toBeNull();
  });

  it("Linktree: lê os links do JSON da página", () => {
    const dados = {
      props: {
        pageProps: {
          pageTitle: "Studio Exemplo",
          links: [
            { title: "Agende sua consultoria", url: "https://agenda.exemplo.com/ana", type: "CLASSIC" },
            { title: "Cabeçalho", url: "", type: "HEADER" },
          ],
          socialLinks: [{ type: "INSTAGRAM", url: "https://instagram.com/studio.exemplo" }],
        },
      },
    };
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(dados)}</script></html>`;
    expect(lerBioAtual(html, "https://linktr.ee/studioexemplo")).toEqual({
      ferramenta: "Linktree",
      url: "https://linktr.ee/studioexemplo",
      titulo: "Studio Exemplo",
      links: [
        { titulo: "Agende sua consultoria", url: "https://agenda.exemplo.com/ana" },
        { titulo: "INSTAGRAM", url: "https://instagram.com/studio.exemplo" },
      ],
    });
  });

  it("outras: lê os links da página, sem os da própria ferramenta e sem repetir", () => {
    const html = `<title>Ana</title>
      <a href="https://loja.exemplo.com">Minha <b>loja</b></a>
      <a href="https://loja.exemplo.com">Loja de novo</a>
      <a href="https://beacons.ai/signup">Crie o seu</a>
      <a href="/ana/sobre">Sobre</a>`;
    expect(lerBioAtual(html, "https://beacons.ai/ana").links).toEqual([{ titulo: "Minha loja", url: "https://loja.exemplo.com" }]);
  });
});

describe("cores da foto", () => {
  it("acha as cores marcantes e ignora branco, preto e cinza", async () => {
    const { coresMarcantes } = await import("../lib/onboarding/cores-foto");
    const px: number[] = [];
    const pinta = (r: number, g: number, b: number, n: number) => { for (let i = 0; i < n; i++) px.push(r, g, b, 255); };
    pinta(255, 255, 255, 500); // fundo branco
    pinta(20, 20, 20, 100); // texto preto
    pinta(128, 128, 128, 80); // cinza
    pinta(66, 194, 205, 200); // turquesa
    pinta(202, 100, 98, 120); // coral
    const cores = coresMarcantes(Uint8Array.from(px), 4);
    expect(cores).toEqual(["#42c2cd", "#ca6462"]);
  });

  it("foto sem cor (preto e branco) não devolve nada", async () => {
    const { coresMarcantes } = await import("../lib/onboarding/cores-foto");
    const px: number[] = [];
    for (let i = 0; i < 300; i++) px.push(i % 255, i % 255, i % 255, 255);
    expect(coresMarcantes(Uint8Array.from(px), 4)).toEqual([]);
  });

  it("bio com letras estilizadas de teclado de fonte vira texto normal", () => {
    const r = normalizarInstagram("studio.exemplo", [{ ...PERFIL[0], biography: "𝐓𝐮𝐝𝐨 para festas" }], []);
    expect(r.bio).toBe("Tudo para festas");
  });
});
