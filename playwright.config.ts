import { defineConfig } from "@playwright/test";
import { CHAVE_FALSA, PORTA_APP, RESEND_FALSA, SEGREDO_SESSAO, URL_ANTHROPIC, URL_APP, URL_FALSA } from "./e2e/painel-ambiente";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: URL_APP,
    viewport: { width: 375, height: 667 },
    trace: "on-first-retry",
  },
  // WebKit é o motor do Safari: a maior parte de quem abre a bio chega pelo iPhone. O painel (/admin)
  // e o keepalive ficam só no chromium: o banco falso é um só e cada teste do painel limpa ele.
  // "sem-oferta" publica uma bio sem nenhuma oferta, visivelmente diferente do arquivo: roda depois
  // de todos, porque os testes da bio pública leem "/" e esperam o linkbio.config.ts ("capa", idem).
  projects: [
    { name: "chromium", testIgnore: ["painel-sem-oferta.spec.ts", "capa-publicada.spec.ts", "painel-contraste.spec.ts", "cliques.spec.ts", "lead.spec.ts", "login-codigo.spec.ts"], use: { browserName: "chromium" } },
    { name: "firefox", testIgnore: ["admin.spec.ts", "painel.spec.ts", "painel-celular.spec.ts", "previa-segue.spec.ts", "painel-sem-oferta.spec.ts", "keepalive.spec.ts", "saude.spec.ts", "capa-publicada.spec.ts", "painel-contraste.spec.ts", "login-codigo.spec.ts", "cliques.spec.ts", "concierge-ia.spec.ts", "janela-painel.spec.ts", "lead.spec.ts"], use: { browserName: "firefox" } },
    { name: "webkit", testIgnore: ["admin.spec.ts", "painel.spec.ts", "painel-celular.spec.ts", "previa-segue.spec.ts", "painel-sem-oferta.spec.ts", "keepalive.spec.ts", "saude.spec.ts", "capa-publicada.spec.ts", "painel-contraste.spec.ts", "login-codigo.spec.ts", "cliques.spec.ts", "concierge-ia.spec.ts", "janela-painel.spec.ts", "lead.spec.ts"], use: { browserName: "webkit" } },
    // Contagem e formulário de contato publicam uma bio diferente do arquivo. Rodam depois dos três
    // motores, senão o "/" dos testes públicos ganha atalho /r/ ou some o Pix no meio da execução.
    { name: "banco", testMatch: ["cliques.spec.ts", "lead.spec.ts", "login-codigo.spec.ts"], dependencies: ["chromium", "firefox", "webkit"], use: { browserName: "chromium" } },
    // Contraste do painel no claro e no escuro: cria um bloco novo (rascunho no banco falso), então roda
    // sozinho, depois dos três motores e do banco, antes do "sem-oferta".
    { name: "contraste", testMatch: "painel-contraste.spec.ts", dependencies: ["banco"], use: { browserName: "chromium" } },
    { name: "sem-oferta", testMatch: "painel-sem-oferta.spec.ts", dependencies: ["contraste"], use: { browserName: "chromium" } },
    // Capa ao compartilhar publicada pelo painel: também muda a bio no ar, então roda por último, sozinha.
    { name: "capa", testMatch: "capa-publicada.spec.ts", dependencies: ["sem-oferta"], use: { browserName: "chromium" } },
  ],
  // Nada é reaproveitado: o painel precisa subir contra o banco falso DESTA execução.
  webServer: [
    {
      // Banco de mentira, em memória (e2e/painel-servidor.ts): os testes do /admin escrevem nele,
      // nunca no banco de verdade.
      command: "npx tsx e2e/painel-servidor.ts",
      url: `${URL_FALSA}/__saude`,
      reuseExistingServer: false,
    },
    {
      // API da Anthropic de mentira. O app só fala com ela porque ANTHROPIC_BASE_URL aponta aqui.
      command: "npx tsx e2e/anthropic-falso.ts",
      url: `${URL_ANTHROPIC}/__saude`,
      reuseExistingServer: false,
    },
    {
      // Painel ligado: sem banco o /admin mostra "ainda não está ligado" e o editor inteiro fica sem
      // teste. A porta é própria para um `npm run dev` com as credenciais reais nunca ser aproveitado.
      // O cache de fetch do build anterior guarda a config publicada. Sem apagar, o próximo build
      // ainda conta clique numa bio que o banco falso (vazio) já não tem.
      command: `rm -rf .next/cache/fetch-cache && npm run build && npm run start -- -p ${PORTA_APP}`,
      url: URL_APP,
      reuseExistingServer: false,
      // Build + start do Next numa máquina lenta passa do padrão de 60 s.
      timeout: 240_000,
      env: {
        SUPABASE_URL: URL_FALSA,
        SUPABASE_SERVICE_ROLE_KEY: CHAVE_FALSA,
        ADMIN_SESSION_SECRET: SEGREDO_SESSAO,
        RESEND_API_KEY: RESEND_FALSA,
        EMAIL_API_URL: `${URL_FALSA}/email`,
        // Liga as rotas /e2e (pixel, fontes, JSON-LD). Sem isto, elas respondem 404.
        LINKBIO_E2E: "1",
        ANTHROPIC_API_KEY: "sk-ant-teste-e2e",
        ANTHROPIC_BASE_URL: URL_ANTHROPIC,
        ANTHROPIC_MODEL: "claude-haiku-5-5",
      },
    },
  ],
});
