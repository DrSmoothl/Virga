import { hostConfig } from "./storage.ts";
import { startTheme } from "./runtime.ts";
import { mountSettings } from "./settings.tsx";
import { attachLiteLoaderSettings } from "./liteloader-settings.ts";

const managed = new URL(import.meta.url).searchParams.get("renderer-lifecycle") === "1";
let theme: ReturnType<typeof startTheme> | undefined;
let unmountLiteLoaderSettings: (() => void) | undefined;
const settingsViews = new Map<HTMLElement, () => void>();

export async function activateRenderer() {
  if (theme) throw new Error("Virga 已激活");
  const runtime = startTheme(hostConfig());
  theme = runtime;
  await runtime.ready;
  if (!managed && theme === runtime) {
    unmountLiteLoaderSettings = attachLiteLoaderSettings(window, runtime);
  }
}

export function deactivateRenderer() {
  unmountLiteLoaderSettings?.();
  unmountLiteLoaderSettings = undefined;
  for (const close of settingsViews.values()) close();
  settingsViews.clear();
  theme?.dispose();
  theme = undefined;
}

export function onSettingWindowCreated(view: HTMLElement) {
  if (!theme) throw new Error("Virga 尚未激活");
  settingsViews.get(view)?.();
  settingsViews.set(view, mountSettings(view, theme));
}

if (!managed)
  void activateRenderer().catch((cause) => {
    deactivateRenderer();
    console.error("[Virga] 读取初始外观失败", cause);
  });
