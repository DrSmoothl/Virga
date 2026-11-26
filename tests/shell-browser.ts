import assert from "node:assert/strict";
import type { Page } from "playwright-core";

const nativeWindowBackground = `<div class="q-miracle-background miracle-background__sidebar" style="position:absolute;inset:0;pointer-events:none;z-index:-1;background-color:#88b7c8;background-image:linear-gradient(#88b7c8,#bde4f2)"></div>`;

export const shellFixture = `<style>
.pin-collapse-bar { background: #43576d !important; }
.pin-collapse-bar__stuck-bg { background: #55749a !important; }
</style><div id="layout" class="global-container">
  ${nativeWindowBackground}
  <div class="window-title-bar window-title-bar--ghost" style="position:absolute;inset:0 0 auto;height:40px;z-index:3500;pointer-events:none"></div>
  <header class="topbar container-topbar"><div class="topbar-content"><button>账号</button></div></header>
  <aside class="recent-contact"><section class="viewport-list" role="list">
    <div class="recent-contact-item" role="listitem"><div class="item__content"><span class="contact-name__text">山雨</span><span class="item__summary">会话摘要</span><span class="q-badge-num q-badge__grey">9</span></div></div>
    <div class="recent-contact-item recent-contact-item--selected" role="listitem" aria-selected="true"><span class="contact-name__text">云下</span></div>
  </section>
  <div class="pin-collapse-bar" role="button" aria-expanded="true" tabindex="0" style="position:relative;height:36px">
    <span class="pin-collapse-bar__stuck-bg" aria-hidden="true" style="position:absolute;inset:0"></span>
    <span class="pin-collapse-bar__text" style="position:relative">折叠置顶聊天</span>
  </div></aside>
  <aside class="group-box"><div class="group-box__container"><section class="group-notice">群公告</section><section class="group-member"><button class="group-user">成员</button></section></div></aside>
</div>
<div class="q-context-menu aio-right-click-menu" role="menu">
  <button class="q-context-menu-item" role="menuitem">回复</button><div class="q-context-menu-separator" role="separator"></div>
  <button class="q-context-menu-item danger" role="menuitem" style="color:rgb(184,46,51)">删除</button>
  <button class="q-context-menu-item" role="menuitem" disabled>禁用</button>
  <div class="q-context-sub-menu__container" style="position:fixed;left:280px;top:350px">子菜单</div>
</div>
<div class="q-dialog"><div class="q-dialog-modal"></div><section class="q-dialog-main" role="dialog">确认</section></div>
<div class="bar-more-menu-inner">更多操作</div><div class="q-popup__main">弹出面板</div>
<div class="q-popup__main lucky-money-dialog">
  <div class="send-container" style="background:#212121">
    <div class="send-container__tabs"><span class="q-tabs-item active" style="color:#ff4d4d">拼手气红包</span></div>
    <label class="send-input-container" style="display:block;background:#292929">
      总金额<input class="send-input" placeholder="0.00" style="color:white">
    </label>
  </div>
</div>
<div class="layout-container group-file-global-container" style="background:rgba(0,0,0,.3)">${nativeWindowBackground}<header class="window-title-bar">群文件</header></div>`;

export async function verifyShell(page: Page) {
  const color = (sel: string) =>
    page.locator(sel).evaluate((el) => getComputedStyle(el).backgroundColor);
  const pin = page.locator(".pin-collapse-bar");
  const stuck = ".pin-collapse-bar__stuck-bg";
  await pin.evaluate((el) => {
    el.addEventListener("click", () => {
      const expanded = el.getAttribute("aria-expanded") === "true";
      el.setAttribute("aria-expanded", String(!expanded));
      el.querySelector(".pin-collapse-bar__text")!.textContent = expanded
        ? "展开置顶聊天"
        : "折叠置顶聊天";
    });
    el.addEventListener("keydown", (e: Event) => {
      if ((e as KeyboardEvent).key === "Enter") (el as HTMLElement).click();
    });
  });
  for (const dark of [false, true]) {
    await page.locator("html").evaluate((el, dark) => {
      el.setAttribute(
        "class",
        dark ? "q-theme-tokens-dark" : "q-theme-tokens-light",
      );
    }, dark);
    const rail = dark ? "rgb(25, 32, 36)" : "rgb(41, 50, 55)";
    const canvas = dark ? "rgb(32, 39, 43)" : "rgb(252, 252, 250)";
    const panel = dark ? "rgb(40, 47, 51)" : "rgb(242, 243, 241)";
    const selected = dark ? "rgb(57, 70, 77)" : "rgb(219, 226, 228)";
    assert.equal(await color(".topbar"), rail);
    assert.equal(await color(".group-file-global-container .window-title-bar"), rail);
    assert.equal(await color(".window-title-bar--ghost"), "rgba(0, 0, 0, 0)");
    assert.equal(
      await page.locator(".window-title-bar--ghost").evaluate((el) => getComputedStyle(el).boxShadow),
      "none",
    );
    assert.equal(await color(".pin-collapse-bar"), panel);
    assert.equal(await color(stuck), panel);
    assert.equal(await pin.getAttribute("aria-expanded"), "true");
    const oldBox = await pin.boundingBox();
    await page.getByRole("button", { name: "折叠置顶聊天" }).click();
    assert.equal(await pin.getAttribute("aria-expanded"), "false");
    assert.ok(await page.getByRole("button", { name: "展开置顶聊天" }).isVisible());
    assert.equal(await color(".pin-collapse-bar"), await color(stuck));
    await page.mouse.move(0, 0);
    await pin.evaluate((el) => (el as HTMLElement).blur());
    assert.equal(await color(stuck), panel);
    assert.deepEqual(await pin.boundingBox(), oldBox);
    await pin.press("Enter");
    assert.equal(await pin.getAttribute("aria-expanded"), "true");
    assert.equal(await color(".pin-collapse-bar"), await color(stuck));
    await pin.evaluate((el) => (el as HTMLElement).blur());
    for (const shell of [".global-container", ".group-file-global-container"]) {
      const skin = shell + " > .q-miracle-background";
      assert.equal(await color(shell), canvas);
      assert.equal(await color(skin), canvas);
      assert.equal(
        await page
          .locator(skin)
          .evaluate((el) => getComputedStyle(el).backgroundImage),
        "none",
      );
    }
    for (const sel of [
      ".group-box",
      ".q-context-menu",
      ".q-context-sub-menu__container",
      ".q-dialog-main",
      ".bar-more-menu-inner",
      ".q-popup__main:not(.lucky-money-dialog)",
    ])
      assert.equal(await color(sel), panel, sel);
    assert.equal(await color(".lucky-money-dialog .send-container"), canvas);
    assert.equal(await color(".lucky-money-dialog .send-input-container"), panel);
    assert.equal(await page.locator(".lucky-money-dialog .q-tabs-item").evaluate(
      el => getComputedStyle(el).color,
    ), "rgb(255, 77, 77)");
    for (const sel of [
      ".topbar-content",
      ".group-notice",
      ".group-member",
      ".q-dialog",
    ])
      assert.equal(await color(sel), "rgba(0, 0, 0, 0)", sel);
    await page.waitForFunction(
      (value) =>
        getComputedStyle(
          document.querySelector(".recent-contact-item--selected")!,
        ).backgroundColor === value,
      selected,
    );
    await page.getByRole("menuitem", { name: "回复" }).focus();
    assert.equal(await color(".q-context-menu-item:focus"), selected);
    assert.equal(
      await page
        .getByRole("menuitem", { name: "删除" })
        .evaluate((el) => getComputedStyle(el).color),
      "rgb(184, 46, 51)",
    );
    assert.ok(await page.getByRole("menuitem", { name: "禁用" }).isDisabled());
    assert.equal(await color(".q-dialog-modal"), "rgba(0, 0, 0, 0.36)");
    assert.equal(
      await page
        .locator(".q-context-sub-menu__container")
        .evaluate((el) => el.getBoundingClientRect().left),
      280,
    );
    assert.equal(
      await page
        .locator(".recent-contact-item--selected")
        .evaluate((el) => el.matches(":focus-visible")),
      false,
    );
  }
}
