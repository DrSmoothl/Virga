import type { ThemeRuntime } from "./runtime.ts";
import { mountSettings } from "./settings.tsx";

export function attachLiteLoaderSettings(win: Window, runtime: ThemeRuntime) {
  const doc = win.document;
  const events = new AbortController();
  const { signal } = events;
  const isSettings = () => /^#\/settings?(?:[/?]|$)/.test(win.location.hash);
  let mounted: { view: HTMLElement; unmount: () => void } | undefined;

  function clear() {
    if (!mounted) return;
    mounted.unmount();
    mounted.view.remove();
    mounted = undefined;
  }

  function reconcile() {
    const nav = isSettings() && doc.querySelector<HTMLElement>(
      '.setting-tab .nav-bar.liteloader:has(> .nav-item[data-slug="config_view"]):not(:has(> .nav-item[data-slug="virga"]))',
    );
    if (nav && mounted?.view.parentElement === nav) return;
    clear();
    if (!nav) return;
    const view = doc.createElement("div");
    view.dataset.virgaLiteloaderSettings = "";
    nav.append(view);
    mounted = { view, unmount: mountSettings(view, runtime) };
  }

  const observer = new MutationObserver(reconcile);
  function trackRoute() {
    if (isSettings()) observer.observe(doc, { childList: true, subtree: true });
    else observer.disconnect();
    reconcile();
  }

  function dispose() {
    events.abort();
    observer.disconnect();
    clear();
  }
  win.addEventListener("hashchange", trackRoute, { signal });
  win.addEventListener("popstate", trackRoute, { signal });
  const navigation = (win as Window & { navigation?: EventTarget }).navigation;
  navigation?.addEventListener("navigatesuccess", trackRoute, { signal });
  win.addEventListener("pagehide", (event) => {
    if (!event.persisted) dispose();
  }, { signal });
  trackRoute();
  return dispose;
}
