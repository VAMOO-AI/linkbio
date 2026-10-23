import { expect, test, type Page } from "@playwright/test";

/** Dois dias com horários a partir de amanhã (o servidor real tira o ocupado do Google). */
function horariosFalsos() {
  const dias = [1, 2].map((n) => {
    const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  return dias.flatMap((dia) =>
    ["09:00", "09:30", "14:00"].map((hora) => ({ inicio: `${dia}T${hora === "09:00" ? "12:00" : hora === "09:30" ? "12:30" : "17:00"}:00.000Z`, dia, hora })),
  );
}

async function simularApi(page: Page, opts: { get?: number; post?: number } = {}) {
  const horarios = horariosFalsos();
  const pedidos: Record<string, unknown>[] = [];
  await page.route("**/api/agendamento**", async (rota) => {
    const req = rota.request();
    if (req.method() === "GET") {
      if (opts.get && opts.get !== 200) return rota.fulfill({ status: opts.get, json: { ok: false, motivo: "desligado" } });
      return rota.fulfill({ json: { ok: true, tz: "America/Sao_Paulo", horarios } });
    }
    pedidos.push(req.postDataJSON() as Record<string, unknown>);
    if (opts.post === 409 && pedidos.length === 1) {
      return rota.fulfill({ status: 409, json: { ok: false, motivo: "ocupado", mensagem: "Esse horário acabou de ser ocupado. Escolha outro." } });
    }
    const p = pedidos.at(-1)!;
    return rota.fulfill({
      json: { ok: true, servico: "Consulta", inicio: p.inicio, fim: p.inicio, meetUrl: "https://meet.google.com/abc-defg-hij", local: null },
    });
  });
  return { horarios, pedidos };
}

const semEstouro = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

test("agendamento: serviço, dia, horário e dados até a confirmação, sem estourar 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const { horarios, pedidos } = await simularApi(page);
  await page.goto("/e2e/agendamento");
  const bloco = page.locator(".bloco-agendamento");
  await expect(bloco).toContainText("Marque um horário");

  await bloco.getByRole("button", { name: /Consulta/ }).click();
  const primeiroDia = horarios[0]!.dia;
  const botaoDia = bloco.locator(".ag-cal-grade button[data-livre]").first();
  await expect(botaoDia).toBeVisible();
  expect(await semEstouro(page)).toBe(true);
  await botaoDia.click();

  await expect(bloco.locator(".ag-hora")).toHaveCount(3);
  await bloco.getByRole("button", { name: "09:30" }).click();
  await bloco.getByLabel("Nome").fill("Maria Souza");
  await bloco.getByLabel("WhatsApp").fill("(11) 98765-4321");
  expect(await semEstouro(page)).toBe(true);
  await bloco.getByRole("button", { name: "Confirmar horário" }).click();

  await expect(bloco.getByRole("status")).toContainText("Horário marcado");
  await expect(bloco.getByRole("link", { name: /Google Meet/ })).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
  await expect(bloco.getByRole("link", { name: "Pôr na minha agenda" })).toHaveAttribute("href", /^https:\/\/calendar\.google\.com\//);
  expect(pedidos).toHaveLength(1);
  expect(pedidos[0]).toMatchObject({ bloco: "agenda", servico: "consulta", nome: "Maria Souza", inicio: `${primeiroDia}T12:30:00.000Z` });
  expect(String(pedidos[0]!.request_id)).toMatch(/^[0-9a-f-]{36}$/);
  expect(await semEstouro(page)).toBe(true);
});

test("agendamento: horário tomado volta para a lista com aviso e pedido novo", async ({ page }) => {
  const { pedidos } = await simularApi(page, { post: 409 });
  await page.goto("/e2e/agendamento");
  const bloco = page.locator(".bloco-agendamento");
  await bloco.getByRole("button", { name: /Consulta/ }).click();
  await bloco.locator(".ag-cal-grade button[data-livre]").first().click();
  await bloco.getByRole("button", { name: "09:00" }).click();
  await bloco.getByLabel("Nome").fill("Maria Souza");
  await bloco.getByLabel("WhatsApp").fill("11987654321");
  await bloco.getByRole("button", { name: "Confirmar horário" }).click();

  await expect(bloco.getByRole("alert")).toContainText("acabou de ser ocupado");
  await expect(bloco.locator(".ag-hora").first()).toBeVisible();
  await bloco.getByRole("button", { name: "14:00" }).click();
  await bloco.getByLabel("Nome").fill("Maria Souza");
  await bloco.getByLabel("WhatsApp").fill("11987654321");
  await bloco.getByRole("button", { name: "Confirmar horário" }).click();
  await expect(bloco.getByRole("status")).toContainText("Horário marcado");
  expect(pedidos).toHaveLength(2);
  expect(pedidos[0]!.request_id).not.toBe(pedidos[1]!.request_id);
});

test("agendamento: agenda fora do ar vira botão de WhatsApp", async ({ page }) => {
  await simularApi(page, { get: 503 });
  await page.goto("/e2e/agendamento");
  const bloco = page.locator(".bloco-agendamento");
  await bloco.getByRole("button", { name: /Análise de caso/ }).click();
  const wa = bloco.getByRole("link", { name: "Marcar pelo WhatsApp" });
  await expect(wa).toBeVisible();
  await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/5511987654321\?text=/);
});
