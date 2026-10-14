import { expect, test } from "@playwright/test";

/**
 * /api/keepalive contra o Supabase falso (e2e/painel-servidor.ts): a cron diária do vercel.json chama
 * esta rota para o projeto grátis não pausar. Aqui a rota grava no falso, nunca no banco de verdade.
 * Só confere a resposta da rota: o estado do falso é zerado pelos testes do painel em paralelo.
 */
test("keepalive grava o horário no banco e responde ok, sem cache", async ({ request }) => {
  const primeira = await request.get("/api/keepalive");
  expect(primeira.status()).toBe(200);
  const corpo = (await primeira.json()) as { ok: boolean; pinged_at: string };
  expect(corpo.ok).toBe(true);
  expect(Date.parse(corpo.pinged_at)).not.toBeNaN();

  await new Promise((r) => setTimeout(r, 20));
  const segunda = (await (await request.get("/api/keepalive")).json()) as { pinged_at: string };
  // Horário novo a cada chamada: a rota não é servida de cache.
  expect(segunda.pinged_at).not.toBe(corpo.pinged_at);
});
