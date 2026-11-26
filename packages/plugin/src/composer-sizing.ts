import { findTimeline, rowHost, timelineViewport } from "./chat-dom.ts";

const controls =
  '.operation, .send-btn-wrap, .send-msg-btn, button[aria-label="发送"]';
const composerParts =
  ".chat-func-bar, .resize-handler, [data-virga-tools-toggle]";
const sizeProperty = "--virga-composer-size";
const length = (value: string) => Number.parseFloat(value) || 0;

function flows(win: Window, node: Element) {
  const style = win.getComputedStyle(node);
  return (
    style.display !== "none" &&
    style.position !== "absolute" &&
    style.position !== "fixed"
  );
}

function keepTimelinePosition(win: Window, pane: Element) {
  const list = findTimeline(pane);
  if (!list) return;
  const track = rowHost(list);
  const view = timelineViewport(list, track);
  const reversed = win.getComputedStyle(view).flexDirection === "column-reverse";
  const bounds = view.getBoundingClientRect();
  const startHeight = bounds.height;
  const startScroll = view.scrollTop;
  const end = reversed ? 0 : view.scrollHeight - view.clientHeight;
  const pinned = Math.abs(startScroll - end) <= 2;
  const row = pinned
    ? undefined
    : Array.from(track.children).find((child) => {
        const rect = child.getBoundingClientRect();
        return rect.height > 0 && rect.bottom > bounds.top && rect.top < bounds.bottom;
      });
  const rowKey = (el: Element) => el.id || el.getAttribute("data-message-id");
  const key = row && rowKey(row);
  const rowOffset = row && row.getBoundingClientRect().top - bounds.top;
  const input = new AbortController();
  let previousHeight = startHeight;

  function restore(force = false) {
    if (input.signal.aborted || !view.isConnected) return;
    const currentBounds = view.getBoundingClientRect();
    const height = currentBounds.height;
    if (!force && previousHeight === height) return;
    previousHeight = height;
    const range = Math.max(0, view.scrollHeight - view.clientHeight);
    let top = startScroll + (reversed ? height - startHeight : 0);
    if (pinned) {
      top = reversed ? 0 : range;
    } else if (
      row && rowOffset !== undefined && track.contains(row) && rowKey(row) === key
    ) {
      const offset =
        row.getBoundingClientRect().top - currentBounds.top;
      top = view.scrollTop + offset - rowOffset;
    }
    top = Math.min(reversed ? 0 : range, Math.max(reversed ? -range : 0, top));
    if (Math.abs(view.scrollTop - top) > 0.5)
      view.scrollTo({ top, behavior: "instant" });
  }

  const resize = new ResizeObserver(() => restore());
  resize.observe(view);
  function dispose() {
    input.abort();
    resize.disconnect();
  }
  for (const event of ["wheel", "pointerdown", "touchmove", "keydown"])
    view.addEventListener(event, dispose, {
      capture: true,
      passive: true,
      signal: input.signal,
    });
  return { restore, dispose };
}

export function sizeComposer(
  win: Window,
  pane: Element,
  area: HTMLElement,
  viewport: HTMLElement,
  draft: HTMLElement,
) {
  const events = new AbortController();
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  const observed = new Set<Element>();
  let editedAt = -Infinity;
  let lastWidth = 0;
  let goal: number | "auto" | undefined;
  let revision = 0;
  let frame = 0;
  let anchor: ReturnType<typeof keepTimelinePosition>;

  function stopKeepingScroll() {
    anchor?.dispose();
    anchor = undefined;
  }

  function settle(rev: number) {
    if (rev !== revision) return;
    anchor?.restore(true);
    stopKeepingScroll();
    area.removeAttribute("data-virga-composer-sizing");
  }

  function sync(fromLayout = true) {
    const width = area.getBoundingClientRect().width;
    if (!width) return;
    const style = win.getComputedStyle(area);
    const min = length(style.minBlockSize);
    const max = Number.parseFloat(style.maxBlockSize);
    const viewportTop = viewport.getBoundingClientRect().top;
    let intrinsic = min;
    for (const child of viewport.children) {
      if (flows(win, child) && child.getClientRects().length) {
        const bottom = child.getBoundingClientRect().bottom;
        intrinsic = Math.max(intrinsic, bottom - viewportTop + viewport.scrollTop);
      }
    }
    let extraRow = false;
    for (const child of area.children) {
      if (
        child === viewport || child.matches(composerParts) || !flows(win, child)
      )
        continue;
      if (child.matches(controls)) {
        const childStyle = win.getComputedStyle(child);
        intrinsic = Math.max(
          intrinsic,
          child.getBoundingClientRect().height +
            length(childStyle.marginBlockStart) +
            length(childStyle.marginBlockEnd),
        );
      } else if (child.getClientRects().length) {
        // QQ may insert a dedicated row for a special editor mode.
        extraRow = true;
      }
    }
    const next = extraRow
      ? "auto"
      : Math.round(Math.min(Number.isFinite(max) ? max : Infinity, intrinsic) * 64) / 64;
    const sameWidth = Math.abs(lastWidth - width) < 0.5;
    lastWidth = width;
    if (goal === next) return;
    const edit = fromLayout && sameWidth && typeof goal === "number" &&
      typeof next === "number" && win.performance.now() - editedAt < 240;
    const animate = edit && !reduced.matches && !win.document.hidden &&
      length(style.getPropertyValue("--virga-duration")) > 0;
    const rev = ++revision;
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    if (edit) anchor ??= keepTimelinePosition(win, pane);
    else stopKeepingScroll();
    area.toggleAttribute("data-virga-composer-sizing", animate);
    if (typeof next === "number")
      area.style.setProperty(sizeProperty, next + "px");
    else area.style.removeProperty(sizeProperty);
    goal = next;
    if (!animate) {
      settle(rev);
      return;
    }
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      const transition = area.getAnimations().find(
        (a) => a instanceof CSSTransition &&
          /^(height|block-size)$/.test(a.transitionProperty),
      );
      if (!transition) {
        settle(rev);
        return;
      }
      const done = () => {
        transition.removeEventListener("finish", done);
        transition.removeEventListener("cancel", done);
        settle(rev);
      };
      transition.addEventListener("finish", done, { once: true, signal: events.signal });
      transition.addEventListener("cancel", done, { once: true, signal: events.signal });
    });
  }

  const resize = new ResizeObserver(() => sync());
  function watch() {
    const children = new Set([
      ...viewport.children,
      ...Array.from(area.children).filter((child) =>
        child !== viewport && !child.matches(composerParts),
      ),
    ]);
    for (const child of observed) {
      if (!children.has(child)) {
        observed.delete(child);
        resize.unobserve(child);
      }
    }
    for (const child of children) {
      if (!observed.has(child)) {
        observed.add(child);
        resize.observe(child);
      }
    }
  }

  const markEdit = () => { editedAt = win.performance.now(); };
  for (const event of ["beforeinput", "input", "paste", "cut", "drop", "compositionupdate"])
    draft.addEventListener(event, markEdit, {
      capture: true,
      signal: events.signal,
    });
  draft.addEventListener("keydown", (e) => {
    if (["Enter", "Backspace", "Delete"].includes(e.key) ||
      ((e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key)))
      markEdit();
  }, { capture: true, signal: events.signal });

  watch();
  sync(false);
  return {
    watch,
    syncNow: () => sync(false),
    dispose() {
      events.abort();
      resize.disconnect();
      stopKeepingScroll();
      if (frame) win.cancelAnimationFrame(frame);
      area.removeAttribute("data-virga-composer-sizing");
      area.style.removeProperty(sizeProperty);
    },
  };
}
