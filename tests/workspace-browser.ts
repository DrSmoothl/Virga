import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import { updateAppearance, waitForAppearance } from "./browser-settings.ts";

const conversations = [
  ["渡", "山渡", "我把整理好的时间表发过去了。", "15:40"],
  ["悬", "悬雨主题小组", "雨线：我把新的布局整理出来了。", "15:38"],
  ["纸", "纸上城市", "周六的展览从下午两点开始。", "14:12"],
  ["枫", "枫岚", "下次补拍进站口那几张。", "11:26"],
  ["南", "南岸摄影", "连廊那边的光线最好。", "09:04"],
] as const;

const roster = `<aside class="two-col-layout__aside"><div class="recent-contact">
  <div class="contact-top-bar"><div class="q-search__input"><input aria-label="搜索" placeholder="搜索会话"></div><button class="contact-adder-btn" aria-label="添加">+</button></div>
  <div class="list-toggler"><div class="recent-contact-list">
    ${conversations.map(([avatar, name, summary, time], index) =>
      `<div class="recent-contact-item${index === 1 ? " recent-contact-item--selected" : ""}"><div class="item__content"><span class="demo-avatar">${avatar}</span><div class="demo-row-text"><span class="contact-name__text">${name}</span><span class="item__summary">${summary}</span></div><time class="item__time">${time}</time></div></div>`,
    ).join("")}
    <div class="pin-collapse-bar" role="button" aria-expanded="true" tabindex="0"><span class="pin-collapse-bar__stuck-bg"></span><span class="pin-collapse-bar__icon">≡</span><span class="pin-collapse-bar__text">折叠置顶聊天</span><span class="pin-collapse-bar__arrow">⌃</span></div>
  </div></div>
</div></aside>`;

const pane = `<div class="aio">
  <header class="chat-header panel-header"><strong class="chat-header__contact-name">悬雨主题小组 <span class="members-count">8</span></strong><div class="panel-header__action"><div class="bar-icon"><button type="button" class="icon-item" aria-label="群详情">···</button></div></div></header>
  <div class="group-panel"><div class="group-chat">
    <main class="chat-msg-area" aria-label="消息列表"><div class="ml-list">
      <div class="message-time">今天 15:32</div>
      <div class="ml-item"><article class="message-container"><span class="demo-avatar">雨</span><div class="message-content__wrapper"><div class="user-name">雨线</div><div class="msg-content-container container--others"><div class="message-content"><span class="text-element">刚到山脚。云层压得很低，远处还能看见雨丝。</span></div></div></div></article></div>
      <div class="ml-item"><article class="message-container demo-outgoing"><div class="message-content__wrapper"><div class="msg-content-container container--self"><div class="message-content"><span class="text-element">我也看到了，等雨停了再过桥吧。</span></div></div></div></article></div>
      <div class="ml-item"><article class="message-container"><span class="demo-avatar">枫</span><div class="message-content__wrapper"><div class="user-name">枫岚</div><div class="msg-content-container container--others"><div class="message-content"><span class="text-element">好。我把北岸的点位记下了。</span></div></div></div></article></div>
    </div></main>
    <section class="chat-input-area"><div class="resize-handler ns"></div><div class="chat-func-bar" role="toolbar">
      <div class="bar-icon"><button type="button" class="icon-item" aria-label="表情">☺</button></div><div class="bar-icon"><button type="button" class="icon-item" aria-label="截图">✂</button></div><div class="bar-icon"><button type="button" class="arrow" aria-label="文件子菜单">⌄</button><div class="bar-more-menu" role="menu" hidden><button type="button" role="menuitem">选择文件</button></div></div>
    </div><div class="msg-input"><div class="qq-msg-editor"><div role="textbox" aria-label="消息草稿" contenteditable="true"></div></div></div><div class="operation"><button type="button" aria-label="发送">发送</button></div><div class="expression-panel"><div class="expression-panel-inner"><div class="sticker-panel" role="dialog" aria-label="QQ 表情" hidden><div class="sticker-panel__pages"><button class="stickers-item">表情样例</button></div><div class="sticker-panel__divide"></div><div class="sticker-panel__bar">最近使用</div></div></div></div><ul class="forward-ops" hidden><li><button type="button">合并转发</button></li></ul></section>
  </div><aside class="group-box__container"><div class="group-box"><section class="group-notice"><strong>群公告</strong><p>周六拍摄路线和集合点已更新。</p></section><section class="group-member"><strong class="group-member-title">群聊成员</strong><div class="group-user">雨线</div><div class="group-user">枫岚</div><div class="group-user">山渡</div></section></div></aside></div>
</div>`;

export const workspaceFixture = `<div id="workspace" class="global-container container--wide">
  <header class="topbar">悬雨</header>
  <div id="layout" class="container-content">
    <nav class="container-sidebar"><div class="sidebar-nav"><button aria-current="page" aria-label="消息">▤</button><button aria-label="联系人">◎</button></div></nav>
    <section class="message-panel"><div class="two-col-layout">${roster}<div class="two-col-layout__main">${pane}</div></div></section>
  </div>
</div>`;

export const detachedFixture = `<div id="workspace" class="chat-container">
  <header class="window-title-bar">悬雨主题小组</header><div id="layout" class="container-content">${pane}</div>
</div>`;

export const workspaceFixtureCSS = `
#workspace { height: 100vh; display: flex; flex-direction: column; color: var(--virga-text); }
#workspace > header { min-height: 38px; padding: 0 16px; display: flex; align-items: center; }
#workspace #layout { display: flex; flex: 1; min-height: 0; height: auto; margin: 0 4px 4px; }
#workspace .container-sidebar { flex: 0 0 48px; } #workspace .sidebar-nav { height: 100%; padding-top: 8px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 5px; }
#workspace button { border: 0; background: transparent; color: inherit; min-width: 30px; min-height: 30px; cursor: pointer; }
#workspace .message-panel, #workspace .two-col-layout__main { flex: 1; min-width: 0; display: flex; }
#workspace .two-col-layout, #workspace .group-panel { flex: 1; min-width: 0; min-height: 0; display: flex; }
#workspace .two-col-layout__aside { flex: 0 0 min(24vw, 278px); }
#workspace .recent-contact { height: 100%; display: flex; flex-direction: column; }
#workspace .contact-top-bar { display: flex; gap: 4px; padding: 12px; align-items: center; }
#workspace .q-search__input { min-width: 0; flex: 1; border: 1px solid transparent; } #workspace input { box-sizing: border-box; width: 100%; height: 30px; background: transparent; border: 0; padding-inline: 9px; }
#workspace .list-toggler, #workspace .recent-contact-list { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: auto; }
#workspace .item__content { height: 54px; box-sizing: border-box; display: flex; align-items: center; gap: 9px; padding: 7px 8px; }
#workspace .demo-avatar { flex: 0 0 30px; width: 30px; height: 30px; background: var(--virga-selected); border-radius: 50%; display: grid; place-items: center; }
#workspace .demo-row-text { flex: 1; min-width: 0; } #workspace .item__summary { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; margin-top: 4px; }
#workspace .pin-collapse-bar { margin-top: auto; box-sizing: border-box; display: flex; align-items: center; min-height: 34px; position: relative; } #workspace .pin-collapse-bar__stuck-bg { position: absolute; inset: 0; } #workspace .pin-collapse-bar > :not(.pin-collapse-bar__stuck-bg) { position: relative; } #workspace .pin-collapse-bar__text { flex: 1; font-size: 12px; }
#workspace .aio, #workspace .group-chat { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
#workspace .chat-header { display: flex; align-items: center; justify-content: space-between; height: 52px; }
#workspace .chat-msg-area { overflow: auto; min-height: 0; flex: 1; } #workspace .message-container { box-sizing: border-box; display: flex; gap: 9px; padding: 8px 20px; }
#workspace .message-time { text-align: center; margin: 22px 0 16px; font-size: 11px; } #workspace .user-name { font-size: 12px; margin-bottom: 4px; }
#workspace .demo-outgoing { justify-content: flex-end; } #workspace .msg-content-container { padding: 8px 11px; }
#workspace .group-box__container { flex: 0 0 min(17vw, 180px); } #workspace .group-box { height: 100%; display: flex; flex-direction: column; }
#workspace .group-notice, #workspace .group-member { padding: 14px 12px; } #workspace .group-notice { min-height: 88px; box-shadow: inset 0 -1px var(--virga-line); } #workspace .group-user { padding-block: 7px; } #workspace .group-notice p { font-size: 12px; color: var(--virga-muted); line-height: 1.6; }
#workspace .chat-input-area { flex: 0 0 auto; height: 112px; position: relative; display: flex; flex-direction: column; }
#workspace .resize-handler.ns { position: absolute; inset: -2px 0 auto; height: 5px; z-index: 1; cursor: ns-resize; }
#workspace .resize-handler.ns:active { top: -17px !important; padding: 15px 0; }
#workspace .chat-func-bar { min-height: 34px; display: flex; align-items: center; }
#workspace .expression-panel, #workspace .expression-panel-inner { position:absolute; }
#workspace .sticker-panel { width:450px;height:200px;box-sizing:border-box }
#workspace .recent-used .sticker-panel { width:auto; min-width:186px; height:auto; }
#workspace .msg-input { flex: 1; min-height: 0; overflow: auto; } #workspace [contenteditable] { min-height: 56px; padding-top: 4px; outline: none; white-space: pre-wrap; }
`;

export async function verifyWorkspace(page: Page, detached: boolean) {
  await page.setViewportSize({ width: detached ? 720 : 1200, height: 630 });
  const toggle = page.getByRole("button", { name: "聊天工具" });
  await toggle.waitFor();
  for (const scheme of ["light", "dark"] as const) {
    await page.locator("html").evaluate((el, s) => {
      el.setAttribute("class", "q-theme-tokens-" + s);
    }, scheme);
    const geometry = await page.locator("#workspace").evaluate((el) => {
      const css = getComputedStyle(document.documentElement);
      const box = (sel: string) => el.querySelector(sel)?.getBoundingClientRect();
      const header = box(".chat-header")!;
      const timeline = box(".chat-msg-area")!;
      const editor = box(".chat-input-area")!;
      const group = box(".group-box");
      const list = box(".recent-contact");
      const rail = box(".container-sidebar");
      const node = el.querySelector(".chat-input-area")!;
      const layout = box(".container-content")!;
      const handle = el.querySelector(".resize-handler")!.getBoundingClientRect();
      const hit = document.elementFromPoint(
        handle.left + handle.width / 2,
        handle.top - 2,
      );
      return {
        outerPadding: header.top - layout.top,
        headerGap: timeline.top - header.bottom,
        railGap: rail && list ? list.left - rail.right : null,
        listGap: list ? header.left - list.right : null,
        groupGap: group ? group.left - timeline.right : null,
        groupAligned: group?.right === header.right,
        editorInset: editor.left - timeline.left,
        editorBottom: layout.bottom - editor.bottom,
        editorTop: editor.top - timeline.bottom,
        editorHeight: editor.height,
        toggleInset: editor.bottom - box("[data-virga-tools-toggle]")!.bottom,
        editorRadius: getComputedStyle(node).borderTopLeftRadius,
        radius: css.getPropertyValue("--virga-control-radius").trim(),
        editorImage: getComputedStyle(node).backgroundImage,
        resizeHit:
          hit !== null &&
          hit.closest(".resize-handler") !== null &&
          getComputedStyle(hit).cursor === "ns-resize",
      };
    });
    for (const gap of [
      geometry.outerPadding,
      geometry.headerGap,
      geometry.railGap,
      geometry.listGap,
      geometry.groupGap,
    ])
      if (gap !== null) assert.ok(Math.abs(gap) < 0.1);
    assert.ok(geometry.groupAligned);
    assert.ok(geometry.editorInset >= 8 && geometry.editorInset <= 14);
    assert.equal(geometry.editorBottom, 6);
    assert.equal(geometry.editorTop, 0);
    assert.equal(geometry.editorHeight, 44);
    assert.equal(geometry.toggleInset, 6);
    assert.equal(geometry.editorRadius, geometry.radius);
    assert.equal(geometry.editorImage, "none");
    assert.ok(geometry.resizeHit);
  }
  const draft = page.getByRole("textbox", { name: "消息草稿" });
  await draft.fill("待发送的草稿");
  await page.setViewportSize({ width: 860, height: 630 });
  assert.equal(await draft.textContent(), "待发送的草稿");
  const composer = page.locator(".chat-input-area");
  const height = () => composer.evaluate((el) => el.getBoundingClientRect().height);
  assert.equal(await height(), 44);
  await draft.press("End");
  await draft.press("Shift+Enter");
  await draft.pressSequentially("第二行");
  await waitForSize(page, false);
  await draft.fill("连续的文字会自动换行".repeat(1500));
  await waitForSize(page, false);
  assert.ok(await height() <= 240);
  const viewport = composer.locator(".msg-input");
  assert.ok(await viewport.evaluate((el) => el.scrollHeight > el.clientHeight));
  await draft.fill("");
  await waitForSize(page, true);
  assert.equal(await height(), 44);

  const resize = composer.locator(".resize-handler.ns");
  const handle = (await resize.boundingBox())!;
  const markerY = () => composer.evaluate((el) => {
    const area = el.getBoundingClientRect();
    const paint = getComputedStyle(el, "::after");
    return area.top + parseFloat(paint.top);
  });
  await resize.hover({ position: { x: handle.width / 2, y: 1 } });
  const beforePress = await markerY();
  assert.ok(Number.isFinite(beforePress));
  await page.mouse.down();
  assert.equal(await resize.evaluate((el) => getComputedStyle(el).top), "-17px");
  assert.equal(await markerY(), beforePress);
  await page.mouse.up();
  const dragSurface = page.locator("body");
  for (const offset of [-30, 30]) {
    const pointer = { pointerId: 1, isPrimary: true, pointerType: "mouse" };
    await resize.dispatchEvent("pointerdown", {
      ...pointer,
      button: 0,
      buttons: 1,
      clientY: 450,
    });
    await dragSurface.dispatchEvent("pointermove", {
      ...pointer,
      buttons: offset < 0 ? 0 : 1,
      clientY: 450 + offset,
    });
    assert.equal(await height(), 44);
    await dragSurface.dispatchEvent("pointerup", {
      ...pointer,
      button: 0,
      buttons: 0,
      clientY: 450 + offset,
    });
    assert.equal(await height(), offset < 0 ? 74 : 44);
  }

  const smile = page.getByRole("button", { name: "表情", exact: true });
  const toolbar = composer.locator(".chat-func-bar");
  const hasFade = () =>
    toolbar.evaluate((el) =>
      el.getAnimations().some(
        (animation) =>
          animation instanceof CSSTransition &&
          animation.transitionProperty === "opacity",
      ),
    );
  assert.ok(!(await smile.isVisible()));
  await toggle.focus();
  await toggle.press("Space");
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  assert.ok(await hasFade());
  assert.equal(
    await toolbar.evaluate((el) => getComputedStyle(el).transform),
    "none",
  );
  await toolbar.evaluate((el) =>
    Promise.all(el.getAnimations().map((animation) => animation.finished)),
  );
  await page.keyboard.press("Tab");
  assert.ok(await smile.evaluate((el) => el === document.activeElement));
  await page.keyboard.press("Escape");
  assert.ok(await toggle.evaluate((el) => el === document.activeElement));
  assert.ok(await toolbar.evaluate((el) => (el as HTMLElement).inert));
  assert.ok(await hasFade());
  assert.ok(
    await toolbar.locator("button").first().evaluate((el) => {
      let called = false;
      el.addEventListener("click", () => (called = true), { once: true });
      (el as HTMLButtonElement).click();
      return called;
    }),
  );
  await smile.waitFor({ state: "hidden" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await toggle.press("Space");
  assert.ok(await smile.isVisible());
  assert.ok(!(await hasFade()));
  await toggle.press("Space");
  assert.ok(!(await smile.isVisible()));
  await page.emulateMedia({ reducedMotion: "no-preference" });

  const sticker = page.getByRole("dialog", { name: "QQ 表情" });
  await toggle.click();
  await smile.evaluate((el) => el.addEventListener("click", () =>
    el.closest(".chat-input-area")!.querySelector(".sticker-panel")!.removeAttribute("hidden"),
  ));
  await smile.click();
  await sticker.waitFor();
  const stickerRect = (await sticker.boundingBox())!;
  const composerRect = (await composer.boundingBox())!;
  assert.ok(Math.abs(stickerRect.x - composerRect.x) < 1);
  assert.ok(stickerRect.y + stickerRect.height <= composerRect.y);
  assert.ok(stickerRect.width <= composerRect.width);
  const emoji = sticker.getByRole("button", { name: "表情样例" });
  await emoji.evaluate((el) => el.addEventListener("click", () => {
    el.setAttribute("data-clicked", "");
    el.closest(".sticker-panel")!.setAttribute("hidden", "");
  }));
  await emoji.click();
  assert.equal(await page.locator(".stickers-item").getAttribute("data-clicked"), "");

  const stickerElement = composer.locator(".sticker-panel");
  await stickerElement.evaluate((el) => {
    const compact = document.createElement("div");
    compact.className = "sticker-panel-ref recent-used";
    el.before(compact);
    compact.append(el);
    el.removeAttribute("hidden");
  });
  const quick = (await sticker.boundingBox())!;
  assert.equal(quick.width, 186);
  assert.ok(quick.width < stickerRect.width);
  assert.ok(Math.abs(quick.x - composerRect.x) < 1);
  await stickerElement.evaluate((el) => {
    const compact = el.parentElement!;
    compact.replaceWith(el);
    el.setAttribute("hidden", "");
  });

  const fileArrow = toolbar.locator(".arrow");
  await fileArrow.evaluate((el) => el.addEventListener("click", () =>
    el.parentElement!.querySelector('[role="menu"]')!.toggleAttribute("hidden"),
  ));
  await toggle.click();
  await fileArrow.click();
  const choose = page.getByRole("menuitem", { name: "选择文件" });
  await choose.waitFor();
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  await choose.evaluate((el) => el.addEventListener("click", () =>
    requestAnimationFrame(() => {
      if (el.closest<HTMLElement>(".chat-func-bar")?.inert) return;
      el.setAttribute("data-selected", "true");
      dispatchEvent(new Event("blur"));
      dispatchEvent(new Event("focus"));
    }),
  ));
  await choose.click();
  await toolbar.waitFor({ state: "hidden" });
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(
    await toolbar.locator('[role="menuitem"]').getAttribute("data-selected"),
    "true",
  );
  await toolbar.evaluate((el) => {
    const area = el.parentElement!;
    for (const name of ["图片", "文件", "语音消息", "机器人指令"]) {
      const button = document.createElement("button");
      button.className = "icon-item";
      button.textContent = name;
      el.append(button);
      button.addEventListener("click", () => {
        if (name === "语音消息") {
          const voice = document.createElement("div");
          voice.className = "audio-msg-input";
          voice.style.minHeight = "120px";
          voice.innerHTML = '<p class="key-desc"><button class="link-btn">退出</button></p>';
          voice.querySelector("button")!.onclick = () => voice.remove();
          voice.addEventListener("keydown", (event) => {
            if (event.key === " ") area.setAttribute("data-record-key-received", "");
          });
          area.append(voice);
          voice.querySelector("button")!.focus();
        } else if (name === "机器人指令") {
          const popup = document.createElement("div");
          popup.className = "q-popup__main";
          popup.style.cssText = "position:fixed;top:20px;left:200px;width:280px;height:130px";
          popup.innerHTML = '<section class="bot-panel-wrapper">这里还没有指令</section>';
          document.body.append(popup);
        } else {
          requestAnimationFrame(() => {
            if ((el as HTMLElement).inert) return;
            const input = document.createElement("input");
            input.type = "file";
            input.hidden = true;
            input.accept = name === "图片" ? "image/*" : "";
            el.append(input);
            input.click();
          });
        }
      });
    }
  });
  for (const name of ["图片", "文件"]) {
    await toggle.click();
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 4000 }),
      toolbar.getByRole("button", { name, exact: true }).click(),
    ]);
    assert.equal(await chooser.element().getAttribute("accept"), name === "图片" ? "image/*" : "");
    await chooser.setFiles([]);
    await chooser.element().evaluate((el) => {
      el.dispatchEvent(new Event("cancel", { bubbles: true }));
      el.parentNode!.removeChild(el);
    });
    await toolbar.waitFor({ state: "hidden" });
  }
  for (const exit of ["Escape", "退出", "退出语音消息", "Space"]) {
    await toggle.click();
    await toolbar.getByRole("button", { name: "语音消息" }).click();
    const voice = composer.locator(".audio-msg-input");
    await voice.waitFor();
    await toggle.waitFor({ state: "detached" });
    const close = voice.getByRole("button", { name: "退出语音消息" });
    if (exit === "退出语音消息") {
      const panel = (await voice.boundingBox())!;
      const button = (await close.boundingBox())!;
      assert.equal(button.width, 32);
      assert.equal(button.height, 32);
      assert.equal(button.y - panel.y, 8);
      assert.equal(panel.x + panel.width - button.x - button.width, 8);

      const nativeExit = voice.getByRole("button", { name: "退出", exact: true });
      await nativeExit.evaluate((el) => el.setAttribute("disabled", ""));
      await close.waitFor({ state: "detached" });
      await nativeExit.evaluate((el) => el.removeAttribute("disabled"));
      await close.waitFor();
    }
    if (exit === "Escape") await page.keyboard.press(exit);
    else if (exit === "Space") await close.press(exit);
    else await voice.getByRole("button", { name: exit, exact: true }).click();
    await voice.waitFor({ state: "detached" });
    assert.equal(await composer.getAttribute("data-record-key-received"), null);
    await toggle.waitFor();
    assert.ok(await draft.isEditable());
    await page.waitForFunction(() =>
      document.activeElement?.hasAttribute("data-virga-draft"),
    );
  }
  await toggle.click();
  await toolbar.getByRole("button", { name: "机器人指令" }).click();
  const commandPanel = page.locator("[data-virga-command-panel]");
  await commandPanel.waitFor();
  const commandRect = (await commandPanel.boundingBox())!;
  const inputRect = (await composer.boundingBox())!;
  assert.ok(Math.abs(inputRect.x - commandRect.x) < 1);
  assert.ok(Math.abs(inputRect.y - commandRect.y - commandRect.height - 6) < 1);
  await commandPanel.locator(".bot-panel-wrapper").evaluate((el) => el.remove());
  await commandPanel.waitFor({ state: "detached" });
  await page.locator(".q-popup__main").evaluate((el) => el.remove());
  await toggle.click();
  await toolbar.waitFor({ state: "hidden" });

  const commandSearches = await page.locator(".chat-msg-area .ml-list").evaluate(async (list) => {
    let searches = 0;
    const previous = [...list.childNodes];
    const batch = document.createDocumentFragment();
    for (let index = 0; index < 120; index++) {
      const row = document.createElement("div");
      row.className = "ml-item";
      row.innerHTML = '<div class="message-container">合成消息</div>';
      const query = row.querySelector.bind(row);
      Object.defineProperty(row, "querySelector", { value: (selector: string) => {
        if (selector.includes(".bot-panel-wrapper")) searches++;
        return query(selector);
      } });
      batch.append(row);
    }
    list.append(batch);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    list.replaceChildren(...previous);
    return searches;
  });
  assert.equal(commandSearches, 0, "普通消息批量挂载不需要逐条查找机器人面板");

  const send = page.getByRole("button", { name: "发送", exact: true });
  assert.ok(await send.isVisible());
  await draft.fill("保留原生快捷键");
  await draft.evaluate((el) => {
    el.addEventListener("keydown", (event) => {
      if (
        event instanceof KeyboardEvent &&
        event.key === "Enter" &&
        event.ctrlKey &&
        !event.defaultPrevented
      )
        el.setAttribute("data-shortcut", "seen");
    });
  });
  await draft.press("Control+Enter");
  assert.equal(await draft.getAttribute("data-shortcut"), "seen");
  await toggle.click();
  assert.ok(await smile.isVisible());
  await draft.press("Escape");
  await smile.waitFor({ state: "hidden" });
  assert.ok(await draft.evaluate((el) => el === document.activeElement));
  const selection = composer.locator(".forward-ops");
  await selection.evaluate((el) => el.removeAttribute("hidden"));
  await toggle.waitFor({ state: "detached" });
  assert.ok(await page.getByRole("button", { name: "合并转发" }).isVisible());
  await selection.evaluate((el) => el.setAttribute("hidden", ""));
  await toggle.waitFor();
  await verifyResizeAnchor(page, detached);
}

export async function verifyPinned(page: Page, settings: Page) {
  const pin = page.locator(".pin-collapse-bar");
  await pin.evaluate((el) => {
    el.setAttribute("aria-expanded", "false");
    el.addEventListener("click", () => queueMicrotask(() =>
      el.setAttribute("aria-expanded", "true"),
    ), { once: true });
  });
  await settings.getByRole("button", { name: "界面", exact: true }).click();
  const hide = settings.getByRole("checkbox", { name: "隐藏「折叠置顶聊天」" });
  await waitForAppearance(page, await updateAppearance(settings, () => hide.check()));
  await pin.waitFor({ state: "hidden" });
  assert.equal(await pin.getAttribute("aria-expanded"), "true");
  await waitForAppearance(page, await updateAppearance(settings, () => hide.uncheck()));
  await pin.waitFor();
  assert.equal(await pin.getAttribute("aria-expanded"), "true");
}

function waitForSize(page: Page, single: boolean) {
  return page.waitForFunction((single) => {
    const area = document.querySelector("[data-virga-composer]");
    if (!area || area.hasAttribute("data-virga-composer-sizing")) return false;
    const height = area.getBoundingClientRect().height;
    return single ? height === 44 : height > 44;
  }, single);
}

async function verifyResizeAnchor(page: Page, reversed: boolean) {
  const view = page.locator(".chat-msg-area");
  const draft = page.getByRole("textbox", { name: "消息草稿" });
  await draft.fill("");
  await waitForSize(page, true);
  await view.evaluate((el, reversed) => {
    const scroll = el as HTMLElement;
    const track = scroll.querySelector<HTMLElement>(".ml-list")!;
    const row = track.querySelector(".ml-item")!.outerHTML;
    track.innerHTML += row.repeat(26);
    track.style.flexShrink = "0";
    scroll.style.display = "flex";
    scroll.style.flexDirection = reversed ? "column-reverse" : "column";
    scroll.style.overflowAnchor = "none";
  }, reversed);

  for (const pinned of [false, true]) {
    await view.evaluate((el, { reversed, pinned }) => {
      el.scrollTop = reversed
        ? (pinned ? 0 : -190)
        : (pinned ? el.scrollHeight : 190);
    }, { reversed, pinned });
    await view.evaluate((el, { reversed, pinned }) => {
      const host = el.closest(".aio")!;
      const area = host.querySelector(".chat-input-area")!;
      const top = el.getBoundingClientRect().top;
      const row = Array.from(el.querySelectorAll(".ml-item")).find(
        (node) => node.getBoundingClientRect().bottom > top,
      )!;
      const rowOffset = () => row.getBoundingClientRect().top - el.getBoundingClientRect().top;
      const initial = rowOffset();
      const drift = () => pinned
        ? Math.abs(el.scrollTop - (reversed ? 0 : el.scrollHeight - el.clientHeight))
        : Math.abs(rowOffset() - initial);
      const frames: [number, number][] = [];
      const sample = new ResizeObserver(() => {
        // Sample after the viewport observer has restored the scroll anchor.
        setTimeout(() => frames.push([area.getBoundingClientRect().height, drift()]), 0);
      });
      sample.observe(area);
      el.addEventListener("virga-fixture-resize-done", () => {
        sample.disconnect();
        el.setAttribute("data-virga-fixture-frames", JSON.stringify(frames));
      }, { once: true });
    }, { reversed, pinned });
    await draft.fill("第一行\n第二行\n第三行");
    await waitForSize(page, false);
    const expanded = await page.locator(".chat-input-area").evaluate(
      (el) => el.getBoundingClientRect().height,
    );
    await draft.fill("");
    await waitForSize(page, true);
    const frames = await view.evaluate((el) => {
      el.dispatchEvent(new Event("virga-fixture-resize-done"));
      const result = JSON.parse(el.getAttribute("data-virga-fixture-frames")!);
      el.removeAttribute("data-virga-fixture-frames");
      return result as [number, number][];
    });
    assert.ok(frames.some(([size]) => size > 45 && size < expanded - 1),
      "Composer should pass through intermediate heights");
    assert.ok(frames.every(([, drift]) => drift <= 1),
      "Timeline should stay at its anchor throughout the resize: " + JSON.stringify(frames));
    const tailDrift = await view.evaluate((el, { reversed, pinned }) =>
      Math.abs(el.scrollTop - (reversed
        ? (pinned ? 0 : -190)
        : (pinned ? el.scrollHeight - el.clientHeight : 190))),
      { reversed, pinned },
    );
    assert.ok(tailDrift <= 1, "Scroll drift after expanding and shrinking");
  }
}
