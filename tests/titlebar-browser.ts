import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import { updateAppearance, waitForAppearance } from "./browser-settings.ts";

export const titlebarFixture = `
<style>
  #layout.titlebar-fixture { display: flex; flex-direction: column; height: 450px; }
  .titlebar-fixture .container-content { display:flex; flex:1; margin:0 4px 4px; overflow:hidden; }
  .titlebar-fixture .container-sidebar {
    flex:0 0 52px; block-size:100%; margin:0; align-self:flex-start;
    display:flex; flex-direction:column; justify-content:space-between;
  }
  .titlebar-fixture .container-content-view { display:flex; flex:1; position:relative; min-width:0; }
  .titlebar-fixture .recent-contact { flex:0 0 270px; min-inline-size:0; }
  .titlebar-fixture .two-col-layout__main { min-width:0; flex:1; }
  .titlebar-fixture .contact-layout, .titlebar-fixture .guild-layout-wrapper { flex:1; }
  .titlebar-fixture .contact-layout__left-area { width:270px; }
  .titlebar-fixture .container-topbar { block-size:40px; }
  .titlebar-fixture .topbar-content { display:flex; height:40px; padding-inline:56px 72px; box-sizing:border-box; }
  .titlebar-fixture .topbar-profile { display:flex; position:relative; flex:1; inline-size:0; block-size:40px; padding-inline:12px 4px; }
  .titlebar-fixture .user-profile-card__content, .titlebar-fixture .user-profile-card__info,
  .titlebar-fixture .user-profile-card__avatar { display:flex; align-items:center; gap:6px }
  .titlebar-fixture .user-profile-card__content { flex:1 1 0%; min-inline-size:0; }
  .titlebar-fixture .user-profile-card__info { padding:0; max-inline-size:180px; box-shadow:none; }
  .titlebar-fixture .user-profile-card__nick-row { display:flex; align-items:baseline; }
  .titlebar-fixture .profile-nickname__text { display:block; }
  .titlebar-fixture .user-profile-card__nameplate { flex-shrink:1; margin-inline-start:3px; }
  .titlebar-fixture .user-profile-card__long-nick { margin-block-start:8px; }
  .titlebar-fixture .profile_signature { white-space:nowrap; padding-inline:4px; }
  .titlebar-fixture .user-profile-card__avatar > button { inline-size:24px; block-size:24px; overflow:hidden; padding:0; }
  .titlebar-fixture .contact-top-bar, .titlebar-fixture .chat-header { display:flex; align-items:center; height:52px; }
  .titlebar-fixture .contact-top-bar { padding:0 12px; gap:8px; }
  .titlebar-fixture input { flex:1; min-width:0; block-size:28px }
  .titlebar-fixture .chat-header { box-sizing:border-box; padding-block:15px 12px; border-block-start:1px solid transparent; }
  .titlebar-fixture .panel-header__title { flex:1; display:flex; min-width:0; overflow:hidden; margin-block-start:3px; }
  .titlebar-fixture .panel-header__action { margin-block-start:3px; }
  .titlebar-ghost { position:absolute; display:flex; justify-content:space-between; inset:0 0 auto; height:40px; pointer-events:none; z-index:3500; }
  .titlebar-ghost .window-title-bar__mac-spacer { width:86px; }
  .titlebar-ghost [data-testid="native-traffic-lights"] { position:absolute; inset:9px auto auto 9px; width:60px; height:14px; }
  .titlebar-ghost .window-control-area { pointer-events:auto; display:flex; align-items:center; justify-content:center; width:76px; block-size:40px; }
</style>
<div class="mac-qq">
  <div class="titlebar-ghost window-title-bar window-title-bar--app window-title-bar--mac window-title-bar--ghost">
    <i class="window-title-bar__mac-spacer" aria-hidden="true"><i data-testid="native-traffic-lights"></i></i>
    <div class="window-control-area"><button type="button" aria-label="窗口操作">窗口</button></div>
  </div>
  <div id="layout" class="global-container titlebar-fixture">
    <header class="topbar container-topbar">
      <div class="topbar-content">
        <div class="topbar-profile">
          <div class="user-profile-card__content">
            <div class="user-profile-card__avatar"><button type="button" aria-label="头像">雨</button></div>
            <div class="user-profile-card__info">
              <div class="user-profile-card__nick-row">
                <div class="user-profile-card__nickname"><span class="profile-nickname__text">雨青</span></div>
                <span class="user-profile-card__nameplate">SVIP</span>
              </div>
              <div class="user-profile-card__long-nick">
                <span class="profile_signature editable" role="button" tabindex="0" aria-label="编辑个签">风停以后，记得和心中重要的人再见一面。愿夜里的航灯也能在回家的路上照亮你。</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
    <div class="container-content">
      <div class="container-sidebar">
        <nav class="sidebar-nav"><button class="nav-item" type="button">消息</button></nav>
        <button type="button">侧栏设置</button>
      </div>
      <div class="container-content-view">
        <aside class="recent-contact">
          <div class="contact-top-bar"><input type="search" aria-label="搜索会话"><button type="button">新建</button></div>
          <div role="list"><span role="listitem">周末计划</span></div>
        </aside>
        <div class="two-col-layout__main">
          <header class="chat-header">
            <div class="panel-header__title"><button type="button">群聊资料</button></div>
            <div class="panel-header__action"><button type="button">聊天操作</button></div>
          </header>
          <section class="chat-msg-area" role="log">一条合成消息</section>
        </div>
      </div>
    </div>
  </div>
</div>`;

export async function verifyTitlebar(page: Page, settings: Page) {
  await settings.getByRole("button", { name: "界面", exact: true }).click();
  const select = settings.getByRole("combobox", { name: "标题栏" });
  const settleTitlebar = () => page.waitForFunction(() =>
    !document.getAnimations().some(a => a.id === "virga-titlebar-rail" ||
      (a instanceof CSSTransition && (a.effect as KeyframeEffect).target?.matches(
        ".titlebar-fixture > .container-topbar",
      ))),
  );
  const choose = async (name: string) => {
    const revision = await updateAppearance(settings, async () => {
      await select.click();
      await settings.getByRole("option", { name, exact: true }).click();
    });
    await waitForAppearance(page, revision);
    await settleTitlebar();
  };
  const compactAttr = "data-virga-compact-titlebar";
  const shell = page.locator("#layout");
  const finder = page.locator(".contact-top-bar");
  const search = page.getByRole("searchbox", { name: "搜索会话" });
  const tools = page.getByRole("button", { name: "窗口操作" });
  const actions = page.getByRole("button", { name: "聊天操作" });
  const account = page.getByRole("button", { name: "账号资料" });
  const signature = page.getByRole("button", { name: "编辑个签" });
  const traffic = page.getByTestId("native-traffic-lights");
  const spacer = page.locator(".window-title-bar__mac-spacer");
  const sidebar = page.locator(".container-sidebar");
  const rowEnd = page.locator(".container-content");
  async function checkDockedRail(headerHeight: number) {
    const [rail, container, top, bottom] = await Promise.all([
      sidebar.boundingBox(),
      rowEnd.boundingBox(),
      page.getByRole("button", { name: "消息", exact: true }).boundingBox(),
      page.getByRole("button", { name: "侧栏设置", exact: true }).boundingBox(),
    ]);
    assert.ok(rail && container && top && bottom);
    assert.equal(rail.y, headerHeight);
    assert.ok(top.y >= rail.y);
    assert.ok(bottom.y + bottom.height <= container.y + container.height);
    assert.equal(rail.y + rail.height, container.y + container.height);
  }
  const initial = await traffic.boundingBox();
  assert.ok(initial);
  const safeArea = (await spacer.boundingBox())!;
  const searchEdge = safeArea.x + safeArea.width;
  assert.equal(await shell.getAttribute(compactAttr), null);
  await signature.waitFor();
  const full = (await finder.boundingBox())!;
  const fullTools = await tools.boundingBox();

  await choose("紧凑");
  await shell.locator("xpath=self::*[@" + compactAttr + "]").waitFor();
  const [finderBox, chatHeader, searchBox] = await Promise.all([
    finder.boundingBox(),
    page.locator(".chat-header").boundingBox(),
    search.boundingBox(),
  ]);
  assert.ok(finderBox && chatHeader && searchBox);
  const compactHeight = finderBox.height;
  assert.equal(compactHeight, 44);
  assert.equal(finderBox.y, 0);
  assert.equal(chatHeader.y, finderBox.y);
  assert.equal(chatHeader.height, compactHeight);
  assert.ok(searchBox.y - finderBox.y >= 6);
  assert.ok(finderBox.y + compactHeight - (searchBox.y + searchBox.height) >= 6);
  const controlsCenter = searchBox.y + searchBox.height / 2;
  assert.equal(controlsCenter, compactHeight / 2);
  assert.equal(await signature.isVisible(), false);
  assert.deepEqual(await traffic.boundingBox(), initial);
  await checkDockedRail(compactHeight);
  const [native, avatar, chat] = await Promise.all(
    [tools, account, actions].map(locator => locator.boundingBox()),
  );
  assert.ok(native && avatar && chat);
  assert.ok(chat.x + chat.width < avatar.x && avatar.x + avatar.width < native.x);
  const centered = await Promise.all([
    page.getByRole("button", { name: "群聊资料" }).boundingBox(),
    page.getByRole("button", { name: "新建" }).boundingBox(),
  ]);
  for (const item of [native, avatar, chat, ...centered]) {
    assert.ok(item);
    assert.ok(Math.abs(item.y + item.height / 2 - controlsCenter) <= 0.5, JSON.stringify(item));
  }
  assert.equal(searchBox.x, searchEdge);
  assert.ok(await page.locator(".panel-header__title").evaluate(el => {
    const title = el.firstElementChild!.getBoundingClientRect();
    const clip = el.getBoundingClientRect();
    return title.top >= clip.top && title.bottom <= clip.bottom;
  }));
  const sidebarWidth = (width: string) => finder.evaluate(async (control, width) => {
    const shell = control.closest(".global-container")!;
    const bar = shell.querySelector<HTMLElement>(":scope > .container-topbar")!;
    const before = control.getBoundingClientRect().top;
    const finished = new Promise<number>((resolve, reject) => {
      const events = new AbortController();
      const timeout = window.setTimeout(() => {
        events.abort();
        reject(new Error("侧栏宽度变化后顶栏高度过渡未完成 " + JSON.stringify({
          width, before, after: control.getBoundingClientRect().top,
          compact: shell.hasAttribute("data-virga-compact-titlebar"),
          duration: getComputedStyle(bar).transitionDuration,
        })));
      }, 5_000);
      bar.addEventListener("transitionend", (event) => {
        if (event.target !== bar ||
            (event.propertyName !== "height" && event.propertyName !== "block-size")) return;
        window.clearTimeout(timeout);
        events.abort();
        resolve(event.elapsedTime);
      }, { signal: events.signal });
    });
    (control.parentElement as HTMLElement).style.flexBasis = width;
    const duration = await finished;
    return { before, after: control.getBoundingClientRect().top, duration };
  }, width);
  for (const [width, start, end] of [["132px", 0, full.y], ["270px", full.y, 0]] as const) {
    const { before, after, duration } = await sidebarWidth(width);
    assert.ok(duration > 0, width);
    assert.deepEqual([before, after], [start, end], width);
  }
  const roster = page.locator(".recent-contact");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await roster.evaluate(el => { (el as HTMLElement).style.flexBasis = "132px"; });
  await signature.waitFor();
  assert.equal((await finder.boundingBox())?.y, compactHeight);
  assert.equal(await shell.locator(":scope > .container-topbar").evaluate(el => el.getAnimations().length), 0);
  await roster.evaluate(el => { (el as HTMLElement).style.removeProperty("flex-basis"); });
  await account.waitFor();
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await search.fill("雨");
  assert.equal(await search.inputValue(), "雨");
  const workspace = shell.locator(".container-content-view");
  const conversationHeader = page.locator(".chat-header");
  const idleToolbar = workspace.locator("xpath=self::*[@data-virga-titlebar-empty]");
  await conversationHeader.evaluate(el => { el.style.display = "none"; });
  await idleToolbar.waitFor();
  assert.equal(await shell.getAttribute(compactAttr), "");
  assert.deepEqual(await search.boundingBox(), searchBox);
  assert.equal(await idleToolbar.evaluate(el => getComputedStyle(el, "::before").height), compactHeight + "px");
  await conversationHeader.evaluate(el => { el.style.removeProperty("display"); });
  await idleToolbar.waitFor({ state: "detached" });
  assert.deepEqual(await conversationHeader.boundingBox(), chatHeader);
  await account.press("Enter");
  assert.equal(await account.getAttribute("aria-expanded"), "true");
  const card = page.locator(".user-profile-card__info");
  const [surface, nickname, badge, bio] = await Promise.all([
    card.boundingBox(),
    card.locator(".profile-nickname__text").boundingBox(),
    card.locator(".user-profile-card__nameplate").boundingBox(),
    signature.boundingBox(),
  ]);
  assert.ok(surface && nickname && badge && bio);
  assert.equal(surface.width, 240);
  assert.equal(surface.y, compactHeight + 8);
  assert.ok(surface.x + surface.width <= 808);
  assert.ok(avatar.x + avatar.width / 2 > surface.x);
  assert.ok(avatar.x + avatar.width / 2 < surface.x + surface.width);
  assert.equal(nickname.x - surface.x, 12);
  assert.equal(bio.x, nickname.x);
  assert.equal(badge.x - nickname.x - nickname.width, 8);
  assert.equal(bio.height, 36);
  assert.notEqual(await card.evaluate(el => getComputedStyle(el).boxShadow), "none");
  await signature.click();
  await signature.press("Escape");
  assert.equal(await signature.isVisible(), false);
  assert.equal(await account.evaluate(el => el === document.activeElement), true);
  await account.click();
  await search.click();
  assert.equal(await account.getAttribute("aria-expanded"), "false");

  const rail = settings.getByRole("checkbox", { name: "导航栏自动收回" });
  const dockedSearchX = (await search.boundingBox())!.x;
  const setAutoHide = async (enabled: boolean) => {
    await search.evaluate(el => {
      el.removeAttribute("data-test-search-x");
      const observer = new MutationObserver(() => {
        el.setAttribute("data-test-search-x", String(el.getBoundingClientRect().x));
        el.setAttribute("data-test-rail-motion", String(document.getAnimations().filter(
          animation => animation.id === "virga-titlebar-rail",
        ).length));
        observer.disconnect();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-virga-revision"],
      });
    });
    const revision = await updateAppearance(settings, () => rail.setChecked(enabled));
    await waitForAppearance(page, revision);
    assert.equal(
      await search.getAttribute("data-test-search-x"),
      String(dockedSearchX),
      "搜索框应在配置生效时避开交通灯",
    );
    assert.ok(Number(await search.getAttribute("data-test-rail-motion")) > 0);
    await settleTitlebar();
  };
  await setAutoHide(true);
  await page.locator("[data-virga-rail-handle]").waitFor();
  assert.equal(await page.locator("[data-virga-rail-handle]").evaluate(
    el => el.getBoundingClientRect().top,
  ), compactHeight);
  assert.equal(await page.locator("[data-virga-floating-rail]").evaluate(
    el => el.getBoundingClientRect().bottom,
  ), await page.locator(".container-content").evaluate(el => el.getBoundingClientRect().bottom));
  assert.equal((await search.boundingBox())?.x, searchEdge);
  assert.deepEqual(await traffic.boundingBox(), initial);

  await page.setViewportSize({ width: 440, height: 920 });
  await signature.waitFor();
  assert.equal(await shell.getAttribute(compactAttr), null);
  await page.setViewportSize({ width: 820, height: 920 });
  await account.waitFor();
  assert.equal(await shell.getAttribute(compactAttr), "");
  await settleTitlebar();

  const conversationMarkup = await workspace.innerHTML();
  await workspace.evaluate(el => {
    location.hash = "/main/contact";
    el.innerHTML = '<div class="contact-layout"><div class="contact-layout__left-area">' +
      '<div class="contact-top-bar"><input type="search" aria-label="搜索联系人"></div>' +
      '</div></div>';
  });
  await signature.waitFor();
  assert.equal(await shell.getAttribute(compactAttr), null);
  await settleTitlebar();
  const contactsHeader = shell.locator(".container-topbar");
  const contactsSearch = page.getByRole("searchbox", { name: "搜索联系人" });
  const contactsHeight = (await contactsHeader.boundingBox())!.height;
  assert.equal(contactsHeight, compactHeight);
  assert.equal((await finder.boundingBox())?.y, contactsHeight);
  const contactSearchBox = (await contactsSearch.boundingBox())!;
  assert.equal(contactSearchBox.y + contactSearchBox.height / 2, contactsHeight * 1.5);
  assert.ok(contactSearchBox.y - contactsHeight >= 6);
  for (const control of [page.getByRole("button", { name: "头像" }), tools]) {
    const box = await control.boundingBox();
    assert.ok(box && Math.abs(box.y + box.height / 2 - contactsHeight / 2) <= 0.5);
  }
  await contactsSearch.fill("雨");
  assert.equal(await contactsSearch.inputValue(), "雨");
  await choose("完整");
  assert.equal((await contactsHeader.boundingBox())?.height, compactHeight);
  await choose("紧凑");
  await workspace.evaluate(el => {
    location.hash = "/main/guild";
    el.innerHTML = '<div class="guild-layout-wrapper" aria-label="频道内容"></div>';
  });
  assert.equal((await page.getByLabel("频道内容").boundingBox())?.y, compactHeight);
  assert.equal((await contactsHeader.boundingBox())?.height, compactHeight);
  for (const control of [page.getByRole("button", { name: "头像" }), tools]) {
    const box = await control.boundingBox();
    assert.ok(box && Math.abs(box.y + box.height / 2 - controlsCenter) <= 0.5);
    assert.ok(box.x >= searchEdge && box.x + box.width <= 820 - 6);
  }
  await workspace.evaluate((el, markup) => {
    location.hash = "/main/message";
    el.innerHTML = markup;
  }, conversationMarkup);
  await account.waitFor();
  await settleTitlebar();

  await setAutoHide(false);
  await checkDockedRail(compactHeight);
  await choose("完整");
  await signature.waitFor();
  assert.equal(await shell.getAttribute(compactAttr), null);
  assert.deepEqual(await finder.boundingBox(), full);
  assert.deepEqual(await tools.boundingBox(), fullTools);
  assert.equal(await page.getByRole("button", { name: "头像" }).getAttribute("aria-expanded"), null);
}
