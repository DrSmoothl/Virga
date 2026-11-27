import { defaultNavigation, settingsCSS, type Saved, type Settings } from "@virga/theme";
import base from "./host.css?inline";
import { coverage } from "./coverage.ts";
import surfaceCSS from "./surfaces.css?inline";
import shellCSS from "./shell.css?inline";
import toolbarCSS from "./toolbar.css?inline";
import titlebarCSS from "./titlebar.css?inline";
import { compactTitlebar } from "./titlebar.ts";
import chatCSS from "./chat.css?inline";
import composerCSS from "./composer.css?inline";
import overlayCSS from "./overlays.css?inline";
import navigationCSS from "./navigation.css?inline";
import featureCSS from "./features.css?inline";
import { avatarGroups } from "./avatars.ts";
import { chatMotion } from "./motion.ts";
import { chatComposer } from "./composer.ts";
import { bindConversation } from "./conversation.ts";
import { navigationRail } from "./navigation.ts";
import { filteredNotifications } from "./notifications.ts";
import { channelAppearance } from "./channels.ts";
import { pinnedConversations } from "./pinned.ts";
import { readConfig, writeConfig, type ConfigAPI, type SettingsEdit } from "./storage.ts";

export interface AppearanceState {
  settings?: Settings;
  saving: boolean;
  error?: string;
}

const featureAttributes = {
  styleEmoji: "data-virga-emoji",
  styleNotifications: "data-virga-notifications",
  styleChannels: "data-virga-channels",
  hideMemberActivity: "data-virga-hide-member-activity",
} as const;

export function startTheme(api: ConfigAPI, win: Window = window) {
  const doc = win.document;
  const style = doc.createElement("style");
  style.dataset.virgaStyle = "";
  style.textContent =
    base + toolbarCSS + surfaceCSS + shellCSS + chatCSS + composerCSS +
    overlayCSS + navigationCSS + titlebarCSS + featureCSS;
  const tokens = doc.createElement("style");
  tokens.dataset.virgaSettingsStyle = "";
  const events = new AbortController();
  const channel =
    typeof BroadcastChannel === "function"
      ? new BroadcastChannel("virga:appearance:v1")
      : null;
  const avatars = avatarGroups(win);
  const motion = chatMotion(win, avatars.flushPending);
  const composer = chatComposer(win);
  const navigation = navigationRail(win, () =>
    update((s) => ({ ...s, navigation: defaultNavigation() })),
  );
  const notifications = filteredNotifications(win);
  const channels = channelAppearance(win);
  const pins = pinnedConversations();
  const titlebar = compactTitlebar(win);
  const coverageCheck = coverage(win, motion.played);
  let unbindConversation: (() => void) | undefined;
  let current: Saved | undefined;
  let disposed = false;
  let reading: Promise<void> | undefined;
  let refreshRequested = false;
  let timer = 0;
  let pending: SettingsEdit[] = [];
  let active: SettingsEdit[] | undefined;
  let failure: string | undefined;
  const listeners = new Set<(state: AppearanceState) => void>();
  function snapshot(): AppearanceState {
    const settings = current &&
      [...(active ?? []), ...pending].reduce((value, edit) => edit(value), current.settings);
    return { settings, saving: !!active || pending.length > 0, error: failure };
  }
  function publish() {
    if (disposed || listeners.size === 0) return;
    const state = snapshot();
    for (const listener of listeners) listener(state);
  }
  function failed(operation: string, cause: unknown) {
    failure = cause instanceof Error ? cause.message : String(cause);
    console.error("[Virga] " + operation, cause);
  }
  const apply = (record: Saved) => {
    if (disposed) return;
    if (
      current &&
      (current.revision > record.revision ||
        (current.revision === record.revision &&
          JSON.stringify(current.settings) === JSON.stringify(record.settings)))
    )
      return;
    const { settings } = record;
    tokens.textContent = settingsCSS(settings);
    if (!style.isConnected) (doc.head ?? doc.documentElement).append(style, tokens);
    const root = doc.documentElement;
    root.setAttribute("data-virga", "");
    root.dataset.virgaBubbles = settings.bubbleShape;
    root.toggleAttribute("data-virga-motion", settings.motion && settings.duration > 0);
    for (const [key, attribute] of Object.entries(featureAttributes))
      root.toggleAttribute(attribute, settings[key as keyof typeof featureAttributes]);
    motion.configure(settings);
    avatars.configure(settings.groupAvatars);
    titlebar.configure(
      settings.titlebar,
      current?.settings.navigation.autoHide !== settings.navigation.autoHide,
      settings.motion ? settings.duration : 0,
      () => navigation.configure(settings.navigation),
    );
    notifications.configure(settings.styleNotifications);
    channels.configure(settings);
    pins.configure(settings.hidePinnedToggle);
    unbindConversation ??= bindConversation(win, (pane, roster) => {
      avatars.attach(pane);
      motion.attach(pane, roster);
      composer.attach(pane);
      pins.attach(roster);
      titlebar.attach(roster);
    });
    current = record;
    root.dataset.virgaRevision = String(record.revision);
  };
  function refresh() {
    refreshRequested = true;
    reading ??= Promise.resolve().then(async () => {
      try {
        while (refreshRequested && !disposed) {
          refreshRequested = false;
          apply(await readConfig(api));
          publish();
        }
      } finally {
        reading = undefined;
        if (refreshRequested && !disposed) reload();
      }
    });
    return reading;
  }
  function readFailed(cause: unknown) {
    failed("读取外观失败", cause);
    publish();
  }
  function reload() {
    if (disposed) return;
    const alreadyReading = !!reading;
    const task = refresh();
    if (!alreadyReading) void task.catch(readFailed);
  }
  function schedule() {
    if (!active && !timer && pending.length)
      timer = win.setTimeout(() => {
        timer = 0;
        void flush();
      }, 90);
  }
  async function flush() {
    if (active || !pending.length) return;
    const edits = pending;
    active = edits;
    pending = [];
    try {
      const record = await writeConfig(api, (settings) =>
        edits.reduce((value, edit) => edit(value), settings),
      );
      if (!disposed) {
        apply(record);
        failure = undefined;
        channel?.postMessage("changed");
      }
    } catch (cause) {
      failed("自动保存外观失败", cause);
    } finally {
      active = undefined;
      publish();
      if (disposed) void flush();
      else schedule();
    }
  }
  function update(edit: SettingsEdit) {
    if (!current || disposed) throw Error("Virga 配置未就绪");
    pending.push(edit);
    publish();
    schedule();
  }
  channel?.addEventListener("message", (e) => {
    if (e.data === "changed") reload();
  });
  win.addEventListener("extension-config-changed", (e) => {
    if (e instanceof CustomEvent && e.detail === "virga") reload();
  }, { signal: events.signal });
  win.addEventListener("focus", reload, { signal: events.signal });
  doc.addEventListener(
    "visibilitychange",
    () => {
      if (doc.visibilityState === "visible") reload();
      else void flush();
    },
    { signal: events.signal },
  );
  win.addEventListener("pageshow", reload, { signal: events.signal });
  function dispose() {
    if (disposed) return;
    disposed = true;
    win.clearTimeout(timer);
    void flush();
    events.abort();
    channel?.close();
    listeners.clear();
    unbindConversation?.();
    motion.dispose();
    avatars.dispose();
    composer.dispose();
    navigation.dispose();
    notifications.dispose();
    channels.dispose();
    pins.dispose();
    titlebar.dispose();
    coverageCheck.dispose();
    doc.documentElement.removeAttribute("data-virga-bubbles");
    doc.documentElement.removeAttribute("data-virga-motion");
    doc.documentElement.removeAttribute("data-virga-revision");
    for (const attribute of Object.values(featureAttributes))
      doc.documentElement.removeAttribute(attribute);
    style.remove();
    tokens.remove();
    doc.documentElement.removeAttribute("data-virga");
  }
  win.addEventListener(
    "pagehide",
    (e) => {
      if (!e.persisted) dispose();
    },
    { signal: events.signal },
  );
  const ready = refresh();
  return {
    ready,
    inspect: coverageCheck.inspect,
    async retry() {
      failure = undefined;
      await refresh().catch(readFailed);
    },
    snapshot,
    subscribe(listener: (state: AppearanceState) => void) {
      listeners.add(listener);
      listener(snapshot());
      return () => { listeners.delete(listener); };
    },
    update,
    dispose,
  };
}
export type ThemeRuntime = ReturnType<typeof startTheme>;
