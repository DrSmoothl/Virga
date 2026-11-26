const compactAttribute = "data-virga-compact-titlebar";
const profileAttribute = "data-virga-titlebar-profile-open";
const insetsAttribute = "data-virga-titlebar-insets";
const emptyAttribute = "data-virga-titlebar-empty";
const avatarGap = 8;

function findTitlebar(doc: Document) {
  const shell = doc.querySelector<HTMLElement>(
    ".global-container:has(> .container-topbar > .topbar-content)",
  );
  const view = shell?.querySelector<HTMLElement>(
    ":scope > .container-content > .container-content-view",
  );
  const bar = shell?.querySelector<HTMLElement>(
    ":scope > .topbar.container-topbar > .topbar-content",
  );
  const chrome = shell?.parentElement?.querySelector<HTMLElement>(
    ":scope > .window-title-bar--app.window-title-bar--mac.window-title-bar--ghost",
  );
  const tools = chrome?.querySelector<HTMLElement>(".window-control-area");
  const spacer = chrome?.querySelector<HTMLElement>(".window-title-bar__mac-spacer");
  const profile = bar?.querySelector<HTMLElement>(".topbar-profile");
  const avatar = profile?.querySelector<HTMLElement>(
    ".user-profile-card__avatar :is(.user-avatar, [role=button], button)",
  );
  const info = profile?.querySelector<HTMLElement>(".user-profile-card__info");
  if (!shell || !view || !bar || !chrome || !tools || !spacer ||
      !profile || !avatar || !info) return;
  return { shell, view, bar, chrome, tools, spacer, profile, avatar, info };
}

function bindTitlebar(win: Window, parts: NonNullable<ReturnType<typeof findTitlebar>>) {
  const { shell, view, chrome, tools, spacer, profile, avatar, info } = parts;
  const doc = win.document;
  const attributes = ["aria-label", "aria-controls", "aria-expanded"] as const;
  const original = attributes.map((name) => avatar.getAttribute(name));
  const originalId = info.getAttribute("id");
  const id = originalId || "virga-titlebar-account";
  const events = new AbortController();
  const { signal } = events;
  const metrics = new Map<string, string>();
  let active = false;
  let search: HTMLElement | undefined;
  let watchedChat: HTMLElement | undefined;

  function setOpen(open: boolean) {
    profile.toggleAttribute(profileAttribute, open);
    avatar.setAttribute("aria-expanded", String(open));
  }

  function setActive(next: boolean) {
    if (active === next) return;
    active = next;
    shell.toggleAttribute(compactAttribute, active);
    if (active) {
      info.id = id;
      avatar.setAttribute("aria-label", "账号资料");
      avatar.setAttribute("aria-controls", id);
      setOpen(false);
    } else {
      profile.removeAttribute(profileAttribute);
      for (const [i, name] of attributes.entries()) {
        const value = original[i];
        if (value == null) avatar.removeAttribute(name);
        else avatar.setAttribute(name, value);
      }
      if (originalId == null) info.removeAttribute("id");
      else info.id = originalId;
    }
  }

  const isOpen = () => profile.hasAttribute(profileAttribute);
  avatar.addEventListener("click", () => {
    if (active) setOpen(!isOpen());
  }, { signal });
  avatar.addEventListener("keydown", (event) => {
    if (!active || event.defaultPrevented || event.repeat ||
        avatar.matches("button, a[href]") || (event.key !== "Enter" && event.key !== " "))
      return;
    event.preventDefault();
    avatar.click();
  }, { signal });
  doc.addEventListener("pointerdown", (event) => {
    if (isOpen() && !event.composedPath().includes(profile)) setOpen(false);
  }, { capture: true, signal });
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || !isOpen())
      return;
    event.preventDefault();
    setOpen(false);
    if (profile.contains(doc.activeElement)) avatar.focus({ preventScroll: true });
  }, { signal });

  function setMetric(name: string, amount: number) {
    const key = "--virga-titlebar-" + name;
    const value = Math.ceil(amount) + "px";
    if (metrics.get(key) === value) return;
    shell.style.setProperty(key, value);
    metrics.set(key, value);
  }

  function watchChat(header: HTMLElement | undefined) {
    if (watchedChat === header) return;
    if (watchedChat) size.unobserve(watchedChat);
    watchedChat = header;
    if (watchedChat) size.observe(watchedChat);
  }

  function measure() {
    const header = chrome.getBoundingClientRect();
    const frame = shell.getBoundingClientRect();
    const control = tools.getBoundingClientRect();
    const nativeRight = spacer.getBoundingClientRect().right;
    const hasInsets = header.height > 0 && frame.width > 0 && control.width > 0;
    const profileInset = Math.max(0, frame.right - control.left) + avatarGap;
    if (hasInsets) {
      setMetric("account-start", Math.max(0, nativeRight - frame.left));
      setMetric("profile-inset", profileInset);
    }
    shell.toggleAttribute(insetsAttribute, hasInsets);
    if (!search || !hasInsets) {
      watchChat(undefined);
      setActive(false);
      view.removeAttribute(emptyAttribute);
      return;
    }

    const finder = search.getBoundingClientRect();
    const workspace = view.getBoundingClientRect();
    const profileWidth = avatar.getBoundingClientRect().width;
    const searchStart = Math.max(12, nativeRight - finder.left);
    const right = profileInset + profileWidth + avatarGap;
    const headers = Array.from(view.querySelectorAll<HTMLElement>(".chat-header"));
    const chat = headers.find((el) => el.offsetWidth > 0 && el.offsetHeight > 0);
    watchChat(chat ?? headers[0]);
    const actions = chat?.querySelector(".panel-header__action");
    const chatWidth = chat?.getBoundingClientRect().width ?? workspace.right - finder.right;
    const actionWidth = actions?.getBoundingClientRect().width ?? 0;

    const fits = profileWidth > 0 &&
      finder.width - searchStart >= 120 && chatWidth >= right + actionWidth + 80;
    if (fits) {
      setMetric("search-start", searchStart);
      setMetric("search-end", finder.right - workspace.left);
      setMetric("profile-width", profileWidth);
      setMetric("right", right);
    }
    setActive(fits);
    view.toggleAttribute(emptyAttribute, fits && !chat);
  }

  const size = new ResizeObserver(measure);
  for (const node of [chrome, spacer, view, tools, avatar]) size.observe(node);
  return {
    parts,
    measure,
    attach(roster: Element | undefined) {
      const next = roster?.matches(".recent-contact") && view.contains(roster)
        ? roster.querySelector<HTMLElement>(":scope > .contact-top-bar") ?? undefined
        : undefined;
      if (search !== next) {
        if (search) size.unobserve(search);
        search = next;
        if (search) size.observe(search);
      }
      measure();
    },
    dispose() {
      size.disconnect();
      events.abort();
      setActive(false);
      view.removeAttribute(emptyAttribute);
      shell.removeAttribute(insetsAttribute);
      for (const name of metrics.keys()) shell.style.removeProperty(name);
    },
  };
}

export function compactTitlebar(win: Window) {
  let mode: "full" | "compact" | undefined;
  let roster: Element | undefined;
  let binding: ReturnType<typeof bindTitlebar> | undefined;
  function reconcile() {
    if (!binding || Object.values(binding.parts).some((node) => !node.isConnected)) {
      binding?.dispose();
      const parts = findTitlebar(win.document);
      binding = parts && bindTitlebar(win, parts);
    }
    binding?.attach(mode === "compact" ? roster : undefined);
  }
  return {
    configure(next: "full" | "compact", railChanged: boolean) {
      if (mode === next && binding) {
        if (railChanged) binding?.measure();
        return;
      }
      mode = next;
      reconcile();
    },
    attach(next: Element | undefined) {
      roster = next;
      reconcile();
    },
    dispose() {
      binding?.dispose();
      binding = undefined;
    },
  };
}
