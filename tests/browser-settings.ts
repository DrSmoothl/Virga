import assert from "node:assert/strict";
import type { Page } from "playwright-core";

export async function updateAppearance(page: Page, action: () => Promise<void>) {
  const previous = Number(await page.locator("html").getAttribute("data-virga-revision"));
  await action();
  const handle = await page.waitForFunction(
    (revision) => {
      const current = Number(document.documentElement.dataset.virgaRevision);
      return current > revision && current;
    },
    previous,
    { polling: 50 },
  );
  return String(await handle.jsonValue());
}

export async function waitForAppearance(page: Page, revision: string) {
  await page.waitForFunction(
    (r) => document.documentElement.dataset.virgaRevision === r,
    revision,
    { polling: 50 },
  );
}

export async function selectMode(page: Page, option: string) {
  const control = page.getByRole("combobox", { name: "界面模式" });
  await control.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  assert.match(await control.innerText(), new RegExp(option));
}
