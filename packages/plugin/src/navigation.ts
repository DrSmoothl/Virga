import { navigationItems, type NavigationItem, type Settings } from "@virga/theme";

const railSelector =
  ".container-content > :is(.container-sidebar, .nav-bar-container):has(.sidebar-nav)";
const entrySelector =
  ".sidebar__nav > .nav-item, .sidebar__menu .func-menu__item, [data-nav-id]";
const labels = new Map<string, NavigationItem>([
  ["消息", "messages"], ["Messages", "messages"],
  ["联系人", "contacts"], ["Contacts", "contacts"],
  ["空间", "space"], ["QQ空间", "space"], ["Qzone", "space"],
  ["频道", "channels"], ["QQ频道", "channels"], ["Channels", "channels"],
  ["游戏", "games"], ["QQ游戏", "games"], ["Games", "games"],
  ["更多", "more"], ["更多应用", "more"], ["More", "more"],
  ["邮箱", "mail"], ["QQ邮箱", "mail"], ["Mail", "mail"],
  ["我的手机", "phone"], ["My phone", "phone"],
  ["设置", "settings"], ["主菜单", "settings"], ["Settings", "settings"],
]);
function itemId(el: Element): NavigationItem | undefined {
  const key = el.getAttribute("data-nav-id");
  if (key && Object.hasOwn(navigationItems, key)) return key as NavigationItem;
  if (el.matches(".func-menu-more-component")) return "settings";
  if (el.matches(".nav-item-more")) return "more";
  if (el.matches(".item-mail")) return "mail";
  if (el.matches(".handoff-item")) return "phone";
  const label = el.getAttribute("aria-label") ?? el.getAttribute("title") ??
    el.querySelector("[aria-label]")?.getAttribute("aria-label") ?? "";
  return labels.get(label.trim().replace(/\s*\d+\s*条未读$/, "").replace(/^QQ\s+/, "QQ"));
}

export function navigationShortcut(win: Window) {
  const mac = /Mac/i.test(win.navigator.platform);
  return {
    label: mac ? "⌘ ⇧ ;" : "Ctrl + Shift + ;",
    aria: mac ? "Meta+Shift+;" : "Control+Shift+;",
    matches: (e: KeyboardEvent) => e.code === "Semicolon" && e.shiftKey &&
      (mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) && !e.altKey,
  };
}

function bindRail(win: Window, shell: HTMLElement, nav: HTMLElement) {
  const doc = win.document;
  const host = shell.parentElement!;
  const handle = doc.createElement("button");
  handle.type = "button";
  handle.setAttribute("aria-label", "展开 QQ 导航栏");
  handle.dataset.virgaRailHandle = "";
  const events = new AbortController(), { signal } = events;
  const marked = new Set<Element>();
  let timer = 0, open = false, ownsInert = false;
  let fromOuterEdge = false;
  let config: Settings["navigation"] | undefined;
  function cancelClose() {
    win.clearTimeout(timer);
    timer = 0;
  }
  function show(next: boolean) {
    cancelClose();
    open = next;
    host.toggleAttribute("data-virga-rail-open", next);
    handle.setAttribute("aria-expanded", String(next));
    if (!next && config?.autoHide && !shell.inert) {
      shell.inert = true;
      ownsInert = true;
    } else if ((next || !config?.autoHide) && ownsInert) {
      shell.inert = false;
      ownsInert = false;
    }
  }
  function closeSoon() {
    if (!config?.autoHide || !open) return;
    cancelClose();
    timer = win.setTimeout(() => {
      timer = 0;
      if (!shell.matches(":hover, :has(:focus-visible)") && !handle.matches(":hover"))
        show(false);
    }, 190);
  }
  function clearMark(el: Element) {
    el.removeAttribute("data-virga-nav-hidden");
    el.removeAttribute("data-virga-nav-badge-hidden");
  }
  function markItems() {
    if (!config) return;
    const next = new Set<Element>();
    for (const entry of nav.querySelectorAll(entrySelector)) {
      const id = itemId(entry);
      if (!id) continue;
      const item = entry.closest(".func-menu__item_wrap") ?? entry;
      item.toggleAttribute("data-virga-nav-hidden", config.hidden.includes(id));
      item.toggleAttribute("data-virga-nav-badge-hidden", config.hiddenBadges.includes(id));
      next.add(item);
    }
    for (const el of marked)
      if (!next.has(el)) clearMark(el);
    marked.clear();
    for (const el of next) marked.add(el);
  }
  const observer = new MutationObserver(markItems);
  observer.observe(nav, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ["aria-label", "title", "data-nav-id"],
  });
  const reveal = () => { if (config?.autoHide) show(true); };
  function trackEdge(e: PointerEvent) {
    if (!config?.autoHide || e.pointerType === "touch") return;
    // The content wrapper can start a few pixels inside the window frame.
    if (e.clientX < 12) {
      const { left, top, bottom } = host.getBoundingClientRect();
      if (e.clientX < left && e.clientY >= top && e.clientY < bottom) {
        fromOuterEdge = true;
        if (!open) reveal();
        return;
      }
    }
    if (fromOuterEdge) {
      fromOuterEdge = false;
      closeSoon();
    }
  }
  for (const kind of ["pointermove", "pointerover"] as const)
    doc.addEventListener(kind, trackEdge, { passive: true, signal });
  doc.documentElement.addEventListener("pointerleave", () => {
    fromOuterEdge = false;
    closeSoon();
  }, { signal });
  handle.addEventListener("pointerenter", reveal, { signal });
  handle.addEventListener("pointerleave", closeSoon, { signal });
  shell.addEventListener("pointerenter", reveal, { signal });
  shell.addEventListener("pointerleave", closeSoon, { signal });
  shell.addEventListener("focusout", closeSoon, { signal });
  handle.addEventListener("focusout", closeSoon, { signal });
  handle.addEventListener("click", () => {
    reveal();
    nav.querySelector<HTMLElement>(
      '.nav-item:not([data-virga-nav-hidden]) :is(button,[tabindex="0"]), .nav-item:is(button,[tabindex="0"]):not([data-virga-nav-hidden])',
    )?.focus({ preventScroll: true });
  }, { signal });
  host.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented || !open ||
      !(shell.contains(doc.activeElement) || doc.activeElement === handle)) return;
    show(false);
    handle.focus({ preventScroll: true });
  }, { signal });
  return {
    shell, nav,
    configure(next: Settings["navigation"]) {
      const floating = config?.autoHide ?? false;
      config = next;
      markItems();
      if (next.autoHide === floating) return;
      if (next.autoHide) {
        const width = shell.getBoundingClientRect().width;
        if (width > 0) host.style.setProperty("--virga-rail-width", width + "px");
        shell.dataset.virgaFloatingRail = "";
        host.append(handle);
        host.dataset.virgaRailHost = "";
        show(shell.matches(":hover, :focus-within"));
      } else {
        show(false);
        handle.remove();
        delete shell.dataset.virgaFloatingRail;
        delete host.dataset.virgaRailHost;
        host.style.removeProperty("--virga-rail-width");
      }
    },
    dispose() {
      config = undefined;
      show(false);
      events.abort();
      observer.disconnect();
      handle.remove();
      delete shell.dataset.virgaFloatingRail;
      delete host.dataset.virgaRailHost;
      host.style.removeProperty("--virga-rail-width");
      for (const el of marked) clearMark(el);
      marked.clear();
    },
  };
}

export function navigationRail(win: Window, restore: () => void) {
  const doc = win.document;
  const events = new AbortController();
  const shortcut = navigationShortcut(win);
  let config: Settings["navigation"] | undefined;
  let binding: ReturnType<typeof bindRail> | undefined;
  let frame = 0;
  function reconcile() {
    frame = 0;
    if (!config) return;
    const shell = doc.querySelector<HTMLElement>(railSelector);
    const nav = shell?.querySelector<HTMLElement>(".sidebar-nav");
    if (shell === binding?.shell && nav === binding?.nav) return;
    binding?.dispose();
    binding = shell && nav ? bindRail(win, shell, nav) : undefined;
    binding?.configure(config);
  }
  const observer = new MutationObserver((records) => {
    if (frame || (binding?.shell.isConnected && binding.nav.isConnected)) return;
    if (binding || records.some((r) => Array.from(r.addedNodes).some((node) =>
      node instanceof Element && (node.closest(railSelector) || node.querySelector(railSelector)))))
      frame = win.requestAnimationFrame(reconcile);
  });
  win.addEventListener("keydown", (e) => {
    if (!config || e.repeat || e.isComposing || e.defaultPrevented ||
        !shortcut.matches(e) || !(config.autoHide || config.hidden.length || config.hiddenBadges.length))
      return;
    e.preventDefault();
    restore();
  }, { capture: true, signal: events.signal });
  return {
    configure(next: Settings["navigation"]) {
      if (!config) {
        config = next;
        observer.observe(doc.documentElement, { subtree: true, childList: true });
        reconcile();
      } else {
        config = next;
        binding?.configure(next);
      }
    },
    dispose() {
      if (frame) win.cancelAnimationFrame(frame);
      observer.disconnect();
      binding?.dispose();
      events.abort();
    },
  };
}
