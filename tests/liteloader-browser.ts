import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import { updateAppearance } from "./browser-settings.ts";

export const liteLoaderSettingsFixture = `
<div class="setting-layout">
  <aside class="setting-tab">
    <div class="nav-bar"><button class="nav-item nav-item-active">通用</button></div>
    <div class="nav-bar liteloader"><button class="nav-item" data-slug="config_view">LiteLoaderQQNT</button></div>
  </aside>
  <main class="setting-main"></main>
</div>`;

export async function verifyLiteLoaderSettings(page: Page) {
  await page.evaluate(() => import(new URL("/renderer.js", location.href).href));
  const nav = page.locator(".nav-bar.liteloader");
  const fallback = nav.locator("[data-virga-liteloader-settings]");
  const dialog = page.getByRole("dialog", { name: "Virga 悬雨" });
  await fallback.getByRole("button", { name: "打开 Virga 设置" }).click({ timeout: 5000 });
  await dialog.getByText("已与配置同步").waitFor();
  assert.equal(await page.locator(".nav-item-active").textContent(), "通用");
  await dialog.getByRole("button", { name: "文字与形状", exact: true }).click();
  const avatars = dialog.getByRole("checkbox", { name: "合并连续消息头像" });
  const grouping = await avatars.isChecked();
  await updateAppearance(page, () => avatars.setChecked(!grouping));
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });

  await nav.evaluate(el => el.replaceChildren(el.firstElementChild!.cloneNode(true)));
  await fallback.waitFor();
  assert.equal(await fallback.count(), 1);
  await page.evaluate(() => { location.hash = "/main/contact"; });
  await fallback.waitFor({ state: "detached" });
  await page.evaluate(() => { location.hash = "/setting"; });
  await fallback.waitFor();

  await nav.evaluate(async el => {
    const module = await import(new URL("/renderer.js", location.href).href);
    const tab = document.createElement("button");
    tab.className = "nav-item";
    tab.dataset.slug = "virga";
    el.append(tab);
    const view = document.createElement("div");
    view.className = "tab-view virga";
    document.querySelector(".setting-main")!.append(view);
    module.onSettingWindowCreated(view);
  });
  await fallback.waitFor({ state: "detached" });
  const native = page.locator(".tab-view.virga");
  await native.getByRole("button", { name: "打开 Virga 设置" }).click();
  await dialog.getByText("已与配置同步").waitFor();
  await dialog.getByRole("button", { name: "文字与形状", exact: true }).click();
  assert.equal(await avatars.isChecked(), !grouping);

  await page.evaluate(async () => {
    const module = await import(new URL("/renderer.js", location.href).href);
    module.deactivateRenderer();
  });
  await dialog.waitFor({ state: "detached" });
  assert.equal(await nav.locator('[data-slug="virga"]').count(), 1);
}
