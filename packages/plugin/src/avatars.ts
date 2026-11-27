import {
  findTimeline,
  messageBubble,
  messageCards,
  rows,
  rowHost,
  timelineViewport,
} from "./chat-dom.ts";

const avatarSelector =
  ".message-avatar, .message__avatar, .avatar-span, .avatar, .q-avatar, .avatar-img, [data-message-avatar]";
const senderAttributes = [
  "data-sender-uid",
  "data-sender-uin",
  "data-sender-id",
  "sender-uid",
  "sender-uin",
];
const avatarAttributes = [
  "data-uid",
  "data-uin",
  "data-user-id",
  "data-user-uid",
  ...senderAttributes,
];
const systemRow = ".system-message, .gray-tip, .gray-tip-message";
const timeDivider =
  ".message__timestamp, .message-time, .message__time, .message-timestamp, .time-divider, .msg-time";
const separator =
  '[role="separator"], .new-msg-indicator, ' + systemRow + ", " + timeDivider;
const embedded =
  ".message-content, .text-element, .reply-element, .forward-element, .ark-element, blockquote";
const mark = "data-virga-merged-avatar";
const nameMark = "data-virga-merged-name";
const positionMark = "data-virga-avatar-anchor";
const groupMark = "data-virga-message-group";
export const messageSpacingMark = "data-virga-message-spacing";
const clockMark = "data-virga-merged-clock";
const avatarOffset = "--virga-avatar-offset";
const maxGroupPauseMinutes = 15;

function attributeKey(el: Element, attributes: readonly string[]) {
  for (const name of attributes) {
    const value = el.getAttribute(name)?.trim();
    if (value && value !== "0" && value !== "undefined" && value !== "null")
      return name + "=" + value;
  }
}

function resourceSender(raw: string | null | undefined, base: string) {
  if (!raw || raw.length > 4096 || !URL.canParse(raw, base)) return;
  const url = new URL(raw, base);
  for (const key of ["dst_uin", "uin", "uid", "nk", "userId", "user_id"]) {
    const value = url.searchParams.get(key);
    if (value && value !== "0" && /^[a-zA-Z0-9_-]+$/.test(value))
      return key + "=" + value;
  }
  // A user-avatar route carries the account key even when the image is cached.
  const path = (url.hostname === "avatar" ? "/avatar" : "") + url.pathname;
  const user =
    /\/avatar\/(?:user|buddy)\/(u_[\w-]+|[1-9]\d{4,})(?:\/|\.|$)/i.exec(path);
  if (user) return "avatar-user=" + user[1];
}

function identifiableImage(raw: string | null | undefined, base: string) {
  if (!raw || raw.length > 4096 || !URL.canParse(raw, base)) return;
  const url = new URL(raw, base);
  const address = `${url.hostname}${url.pathname}`;
  if (
    /\b(?:default|placeholder|anonymous|unknown|sprite|icon)\b/i.test(address)
  )
    return;
  // Native avatar cache paths and user head CDN URLs can lack an account parameter.
  if (/(?:\/avatar\/|\/head\/|(?:^|\.)qlogo\.cn\/)/i.test(address)) {
    url.hash = "";
    for (const key of ["size", "spec", "format", "width", "height"])
      url.searchParams.delete(key);
    return url.href;
  }
}
function imageSender(avatar: Element) {
  const label = avatar.getAttribute("aria-label")?.trim();
  for (const el of [
    avatar,
    ...avatar.querySelectorAll('img[src],[style*="url("]'),
  ]) {
    const background = (el as HTMLElement).style?.backgroundImage;
    const raw =
      el.getAttribute("src") ??
      background?.match(/^url\(["']?(.+?)["']?\)$/)?.[1];
    const id = resourceSender(raw, el.baseURI);
    if (id) return id;
    if (label && !/^(?:avatar|头像|用户头像|群头像)$/i.test(label)) {
      const image = identifiableImage(raw, el.baseURI);
      if (image) return `label=${label}\n${image}`;
    }
  }
}
export function messageAuthor(row: Element) {
  if (!row.matches(rows + ", " + messageCards)) return;
  if (row.matches(systemRow) || row.querySelector(systemRow)) return;
  const message = row.matches(messageCards)
    ? row
    : row.querySelector(messageCards);
  const card = message?.matches(".message-container")
    ? message
    : message?.querySelector(".message-container") ?? message ?? row;
  const avatar =
    card.querySelector(":scope > .avatar-span") ??
    Array.from(row.querySelectorAll(avatarSelector)).find(
      (el) => !el.closest(embedded),
    );
  if (!avatar) return;
  const owner = avatar.querySelector(
    avatarAttributes.map((k) => "[" + k + "]").join(","),
  );
  const id =
    attributeKey(row, senderAttributes) ??
    (message && attributeKey(message, senderAttributes)) ??
    attributeKey(card, senderAttributes) ??
    attributeKey(avatar, avatarAttributes) ??
    (owner && attributeKey(owner, avatarAttributes)) ??
    imageSender(avatar) ??
    (row.matches(".message-self,.message--self,.message-container--self") ||
    row.querySelector(".msg-content-container.container--self")
      ? "self"
      : undefined);
  if (id) return { id, avatar, card, row };
}

interface TimelineClock {
  element: Element;
  minute: number;
}

// Undefined means no divider. A date, system or unread divider ends the group.
function rowClock(row: Element): TimelineClock | null | undefined {
  let clock: TimelineClock | undefined;
  const dividers = row.matches(separator) ? [row] : row.querySelectorAll(separator);
  for (const el of dividers) {
    if (
      clock?.element.contains(el) ||
      el.closest(embedded + ", .msg-content-container, .message-content__wrapper, [hidden]") ||
      (!el.closest("[" + clockMark + "]") && el.getClientRects().length === 0)
    ) continue;
    const time = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(el.textContent?.trim() ?? "");
    if (clock || !el.matches(timeDivider) || !time) return null;
    clock = { element: el, minute: Number(time[1]) * 60 + Number(time[2]) };
  }
  return clock;
}

function isClockOnlyRow(row: Element, clock: Element) {
  for (let el = clock; el !== row; el = el.parentElement!) {
    if (el.parentElement?.childElementCount !== 1) return false;
  }
  return row.textContent?.trim() === clock.textContent?.trim();
}

export function avatarGroups(win: Window) {
  let enabled = true,
    scope: Element | undefined,
    timeline: Element | undefined,
    host: Element | undefined,
    viewport: Element | undefined,
    frame = 0,
    positionFrame = 0;
  const marked = new Map<string, Map<Element, string>>();
  const offsets = new Map<HTMLElement, number>();
  const sources = new WeakMap<Element, string>();
  let anchors: Array<{ avatar: HTMLElement; first: Element; last: Element }> =
    [];
  const observer = new MutationObserver((records) => {
    if (
      records.some((r) => {
        const el = r.target instanceof Element ? r.target : r.target.parentElement;
        if (!el || el.closest(embedded)) return false;
        if (r.type === "characterData") return !!el.closest(separator);
        if (r.attributeName === "style") {
          if (el === host || el.matches(rows)) schedulePosition();
          if (el.matches(separator)) return true;
          if (!(el instanceof HTMLElement) || !el.closest(avatarSelector))
            return false;
          const source = el.style.backgroundImage;
          if (sources.get(el) === source) return false;
          sources.set(el, source);
        }
        return true;
      })
    )
      schedule();
  });
  const geometry = new MutationObserver(schedule);
  const resize = new ResizeObserver(schedulePosition);
  function schedule() {
    if (!frame && enabled) frame = win.requestAnimationFrame(render);
  }
  function schedulePosition() {
    if (!positionFrame && enabled)
      positionFrame = win.requestAnimationFrame(positionAvatars);
  }
  function replaceMarks(attribute: string, next: Map<Element, string>) {
    const previous = marked.get(attribute);
    for (const el of previous?.keys() ?? [])
      if (!next.has(el)) el.removeAttribute(attribute);
    for (const [el, value] of next)
      if (previous?.get(el) !== value) el.setAttribute(attribute, value);
    marked.set(attribute, next);
  }
  function resetOffset(el: HTMLElement) {
    el.style.removeProperty(avatarOffset);
    offsets.delete(el);
  }
  function positionAvatars() {
    positionFrame = 0;
    if (!viewport) return;
    const view = viewport.getBoundingClientRect();
    const positions = new Map<HTMLElement, number>();
    for (const { avatar, first, last } of anchors) {
      const start = first.getBoundingClientRect(),
        end = last.getBoundingClientRect();
      if (start.top >= view.bottom || end.bottom <= view.top) continue;
      const icon = avatar.getBoundingClientRect();
      if (icon.height <= 0) continue;
      const naturalBottom = icon.bottom - (offsets.get(avatar) ?? 0);
      const min = Math.min(start.top + icon.height, end.bottom);
      const bottom = Math.max(min, Math.min(end.bottom, view.bottom - 4));
      positions.set(avatar, Math.round((bottom - naturalBottom) * 2) / 2);
    }
    for (const el of offsets.keys()) if (!positions.has(el)) resetOffset(el);
    for (const [el, offset] of positions) {
      if (offsets.get(el) === offset) continue;
      el.style.setProperty(avatarOffset, offset + "px");
      offsets.set(el, offset);
    }
  }
  function clearGrouping() {
    for (const attribute of [mark, nameMark, groupMark, messageSpacingMark, clockMark, positionMark]) {
      for (const el of marked.get(attribute)?.keys() ?? [])
        el.removeAttribute(attribute);
      marked.delete(attribute);
    }
    for (const el of offsets.keys()) resetOffset(el);
    anchors = [];
  }
  function clear() {
    if (frame) win.cancelAnimationFrame(frame);
    if (positionFrame) win.cancelAnimationFrame(positionFrame);
    frame = positionFrame = 0;
    observer.disconnect();
    geometry.disconnect();
    resize.disconnect();
    viewport?.removeEventListener("scroll", schedulePosition, true);
    clearGrouping();
    timeline = host = viewport = undefined;
  }
  function render() {
    frame = 0;
    if (!enabled || !timeline || !host) return;
    if (!host.isConnected || rowHost(timeline) !== host) {
      attach(scope);
      return;
    }
    const children = Array.from(host.children);
    const groups: NonNullable<ReturnType<typeof messageAuthor>>[][] = [];
    const foldedClocks = new Map<Element, string>();
    let group: (typeof groups)[number] | undefined;
    let pendingClock: TimelineClock | undefined;
    let previousMinute: number | undefined;
    if (getComputedStyle(host).flexDirection === "column-reverse")
      children.reverse();
    for (const row of children) {
      const current = messageAuthor(row);
      const divider = rowClock(row);
      if (!current) {
        if (divider && !pendingClock && isClockOnlyRow(row, divider.element)) {
          pendingClock = { element: row, minute: divider.minute };
          continue;
        }
        group = undefined;
        pendingClock = undefined;
        previousMinute = undefined;
        continue;
      }
      const clock = divider ?? pendingClock;
      const pause = clock && previousMinute !== undefined
        ? clock.minute - previousMinute
        : 0;
      if (
        !group ||
        group[0]?.id !== current.id ||
        divider === null ||
        (divider && pendingClock) ||
        pause < 0 ||
        pause > maxGroupPauseMinutes
      ) {
        group = [];
        groups.push(group);
      } else if (clock) foldedClocks.set(clock.element, "");
      group.push(current);
      if (divider === null) previousMinute = undefined;
      else if (clock) previousMinute = clock.minute;
      pendingClock = undefined;
    }
    const hidden = new Map<Element, string>(),
      names = new Map<Element, string>();
    const grouped = new Map<Element, string>(),
      spacing = new Map<Element, string>(),
      positioned = new Map<Element, string>();
    anchors = [];
    for (const run of groups) {
      const first = run[0]!,
        last = run[run.length - 1]!;
      if (run.length > 1)
        for (const message of run) {
          const position = message === first ? "first" : message === last ? "last" : "middle";
          grouped.set(message.card, position);
          for (let layer = message.card; ; layer = layer.parentElement!) {
            spacing.set(layer, position);
            if (layer === message.row) break;
          }
          if (message !== last) hidden.set(message.avatar, "");
          if (message !== first) {
            const name = Array.from(
              message.card.querySelectorAll(
                ".user-name, .message-sender, [data-message-author]",
              ),
            ).find((el) => !el.closest(embedded));
            if (name) names.set(name, "");
          }
        }
      const icon =
        last.avatar.querySelector<HTMLElement>(
          ".message-container__avatar,.avatar-native,.avatar,.q-avatar",
        ) ?? last.avatar;
      const firstBubble = messageBubble(first.card),
        lastBubble = messageBubble(last.card);
      if (icon instanceof HTMLElement && firstBubble && lastBubble) {
        positioned.set(icon, "");
        anchors.push({ avatar: icon, first: firstBubble, last: lastBubble });
      }
    }
    replaceMarks(mark, hidden);
    replaceMarks(nameMark, names);
    replaceMarks(groupMark, grouped);
    replaceMarks(messageSpacingMark, spacing);
    replaceMarks(clockMark, foldedClocks);
    replaceMarks(positionMark, positioned);
    schedulePosition();
  }
  function attach(pane: Element | undefined) {
    scope = pane;
    const list = enabled && pane && findTimeline(pane);
    if (!list) {
      clear();
      return;
    }
    const track = rowHost(list);
    if (list === timeline && track === host) return;
    clear();
    timeline = list;
    host = track;
    viewport = timelineViewport(list, track);
    viewport.addEventListener("scroll", schedulePosition, {
      passive: true,
      capture: true,
    });
    resize.observe(viewport);
    if (track !== viewport) resize.observe(track);
    observer.observe(track, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        ...new Set([
          ...avatarAttributes,
          "src",
          "style",
          "class",
          "aria-label",
          "role",
          "hidden",
        ]),
      ],
    });
    if (track !== list) {
      for (
        let parent = track.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        geometry.observe(parent, { childList: true });
        if (parent === list) break;
      }
    }
    schedule();
  }
  return {
    attach,
    flushPending() {
      const mutations = observer.takeRecords();
      if (frame || mutations.length > 0) {
        if (frame) win.cancelAnimationFrame(frame);
        render();
      }
    },
    configure(value: boolean) {
      if (value !== enabled) {
        enabled = value;
        attach(scope);
      }
    },
    dispose() {
      clear();
      scope = undefined;
    },
  };
}
