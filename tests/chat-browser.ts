import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import { updateAppearance, waitForAppearance } from "./browser-settings.ts";

const messages = [
  ["南枝", '<span class="text-element--at">@我</span> 雨停在半山腰了。', "others"],
  ["我", '<span class="text-element--at">@南枝</span> 看到了，云下面还有一层雨幕。', "self"],
  ["南枝", "等风再小一点，我们就出发。", "others"],
] as const;
const row = (name: string, body: string, direction: string) =>
  `<article class="ml-item message"><div class="identity" aria-hidden="true">${name.slice(0, 1)}</div><div><small>${name}</small><div class="msg-content-container container--${direction}"><span class="message-content"><span class="text-element">${body}</span></span></div></div></article>`;
export const chatFixture = `<div id="layout" class="thread"><div class="sidebar-nav"></div><aside class="recent-contact"><div role="listitem" aria-selected="true">悬雨主题小组</div></aside>
<main id="thread-pane"><header class="chat-header"><div class="background-mask"></div><strong class="chat-header__contact-name">悬雨主题小组 <small class="members-count">8</small></strong><div class="panel-header__action"><div class="bar-icon"><button type="button" class="icon-item" aria-label="会话信息">···</button></div></div></header>
<section class="chat-msg-area" aria-label="消息列表"><div class="thread-jumps">
<button type="button" class="chat-msg-area__tip--top-btn theme-primary"><span class="icon" aria-hidden="true"><span class="q-icon">↑</span></span> <span class="content">@全体成员</span></button>
<button type="button" class="chat-msg-area__tip--top-btn"><span class="icon" aria-hidden="true"><span class="q-icon">↑</span></span> <span class="content">10 条新消息</span></button>
</div><div class="ml-list"><div class="message-time">今天 14:32</div>${messages.map(([name, body, direction]) => row(name, body, direction)).join("")}</div></section>
<section class="chat-input-area"><div class="resize-handler ns"><div></div><div></div><div></div></div><div class="chat-func-bar" role="toolbar"><div class="bar-icon"><button type="button" class="icon-item" aria-label="聊天记录">◷</button></div></div><div class="msg-input"><div class="qq-msg-editor"><div role="textbox" contenteditable="true" aria-label="消息草稿"></div></div></div><div class="operation"><button type="button" aria-label="发送">发送</button></div></section></main></div>`;
export const chatFixtureCSS = `
#layout.thread{height:480px}.thread .recent-contact{padding:16px 12px}.thread #thread-pane{min-height:0;min-width:0;display:grid;grid-template-rows:55px minmax(0,1fr) auto}
.thread .chat-header{display:flex;align-items:center;justify-content:space-between;position:relative;padding:0 22px;font-size:17px}.thread .chat-header .background-mask{position:absolute;inset:0;background:linear-gradient(#345678,#89abc1);pointer-events:none}.thread .chat-msg-area{overflow:auto;min-height:0;padding:0 24px}
.thread .message-time{text-align:center;font:11px system-ui;margin:16px 0}.thread .message{display:flex;gap:10px;margin:13px 0;align-items:flex-start}
.thread .identity{display:grid;place-items:center;background:#71858c;color:white;font:13px system-ui;border-radius:50%;width:32px;height:32px}
.thread .message:has(.container--self){flex-direction:row-reverse}.thread .message:has(.container--self)>div:nth-child(2){text-align:end}.thread .message:has(.container--self) .identity{background:#56646c}
.thread .message small{display:block;color:var(--text_secondary);font-size:11px;margin-bottom:4px}.thread .msg-content-container{padding:6px 12px;display:inline-block;text-align:start}
.thread .chat-input-area{position:relative;display:flex;flex-direction:column}.thread .msg-input [contenteditable]{outline:none;white-space:pre-wrap}.thread .chat-func-bar{display:flex;align-items:center}
.thread .resize-handler.ns{position:absolute;inset:-2px 0 auto;height:5px;cursor:ns-resize;z-index:2}
.thread button{padding:4px 17px;border:0;align-self:end}.thread button.icon-item{width:32px;height:26px;padding:0;background:transparent}
.thread .chat-msg-area{position:relative}.thread-jumps{position:absolute;inset:8px 12px auto auto;display:flex;gap:6px}
.thread-jumps :is(.content,.q-icon),.thread .text-element--at{color:#000 !important}
`;

async function verifyMentions(page: Page) {
  function luminance(rgb: string) {
    const channels = rgb.match(/\d+/g);
    assert.ok(channels?.length === 3, rgb);
    const linear = (value: string | undefined) => {
      const srgb = Number(value) / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    };
    const [red, green, blue] = channels;
    return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
  }
  function requireContrast(ink: string, surface: string, label: string) {
    const a = luminance(ink) + 0.05;
    const b = luminance(surface) + 0.05;
    assert.ok(Math.max(a / b, b / a) >= 4.5, label + " " + ink + " / " + surface);
  }
  const root = page.locator("html");
  const originalClass = await root.getAttribute("class");
  for (const mode of ["light", "dark"]) {
    await root.evaluate((el, scheme) => {
      el.setAttribute("class", "q-theme-tokens-" + scheme);
    }, mode);
    for (const name of ["@全体成员", "10 条新消息"]) {
      const jump = page.getByRole("button", { name, exact: true });
      const [label, icon, surface] = await jump.evaluate((el) => [
        getComputedStyle(el.querySelector(".content")!).color,
        getComputedStyle(el.querySelector(".q-icon")!).color,
        getComputedStyle(el).backgroundColor,
      ]);
      assert.equal(label, icon);
      requireContrast(label, surface, mode + " " + name);
    }
    for (const direction of ["others", "self"]) {
      const [ink, surface, decoration] = await page
        .locator(".container--" + direction + " .text-element--at")
        .evaluate((el) => [
          getComputedStyle(el).color,
          getComputedStyle(el.closest(".msg-content-container")!).backgroundColor,
          getComputedStyle(el).textDecorationLine,
        ]);
      requireContrast(ink, surface, mode + " " + direction);
      assert.equal(decoration, "underline");
    }
  }
  await root.evaluate((el, className) => {
    el.setAttribute("class", className ?? "");
  }, originalClass);
  assert.equal(
    await page.getByText("等风再小一点，我们就出发。").evaluate(
      (el) => getComputedStyle(el).textDecorationLine,
    ),
    "none",
  );
}

export async function verifyChat(page: Page, settings: Page) {
  await page.bringToFront();
  const timeline = page.locator(".ml-list"),
    draft = page.getByRole("textbox", { name: "消息草稿" });
  await page.waitForFunction(
    () => !!document.querySelector("[data-virga-pane]"),
  );
  const original = await timeline.innerHTML();
  const item = await timeline
    .locator(".ml-item")
    .first()
    .evaluate((el) => el.outerHTML);
  const outgoing = await timeline
    .locator(".ml-item")
    .nth(1)
    .evaluate((el) => el.outerHTML);
  const settle = () =>
    page.evaluate(() => new Promise<void>((r) => setTimeout(r, 420)));
  const mutate = async (
    action: "append" | "prepend" | "replace" | "recycle" | "batch" | "switch",
    html = item,
  ) =>
    page.evaluate(
      async ({ action, html }) => {
        const track = document.querySelector(".ml-list")!;
        if (action === "switch")
          document
            .querySelector(".chat-header__contact-name")!
            .replaceChildren("云下");
        else if (action === "append")
          track.insertAdjacentHTML("beforeend", html);
        else if (action === "prepend")
          track.insertAdjacentHTML("afterbegin", html);
        else if (action === "replace") track.innerHTML = html;
        else if (action === "batch")
          track.insertAdjacentHTML("beforeend", html.repeat(5));
        else track.append(track.querySelector(".ml-item")!);
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        return document
          .getAnimations()
          .filter((a) => a.id.startsWith("virga-chat-"))
          .map((a) => ({
            id: a.id,
            virtualRow: (a.effect as KeyframeEffect).target!.matches(
              ".ml-item",
            ),
          }));
      },
      { action, html },
    );
  const noArrivals = (list: Awaited<ReturnType<typeof mutate>>) =>
    assert.ok(
      !list.some((a) => a.id === "virga-chat-in" || a.id === "virga-chat-out"),
    );
  await settle();
  await verifyMentions(page);
  const inBubble = timeline.locator(".container--others").first(),
    outBubble = timeline.locator(".container--self").first();
  assert.ok(
    await inBubble.evaluate(
      (el) =>
        parseFloat(getComputedStyle(el).borderTopLeftRadius) <
        parseFloat(getComputedStyle(el).borderTopRightRadius),
    ),
  );
  assert.ok(
    await outBubble.evaluate(
      (el) =>
        parseFloat(getComputedStyle(el).borderTopRightRadius) <
        parseFloat(getComputedStyle(el).borderTopLeftRadius),
    ),
  );
  assert.equal(
    await page
      .locator(".chat-header .background-mask")
      .evaluate((el) => getComputedStyle(el).backgroundImage),
    "none",
  );
  const toggle = page.getByRole("button", { name: "聊天工具" });
  for (const name of ["@全体成员", "10 条新消息", "会话信息", "聊天记录"]) {
    if (name === "聊天记录") await toggle.click();
    const control = name === "聊天记录"
      ? page.locator(".chat-func-bar .icon-item")
      : page.getByRole("button", { name });
    await control.evaluate((el) =>
      el.addEventListener("click", () => el.setAttribute("data-clicked", ""), {
        once: true,
      }),
    );
    await control.click();
    assert.equal(await control.getAttribute("data-clicked"), "");
  }
  await page.waitForFunction(() =>
    document.querySelector("[data-virga-tools-toggle]")?.getAttribute("aria-expanded") === "false",
  );
  const normalDivider = await draft.evaluate(
    (el) => getComputedStyle(el.closest(".chat-input-area")!).boxShadow,
  );
  await draft.focus();
  assert.equal(
    await draft.evaluate(
      (el) => getComputedStyle(el.closest(".chat-input-area")!).boxShadow,
    ),
    normalDivider,
  );
  const hitArea = await page.locator(".resize-handler.ns").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const top = Math.round(rect.top);
    const hits = (y: number) =>
      document.elementFromPoint(x, y)?.closest(".resize-handler") === el;
    return {
      extended: hits(top - 3) && hits(top + 7),
      bounded: !hits(top - 4) && !hits(top + 8),
      cursor: getComputedStyle(document.elementFromPoint(x, top - 3)!).cursor,
    };
  });
  assert.deepEqual(hitArea, {
    extended: true,
    bounded: true,
    cursor: "ns-resize",
  });
  await draft.fill("留在输入框的草稿");
  const incoming = await mutate("append");
  assert.deepEqual(incoming, [{ id: "virga-chat-in", virtualRow: false }]);
  assert.equal(
    await page.evaluate(() =>
      (document.getAnimations().find((a) => a.id === "virga-chat-in")
        ?.effect as KeyframeEffect).getKeyframes()[0]?.translate,
    ),
    "-12px 10px",
  );
  await settle();
  const bottom = () =>
    page.locator(".chat-msg-area").evaluate(async (el) => {
      el.scrollTop = el.scrollHeight;
      await new Promise((r) => requestAnimationFrame(r));
    });
  await bottom();
  assert.deepEqual(await mutate("append", outgoing), [
    { id: "virga-chat-out", virtualRow: false },
  ]);
  assert.equal(await draft.textContent(), "留在输入框的草稿");
  assert.ok(await draft.evaluate((el) => el === document.activeElement));
  await settle();
  noArrivals(await mutate("prepend", item.repeat(22)));
  await bottom();
  await page.locator(".chat-msg-area").evaluate(async (el) => {
    el.scrollTop = 0;
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
  noArrivals(await mutate("append"));
  await bottom();
  noArrivals(await mutate("recycle"));
  noArrivals(await mutate("batch"));
  noArrivals(await mutate("replace", original));
  const change = await mutate("switch");
  assert.ok(change.some((a) => a.id === "virga-chat-enter"));
  assert.ok(change.some((a) => a.id === "virga-chat-title"));
  assert.ok(
    await page.evaluate(() =>
      document.getAnimations().some(
        (a) => a.id === "virga-chat-enter" && (a.effect?.getTiming().delay ?? 0) > 0,
      ),
    ),
  );
  noArrivals(change);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settle();
  await bottom();
  assert.deepEqual(await mutate("append"), []);
  assert.deepEqual(await mutate("switch"), []);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await settings.getByRole("button", { name: "动效", exact: true }).click();
  const each = settings.getByLabel("新消息入场", { exact: true });
  const revision = await updateAppearance(settings, () => each.uncheck());
  await waitForAppearance(page, revision);
  await page.bringToFront();
  await settle();
  await bottom();
  noArrivals(await mutate("append"));
  await updateAppearance(settings, () => each.check());
  await settings.getByRole("button", { name: "配色", exact: true }).click();
}

export async function verifyConversationDrag(page: Page) {
  await page.bringToFront();
  const roster = page.locator(".recent-contact-list");
  const rows = roster.locator(".recent-contact-item");
  await roster.evaluate(el => {
    const title = document.querySelector(".chat-header__contact-name")!;
    const photo = document.createElement("img");
    photo.alt = "拖拽测试照片";
    photo.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    photo.width = photo.height = 32;
    photo.draggable = true;
    document.querySelector(".ml-item .msg-content-container")!.append(photo);
    const entries = Array.from(el.querySelectorAll<HTMLElement>(".recent-contact-item"));
    function select(target: Element) {
      for (const row of entries)
        row.classList.toggle("recent-contact-item--selected", row === target);
      title.replaceChildren(target.querySelector(".contact-name__text")!.textContent!);
    }
    for (const row of entries) {
      row.addEventListener("dragover", event => {
        event.preventDefault();
        select(row);
      });
      row.addEventListener("click", () => select(row));
    }
    el.addEventListener("drop", event => {
      event.preventDefault();
      el.setAttribute("data-fixture-drop", "");
      select(entries[4]!);
    });
  });

  const observed = await page.evaluateHandle(() => {
    const original = Element.prototype.animate;
    const started: Animation[] = [];
    Element.prototype.animate = function (keyframes, options) {
      const animation = original.call(this, keyframes, options);
      started.push(animation);
      return animation;
    };
    return { started, restore: () => { Element.prototype.animate = original; } };
  });
  const entriesPlayed = () => observed.evaluate(async ({ started }) => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return started.map(animation => animation.id).filter(id =>
      id === "virga-chat-title" || id === "virga-chat-enter",
    );
  });
  try {
    const photo = page.getByRole("img", { name: "拖拽测试照片" });
    await photo.hover();
    await page.mouse.down();
    try {
      for (const index of [0, 2]) {
        const row = rows.nth(index);
        const box = await row.boundingBox();
        assert.ok(box);
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        await page.mouse.move(x, y, { steps: 3 });
        await page.mouse.move(x + 1, y);
        await row.and(page.locator(".recent-contact-item--selected")).waitFor({ timeout: 5_000 });
        assert.deepEqual(await entriesPlayed(), [], "拖拽经过会话时应保持静止");
      }
    } finally {
      await page.mouse.up();
    }
    assert.equal(await roster.getAttribute("data-fixture-drop"), "");
    await rows.nth(4).and(page.locator(".recent-contact-item--selected")).waitFor();
    assert.deepEqual(await entriesPlayed(), [], "投放时的会话更新应保持静止");

    await rows.nth(3).click();
    const afterClick = await entriesPlayed();
    assert.equal(afterClick.filter(id => id === "virga-chat-title").length, 1);
    assert.ok(afterClick.includes("virga-chat-enter"), "普通会话切换应恢复入场动效");

    const preview = rows.first();
    await preview.dispatchEvent("dragover");
    await preview.and(page.locator(".recent-contact-item--selected")).waitFor();
    assert.deepEqual(await entriesPlayed(), afterClick, "从窗口外拖入时也应暂停入场动效");
    await preview.dispatchEvent("dragleave", { relatedTarget: null });
    assert.deepEqual(await entriesPlayed(), afterClick, "拖出窗口时不应补播预览动效");
    await rows.nth(1).evaluate(el => (el as HTMLElement).click());
    const afterLeaving = await entriesPlayed();
    assert.equal(afterLeaving.filter(id => id === "virga-chat-title").length, 2);
  } finally {
    await observed.evaluate(({ restore }) => restore());
    await observed.dispose();
  }
}
