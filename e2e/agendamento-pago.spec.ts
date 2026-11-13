import { expect, test, type Page } from "@playwright/test";

const QR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=";

function horariosFalsos() {
  const dia = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return [{ inicio: `${dia}T12:00:00.000Z`, dia, hora: "09:00" }];
}

/** API falsa: reserva paga devolve o Pix; a consulta do token responde o estado da vez. */
async function simularApi(page: Page, estados: string[]) {
  const horarios = horariosFalsos();
  const consultas: string[] = [];
  await page.route("**/api/agendamento**", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    if (req.method() === "GET" && url.searchParams.get("token")) {
      consultas.push(url.searchParams.get("token")!);
      const estado = estados[Math.min(consultas.length - 1, estados.length - 1)]!;
      return rota.fulfill({ json: { ok: true, estado, servico: "consulta", inicio: horarios[0]!.inicio, fim: horarios[0]!.inicio, meetUrl: "https://meet.google.com/pago" } });
    }
    if (req.method() === "GET") return rota.fulfill({ json: { ok: true, tz: "America/Sao_Paulo", horarios } });
    const p = req.postDataJSON() as Record<string, string>;
    return rota.fulfill({
      json: {
        ok: true,
        pagar: true,
        servico: "Consulta",
        inicio: p.inicio,
        fim: p.inicio,
        meetUrl: null,
        local: null,
        pagamento: {
          modo: "email",
          token: "t".repeat(43),
          valorCentavos: 30017,
          copiaECola: "00020126PIXFALSO",
          qr: QR,
          expiraEm: new Date(Date.now() + 15 * 60_000).toISOString(),
        },
      },
    });
  });
  return { consultas };
}

async function irAtePix(page: Page) {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/e2e/agendamento-pago");
  const bloco = page.locator(".bloco-agendamento");
  await expect(bloco.getByRole("button", { name: /Consulta.*R\$\s300,00/ })).toBeVisible();
  await bloco.getByRole("button", { name: /Consulta/ }).click();
  await bloco.locator(".ag-cal-grade button[data-livre]").first().click();
  await bloco.getByRole("button", { name: "09:00" }).click();
  await expect(bloco.locator(".ag-resumo")).toContainText("R$ 300,00 no Pix");
  await bloco.getByLabel("Nome").fill("Maria Souza");
  await bloco.getByLabel("WhatsApp").fill("(11) 98765-4321");
  await bloco.getByRole("button", { name: "Ir para o Pix" }).click();
  await expect(bloco.locator(".ag-pix-valor")).toContainText("R$ 300,17");
  await expect(bloco.getByAltText("QR Code do Pix")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  return bloco;
}

test("agenda paga: Pix com centavos, consulta até confirmar e mostra o link", async ({ page }) => {
  const { consultas } = await simularApi(page, ["aguardando", "confirmado"]);
  const bloco = await irAtePix(page);
  await expect(bloco.getByRole("status").first()).toContainText("Horário separado por mais 1");
  await expect(bloco.getByText("Horário marcado")).toBeVisible({ timeout: 25_000 });
  await expect(bloco.getByRole("link", { name: /Link da chamada/ })).toHaveAttribute("href", "https://meet.google.com/pago");
  expect(consultas.length).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => localStorage.getItem("linkbio-agenda-pix-agenda"))).toBeNull();
});

test("agenda paga: recarregar a página volta para a tela do Pix", async ({ page }) => {
  await simularApi(page, ["aguardando"]);
  await irAtePix(page);
  await page.reload();
  await expect(page.locator(".ag-pix-valor")).toContainText("R$ 300,17");
});

test("agenda paga: prazo vencido solta o horário e volta para o calendário", async ({ page }) => {
  await simularApi(page, ["expirado"]);
  const bloco = await irAtePix(page);
  await expect(bloco.getByRole("alert")).toContainText("O prazo do Pix acabou", { timeout: 15_000 });
  await expect(bloco.locator(".ag-cal-grade")).toBeVisible();
});

test("agenda paga: Pix atrasado sem horário oferece outro horário e o WhatsApp", async ({ page }) => {
  await simularApi(page, ["pago_sem_horario"]);
  const bloco = await irAtePix(page);
  await expect(bloco.getByText("Pix recebido")).toBeVisible({ timeout: 15_000 });
  await expect(bloco.getByRole("button", { name: "Escolher outro horário" })).toBeVisible();
  await expect(bloco.getByRole("link", { name: "Chamar no WhatsApp" })).toHaveAttribute("href", /wa\.me\/5511987654321/);
  // Recarregou: o aparelho lembra da reserva paga e a troca continua à mão.
  await page.reload();
  await expect(page.getByText("Pix recebido")).toBeVisible();
  await expect(page.getByRole("button", { name: "Escolher outro horário" })).toBeVisible();
});

test("agenda paga: link do convite troca o horário sem pagar de novo", async ({ page }) => {
  const dia = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const horarios = [{ inicio: `${dia}T13:00:00.000Z`, dia, hora: "10:00" }];
  const antigo = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const pedidos: Record<string, string>[] = [];
  await page.route("**/api/agendamento**", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    if (req.method() === "GET" && url.searchParams.get("token")) {
      return rota.fulfill({ json: { ok: true, estado: "confirmado", servico: "consulta", inicio: antigo, fim: antigo, meetUrl: "https://meet.google.com/pago" } });
    }
    if (req.method() === "GET") return rota.fulfill({ json: { ok: true, tz: "America/Sao_Paulo", horarios } });
    const p = req.postDataJSON() as Record<string, string>;
    pedidos.push(p);
    return rota.fulfill({ json: { ok: true, servico: "Consulta", inicio: p.inicio, fim: p.inicio, meetUrl: "https://meet.google.com/pago", local: null } });
  });
  const token = "k".repeat(43);
  await page.goto(`/e2e/agendamento-pago?agenda=${token}`);
  const bloco = page.locator(".bloco-agendamento");
  await expect(bloco.getByText("Horário marcado")).toBeVisible();
  // O token sai da barra (pixels de medição guardam a URL).
  expect(page.url()).not.toContain("agenda=");
  await bloco.getByRole("button", { name: "Trocar horário" }).click();
  await expect(bloco.getByText("O Pix já pago continua valendo")).toBeVisible();
  await bloco.locator(".ag-cal-grade button[data-livre]").first().click();
  await bloco.getByRole("button", { name: "10:00" }).click();
  await expect(bloco.getByText("Horário marcado")).toBeVisible();
  await expect(bloco.locator(".ag-resumo")).toContainText("10:00");
  expect(pedidos).toEqual([{ acao: "remarcar", bloco: "agenda", token, inicio: horarios[0]!.inicio }]);
  // "Marcar outro atendimento" esquece a reserva e volta ao começo.
  await bloco.getByRole("button", { name: "Marcar outro atendimento" }).click();
  await expect(bloco.getByText("Qual atendimento?")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("linkbio-agenda-paga-agenda"))).toBeNull();
});

test("agenda paga: serviço grátis segue sem Pix", async ({ page }) => {
  await simularApi(page, []);
  await page.goto("/e2e/agendamento-pago");
  const bloco = page.locator(".bloco-agendamento");
  await bloco.getByRole("button", { name: /Papo rápido/ }).click();
  await bloco.locator(".ag-cal-grade button[data-livre]").first().click();
  await bloco.getByRole("button", { name: "09:00" }).click();
  await expect(bloco.getByRole("button", { name: "Confirmar horário" })).toBeVisible();
});
