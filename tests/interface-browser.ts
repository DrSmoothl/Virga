import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import { updateAppearance, waitForAppearance } from "./browser-settings.ts";

export const interfaceFixture = `
<div id="layout" class="interface-fixture">
  <div class="container-content">
    <div class="container-sidebar">
      <nav class="sidebar-nav"><div class="sidebar-wrapper">
        <div class="sidebar__nav">
          <button type="button" class="nav-item" aria-label="消息" data-control="messages">消息</button>
          <div class="nav-item"><button type="button" aria-label="空间">空间</button><i class="q-badge-dot">•</i></div>
          <button type="button" class="nav-item" aria-label="频道 3 条未读" data-control="channels">频道 <i class="q-badge-num">3</i></button>
        </div>
        <div class="sidebar__menu"><div class="func-menu__item_wrap"><button class="func-menu__item func-menu-more-component" aria-label="更多">更多</button></div></div>
      </div></nav>
    </div>
    <div class="container-content-view">
      <div class="sys-notify">
        <div class="panel-header">新朋友<div class="background-mask" style="background:#ff7f00"></div></div>
        <div class="q-scroll-view" style="background:#ff7f00">
          <div class="notify-list"><article class="sys-notify-card"><button class="q-button--primary" type="button">同意</button></article></div>
        </div>
      </div>
      <div class="group-member"><div class="group-user"><span class="qzone-feed">更新说说</span><span>群主</span></div></div>
      <div class="guild-layout-wrapper"><iframe title="频道" srcdoc="<body class='q-theme-tokens-light'><div class='app-guild app-layout'><aside class='app-aside'><div style='height:52px'><button>频道搜索</button></div><div class='aside-scroll-view-container'>频道入口</div></aside><main class='app-main'><div class='explore-container'><div class='section-header' style='height:40px'><span>频道热榜</span></div></div><button style='background:var(--button-primary-bg)'>关注</button></main></div></body>"></iframe></div>
    </div>
  </div>
</div>`;
export const interfaceFixtureCSS = `
#layout.interface-fixture { display:block;height:500px }
.interface-fixture .container-content{display:flex;height:100%;overflow:hidden;margin-inline:4px}
.interface-fixture .container-sidebar{width:52px;flex:none}
.interface-fixture .sidebar-nav{height:100%}
.interface-fixture .sidebar-wrapper{display:flex;flex-direction:column;justify-content:space-between;height:100%;align-items:center;padding:5px 0}
.interface-fixture .sidebar__nav{display:grid;gap:5px}
.interface-fixture .container-content-view{flex:1}
.interface-fixture .panel-header{position:relative;padding:8px}
.interface-fixture .background-mask{position:absolute;inset:0;pointer-events:none}
#layout.notify-fixture{display:block}
.notify-filter-container{display:flex;flex-direction:column;height:120px}
.notify-filter-container .notify-header{height:30px;padding-inline:24px}
.notify-filter-container .notify-header > .func-btn{width:20px;height:20px;border:0;background:transparent;color:inherit}
.notify-filter-container :is(form,input,button){padding:0}
.notify-filter-body{flex:1;min-height:0}
.notify-filter-body .q-scroll-view{overflow:auto;height:100%}
.notify-filter-body .sys-notify-card{min-height:30px}
`;
export const filterFixture = `
<div id="layout" class="notify-fixture">
  <section class="notify-filter-container">
    <header class="notify-header"><span>已过滤的通知</span><button class="func-btn" type="button" aria-label="清空通知">×</button></header>
    <div class="notify-filter-body">
      <div class="q-scroll-view sys-notify__content">
        <article class="sys-notify-card"><div class="list-item__info">雨林申请加入</div><button type="button">查看通知</button></article>
        <article class="sys-notify-card"><div class="list-item__info">远处的雾</div></article>
        <article class="sys-notify-card"><div class="list-item__info">雨林退出</div></article>
      </div>
    </div>
  </section>
</div>`;

export async function verifyInterface(page: Page, filter: Page, settings: Page) {
  const surface = page.locator(".container-content-view");
  const rail = page.locator(".container-sidebar");
  const width = (target: typeof surface) => target.evaluate((el) => el.getBoundingClientRect().width);
  const color = (target: typeof surface) => target.evaluate((el) => getComputedStyle(el).backgroundColor);
  const gutter = () => surface.evaluate((el) =>
    el.getBoundingClientRect().left - el.parentElement!.getBoundingClientRect().left);
  const dockedWidth = await width(surface);
  const railWidth = await width(rail);
  const settingsSection = (name: string) => settings.getByRole("button", { name, exact: true }).click();
  const edit = async (action: () => Promise<void>) => {
    const revision = await updateAppearance(settings, action);
    await waitForAppearance(page, revision);
    await waitForAppearance(filter, revision);
  };

  assert.equal(await color(page.locator(".sys-notify .q-scroll-view")), "rgb(252, 252, 250)");
  assert.equal(await color(page.locator(".sys-notify .background-mask")), "rgba(0, 0, 0, 0)");
  assert.equal(await color(page.locator(".notify-list")), "rgb(242, 243, 241)");
  assert.equal(await color(filter.locator(".notify-filter-body")), "rgb(252, 252, 250)");
  await filter.setViewportSize({ width: 640, height: 400 });
  const notifyList = filter.locator(".notify-filter-body .q-scroll-view");
  const listRect = (await notifyList.boundingBox())!;
  const headerRect = (await filter.locator(".notify-header").boundingBox())!;
  const trigger = filter.getByRole("button", { name: "查找通知", exact: true });
  const searchButton = (await trigger.boundingBox())!;
  const clearButton = (await filter.getByRole("button", { name: "清空通知" }).boundingBox())!;
  assert.ok(searchButton.x + searchButton.width < clearButton.x);
  assert.equal(searchButton.y + searchButton.height / 2, clearButton.y + clearButton.height / 2);
  const search = filter.getByRole("searchbox");
  assert.equal(await search.count(), 0);
  await trigger.click();
  const searchBox = (await filter.getByRole("search").boundingBox())!;
  assert.ok(searchBox.y >= headerRect.y && searchBox.y + searchBox.height <= headerRect.y + headerRect.height);
  assert.deepEqual(await notifyList.boundingBox(), listRect);
  const nextMatch = filter.getByRole("button", { name: "下一处匹配" });
  assert.equal(await nextMatch.count(), 0);
  await search.fill("雨林");
  assert.equal(await nextMatch.isVisible(), true);
  const nextBox = (await nextMatch.boundingBox())!;
  assert.ok(nextBox.x + nextBox.width < searchBox.x + searchBox.width);
  assert.equal(await filter.locator("[data-virga-notify-match] .list-item__info").innerText(), "雨林申请加入");
  await search.press("Enter");
  assert.equal(await filter.locator("[data-virga-notify-match] .list-item__info").innerText(), "雨林退出");
  assert.equal(await filter.locator(".sys-notify-card:visible").count(), 3);
  await search.press("Escape");
  assert.equal(await search.count(), 0);
  assert.equal(await filter.locator("[data-virga-notify-match]").count(), 0);
  assert.equal(await nextMatch.count(), 0);
  const originalAction = filter.getByRole("button", { name: "查看通知" });
  await originalAction.evaluate((node) => node.addEventListener("click", () => node.setAttribute("data-clicked", "")));
  await originalAction.click();
  assert.equal(await originalAction.getAttribute("data-clicked"), "");

  await page.evaluate(async () => {
    const frame = document.querySelector("iframe")!;
    const contents = frame.contentDocument!;
    const host = document.querySelector(".guild-layout-wrapper")!;
    const guest = document.createElement("webview");
    guest.className = "guild-webview";
    let index = 0;
    Object.assign(guest, {
      getURL: () => "https://pd.qq.com/explore",
      async insertCSS(css: string) {
        const style = contents.createElement("style");
        style.id = "guest-style-" + (++index);
        style.textContent = css;
        contents.head.append(style);
        return style.id;
      },
      async removeInsertedCSS(id: string) {
        contents.getElementById(id)?.remove();
      },
    });
    host.append(guest);
  });
  const guest = page.frameLocator("iframe");
  const innerAside = guest.locator(".app-aside");
  await page.waitForFunction(() => {
    const doc = document.querySelector("iframe")?.contentDocument;
    return doc?.querySelector("style[id^=guest-style]") !== null;
  }, undefined, { polling: 50 });
  assert.equal(await color(innerAside), "rgb(245, 246, 244)");
  const channelSearch = guest.getByRole("button", { name: "频道搜索" });
  for (const item of [channelSearch, guest.getByText("频道热榜")]) {
    const row = await item.evaluate(el => {
      const content = el.getBoundingClientRect();
      const bar = el.parentElement!.getBoundingClientRect();
      return { height: bar.height, offset: content.top - bar.top, contentHeight: content.height };
    });
    assert.equal(row.height, 44);
    assert.equal(row.offset + row.contentHeight / 2, row.height / 2);
    assert.ok(row.offset >= 6);
  }
  assert.deepEqual(await channelSearch.evaluate(el => {
    const box = el.getBoundingClientRect();
    const row = el.parentElement!.getBoundingClientRect();
    return [box.left - row.left, row.right - box.right];
  }), [12, 12]);
  await settingsSection("配色");
  await settings.locator("summary").click();
  await edit(() => settings.locator('input[type="color"][aria-label="主题色"]').fill("#9b5656"));
  assert.equal(await color(page.getByRole("button", { name: "同意" })), "rgb(155, 86, 86)");
  assert.equal(await color(guest.getByRole("button", { name: "关注" })), "rgb(155, 86, 86)");
  await edit(() => settings.getByRole("button", { name: "雨青", exact: true }).click());

  await settingsSection("界面");
  await edit(() => settings.getByLabel("显示空间", { exact: true }).uncheck());
  await edit(() => settings.getByLabel("显示频道角标", { exact: true }).uncheck());
  assert.equal(await page.getByRole("button", { name: "空间" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: /频道 3/ }).count(), 1);
  assert.equal(await page.locator(".q-badge-num").isVisible(), false);
  await settings.getByRole("button", { name: "隐藏", exact: true }).click();
  await settings.getByRole("group", { name: "隐藏设置入口确认" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "更多" }).isVisible(), true);
  await edit(() => settings.getByRole("button", { name: "确认隐藏设置入口" }).click());
  assert.equal(await page.getByRole("button", { name: "更多" }).count(), 0);
  await edit(() => settings.getByLabel("隐藏群成员的「更新说说」").check());
  assert.equal(await page.getByText("更新说说").isVisible(), false);
  assert.equal(await page.getByText("群主").isVisible(), true);

  await page.bringToFront();
  await page.mouse.move(350, 100);
  await edit(() => settings.getByLabel("导航栏自动收回").check());
  const openButton = page.getByRole("button", { name: "展开 QQ 导航栏" });
  await openButton.waitFor();
  assert.equal(await gutter(), 0);
  assert.equal(await width(surface), dockedWidth + railWidth);
  const box = (await openButton.boundingBox())!;
  await page.mouse.move(box.x - 2, box.y + 100);
  await page.waitForFunction(() => document.querySelector("[data-virga-rail-open]"), undefined, { polling: 50 });
  assert.equal(await gutter(), 0);
  assert.equal(await width(surface), dockedWidth + railWidth);
  await page.mouse.move(300, 100);
  await page.waitForFunction(() => !document.querySelector("[data-virga-rail-open]"), undefined, { polling: 50 });
  const key = await page.evaluate(() => /Mac/i.test(navigator.platform) ? "Meta" : "Control");
  const restored = await updateAppearance(page, () => page.keyboard.press(key + "+Shift+Semicolon"));
  await waitForAppearance(settings, restored);
  assert.equal(await page.getByRole("button", { name: "空间" }).isVisible(), true);
  assert.equal(await page.locator(".q-badge-num").isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "更多" }).isVisible(), true);
  assert.equal(await width(surface), dockedWidth);
  assert.equal(await settings.getByLabel("导航栏自动收回").isChecked(), false);

  await edit(() => settings.getByLabel("频道主题样式").uncheck());
  assert.equal(await guest.locator("style[id^=guest-style]").count(), 0);
  await edit(() => settings.getByLabel("频道主题样式").check());
  await edit(() => settings.getByLabel("好友与群聊通知主题样式").uncheck());
  assert.equal(await trigger.count(), 0);
  await edit(() => settings.getByLabel("好友与群聊通知主题样式").check());
  assert.equal(await trigger.isVisible(), true);
  await edit(() => settings.getByLabel("隐藏群成员的「更新说说」").uncheck());
  await settingsSection("配色");
}
