import searchCSS from "./notification-search.css?inline";

const filterSelector = ".notify-filter-container";

function bindSearch(win: Window, header: HTMLElement, list: HTMLElement) {
  const doc = win.document, events = new AbortController(), { signal } = events;
  const host = doc.createElement("div");
  host.dataset.virgaNotifySearch = "";
  const shadow = host.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = searchCSS;
  const actions = doc.createElement("div");
  actions.className = "search-actions";
  const trigger = doc.createElement("button");
  trigger.type = "button";
  trigger.className = "search-toggle";
  trigger.setAttribute("aria-controls", "virga-notify-find");
  const form = doc.createElement("form");
  form.id = "virga-notify-find";
  form.setAttribute("role", "search");
  const icon = doc.createElement("span");
  icon.className = "search-icon";
  icon.setAttribute("aria-hidden", "true");
  const field = doc.createElement("input");
  field.type = "search";
  field.placeholder = "查找通知";
  field.setAttribute("aria-label", "查找已加载通知");
  const count = doc.createElement("output");
  const controls = doc.createElement("div");
  controls.className = "match-navigation";
  const previous = doc.createElement("button");
  const next = doc.createElement("button");
  for (const [button, direction, label] of [
    [previous, "previous", "上一处匹配"],
    [next, "next", "下一处匹配"],
  ] as const) {
    button.type = "button";
    button.className = direction;
    button.setAttribute("aria-label", label);
    button.title = label;
  }
  controls.append(previous, next);
  trigger.append(icon);
  form.append(field, count, controls);
  actions.append(trigger, form);
  shadow.append(style, actions);
  let matches: HTMLElement[] = [];
  let selected: HTMLElement | undefined;
  const mac = /Mac/i.test(win.navigator.platform);
  function setOpen(open: boolean) {
    form.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    trigger.setAttribute("aria-label", open ? "关闭查找" : "查找通知");
    trigger.title = open ? "关闭查找" : "查找通知（" + (mac ? "⌘F" : "Ctrl+F") + "）";
    if (!open && field.value) {
      field.value = "";
      search(false);
    }
  }
  function select(index: number, move: boolean) {
    selected?.removeAttribute("data-virga-notify-match");
    selected = matches[index];
    selected?.setAttribute("data-virga-notify-match", "");
    if (move) selected?.scrollIntoView({ block: "nearest", behavior: "instant" });
    count.hidden = !field.value.trim();
    count.value = selected ? (index + 1) + " / " + matches.length : "无匹配";
    controls.hidden = matches.length < 2;
  }
  function search(move: boolean) {
    const query = field.value.trim().toLocaleLowerCase();
    matches = query ? [...list.querySelectorAll<HTMLElement>(".sys-notify-card")].filter((row) =>
      [...row.querySelectorAll(".list-item__info, .card-extra, .card-action-status")].some((el) =>
        el.textContent?.toLocaleLowerCase().includes(query)),
    ) : [];
    select(Math.max(0, matches.indexOf(selected!)), move);
  }
  function step(offset: number) {
    if (matches.length)
      select((matches.indexOf(selected!) + offset + matches.length) % matches.length, true);
  }
  field.addEventListener("input", () => search(true), { signal });
  field.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    e.preventDefault();
    step(e.shiftKey ? -1 : 1);
  }, { signal });
  trigger.addEventListener("click", () => {
    const wasClosed = form.hidden === true;
    setOpen(wasClosed);
    if (wasClosed) field.focus();
  }, { signal });
  actions.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || form.hidden || e.isComposing) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    trigger.focus();
  }, { signal });
  doc.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.isComposing || e.shiftKey || e.altKey ||
        e.key.toLowerCase() !== "f" || !(mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey)) return;
    e.preventDefault();
    setOpen(true);
    field.focus();
    field.select();
  }, { signal });
  form.addEventListener("submit", (e) => e.preventDefault(), { signal });
  previous.addEventListener("click", () => step(-1), { signal });
  next.addEventListener("click", () => step(1), { signal });
  const observer = new MutationObserver(() => { if (field.value) search(false); });
  observer.observe(list, { subtree: true, childList: true, characterData: true });
  setOpen(false);
  select(-1, false);
  const clear = header.querySelector(":scope > .func-btn");
  header.insertBefore(host, clear);
  return {
    header, list, host,
    dispose() {
      observer.disconnect();
      events.abort();
      selected?.removeAttribute("data-virga-notify-match");
      host.remove();
    },
  };
}

export function filteredNotifications(win: Window) {
  const doc = win.document;
  let binding: ReturnType<typeof bindSearch> | undefined;
  let enabled = false;
  function reconcile() {
    const pane = enabled ? doc.querySelector(filterSelector) : null;
    const header = pane?.querySelector<HTMLElement>(".notify-header");
    const list = pane?.querySelector<HTMLElement>(".notify-filter-body :is(.sys-notify__content, .q-scroll-view)");
    if (binding?.host.isConnected && binding.list === list && binding.header === header) return;
    binding?.dispose();
    binding = header && list ? bindSearch(win, header, list) : undefined;
  }
  const observer = new MutationObserver((records) => {
    if (binding?.host.isConnected && binding.list.isConnected) return;
    if (binding || records.some((record) => [...record.addedNodes].some((node) =>
      node instanceof Element &&
      (node.closest(filterSelector) || node.querySelector(filterSelector)))))
      reconcile();
  });
  return {
    configure(next: boolean) {
      if (next === enabled) return;
      enabled = next;
      observer.disconnect();
      if (enabled) observer.observe(doc.documentElement, { childList: true, subtree: true });
      reconcile();
    },
    dispose() {
      observer.disconnect();
      binding?.dispose();
    },
  };
}
