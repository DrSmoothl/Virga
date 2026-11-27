import type { Settings } from "@virga/theme";

import { messageSpacingMark } from "./avatars.ts";
import {
  findTimeline,
  messageBubble,
  rows,
  rowHost,
  timelineViewport,
} from "./chat-dom.ts";
const titles =
  '.chat-header__contact-name, .chat-header .contact-name__text, .chat-header [role="heading"], .panel-header [role="heading"]';
const selected =
  '[aria-selected="true"], .recent-contact-item--selected, .contact-item.list-item--selected';
const easing = "cubic-bezier(.16,1,.3,1)";
type MotionOptions = Pick<
  Settings,
  "motion" | "conversationMotion" | "messageMotion" | "duration"
>;
type Effect = "enter" | "title" | "in" | "out";

const startFrames: Record<Effect, Keyframe> = {
  title: { opacity: 0.3, translate: "0px 6px", scale: 1 },
  enter: { opacity: 0.3, translate: "0px 10px", scale: 0.985 },
  in: { opacity: 0.2, translate: "-12px 10px", scale: 0.97 },
  out: { opacity: 0.15, translate: "12px 12px", scale: 0.95 },
};

export function playChatEffect(
  el: Element,
  kind: Effect,
  duration: number,
  delay = 0,
) {
  const animation = el.animate(
    [startFrames[kind], { opacity: 1, translate: "0px 0px", scale: 1 }],
    { duration, easing, delay, fill: "backwards" },
  );
  animation.id = "virga-chat-" + kind;
  return animation;
}

function atEnd(el: Element) {
  if (getComputedStyle(el).flexDirection === "column-reverse")
    return Math.abs(el.scrollTop) <= 24;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= 24;
}
function lastRow(host: Element) {
  for (let el = host.lastElementChild; el; el = el.previousElementSibling)
    if (el.matches(rows)) return el;
  return null;
}
export function chatMotion(win: Window, flushMessageLayout: () => void) {
  const media = win.matchMedia("(prefers-reduced-motion: reduce)");
  const dragEvents = new AbortController();
  const active = new Set<Animation>();
  let config: MotionOptions | undefined;
  let session: AbortController | undefined;
  let list: Element | undefined,
    host: Element | undefined,
    roster: Element | undefined,
    title: Element | undefined;
  let selectedRow: Element | null = null;
  let conversation: string | Element | undefined;
  let changeFrame = 0,
    quietUntil = 0;
  let dragging = false,
    dragEndFrame = 0;
  const plays = { conversation: 0, message: 0 };
  const now = () => win.performance.now();
  const allow = (kind: "messageMotion" | "conversationMotion") =>
    !!config?.motion &&
    config[kind] &&
    config.duration > 0 &&
    !media.matches &&
    !win.document.hidden;
  function stopEffects() {
    for (const animation of active) animation.cancel();
    active.clear();
  }
  function play(el: Element, kind: Effect, delay = 0) {
    if (!config || !el.animate) return;
    const a = playChatEffect(el, kind, config.duration, delay);
    active.add(a);
    const done = () => active.delete(a);
    a.addEventListener("cancel", done, { once: true });
    a.addEventListener("finish", done, { once: true });
  }
  function changeConversation() {
    quietUntil = now() + 350;
    if (dragging) {
      stopEffects();
      return;
    }
    if (changeFrame) return;
    changeFrame = win.requestAnimationFrame(() => {
      changeFrame = 0;
      stopEffects();
      if (dragging || !host || !list || !allow("conversationMotion")) return;
      flushMessageLayout();
      const viewportRect = timelineViewport(list, host).getBoundingClientRect();
      const sample: Element[] = [];
      for (
        let row = host.lastElementChild;
        row && sample.length < 5;
        row = row.previousElementSibling
      ) {
        const rect = row.getBoundingClientRect();
        if (rect.bottom < viewportRect.top) break;
        if (
          rect.top < viewportRect.bottom &&
          row.matches(rows) &&
          !row.hasAttribute(messageSpacingMark)
        ) {
          const bubble = messageBubble(row);
          if (bubble) sample.push(bubble);
        }
      }
      if (!sample.length && !title) return;
      plays.conversation++;
      if (title) play(title, "title");
      const step = Math.min(20, (config?.duration ?? 0) * 0.1);
      sample.reverse().forEach((bubble, index) =>
        play(bubble, "enter", step * index),
      );
    });
  }

  function setDragging(next: boolean) {
    if (dragEndFrame) win.cancelAnimationFrame(dragEndFrame);
    dragEndFrame = 0;
    dragging = next;
  }
  function endDrag() {
    if (!dragging || dragEndFrame) return;
    // Let the host apply drop updates, including a pane rebind in the next frame.
    dragEndFrame = win.requestAnimationFrame(() => {
      dragEndFrame = win.requestAnimationFrame(() => {
        dragEndFrame = 0;
        dragging = false;
      });
    });
  }
  const dragListenerOptions = { capture: true, passive: true, signal: dragEvents.signal };
  for (const kind of ["dragenter", "dragover"] as const)
    win.addEventListener(kind, () => setDragging(true), dragListenerOptions);
  for (const kind of ["drop", "dragend"] as const)
    win.addEventListener(kind, endDrag, dragListenerOptions);
  win.addEventListener("dragleave", (event) => {
    if (!event.relatedTarget) endDrag();
  }, dragListenerOptions);
  // A fresh press can follow a native drag whose source was removed.
  win.addEventListener("pointerdown", (event) => {
    if (dragging && event.isTrusted) setDragging(false);
  }, dragListenerOptions);

  function syncConversation() {
    selectedRow = roster?.querySelector(selected) ?? null;
    const id = selectedRow?.getAttribute("data-contact-id");
    const next = id || title?.textContent?.trim() || selectedRow || undefined;
    if (!next || conversation === next) return;
    const previous = conversation;
    conversation = next;
    if (previous) changeConversation();
  }
  const selectionObserver = new MutationObserver((records) => {
    if (
      !records.some(
        (r) =>
          r.type === "childList" ||
          r.attributeName === "aria-selected" ||
          r.attributeName === "data-contact-id" ||
          (r.target instanceof Element &&
            (r.target === selectedRow || r.target.matches(selected))),
      )
    )
      return;
    syncConversation();
  });
  const titleObserver = new MutationObserver(syncConversation);
  let arrivals: MutationObserver | undefined,
    trackObserver: MutationObserver | undefined;
  function detach() {
    session?.abort();
    session = undefined;
    selectionObserver.disconnect();
    titleObserver.disconnect();
    arrivals?.disconnect();
    trackObserver?.disconnect();
    if (changeFrame) win.cancelAnimationFrame(changeFrame);
    changeFrame = 0;
    stopEffects();
    list = host = roster = title = undefined;
    selectedRow = null;
  }
  function attach(pane: Element | undefined, nextRoster?: Element) {
    const nextList = pane && findTimeline(pane);
    if (!nextList) {
      if (list) detach();
      if (!nextRoster) conversation = undefined;
      return;
    }
    const nextTitle = pane?.querySelector(titles) ?? undefined;
    const nextHost = rowHost(nextList);
    if (
      list === nextList &&
      host === nextHost &&
      nextRoster === roster &&
      nextTitle === title
    )
      return;
    detach();
    list = nextList;
    host = nextHost;
    roster = nextRoster;
    title = nextTitle;
    if (roster)
      selectionObserver.observe(roster, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["aria-selected", "class", "data-contact-id"],
      });
    if (title)
      titleObserver.observe(title, {
        subtree: true,
        characterData: true,
        childList: true,
      });
    session = new AbortController();
    const scroller = timelineViewport(nextList, nextHost),
      signal = session.signal;
    let pinned = atEnd(scroller);
    const rememberScroll = () => {
      pinned = atEnd(scroller);
    };
    scroller.addEventListener("scroll", rememberScroll, {
      passive: true,
      signal,
    });
    const pauseDuringInput = () => {
      quietUntil = now() + 180;
    };
    scroller.addEventListener("wheel", pauseDuringInput, {
      passive: true,
      signal,
    });
    scroller.addEventListener("touchmove", pauseDuringInput, {
      passive: true,
      signal,
    });
    let tail = lastRow(nextHost);
    const seen = new WeakSet<Element>(Array.from(nextHost.children));
    arrivals = new MutationObserver((records) => {
      // A virtual list may mount a spacer or a new row track after the outer
      // timeline. Rebind once a real row exists.
      if (!tail && rowHost(nextList) !== nextHost) {
        attach(pane, nextRoster);
        return;
      }
      const prior = tail;
      tail = lastRow(nextHost);
      if (Boolean(tail) !== Boolean(prior))
        arrivals?.observe(nextHost, { childList: true, subtree: !tail });
      const added = new Set<Element>();
      for (const record of records)
        for (const node of record.addedNodes)
          if (
            node instanceof Element &&
            node.parentElement === nextHost &&
            node.matches(rows) &&
            !seen.has(node)
          )
            added.add(node);
      for (const el of added) seen.add(el);
      if (
        !prior ||
        !tail ||
        prior === tail ||
        prior.parentElement !== nextHost ||
        !pinned ||
        now() < quietUntil ||
        !allow("messageMotion")
      )
        return;
      const oldId = prior.id;
      const newId = tail.id;
      if (
        /^\d+$/.test(oldId) &&
        /^\d+$/.test(newId) &&
        BigInt(newId) <= BigInt(oldId)
      )
        return;
      // Prove a short append after the previous tail. Initial history, prepends,
      // recycled rows and whole-list replacements have no such anchor.
      const appended: Element[] = [];
      let cursor: Element | null = tail;
      while (cursor && cursor !== prior) {
        if (cursor.matches(rows)) {
          if (!added.has(cursor) || appended.length === 3) return;
          appended.push(cursor);
        }
        cursor = cursor.previousElementSibling;
      }
      if (cursor !== prior) return;
      flushMessageLayout();
      for (const animation of active) {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        if (target?.closest("[" + messageSpacingMark + "]")) {
          animation.cancel();
          active.delete(animation);
        }
      }
      for (const row of appended) {
        if (row.hasAttribute(messageSpacingMark)) continue;
        const bubble = messageBubble(row);
        if (bubble) {
          plays.message++;
          play(
            bubble,
            bubble.closest(
              ".container--self,.message-self,.message--self,.message-container--self",
            )
              ? "out"
              : "in",
          );
        }
      }
    });
    // With rows mounted, changes inside message bodies cannot trigger entrance.
    arrivals.observe(nextHost, { childList: true, subtree: !tail });
    if (nextHost !== nextList) {
      trackObserver = new MutationObserver(() => {
        if (!nextList.contains(nextHost)) attach(pane, nextRoster);
      });
      for (
        let parent = nextHost.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        trackObserver.observe(parent, { childList: true });
        if (parent === nextList) break;
      }
    }
    syncConversation();
  }
  function onPreference() {
    if (media.matches) stopEffects();
  }
  media.addEventListener("change", onPreference);
  return {
    attach,
    played: () => ({ ...plays }),
    configure(settings: MotionOptions) {
      if (
        config &&
        (config.duration !== settings.duration ||
          config.motion !== settings.motion ||
          config.conversationMotion !== settings.conversationMotion ||
          config.messageMotion !== settings.messageMotion)
      )
        stopEffects();
      config = settings;
    },
    dispose() {
      dragEvents.abort();
      setDragging(false);
      detach();
      media.removeEventListener("change", onPreference);
    },
  };
}
