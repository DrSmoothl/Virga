import { settingsCSS, type Settings } from "@virga/theme";
import sheet from "./channels.css?inline";
import toolbar from "./toolbar.css?inline";

const selector = ".guild-layout-wrapper webview.guild-webview";
const origin = "https://pd.qq.com";
interface ChannelGuest extends HTMLElement {
  getURL(): string;
  insertCSS(css: string): Promise<string>;
  removeInsertedCSS(key: string): Promise<void>;
}

function bindGuest(view: ChannelGuest) {
  const events = new AbortController();
  let generation = 0, request = 0;
  let desired = "";
  let installed: { key: string; css: string } | undefined;
  let queue = Promise.resolve();

  function source() {
    try {
      return view.getURL();
    } catch (cause) {
      if (cause instanceof Error && /dom-ready/.test(cause.message)) return "";
      throw cause;
    }
  }
  function apply() {
    const id = ++request;
    const page = generation;
    queue = queue.then(async () => {
      if (!view.isConnected || id !== request || page !== generation) return;
      const url = source();
      if (!url || new URL(url).origin !== origin) return;
      if (installed?.css === desired || (!desired && !installed)) return;
      const previous = installed;
      const css = desired;
      const key = css ? await view.insertCSS(css) : "";
      if (page !== generation || !view.isConnected) return;
      installed = key ? { key, css } : undefined;
      if (previous) await view.removeInsertedCSS(previous.key);
    }).catch((cause: unknown) => {
      if (page === generation && view.isConnected)
        console.error("[Virga] 同步频道外观失败", cause);
    });
  }
  view.addEventListener("load-commit", (e) => {
    if ((e as Event & { isMainFrame?: boolean }).isMainFrame) {
      generation++;
      installed = undefined;
    }
  }, { signal: events.signal });
  view.addEventListener("dom-ready", apply, { signal: events.signal });
  view.addEventListener("did-navigate-in-page", apply, { signal: events.signal });
  return {
    view,
    configure(css: string) {
      if (css === desired) return;
      desired = css;
      apply();
    },
    dispose() {
      events.abort();
      desired = "";
      apply();
    },
  };
}

export function channelAppearance(win: Window) {
  const doc = win.document;
  let guest: ReturnType<typeof bindGuest> | undefined;
  let css = "";
  function reconcile() {
    const node = css ? doc.querySelector<ChannelGuest>(selector) : null;
    if (guest?.view === node) return;
    guest?.dispose();
    guest = node && typeof node.insertCSS === "function" ? bindGuest(node) : undefined;
    guest?.configure(css);
  }
  const observer = new MutationObserver((records) => {
    if (guest?.view.isConnected) return;
    if (records.some((r) => [...r.addedNodes].some((n) =>
      n instanceof Element && (n.matches(selector) || n.querySelector(selector)))))
      reconcile();
  });
  return {
    configure(settings: Settings) {
      const next = settings.styleChannels ? settingsCSS(settings, ":root") + toolbar + sheet : "";
      if (next === css) return;
      if (!css && next) observer.observe(doc.documentElement, { childList: true, subtree: true });
      if (!next) observer.disconnect();
      css = next;
      if (guest?.view.isConnected && css) guest.configure(css);
      else reconcile();
    },
    dispose() {
      observer.disconnect();
      guest?.dispose();
      guest = undefined;
    },
  };
}
