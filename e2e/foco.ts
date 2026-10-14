import { expect, type Locator } from "@playwright/test";

/**
 * Confere que o elemento é o `document.activeElement`. O `toBeFocused()` também exige a janela em
 * primeiro plano, e no Firefox sem tela do CI ela às vezes está "inactive": o teste falhava sem defeito.
 */
export async function esperarFoco(el: Locator): Promise<void> {
  await expect.poll(() => el.evaluate((e) => e === document.activeElement), { message: "elemento sem foco" }).toBe(true);
}
