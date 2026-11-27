import { findTimeline, messageCards, rows, rowHost } from "./chat-dom.ts";
import { messageAuthor } from "./avatars.ts";

function shape(el: Element | null) {
  if (!el) return "";
  const classes = Array.from(el.classList)
    .filter((k) => /^[a-z][a-z_-]{1,40}$/i.test(k))
    .slice(0, 5);
  const attrs = el
    .getAttributeNames()
    .filter(
      (k) =>
        /^(?:data-|aria-|sender|uid|uin)/.test(k) && !k.startsWith("data-v-"),
    )
    .filter((k) => /^[a-z-]{1,40}$/.test(k));
  return (
    el.localName +
    (classes.length ? "." + classes.join(".") : "") +
    attrs.map((k) => "[" + k + "]").join("")
  );
}
function surfaceTrail(el: Element | null, win: Window) {
  const path: string[] = [];
  for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
    const color = win.getComputedStyle(el).backgroundColor;
    path.push(shape(el) + (color === "rgba(0, 0, 0, 0)" ? "" : " " + color));
  }
  return path.join(" ← ");
}

function surfaceTrails(win: Window, selectors: readonly string[]) {
  const trails = new Set<string>();
  for (const selector of selectors) {
    const surface = Array.from(win.document.querySelectorAll(selector)).find(
      (el) => el.getClientRects().length > 0,
    );
    if (surface) trails.add(surfaceTrail(surface, win));
  }
  return [...trails];
}

function avatarResource(el: Element) {
  const background = (el as HTMLElement).style?.backgroundImage;
  const src =
    el.getAttribute("src") ??
    background?.match(/^url\(["']?(.+?)["']?\)$/)?.[1];
  if (!src || src.length > 4096 || !URL.canParse(src, el.baseURI)) return "";
  const url = new URL(src, el.baseURI);
  const parts = url.pathname
    .split("/")
    .filter(Boolean)
    .slice(-5)
    .map((s) =>
      /^(avatar|head|user|users|group|groups|default|image|origin|original)$/i.test(
        s,
      )
        ? s
        : /^\d+$/.test(s)
          ? "{number}"
          : /^u_[\w-]+$/.test(s)
            ? "{uid}"
            : /\.(?:jpg|jpeg|png|webp)$/i.test(s)
              ? "{image}"
              : "{part}",
    );
  return (
    url.protocol +
    " " +
    parts.join("/") +
    " " +
    [...url.searchParams.keys()]
      .filter((k) =>
        /^(?:uin|uid|nk|dst_uin|userId|user_id|size|spec)$/i.test(k),
      )
      .join(",")
  );
}
function styleReport(
  win: Window,
  motion: { conversation: number; message: number },
): string | undefined {
  const doc = win.document,
    h = win.location.hash;
  if (/\/contact(?:[/?]|$)/.test(h)) {
    const surfaces = surfaceTrails(win, [
      ".contact-layout",
      ".contact-layout__left-area",
      ".contact-layout__right-area, .contact-layout .two-col-layout__main",
    ]);
    return "联系人页 · " + (surfaces.join("\n") || "未识别到联系人布局");
  }
  if (!/\/(?:message|chat|aio)(?:[/?]|$)/.test(h)) return;
  const list = findTimeline(doc);
  if (!list) return "消息页 · 未打开会话";
  const host = rowHost(list),
    mounted = Array.from(host.children).filter((el) =>
      el.matches(rows + ", " + messageCards),
    );
  const recognized = mounted.filter(messageAuthor).length;
  const merged = host.querySelectorAll("[data-virga-merged-avatar]").length;
  const first =
    mounted.find((el) =>
      el.querySelector(
        ".avatar-span,.message-avatar,.avatar,[data-message-avatar]",
      ),
    ) ?? mounted[0];
  const tags = first
    ? Array.from(first.querySelectorAll("*"))
        .filter(
          (el) =>
            !el.closest(".message-content,.reply-element,.ark-element") &&
            (el.localName === "img" ||
              Array.from(el.classList).some((k) => /avatar/.test(k))),
        )
        .slice(0, 8)
    : [];
  return (
    "消息页 · 已渲染 " +
    mounted.length +
    " 条，可识别发送者 " +
    recognized +
    " 条，已合并 " +
    merged +
    " 个头像 · 已置底 " +
    host.querySelectorAll("[data-virga-avatar-anchor]").length +
    " 个 · 已折叠组内时分条 " +
    host.querySelectorAll("[data-virga-merged-clock]").length +
    " 个\n聊天动效 · 切换 " +
    motion.conversation +
    " 次，新消息 " +
    motion.message +
    " 条\n" +
    [
      shape(host),
      shape(first ?? null),
      shape(tags[0]?.parentElement ?? null),
      ...tags.map((el) =>
        [shape(el), avatarResource(el)].filter(Boolean).join(" "),
      ),
    ]
      .filter(Boolean)
      .join(" · ") +
    "\n" +
    surfaceTrails(win, [
      ".chat-header",
      ".chat-input-area",
      ".group-box__container",
      "[data-virga-roster]",
    ]).join("\n")
  );
}

export function coverage(
  win: Window,
  motion: () => { conversation: number; message: number },
) {
  const channel =
    typeof BroadcastChannel === "function"
      ? new BroadcastChannel("virga:surface-check:v1")
      : null;
  channel?.addEventListener("message", (e) => {
    if (e.data?.op !== "inspect" || typeof e.data.id !== "string") return;
    const text = styleReport(win, motion());
    if (text) channel.postMessage({ op: "result", id: e.data.id, text });
  });
  return {
    dispose: () => channel?.close(),
    async inspect(): Promise<string> {
      if (!channel) throw Error("当前窗口不支持跨窗口检查");
      const request = new BroadcastChannel("virga:surface-check:v1"),
        id = crypto.getRandomValues(new Uint32Array(4)).join("-");
      const result = await new Promise<string>((resolve) => {
        const results = new Set<string>();
        request.onmessage = (e) => {
          if (
            e.data?.op === "result" &&
            e.data.id === id &&
            typeof e.data.text === "string"
          )
            results.add(e.data.text);
        };
        win.setTimeout(() => {
          request.close();
          resolve([...results].join("\n\n") || "未收到消息页或联系人页的检查结果");
        }, 400);
        request.postMessage({ op: "inspect", id });
      });
      return result;
    },
  };
}
