import assert from "node:assert/strict";
import type { Locator, Page } from "playwright-core";
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
  await verifyGroupSpacing(page, track, avatars);
  await verifySentTimePlacement(page, track);
}

async function verifyGroupSpacing(page: Page, track: Locator, setting: Locator) {
  await page.addStyleTag({ content: `
    .group-fixture > .ml-item { margin-block: 3px; padding-block: 2px; }
    .group-fixture .message { display: block; margin: 0; padding-block-end: 6px; }
    .group-fixture .message-container { margin-block: 2px; }
    .group-fixture .message__timestamp { margin-block: 8px; text-align: center; }
    .group-fixture .msg-content-container { height: auto; }
  ` });
  await track.evaluate((el) => {
    el.classList.add("group-fixture");
    const clock = (value: string) =>
      `<div class="message__timestamp"><span class="babble">${value}</span></div>`;
    const mailCard = '<div class="ark-view-message"><button type="button">邮件详情</button></div>';
    const message = (id: string, time = "", content = '<span class="text-element">下一条</span>') =>
      `<div class="ml-item" id="${id}"><div class="message">${time}
        <div class="message-native"><article class="message-container">
          <span class="avatar-span"><span class="avatar" data-uid="sender"></span></span>
          <div class="msg-content-container container--others">${content}</div>
        </article></div>
      </div></div>`;
    el.innerHTML =
      message("group-first", clock("16:32")) +
      message("group-next") +
      `<div class="ml-item" id="group-clock">${clock("16:37")}</div>` +
      message("group-photo", "", '<img width="72" height="48" alt="">') +
      message("group-last", clock("16:45")) +
      message("group-after-pause", clock("17:12"), mailCard) +
      message("group-after-date", clock("昨天 17:30"), '<button type="button">邮件详情</button>') +
      '<div class="ml-item" role="separator">新消息</div>' +
      message("group-after-unread", "", '<span class="text-element">附带说明</span>' + mailCard);
    el.querySelector("#group-after-pause .msg-content-container")!
      .classList.add("ark-msg-content-container");
    const vnode = (
      selector: string,
      hour: number,
      minute: number,
      elements?: readonly { arkElement: object | null }[],
    ) => {
      const elOfMessage = el.querySelector(selector)!;
      return {
        component: {
          vnode: { el: elOfMessage },
          props: {
            msgRecord: {
              msgTime: String(new Date(2026, 10, 27, hour, minute).getTime() / 1000),
              elements,
            },
          },
        },
      };
    };
    Object.assign(el, {
      _vnode: {
        children: [
          vnode("#group-first .message", 16, 32),
          vnode("#group-photo .message", 16, 37),
          vnode("#group-last .message", 16, 45),
          vnode("#group-next .text-element", 16, 1),
          vnode("#group-after-pause .message", 17, 12),
          vnode("#group-after-date .message", 17, 30, [{ arkElement: {} }]),
          vnode("#group-after-unread .message", 17, 32, [{ arkElement: null }, { arkElement: {} }]),
        ],
      },
    });
  });
  await page.waitForFunction(() => !!document.querySelector(
    "#group-first [data-virga-message-group=first]",
  ));
  const gaps = () => track.evaluate((el) => {
    const boxes = ["group-first", "group-next", "group-photo", "group-last"].map(
      (id) => el.querySelector("#" + id + " .msg-content-container")!.getBoundingClientRect(),
    );
    return boxes.slice(1).map((box, i) => box.top - boxes[i]!.bottom);
  });
  assert.deepEqual(await gaps(), [4, 4, 4], "连续消息气泡之间的距离");
  const bubble = (id: string) => track.locator("#" + id + " .msg-content-container");
  for (const [id, time] of [
    ["group-first", "16:32"],
    ["group-photo", "16:37"],
    ["group-last", "16:45"],
    ["group-after-unread", "17:32"],
  ] as const) {
    assert.equal(await bubble(id).getAttribute("data-virga-sent-at"), time);
    assert.equal(await bubble(id).evaluate(el => getComputedStyle(el, "::after").content), '"' + time + '"');
  }
  assert.equal(await bubble("group-next").getAttribute("data-virga-sent-at"), null);
  for (const id of ["group-after-pause", "group-after-date"]) {
    assert.equal(await bubble(id).getAttribute("data-virga-sent-at"), null, id);
  }
  assert.equal(await bubble("group-photo").evaluate(el => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
  assert.equal(await track.locator("#group-clock").isVisible(), false);
  assert.equal(await track.locator("#group-last .message__timestamp").isVisible(), false);
  for (const selector of [
    "#group-first .message__timestamp",
    "#group-after-pause .message__timestamp",
    "#group-after-date .message__timestamp",
    '[role="separator"]',
  ]) {
    assert.ok(await track.locator(selector).isVisible(), selector);
  }
  for (const id of ["group-after-pause", "group-after-date", "group-after-unread"])
    assert.equal(await track.locator("#" + id + " [data-virga-message-group]").count(), 0);

  const clock = track.locator("#group-clock .babble");
  await clock.evaluate((el) => { el.firstChild!.nodeValue = "昨天 16:37"; });
  await clock.waitFor({ state: "visible" });
  assert.equal(await track.locator("#group-next [data-virga-message-group=last]").count(), 1);
  await clock.evaluate((el) => { el.firstChild!.nodeValue = "16:37"; });
  await clock.waitFor({ state: "hidden" });
  assert.deepEqual(await gaps(), [4, 4, 4]);

  await updateAppearance(page, () => setting.uncheck());
  await clock.waitFor({ state: "visible" });
  assert.ok((await gaps()).every((gap) => gap > 4));
  assert.equal(await bubble("group-photo").getAttribute("data-virga-sent-at"), "16:37");
  await track.evaluate((el) => {
    const owner = el as Element & {
      _vnode?: { children: { component: { props: { msgRecord: { msgTime: string } } } }[] };
    };
    owner._vnode!.children[0]!.component.props.msgRecord.msgTime =
      String(new Date(2026, 10, 27, 16, 33).getTime() / 1000);
    el.querySelector("#group-first")!.setAttribute("data-message-id", "recycled");
  });
  await page.waitForFunction(() =>
    document.querySelector("#group-first .msg-content-container")?.getAttribute("data-virga-sent-at") === "16:33");
  await updateAppearance(page, () => setting.check());
  await clock.waitFor({ state: "hidden" });
  assert.deepEqual(await gaps(), [4, 4, 4]);
}

async function verifySentTimePlacement(page: Page, track: Locator) {
  await page.addStyleTag({ content: `
    .clock-fixture { --virga-bubble-radius: 28px; }
    .clock-fixture [data-clock-case] {
      display: flex;
      inline-size: 144px;
      padding: 0;
      border-radius: var(--virga-bubble-radius);
      overflow: hidden;
    }
    .clock-fixture [data-clock-case$="-reverse"] { flex-direction: row-reverse; }
    .clock-fixture [data-clock-case$="-photo"] { flex-direction: column; inline-size: 72px; }
    .clock-fixture [data-clock-case] > :first-child { flex: none; inline-size: 48px; }
  ` });
  const cases = ["incoming", "outgoing", "incoming-reverse", "outgoing-photo", "incoming-photo"];
  await track.evaluate((el, cases) => {
    el.classList.add("clock-fixture");
    el.innerHTML = cases.map((id) => {
      const own = id.startsWith("outgoing");
      const photo = id.endsWith("-photo");
      const shell = photo ? "message-content__wrapper" : "msg-content-container";
      const content = photo
        ? '<img width="48" height="36" alt="">'
        : '<span class="message-content"><span class="text-element">收到</span></span>';
      return `<article class="ml-item message ${own ? "message-container--self" : ""}">
        <div class="${shell}" data-clock-case="${id}">${content}</div></article>`;
    }).join("");
    Object.assign(el, {
      _vnode: {
        children: Array.from(el.children, (row) => ({
          component: {
            vnode: { el: row },
            props: {
              msgRecord: {
                msgTime: String(new Date(2026, 10, 27, 21, 55).getTime() / 1000),
              },
            },
          },
        })),
      },
    });
  }, cases);
  await page.waitForFunction((count) =>
    document.querySelectorAll(".clock-fixture [data-virga-sent-at]").length === count,
  cases.length);
  for (const id of cases) {
    const own = id.startsWith("outgoing");
    const box = await track.locator(`[data-clock-case="${id}"]`).evaluate((el, own) => {
      const shell = el.getBoundingClientRect();
      const content = el.firstElementChild!.getBoundingClientRect();
      const clock = getComputedStyle(el, "::after");
      const style = getComputedStyle(el);
      const corner = Number.parseFloat(own ? style.borderBottomLeftRadius : style.borderBottomRightRadius);
      const inlineInset = Number.parseFloat(own ? clock.paddingInlineStart : clock.paddingInlineEnd);
      const blockInset = Number.parseFloat(clock.paddingBlockEnd);
      return {
        rendered: clock.content,
        contentLeft: content.left - shell.left,
        contentTop: content.top - shell.top,
        inlineRoom: (shell.width - content.width) / 2,
        fitsCorner: Math.hypot(Math.max(0, corner - inlineInset), Math.max(0, corner - blockInset)) <= corner,
      };
    }, own);
    assert.equal(box.rendered, '"21:55"', id);
    if (id.endsWith("-photo")) {
      assert.ok(box.contentTop < 1, id + " 图片在时间上方");
    } else {
      assert.equal(box.contentLeft > box.inlineRoom, own, id + " 时间在消息的对应一侧");
    }
    assert.ok(box.fitsCorner, id + " 时间避开气泡圆角");
  }
}
