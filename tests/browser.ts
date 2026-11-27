import {
  contactFixture,
  verifyContactSurfaces,
  verifyAvatarGroups,
} from "./surfaces-browser.ts";
import { chatFixture, chatFixtureCSS, verifyChat, verifyConversationDrag } from "./chat-browser.ts";
import { selectMode, updateAppearance, waitForAppearance } from "./browser-settings.ts";
import { filterFixture, interfaceFixture, interfaceFixtureCSS, verifyInterface } from "./interface-browser.ts";
import { liteLoaderSettingsFixture, verifyLiteLoaderSettings } from "./liteloader-browser.ts";
import { shellFixture, verifyShell } from "./shell-browser.ts";
import {
  titlebarFixture,
  verifyTitlebar,
  verifyWindowsTitlebar,
  windowsTitlebarFixture,
} from "./titlebar-browser.ts";
import {
  detachedFixture,
  verifyPinned,
  verifyWorkspace,
  workspaceFixture,
  workspaceFixtureCSS,
} from "./workspace-browser.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import type { Saved } from "../packages/theme/src/index.ts";

const bundle = await readFile(
  new URL("../dist/plugin/renderer.js", import.meta.url),
  "utf8",
);
const photo = '<img alt="" width="24" height="24">';
const richMessages = {
  reply: '<div class="message-content"><div class="reply-element">雨势变小了。</div><span class="text-element"><span class="text-element--at">@南枝</span> 看到了。</span></div>',
  mixed: '<div class="message-content"><span class="pic-element">' + photo + '</span><span class="text-element"><a href="#image">图片附带链接</a></span></div>',
  forward: '<div class="forward-msg" role="button" tabindex="0">合并转发的聊天记录</div>',
  file: '<div class="message-content"><div class="file-element">路线.pdf <button type="button">下载</button></div></div>',
  custom: '<article class="rich-message">没有文字元素标记的消息</article>',
};
const nativeRichBubble = 'style="background:#176e91 linear-gradient(#147caa,#176e91);padding:0;border-radius:17px"';
const richBubbles = Object.entries(richMessages).map(([kind, content]) => `
    <div class="msg-content-container container--self" id="${kind}-outgoing" ${nativeRichBubble}>${content}</div>
    <div class="message-container message-container--others"><div class="message-content__wrapper" id="${kind}-incoming" ${nativeRichBubble}>${content}</div></div>`).join("");
const pages = {
  shell: shellFixture,
  titlebar: titlebarFixture,
  "windows-titlebar": windowsTitlebarFixture,
  chat: chatFixture,
  workspace: workspaceFixture,
  detached: detachedFixture,
  contacts: contactFixture,
  liteloader: liteLoaderSettingsFixture,
  interface: interfaceFixture,
  notify: filterFixture,
  components: `<div id="layout"><aside class="sidebar-nav"></aside><section class="recent-contact"></section><main class="chat-msg-area" style="overflow:auto">
    <div class="message"><div class="message-content__wrapper" id="wrapper"><div class="msg-content-container container--self" id="bubble"><div class="message-content"><span class="text-element">雨还没落到地上。</span></div></div></div></div>
    <div class="msg-content-container container--others" id="incoming"><div class="message-content"><span class="text-element">看到了。</span></div></div>
    ${richBubbles}
    <div class="message-container message-container--self"><div class="message-content__wrapper" id="forward-legacy-outgoing" ${nativeRichBubble}>${richMessages.forward}</div></div>
    <div class="message-container--self"><div class="msg-content-container container--others" id="explicit-incoming" ${nativeRichBubble}>${richMessages.custom}</div></div>
    <div class="msg-content-container container--others" id="photo">${photo}</div>
    <div class="msg-content-container container--self" id="wrapped-photo"><div class="message-content"><span class="pic-element">${photo}</span></div></div></main></div>`,
  empty: `<div id="layout" class="messenger"><aside class="sidebar-nav"></aside>
    <section class="rail-column"><div role="list" aria-label="会话列表"><div role="listitem" aria-selected="true">悬雨主题小组</div></div></section>
    <main id="surface"><div id="native-idle"><svg aria-hidden="true" viewBox="0 0 60 60"><circle cx="30" cy="30" r="19" fill="#33434a"/></svg></div></main></div>`,
  tokens: `<div id="layout"><aside></aside><section></section><main id="canvas"><article id="bubble">下次见。</article><article id="guest">云散了。</article></main></div>`,
};
const layoutCSS =
  "#layout{display:grid;grid-template-columns:52px 180px minmax(0,1fr);height:120px}#layout.messenger{height:85vh}.messenger [role=list]{height:100%}.messenger [role=listitem]{padding:14px}#surface{background:linear-gradient(120deg,#465459,#53636a)}#native-idle{height:100%;display:grid;place-items:center}#native-idle svg{width:55px}#canvas{background:var(--bg_bottom_standard)}#bubble{background-color:var(--bubble_host)}#guest{background-color:var(--bubble_guest)}#wrapper{padding:0}#photo{padding:0}";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.VIRGA_CHROMIUM ? "chromium" : "chrome",
  executablePath: process.env.VIRGA_CHROMIUM,
  chromiumSandbox: true,
});
try {
  const context = await browser.newContext({
    colorScheme: "light",
    viewport: { width: 820, height: 920 },
    deviceScaleFactor: 1,
  });
  const errors: string[] = [];
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  let saved: Saved | undefined;
  await context.exposeBinding("readAppearance", (_source, fallback: Saved) => saved ?? fallback);
  await context.exposeBinding("writeAppearance", (_source, value: Saved) => {
    saved = value;
    return true;
  });
  await context.addInitScript(() => {
    if (location.pathname === "/titlebar")
      Object.defineProperty(navigator, "platform", { value: "MacIntel" });
    if (location.pathname === "/windows-titlebar")
      Object.defineProperty(navigator, "platform", { value: "Win32" });
    const store = window as unknown as {
      readAppearance(fallback: Saved): Promise<unknown>;
      writeAppearance(value: Saved): Promise<boolean>;
    };
    window.LiteLoader = {
      api: {
        config: {
          get: (_slug, fallback) => store.readAppearance(fallback),
          set: (_slug, value) => store.writeAppearance(value),
        },
      },
    };
  });
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== "https://virga.invalid")
      throw Error("意外的外部资源请求 " + u.origin);
    if (u.pathname === "/renderer.js")
      return route.fulfill({ contentType: "text/javascript", body: bundle });
    const key = u.pathname.slice(1);
    const shape = Object.hasOwn(pages, key)
      ? (key as keyof typeof pages)
      : "components";
    const html =
      '<!doctype html><html class="q-theme-tokens-light" lang="zh-CN"><head><meta charset="utf-8"><style>body{margin:0;font:14px system-ui}' +
      layoutCSS +
      chatFixtureCSS +
      workspaceFixtureCSS +
      interfaceFixtureCSS +
      "</style></head><body>" +
      pages[shape] +
      '<div id="mount"></div></body></html>';
    return route.fulfill({ contentType: "text/html", body: html });
  });
  const open = async (path: string) => {
    const page = await context.newPage();
    await page.goto("https://virga.invalid/" + path);
    const tracks = await page
      .locator("#layout")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    await mount(page);
    assert.equal(
      await page
        .locator("#layout")
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns),
      tracks,
    );
    return page;
  };
  async function mount(page: Page) {
    await page.evaluate(async () => {
      const m = await import(new URL("/renderer.js", location.href).href);
      const view = document.getElementById("mount")!;
      view.dataset.settingsPresentation = "window";
      m.onSettingWindowCreated(view);
    });
    await page.locator("#mount").getByText("已与配置同步").waitFor();
  }
  const classic = await open("components"),
    tokens = await open("tokens");
  const artwork = classic.getByRole("img", { name: "Virga 悬雨，雨幕悬在远山上方" });
  assert.equal(await artwork.evaluate(async (el) => {
    const img = el as HTMLImageElement;
    await img.decode();
    return img.naturalWidth;
  }), 1112);
  await classic.getByRole("button", { name: "配色", exact: true }).click();
  const color = (page: Page, selector: string) =>
    page
      .locator(selector)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.equal(await color(classic, "#bubble"), "rgb(82, 109, 128)");
  const bubblePaint = (selector: string) =>
    classic.locator(selector).evaluate((el) => {
      const { backgroundColor, backgroundImage, color } = getComputedStyle(el);
      return { backgroundColor, backgroundImage, color };
    });
  const verifyBubbleColors = async () => {
    for (const [direction, plain, extra] of [
      ["outgoing", "#bubble", "#forward-legacy-outgoing"],
      ["incoming", "#incoming", "#explicit-incoming"],
    ] as const) {
      const expected = await bubblePaint(plain);
      const rich = Object.keys(richMessages).map((kind) => "#" + kind + "-" + direction);
      for (const selector of [...rich, extra]) {
        assert.deepEqual(await bubblePaint(selector), expected, selector);
        const layout = await classic.locator(selector).evaluate((el) => {
          const { paddingTop, borderTopRightRadius } = getComputedStyle(el);
          return [paddingTop, borderTopRightRadius];
        });
        assert.deepEqual(layout, ["0px", "17px"], selector + " native geometry");
      }
    }
    for (const selector of ["#photo", "#wrapped-photo", "#wrapper"]) {
      assert.equal(await color(classic, selector), "rgba(0, 0, 0, 0)", selector);
    }
    for (const direction of ["outgoing", "incoming"]) {
      const mention = classic.locator("#reply-" + direction + " .text-element--at");
      assert.equal(await mention.evaluate((el) => getComputedStyle(el).textDecorationLine), "underline");
    }
  };
  await verifyBubbleColors();
  assert.equal(await color(tokens, "#guest"), "rgb(237, 240, 237)");
  assert.equal(
    await classic
      .locator("#wrapper")
      .evaluate((el) => getComputedStyle(el).paddingTop),
    "0px",
  );
  assert.equal(
    await classic
      .locator("#photo")
      .evaluate((el) => getComputedStyle(el).paddingTop),
    "0px",
  );
  assert.equal(
    await classic
      .locator("#bubble")
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
    "13px",
  );
  const idle = await open("empty#/main/message");
  const surface = idle.locator("#surface");
  await idle.waitForFunction(() =>
    document.querySelector("#surface")?.hasAttribute("data-virga-pane"),
  );
  assert.deepEqual(
    await surface.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.backgroundColor, style.backgroundImage];
    }),
    ["rgb(252, 252, 250)", "none"],
  );
  assert.equal(
    await idle
      .getByRole("listitem")
      .evaluate((el) => getComputedStyle(el).boxShadow),
    "none",
  );
  await idle.evaluate(() => {
    location.hash = "/main/contact";
  });
  await idle.waitForFunction(
    () => !document.querySelector("#surface")?.hasAttribute("data-virga-pane"),
  );
  await idle.evaluate(() => {
    location.hash = "/main/message";
  });
  await idle.waitForFunction(() =>
    document.querySelector("#surface")?.hasAttribute("data-virga-pane"),
  );
  await idle.locator("#native-idle").evaluate((el) => {
    el.innerHTML =
      '<div role="log" aria-label="消息列表">一条合成消息</div><textarea aria-label="发消息"></textarea>';
  });
  await idle.getByRole("textbox", { name: "发消息" }).fill("草稿");
  assert.equal(
    await idle.getByRole("textbox", { name: "发消息" }).inputValue(),
    "草稿",
  );
  await tokens.evaluate(() => {
    document.documentElement.className = "q-theme-tokens-dark";
  });
  assert.equal(await color(tokens, "#canvas"), "rgb(32, 39, 43)");
  await tokens.evaluate(() => {
    document.documentElement.className = "";
    const body = document.body;
    body.className = "q-theme-tokens-light";
  });
  await tokens.emulateMedia({ colorScheme: "dark" });
  assert.equal(await color(tokens, "#canvas"), "rgb(252, 252, 250)");
  await tokens.evaluate(() =>
    document.body.classList.remove("q-theme-tokens-light"),
  );
  assert.equal(await color(tokens, "#canvas"), "rgb(32, 39, 43)");
  for (const attr of ["data-theme", "qq-theme"]) {
    await tokens
      .locator("body")
      .evaluate((el, name) => el.setAttribute(name, "light"), attr);
    assert.equal(await color(tokens, "#canvas"), "rgb(252, 252, 250)");
    await tokens
      .locator("body")
      .evaluate((el, name) => el.removeAttribute(name), attr);
  }
  await classic.getByRole("button", { name: "文字与形状", exact: true }).click();
  const fontSize = classic.getByRole("slider", { name: "消息字号" });
  assert.equal(await fontSize.getAttribute("aria-valuetext"), "14px");
  assert.equal(await fontSize.evaluate(el => getComputedStyle(el).appearance), "none");
  const fontRevision = await updateAppearance(classic, () => fontSize.press("ArrowRight"));
  await waitForAppearance(tokens, fontRevision);
  assert.equal(await fontSize.getAttribute("aria-valuetext"), "15px");
  assert.equal(await fontSize.evaluate(el => getComputedStyle(el).outlineWidth), "2px");
  assert.equal(await tokens.locator("html").evaluate(el =>
    getComputedStyle(el).getPropertyValue("--virga-font-size"),
  ), "15px");
  const hit = (await fontSize.boundingBox())!;
  assert.ok(hit.height >= 24);
  await updateAppearance(classic, () =>
    fontSize.click({ position: { x: hit.width - 2, y: hit.height / 2 } }),
  );
  assert.equal(await fontSize.getAttribute("aria-valuetext"), "24px");
  assert.equal(await fontSize.evaluate(el =>
    getComputedStyle(el).getPropertyValue("--slider-progress"),
  ), "100%");
  await updateAppearance(classic, async () => {
    await fontSize.press("Home");
    await fontSize.press("ArrowRight");
    await fontSize.press("ArrowRight");
  });
  assert.equal(await fontSize.getAttribute("aria-valuetext"), "14px");
  await classic.getByRole("button", { name: "配色", exact: true }).click();

  const darkRevision = await updateAppearance(classic, () => selectMode(classic, "深色"));
  await waitForAppearance(tokens, darkRevision);
  await tokens.emulateMedia({ colorScheme: "light" });
  assert.equal(await color(tokens, "#bubble"), "rgb(159, 181, 195)");
  await verifyBubbleColors();
  await classic.reload();
  await mount(classic);
  await classic.getByRole("button", { name: "配色", exact: true }).click();
  assert.equal(await classic.getByRole("combobox", { name: "界面模式" }).innerText(), "深色");
  await updateAppearance(classic, () => selectMode(classic, "跟随 QQ"));
  const chatPage = await open("chat#/main/message");
  await verifyChat(chatPage, classic);
  const workspace = await open("workspace#/main/message");
  await verifyWorkspace(workspace, false);
  await verifyPinned(workspace, classic);
  await verifyConversationDrag(workspace);
  await verifyWorkspace(await open("detached#/chat"), true);
  await verifyShell(await open("shell"));
  const titlebar = await open("titlebar#/main/message");
  await verifyTitlebar(titlebar, await open("titlebar#/settings"));
  await verifyWindowsTitlebar(await open("windows-titlebar#/main/message"));
  await verifyAvatarGroups(chatPage, classic);
  const notify = await open("notify#/blank");
  await notify.evaluate(() => { history.replaceState(null, "", "#/notify-filter/"); });
  await verifyInterface(await open("interface#/main/guild"), notify, classic);
  await verifyContactSurfaces(await open("contacts#/main/contact"));
  await classic.getByRole("button", { name: "配置文件" }).click();
  await classic.getByRole("button", { name: "检查当前界面" }).click();
  const report = classic.locator("output.coverage");
  await report.filter({ hasText: "联系人页" }).waitFor();
  assert.match(await report.innerText(), /contact-layout__left-area/);
  assert.match(await report.innerText(), /消息页 · 已渲染/);
  const liteLoaderSettings = await context.newPage();
  await liteLoaderSettings.goto("https://virga.invalid/liteloader#/setting");
  await verifyLiteLoaderSettings(liteLoaderSettings);
  assert.deepEqual(errors, []);
  console.log(
    "Chromium " +
      browser.version() +
      " · 聊天与表情面板、群成员、通知、浮动导航、顶栏、频道、跨窗口色板同步与自动保存通过",
  );
} finally {
  await browser.close();
}
