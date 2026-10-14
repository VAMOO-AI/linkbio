import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";

/**
 * scripts/check.ts: `items` só é lista de ids em cards (ofertas) e products (catálogo).
 * Antes do L9, todo `items` de strings virava id de oferta (falso positivo na vitrine).
 */
const dir = mkdtempSync(join(tmpdir(), "linkbio-check-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function rodaCheck(blocos: unknown[], extra: Record<string, unknown> = {}, envExtra: Record<string, string> = {}) {
  const arq = join(dir, `config-${Math.random().toString(36).slice(2)}.mjs`);
  const config = {
    site: { url: "https://link.exemplo.com", locale: "pt-BR", tz: "America/Sao_Paulo" },
    theme: { preset: "neutro" },
    profile: { name: "Nome", handle: "@perfil", avatar: "/avatar-placeholder.svg", bio: "Bio.", tags: [] },
    contact: { whatsapp: "5511987654321" },
    offers: [{ id: "mentoria", title: "Mentoria", why: "Por quê.", url: "https://exemplo.com/m" }],
    catalog: [{ id: "curso", title: "Curso", url: "https://exemplo.com/c", category: "Cursos" }],
    blocks: [{ type: "profile" }, ...blocos],
    ...extra,
  };
  writeFileSync(arq, `export default ${JSON.stringify(config)};`);
  const r = spawnSync("npx", ["tsx", "scripts/check.ts", arq], {
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SECRET_KEY: "",
      LINKBIO_SEM_VERSAO: "1",
      LINKBIO_ROOT: process.cwd(),
      ...envExtra,
    },
  });
  return { status: r.status, saida: `${r.stdout}${r.stderr}` };
}

describe("check.ts × endereço da Vercel", () => {
  test("nome válido passa; com acento, maiúscula, ponto ou curto demais dá erro", () => {
    const comUrl = (url: string) => rodaCheck([], { site: { url, locale: "pt-BR", tz: "America/Sao_Paulo" } });
    expect(comUrl("https://ana-nutri.vercel.app").saida).not.toMatch(/não serve como endereço da Vercel/);
    for (const ruim of ["https://ana.nutri.vercel.app", "https://ab.vercel.app", "https://ana--nutri.vercel.app", "https://-ana.vercel.app"]) {
      const r = comUrl(ruim);
      expect(r.saida, ruim).toMatch(/não serve como endereço da Vercel/);
      expect(r.status, ruim).not.toBe(0);
    }
  }, 60_000);
});

describe("check.ts × items", () => {
  test("vitrine com id do catálogo passa (sem falso positivo de oferta)", () => {
    const r = rodaCheck([{ type: "products", items: ["curso"] }, { type: "cards", items: ["mentoria"] }]);
    expect(r.saida).not.toMatch(/inexistente/);
    expect(r.status).toBe(0);
  }, 30_000);

  test("vitrine com produto inexistente e cards com oferta inexistente dão erro", () => {
    const r = rodaCheck([{ type: "products", items: ["sumiu"] }, { type: "cards", items: ["nao-existe"] }]);
    expect(r.saida).toMatch(/produto do catalog inexistente \("sumiu"\)/);
    expect(r.saida).toMatch(/offer_id inexistente \("nao-existe"\)/);
    expect(r.status).toBe(1);
  }, 30_000);

  test("foto ausente no catálogo e capa ausente na oferta dão erro", () => {
    const r = rodaCheck([], {
      catalog: [{ id: "curso", title: "Curso", url: "https://exemplo.com/c", image: "/nao-tem.jpg" }],
      offers: [{ id: "mentoria", title: "M", why: "P.", url: "https://exemplo.com/m", cover: { image: "/capa-sumida.jpg" } }],
    });
    expect(r.saida).toMatch(/catalog\[0\]\.image: arquivo ausente/);
    expect(r.saida).toMatch(/offers\[0\]\.cover\.image: arquivo ausente/);
  }, 30_000);

  test("capa própria (site.share.image) ausente ou de outro site dá erro", () => {
    const site = (image: string) => ({ site: { url: "https://link.exemplo.com", locale: "pt-BR", tz: "America/Sao_Paulo", share: { image } } });
    const ausente = rodaCheck([], site("/capa-sumida.jpg"));
    expect(ausente.saida).toMatch(/site\.share\.image: arquivo ausente em public\/capa-sumida\.jpg/);
    expect(ausente.status).toBe(1);
    const fora = rodaCheck([], site("https://outro-site.com/capa.jpg"));
    expect(fora.saida).toMatch(/site\.share\.image: imagem de outro site/);
    const ok = rodaCheck([], site("/gallery-2.svg"));
    expect(ok.saida).not.toMatch(/\[erro\][^\n]*site\.share/);
  }, 30_000);

  test("cupom vencido gera aviso (não erro); cupom válido não", () => {
    const vencido = rodaCheck([{ type: "coupon", code: "VELHO10", label: "10%", expires: "2020-01-31" }]);
    expect(vencido.saida).toMatch(/cupom "VELHO10" venceu em 2020-01-31/);
    expect(vencido.status).toBe(0);
    const valido = rodaCheck([{ type: "coupon", code: "NOVO10", label: "10%", expires: "2099-12-31" }]);
    expect(valido.saida).not.toMatch(/venceu/);
  }, 30_000);

  test("theme.palette ilegível quebra o check; cor boa passa", () => {
    const ruim = rodaCheck([], { theme: { preset: "neutro", palette: { claro: { text: "#dddddd" } } } });
    expect(ruim.saida).toMatch(/theme\.palette: paleta claro: texto sobre o fundo/);
    expect(ruim.status).toBe(1);
    const boa = rodaCheck([], { theme: { preset: "neutro", palette: { claro: { text: "#111111" } } } });
    expect(boa.saida).not.toMatch(/contraste/);
    expect(boa.status).toBe(0);
  }, 30_000);

  test("concierge: title/cta/wa ignorados geram aviso; resposta sem offer no 1º passo não", () => {
    const passo = (id: string, options: object[]) => ({ id, question: "Pergunta?", options });
    const r = rodaCheck([
      {
        type: "concierge",
        mode: "roteiro",
        flow: [
          passo("p1", [
            { id: "a", label: "A", offer: "mentoria", reason: "R.", title: "Ignorado" },
            { id: "nao-sei", label: "Não sei", reason: "R.", title: "Vamos conversar" },
          ]),
          passo("p2", [
            { id: "x", label: "X", offer: "mentoria", reason: "R." },
            { id: "y", label: "Y", reason: "R.", wa: "Oi" },
          ]),
        ],
      },
    ]);
    expect(r.saida).toMatch(/flow\[0\]\.options\[0\]: title só vale em resposta sem offer/);
    expect(r.saida).toMatch(/flow\[1\]\.options\[1\]: wa só vale na 1ª pergunta/);
    expect(r.saida).not.toMatch(/flow\[0\]\.options\[1\]/);
    expect(r.status).toBe(0);
  }, 30_000);

  test('concierge com decide "ultima": title/cta/wa valem na resposta com reason de outra pergunta', () => {
    const passo = (id: string, options: object[]) => ({ id, question: "Pergunta?", options });
    const r = rodaCheck([
      {
        type: "concierge",
        mode: "roteiro",
        decide: "ultima",
        flow: [
          passo("p1", [
            { id: "a", label: "A", offer: "mentoria", reason: "R." },
            { id: "b", label: "B", offer: "mentoria", reason: "R." },
          ]),
          passo("p2", [
            { id: "x", label: "X", reason: "R.", title: "Vamos conversar", wa: "Oi" },
            { id: "y", label: "Y", cta: "Ignorado" },
          ]),
        ],
      },
    ]);
    expect(r.saida).not.toMatch(/flow\[1\]\.options\[0\]/);
    expect(r.saida).toMatch(/flow\[1\]\.options\[1\]: cta só vale em resposta com reason/);
    expect(r.status).toBe(0);
  }, 30_000);

  test("todos os blocos desligados geram aviso de página vazia", () => {
    const r = rodaCheck([], { blocks: [{ type: "profile", enabled: false }] });
    expect(r.saida).toMatch(/página vai ao ar vazia/);
    expect(r.status).toBe(0);
  }, 30_000);

  test("bloco com janela já encerrada gera aviso; janela futura não", () => {
    const vencido = rodaCheck([{ type: "text", body: "Turma encerrada", visivel: { ate: "2020-01-31" } }]);
    expect(vencido.saida).toMatch(/blocks\[1\].*saiu do ar em 2020-01-31/);
    expect(vencido.status).toBe(0);
    const futuro = rodaCheck([{ type: "text", body: "Turma futura", visivel: { de: "2099-01-01" } }]);
    expect(futuro.saida).not.toMatch(/saiu do ar/);
    expect(futuro.status).toBe(0);
  }, 30_000);

  test("nenhum bloco dentro da janela de hoje avisa página vazia", () => {
    const r = rodaCheck([], {
      blocks: [
        { type: "profile", visivel: { de: "2099-06-01" } },
        { type: "text", body: "Já foi", visivel: { ate: "2020-01-01" } },
      ],
    });
    expect(r.saida).toMatch(/página vai ao ar vazia/);
    expect(r.status).toBe(0);
  }, 30_000);

  test("imagem de outro site dá erro com o caminho; do Storage do Supabase passa", () => {
    const fora = "https://images.unsplash.com/foto.jpg";
    const doProjeto = "https://abcdefgh.supabase.co/storage/v1/object/public/linkbio/2026-09-30/a.jpg";
    const r = rodaCheck([{ type: "link", title: "L", url: "https://site.com.br/x", image: fora }], {
      profile: { name: "Nome", handle: "@perfil", avatar: doProjeto, bio: "Bio.", tags: [] },
      catalog: [{ id: "curso", title: "Curso", url: "https://site.com.br/c", image: fora }],
    });
    expect(r.saida).toMatch(/blocks\[1\]\.image: imagem de outro site \(https:\/\/images\.unsplash\.com/);
    expect(r.saida).toMatch(/catalog\[0\]\.image: imagem de outro site/);
    expect(r.saida).toMatch(/Salve o arquivo em public\/.*envie a imagem pelo painel/);
    expect(r.saida).not.toMatch(/profile\.avatar: imagem de outro site/);
    expect(r.status).toBe(1);
  }, 30_000);

  test("com SUPABASE_URL, só o Storage desse projeto passa (é o único host que o next.config libera)", () => {
    const outroProjeto = "https://outro.supabase.co/storage/v1/object/public/linkbio/a.jpg";
    const desteProjeto = "https://abcdefgh.supabase.co/storage/v1/object/public/linkbio/a.jpg";
    const env = { SUPABASE_URL: "https://abcdefgh.supabase.co" };
    const ruim = rodaCheck([{ type: "gallery", images: [{ src: outroProjeto, alt: "A" }] }], {}, env);
    expect(ruim.saida).toMatch(/blocks\[1\]\.images\[0\]\.src: imagem de outro site/);
    expect(ruim.status).toBe(1);
    const boa = rodaCheck([{ type: "gallery", images: [{ src: desteProjeto, alt: "A" }] }], {}, env);
    expect(boa.saida).not.toMatch(/imagem de outro site/);
    expect(boa.status).toBe(0);
  }, 30_000);

  test("conteúdo do exemplo esquecido vira aviso (não erro) com os campos", () => {
    const r = rodaCheck(
      [
        { type: "coupon", code: "BEMVINDA10", label: "10%", expires: "2099-12-31" },
        { type: "youtube", videoId: "dQw4w9WgXcQ" },
        { type: "cta", id: "falar", label: "Falar", action: { wa: "Oi" }, note: "Respondo pessoalmente, em dias úteis" },
      ],
      { profile: { name: "Marina Duarte", handle: "@marina.exemplo", avatar: "/avatar-placeholder.svg", bio: "Bio.", tags: [] } },
    );
    expect(r.saida).toMatch(/\[aviso\] a bio ainda tem conteúdo do exemplo/);
    expect(r.saida).toMatch(/profile\.name: nome do exemplo/);
    expect(r.saida).toMatch(/blocks\[1\]\.code: cupom do exemplo/);
    expect(r.saida).toMatch(/blocks\[2\]\.videoId: vídeo do exemplo/);
    expect(r.saida).toMatch(/blocks\[3\]\.note: frase do exemplo/);
    expect(r.saida).toMatch(/offers\[0\]\.url: link do exemplo \(exemplo\.com\)/);
    expect(r.status).toBe(0);
  }, 30_000);

  test("bio sem nada do exemplo não recebe o aviso", () => {
    const r = rodaCheck([], {
      site: { url: "https://bio.minhamarca.com.br", locale: "pt-BR", tz: "America/Sao_Paulo" },
      profile: { name: "Ana Souza", handle: "@ana", avatar: "/favicon.svg", bio: "Bio.", tags: [] },
      offers: [{ id: "mentoria", title: "Mentoria", why: "Por quê.", url: "https://minhamarca.com.br/m" }],
      catalog: [{ id: "curso", title: "Curso", url: "https://minhamarca.com.br/c", category: "Cursos" }],
    });
    expect(r.saida).not.toMatch(/conteúdo do exemplo/);
    expect(r.status).toBe(0);
  }, 30_000);

  test("bloco lead ligado sem banco dá erro; desligado não", () => {
    const lead = { type: "lead", id: "planner", title: "Planner", label: "Quero", pedir: "whatsapp", sucesso: "Pronto, olhe a mensagem." };
    const site = { site: { url: "https://bio.minhamarca.com.br", locale: "pt-BR", tz: "America/Sao_Paulo" } };
    const ligado = rodaCheck([lead], site);
    expect(ligado.saida).toMatch(/bloco lead/);
    expect(ligado.status).toBe(1);
    const desligado = rodaCheck([{ ...lead, enabled: false }], site);
    expect(desligado.saida).not.toMatch(/bloco lead/);
    expect(desligado.status).toBe(0);
    const comBanco = rodaCheck([lead], site, {
      SUPABASE_URL: "https://abcdefgh.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_teste",
    });
    expect(comBanco.status).toBe(0);
    expect(comBanco.saida).toMatch(/LEAD_WEBHOOK_URL/);
  }, 60_000);

  test("agenda com todos os eventos passados avisa e não pede Supabase", () => {
    const passada = rodaCheck([
      { type: "agenda", items: [{ id: "velho", title: "Velho", date: "2020-01-15", time: "10:00" }] },
    ]);
    expect(passada.saida).toMatch(/todos os eventos da agenda já passaram/);
    expect(passada.saida).not.toMatch(/SUPABASE/);
    expect(passada.status).toBe(0);
    const mista = rodaCheck([
      {
        type: "agenda",
        items: [
          { id: "velho", title: "Velho", date: "2020-01-15" },
          { id: "novo", title: "Novo", date: "2099-06-15" },
        ],
      },
    ]);
    expect(mista.saida).not.toMatch(/todos os eventos da agenda já passaram/);
    expect(mista.status).toBe(0);
  }, 30_000);

  test("nome do Pix com acento gera aviso, sem acento não", () => {
    const com = rodaCheck([{ type: "pix", chave: "11144477735", nome: "José", cidade: "BRASILIA" }]);
    expect(com.saida).toMatch(/entra no Pix sem acento, como "Jose"/);
    expect(com.status).toBe(0);
    const sem = rodaCheck([{ type: "pix", chave: "11144477735", nome: "Jose", cidade: "BRASILIA" }]);
    expect(sem.saida).not.toMatch(/sem acento/);
  }, 30_000);


  test("bio sem oferta passa; bloco de cards vazio avisa que não aparece", () => {
    const r = rodaCheck([{ type: "link", title: "@perfil", url: "https://instagram.com/perfil" }], { offers: [] });
    expect(r.saida).not.toMatch(/oferta|offer/i);
    expect(r.status).toBe(0);
    const vazio = rodaCheck([{ type: "cards", items: [] }], { offers: [] });
    expect(vazio.saida).toMatch(/blocks\[1\]: bloco cards sem ofertas não aparece na página/);
    expect(vazio.status).toBe(0);
  }, 30_000);
});

describe("check.ts × contagem de cliques", () => {
  const limpa = {
    site: { url: "https://bio.minhamarca.com.br", locale: "pt-BR", tz: "America/Sao_Paulo" },
    profile: { name: "Ana Souza", handle: "@ana", avatar: "/favicon.svg", bio: "Bio.", tags: [] },
    offers: [{ id: "mentoria", title: "Mentoria", why: "Por quê.", url: "https://minhamarca.com.br/m" }],
    features: { leads: false, analytics: true, pixel: { meta: null, ga4: null } },
  };

  test("analytics sem Supabase avisa e não derruba o check", () => {
    const r = rodaCheck([], limpa, { SUPABASE_SERVICE_ROLE_KEY: "" });
    expect(r.saida).toMatch(/\[aviso\].*contagem de cliques/);
    expect(r.saida).not.toMatch(/\[erro\].*analytics/);
    expect(r.status).toBe(0);
  }, 30_000);

  test("analytics com Supabase não avisa", () => {
    const r = rodaCheck([], limpa, { SUPABASE_URL: "https://abcdefgh.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_teste" });
    expect(r.saida).not.toMatch(/contagem de cliques/);
    expect(r.status).toBe(0);
  }, 30_000);
});

describe("check.ts × pixel", () => {
  const semAmbiente = { META_PIXEL_ID: "", GA4_MEASUREMENT_ID: "" };

  test("ID válido na config passa sem exigir a variável de ambiente", () => {
    const r = rodaCheck([], { features: { pixel: { meta: "123456789012345", ga4: "G-AB12CD34" } } }, semAmbiente);
    expect(r.saida).not.toMatch(/META_PIXEL_ID não está/);
    expect(r.saida).not.toMatch(/GA4_MEASUREMENT_ID não está/);
    expect(r.status).toBe(0);
  }, 60_000);

  test("ID da variável de ambiente que não parece ID vira aviso, não erro", () => {
    const r = rodaCheck([], {}, { META_PIXEL_ID: "pixel", GA4_MEASUREMENT_ID: "" });
    expect(r.saida).toMatch(/META_PIXEL_ID não parece um ID/);
    expect(r.status).toBe(0);
  }, 60_000);
});

/** Concierge em modo IA: a chave é obrigatória e o custo aparece como aviso, sem imprimir o segredo. */
const fluxoIa = {
  type: "concierge",
  mode: "ia",
  flow: [
    {
      id: "p1",
      question: "Qual é o seu momento?",
      options: [
        { id: "a", label: "Começar", offer: "mentoria", reason: "Porque encaixa." },
        { id: "b", label: "Não sei", reason: "A conversa esclarece." },
      ],
    },
  ],
};

describe("check.ts × concierge em modo IA", () => {
  test("sem ANTHROPIC_API_KEY é erro; o valor da chave não aparece", () => {
    const r = rodaCheck([fluxoIa], {}, { ANTHROPIC_API_KEY: "" });
    expect(r.saida).toMatch(/ANTHROPIC_API_KEY não está no env/);
    expect(r.saida).toMatch(/cada dúvida livre faz um pedido/);
    expect(r.status).not.toBe(0);
  }, 30_000);

  test("com a chave configurada, o check passa e avisa o custo sem imprimir a chave", () => {
    const chave = "s" + "k-ant-teste-nao-imprimir";
    const r = rodaCheck([fluxoIa], {}, { ANTHROPIC_API_KEY: chave });
    expect(r.saida).toMatch(/cada dúvida livre faz um pedido/);
    expect(r.saida).toMatch(/CONCIERGE_IA_LIMITE_DIA/);
    expect(r.saida).not.toMatch(/ANTHROPIC_API_KEY não está no env/);
    expect(r.saida).not.toContain(chave);
    expect(r.status).toBe(0);
  }, 30_000);
});
