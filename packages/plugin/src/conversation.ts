const rosterSelector =
  '.recent-contact, .recent-contact-list, [aria-label="会话列表"], [aria-label="Conversations"]';
const liveSelector =
  '.chat-input-area, [contenteditable="true"], [role="textbox"], [role="log"], [aria-label="消息列表"], [aria-label="Message list"], .chat-msg-area, .message-container';
function visible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    getComputedStyle(el).visibility !== "hidden"
  );
}
function firstVisible(root: ParentNode, selector: string): Element | undefined {
  if (root instanceof Element && root.matches(selector) && visible(root))
    return root;
  const first = root.querySelector(selector);
  if (!first || visible(first)) return first ?? undefined;
  return Array.from(root.querySelectorAll(selector)).find(visible);
}
function splitFrom(roster: Element) {
  const listRect = roster.getBoundingClientRect();
  for (
    let branch: Element = roster;
    branch.parentElement;
    branch = branch.parentElement
  ) {
    const parent = branch.parentElement;
    const candidates = Array.from(parent.children)
      .filter((el) => el !== branch && el instanceof HTMLElement)
      .map((el) => ({ el, rect: el.getBoundingClientRect() }));
    const adjacent = candidates.filter(
      ({ rect }) =>
        rect.width >= 120 &&
        rect.left >= listRect.right - 8 &&
        Math.min(rect.bottom, listRect.bottom) -
          Math.max(rect.top, listRect.top) >=
          Math.min(100, listRect.height * 0.5),
    );
    const match = adjacent.sort(
      (a, b) => a.rect.left - b.rect.left || b.rect.width - a.rect.width,
    )[0];
    if (match)
      return { pane: match.el as HTMLElement, side: branch, split: parent };
  }
}
function messengerRoute(win: Window): boolean {
  const route = win.location.hash.split("?")[0] ?? "";
  return (
    !route || /(?:^#?\/?|\/)(?:message|messages|chat|aio)(?:\/|$)/i.test(route)
  );
}

// Observe the split and its immediate branches. Only an idle pane needs subtree
// observation while it waits for its first conversation.
export function bindConversation(
  win: Window,
  attachChat: (pane: Element | undefined, roster?: Element) => void,
) {
  const doc = win.document;
  const events = new AbortController();
  let frame = 0;
  let stopped = false;
  let owner: HTMLElement | undefined;
  let side: Element | undefined;
  let roster: Element | undefined;
  let split: Element | undefined;
  const observer = new MutationObserver(() => schedule());
  const resize =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => schedule())
      : undefined;
  function forget() {
    owner?.removeAttribute("data-virga-pane");
    side?.removeAttribute("data-virga-side");
    roster?.removeAttribute("data-virga-roster");
    owner = undefined;
    side = undefined;
    roster = undefined;
    if (split) {
      resize?.unobserve(split);
      split = undefined;
    }
  }
  function schedule() {
    if (!stopped && !frame) frame = win.requestAnimationFrame(update);
  }
  function watchPath(el: Element, stop?: Element) {
    observer.observe(el, {
      attributes: true,
      attributeFilter: ["hidden", "class", "style"],
    });
    if (el === stop) return;
    for (let node = el.parentElement; node; node = node.parentElement) {
      observer.observe(node, {
        childList: true,
        attributes: true,
        attributeFilter: ["hidden", "class", "style"],
      });
      if (node === stop) break;
    }
  }
  function update() {
    frame = 0;
    observer.disconnect();
    if (!messengerRoute(win)) {
      forget();
      attachChat(undefined);
      return;
    }
    const list =
      roster?.isConnected && visible(roster)
        ? roster
        : firstVisible(doc, rosterSelector);
    const match = list && splitFrom(list);
    if (!list || !match) {
      forget();
      // Detached conversations have a timeline but no roster.
      const standalone = firstVisible(
        doc,
        '.chat-msg-area,[role="log"],[aria-label="消息列表"],[aria-label="Message list"]',
      );
      if (standalone) {
        const shell =
          standalone.closest(".chat-container,.chat-panel,.aio") ??
          standalone.parentElement ??
          standalone;
        attachChat(shell);
        watchPath(standalone);
      } else {
        attachChat(undefined);
        if (doc.body)
          observer.observe(doc.body, { subtree: true, childList: true });
      }
      return;
    }
    if (owner !== match.pane || roster !== list || side !== match.side) {
      forget();
      owner = match.pane;
      side = match.side;
      roster = list;
      split = match.split;
      owner.setAttribute("data-virga-pane", "");
      side.setAttribute("data-virga-side", "");
      roster.setAttribute("data-virga-roster", "");
      resize?.observe(split);
    }
    const pane = match.pane;
    const live = firstVisible(pane, liveSelector);
    attachChat(live ? pane : undefined, list);
    if (live && live !== pane) watchPath(live, pane);
    watchPath(list);
    watchPath(pane);
    if (live)
      observer.observe(pane, {
        childList: true,
        attributes: true,
        attributeFilter: ["hidden", "class", "style"],
      });
    else
      observer.observe(pane, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "hidden", "style"],
      });
  }
  win.addEventListener("resize", schedule, { signal: events.signal });
  win.addEventListener("hashchange", schedule, { signal: events.signal });
  win.addEventListener("popstate", schedule, { signal: events.signal });
  const navigation = (win as Window & { navigation?: EventTarget }).navigation;
  navigation?.addEventListener("navigatesuccess", schedule, {
    signal: events.signal,
  });
  schedule();
  return () => {
    stopped = true;
    if (frame) win.cancelAnimationFrame(frame);
    events.abort();
    observer.disconnect();
    resize?.disconnect();
    forget();
  };
}
