function state(bar: HTMLElement): boolean | undefined {
  const expanded = bar.getAttribute("aria-expanded");
  if (expanded === "true" || expanded === "false") return expanded === "true";
  const label = bar.querySelector(".pin-collapse-bar__text")?.textContent?.trim();
  if (label === "折叠置顶聊天") return true;
  if (label === "展开置顶聊天") return false;
}

export function pinnedConversations() {
  let enabled = false;
  let roster: Element | undefined;
  let bar: HTMLElement | undefined;
  let expanding: HTMLElement | undefined;
  const track = new MutationObserver(() => {
    if (!bar?.isConnected) reconcile();
  });
  const changes = new MutationObserver(sync);
  function sync() {
    if (!bar) return;
    const expanded = state(bar);
    if (expanded === false && expanding !== bar) {
      expanding = bar;
      bar.click();
    }
    const open = state(bar) === true;
    if (open) expanding = undefined;
    bar.toggleAttribute("data-virga-hide-pin-toggle", open);
  }
  function release() {
    changes.disconnect();
    bar?.removeAttribute("data-virga-hide-pin-toggle");
    expanding = bar = undefined;
  }
  function reconcile() {
    const next = roster?.querySelector<HTMLElement>(".pin-collapse-bar") ?? undefined;
    if (bar !== next) {
      release();
      bar = next;
      if (bar) changes.observe(bar, {
        subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ["aria-expanded"],
      });
    }
    sync();
  }
  function watch() {
    track.disconnect();
    if (enabled && roster) {
      track.observe(roster, { subtree: true, childList: true });
      reconcile();
    } else release();
  }
  return {
    attach(next?: Element) {
      if (roster !== next) {
        roster = next;
        watch();
      }
    },
    configure(hide: boolean) {
      if (enabled !== hide) {
        enabled = hide;
        watch();
      }
    },
    dispose() {
      track.disconnect();
      release();
    },
  };
}
