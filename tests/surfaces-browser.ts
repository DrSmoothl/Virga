import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import { firstRecord, type Saved } from "../packages/theme/src/config.ts";
import { updateAppearance } from "./browser-settings.ts";

export const contactFixture = `<div id="layout" class="contact-layout"><aside class="two-col-layout__aside"><div class="contact-layout__left-area"><div class="contact"><div class="contact-top-bar"><input class="search-input" aria-label="搜索联系人"></div><div class="tab-header"><div role="tablist"><button role="tab" aria-selected="true">好友</button><button role="tab" aria-selected="false">群聊</button></div></div><div class="contact-layout__content-area"><section class="q-collapse"><div class="q-collapse-item"><button class="q-collapse-item__header">我的设备</button></div></section></div></div></div></aside><main class="two-col-layout__main"><section class="contact-profile">资料</section></main></div>`;
export async function verifyContactSurfaces(page: Page) {
  await page.evaluate(async (fallback) => {
    const config = window.LiteLoader!.api.config;
    const record = await config.get("virga", fallback) as Saved;
    Object.assign(record.settings.light, {
      list: "#253342",
      canvas: "#fbf4e4",
      panel: "#425769",
      selected: "#769499",
    });
    record.settings.mode = "light";
    record.revision++;
    await config.set("virga", record);
    dispatchEvent(new Event("focus"));
  }, firstRecord());
  const expected: Record<string, string> = {
    ".contact": "rgb(37, 51, 66)",
    ".q-collapse-item__header": "rgb(37, 51, 66)",
    ".contact-layout__content-area": "rgb(37, 51, 66)",
    ".contact-profile": "rgb(251, 244, 228)",
    ".search-input": "rgb(66, 87, 105)",
    "[role=tablist]": "rgb(66, 87, 105)",
    "[aria-selected=true]": "rgb(118, 148, 153)",
  };
  for (const [selector, color] of Object.entries(expected))
    await page.waitForFunction(
      ({ selector, color }) =>
        getComputedStyle(document.querySelector(selector)!).backgroundColor ===
        color,
      { selector, color },
    );
  assert.ok(await page.getByRole("button", { name: "我的设备" }).isEnabled());
}
export async function verifyAvatarGroups(page: Page, settings: Page) {
  const track = page.locator(".ml-list");
  await track.evaluate((el) => {
    const message = (id: string, avatarId: string, own = false) =>
      `<article class="ml-item message" data-sender-id="${id}"><button class="avatar" aria-label="头像" data-user-id="${avatarId}"></button><div class="msg-content-container container--${own ? "self" : "others"}"><span class="text-element">合成消息</span></div></article>`;
    el.innerHTML =
      message("a", "a") +
      message("a", "a") +
      message("b", "b") +
      '<div role="separator">昨天</div>' +
      message("b", "b") +
      message("", "") +
      message("", "");
  });
  const hidden = () => track.locator("[data-virga-merged-avatar]").count();
  const wait = async (n: number) =>
    page.waitForFunction(
      (n) =>
        document.querySelectorAll(".ml-list [data-virga-merged-avatar]")
          .length === n,
      n,
    );
  await wait(1);
  assert.ok(
    await track
      .locator(".avatar")
      .nth(0)
      .evaluate(
        (el) =>
          el.getBoundingClientRect().width > 0 &&
          getComputedStyle(el).visibility === "hidden",
      ),
  );
  assert.equal(
    await track
      .locator(".avatar")
      .nth(1)
      .evaluate((el) => getComputedStyle(el).visibility),
    "visible",
  );
  await track
    .locator(".ml-item")
    .nth(1)
    .evaluate((el) => el.setAttribute("data-sender-id", "c"));
  await wait(0);
  await track
    .locator(".ml-item")
    .nth(1)
    .evaluate((el) => el.setAttribute("data-sender-id", "a"));
  await wait(1);
  await settings.getByRole("button", { name: "文字与形状" }).click();
  const avatars = settings.getByLabel("合并连续消息头像");
  await updateAppearance(settings, () => avatars.uncheck());
  await wait(0);
  assert.equal(await hidden(), 0);
  await updateAppearance(settings, () => avatars.check());
  await wait(1);
  await track
    .locator(".ml-item")
    .first()
    .evaluate((el) => el.remove());
  await wait(0);
  await track.evaluate((el) => {
    const message = (asset: string) =>
      `<div class="ml-item"><article class="message-container"><span class="avatar-span" aria-label="同名的头像"><span class="avatar" style="background-image:url('/avatar/user/${asset}/small')"></span></span><div class="message-content__wrapper"><span class="msg-time">12:15</span><span class="message-content">合成内容</span></div></article></div>`;
    el.innerHTML =
      message("u_synthetic_sender_a") +
      message("u_synthetic_sender_a") +
      message("u_synthetic_sender_b") +
      '<div class="ml-item"><span class="gray-tip-message">系统提示</span></div>' +
      message("u_synthetic_sender_b") +
      message("default") +
      message("default");
  });
  await wait(1);
  assert.ok(
    (await track
      .locator(".avatar-span")
      .first()
      .getAttribute("data-virga-merged-avatar")) !== null,
  );
  const viewport = page.locator('.chat-msg-area');
  await page.addStyleTag({ content: `
    .virga-fixture .message-container { display:flex; gap:8px; padding-block:6px; }
    .virga-fixture .avatar { display:block;width:26px;height:26px; }
    .virga-fixture .msg-content-container { height:56px;width:130px; }
  ` });
  await track.evaluate(el => {
    el.classList.add('virga-fixture');
    el.innerHTML = `<div class="ml-item">
      <article class="message-container">
        <span class="avatar-span" aria-label="发言者的头像">
          <span class="avatar" data-uid="sender"></span>
        </span>
        <div><div class="user-name">发言者</div>
          <div class="msg-content-container container--others"><span class="text-element">合成消息</span></div>
        </div>
      </article></div>`.repeat(8);
  });
  await viewport.evaluate(el => { el.scrollTop = 0; });
  await wait(7);
  assert.equal(await track.locator('[data-virga-merged-name]').count(), 7);
  assert.equal(await track.locator('[data-virga-message-group=last]').count(), 1);
  const anchor = track.locator('[data-virga-avatar-anchor]');
  const geometry = () => anchor.evaluate(el => {
    const view = el.closest('.chat-msg-area')!;
    const last = el.closest('.message-container')!.querySelector('.msg-content-container')!;
    return [
      el.getBoundingClientRect().bottom,
      view.getBoundingClientRect().bottom,
      last.getBoundingClientRect().bottom,
    ] as const;
  });
  await page.waitForFunction(() => {
    const avatar = document.querySelector<HTMLElement>('[data-virga-avatar-anchor]');
    return Number.parseFloat(avatar?.style.getPropertyValue('--virga-avatar-offset') ?? '0') < -1;
  });
  const [pinned, edge, outOfView] = await geometry();
  assert.ok(outOfView > edge && Math.abs(pinned - (edge - 4)) < 1);
  await viewport.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForFunction(() => {
    const avatar = document.querySelector<HTMLElement>('[data-virga-avatar-anchor]')!;
    const viewport = avatar.closest('.chat-msg-area')!;
    const bubble = avatar.closest('.message-container')!.querySelector('.msg-content-container')!;
    const bottom = Math.min(viewport.getBoundingClientRect().bottom - 4, bubble.getBoundingClientRect().bottom);
    return Math.abs(avatar.getBoundingClientRect().bottom - bottom) < 1;
  });
  const [atLast, limit, lastBubble] = await geometry();
  assert.ok(Math.abs(atLast - Math.min(limit - 4, lastBubble)) < 1);
}
