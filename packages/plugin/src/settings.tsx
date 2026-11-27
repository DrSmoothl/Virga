import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  applyPreset,
  colorKeys,
  colorLabels,
  defaultNavigation,
  defaults,
  navigationItems,
  paletteDeclarations,
  presets,
  ranges,
  settingsSchema,
  type Metric,
  type NavigationItem,
  type Scheme,
  type Settings,
} from "@virga/theme";
import { playChatEffect } from "./motion.ts";
import { navigationShortcut } from "./navigation.ts";
import type { ThemeRuntime } from "./runtime.ts";
import { Choices } from "./settings-choice.tsx";
import type { SettingsEdit } from "./storage.ts";
import sheet from "./settings.css?inline";
import wordmark from "../assets/wordmark.svg?url";
import overview from "../assets/overview.png?inline";

const sections = ["概览", "配色", "文字与形状", "界面", "动效", "配置文件"] as const;
const schemes = ["light", "dark"] as const;
const modeOptions = {
  host: "跟随 QQ",
  system: "跟随系统",
  light: "浅色",
  dark: "深色",
} as const;
const fontOptions = {
  host: "跟随 QQ",
  sans: "系统无衬线",
  serif: "衬线",
  mono: "等宽",
} as const;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function useScheme(mode: Settings["mode"]): Scheme {
  const read = (): Scheme => {
    if (mode === "light" || mode === "dark") return mode;
    if (mode === "host") {
      for (const el of [document.body, document.documentElement])
        for (const tone of schemes)
          if (
            el?.matches(
              `.q-theme-tokens-${tone},[q-theme="${tone}"],[data-theme="${tone}"],[qq-theme="${tone}"]`,
            )
          )
            return tone;
    }
    return window.matchMedia("(prefers-color-scheme:dark)").matches
      ? "dark"
      : "light";
  };
  const [tone, setTone] = useState(read);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme:dark)");
    const update = () => setTone(read());
    const observer = new MutationObserver(update);
    for (const el of [document.documentElement, document.body])
      if (el)
        observer.observe(el, {
          attributes: true,
          attributeFilter: ["class", "q-theme", "data-theme", "qq-theme"],
        });
    media.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, [mode]);
  return tone;
}

function Check({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (checked: boolean) => void;
}) {
  return (
    <label class="check">
      <span>{label}</span>
      <input type="checkbox" checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)} />
    </label>
  );
}
function Slider({
  name,
  value,
  onChange,
}: {
  name: Metric;
  value: number;
  onChange: (v: number) => void;
}) {
  const r = ranges[name];
  const displayValue = value + r.unit;
  const progress = (100 * (value - r.min)) / (r.max - r.min);
  return (
    <label class="slider">
      <span>{r.label}</span>
      <input
        aria-label={r.label}
        type="range"
        min={r.min}
        max={r.max}
        step={r.step}
        value={value}
        aria-valuetext={displayValue}
        style={{ "--slider-progress": progress + "%" }}
        onInput={(e) => onChange(e.currentTarget.valueAsNumber)}
      />
      <output aria-hidden="true">{displayValue}</output>
    </label>
  );
}
function Preview({
  s,
  scheme,
  audition,
  select,
}: {
  s: Settings;
  scheme: Scheme;
  audition: boolean;
  select: (v: Scheme) => void;
}) {
  const sample = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReduced(preference.matches);
    preference.addEventListener("change", changed);
    return () => preference.removeEventListener("change", changed);
  }, []);
  const playable =
    s.motion &&
    s.duration > 0 &&
    (s.messageMotion || s.conversationMotion) &&
    !reduced;
  function previewMotion() {
    if (!playable || !sample.current) return;
    for (const a of sample.current.getAnimations({ subtree: true }))
      if (a.id.startsWith("virga-chat-")) a.cancel();
    for (const [selector, kind] of [
      [".sample-chat", "enter"],
      [".sample-in", "in"],
      [".sample-out", "out"],
    ] as const) {
      const el = sample.current.querySelector(selector);
      if (el && (kind === "enter" ? s.conversationMotion : s.messageMotion))
        playChatEffect(el, kind, s.duration);
    }
  }
  const p = s[scheme];
  const style = Object.fromEntries(
    paletteDeclarations(p)
      .split(";")
      .map((item) => item.split(":")),
  );
  return (
    <>
      <div
        ref={sample}
        class="sample"
        data-shape={s.bubbleShape}
        aria-label="消息外观预览"
        style={{
          ...style,
          "--sample-radius": s.bubbleRadius + "px",
          "--sample-pad": s.bubblePadding + "px",
          "--sample-font-size": s.fontSize + "px",
          "--sample-line": s.lineHeight,
          "--sample-font": {
            host: "inherit",
            sans: "system-ui, sans-serif",
            serif: "serif",
            mono: "monospace",
          }[s.font],
        }}
      >
        <div class="sample-heading">
          <span>对话预览</span>
          <div class="scheme" role="group" aria-label="预览与编辑色板">
            {schemes.map((x) => (
              <button
                type="button"
                key={x}
                aria-pressed={scheme === x}
                onClick={() => select(x)}
              >
                {x === "light" ? "浅色" : "深色"}
              </button>
            ))}
          </div>
        </div>
        <div class="sample-chat">
          <span class="sample-in">外面的雨停了吗？</span>
          <span class="sample-out">还悬在云下。</span>
        </div>
      </div>
      {audition && (
        <div class="audition">
          <button type="button" disabled={!playable} onClick={previewMotion}>
            预览聊天动效
          </button>
        </div>
      )}
    </>
  );
}
function Panel({ runtime, close }: { runtime: ThemeRuntime; close?: () => void }) {
  const [appearance, setAppearance] = useState(runtime.snapshot);
  const draft = appearance.settings ?? defaults();
  useEffect(() => runtime.subscribe(setAppearance), [runtime]);
  const [section, setSection] = useState<(typeof sections)[number]>("概览"),
    [editingScheme, setScheme] = useState<Scheme | undefined>();
  const activeScheme = useScheme(draft.mode);
  const scheme = editingScheme ?? activeScheme;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [report, setReport] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmHideSettings, setConfirmHideSettings] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const page = useRef<HTMLElement>(null);
  const shortcut = navigationShortcut(window);
  function edit(update: SettingsEdit) {
    setConfirmReset(false);
    setError("");
    runtime.update(update);
  }
  function change<T extends keyof Settings>(key: T, value: Settings[T]) {
    edit((s) => ({ ...s, [key]: value }));
  }
  function railEntry(field: "hidden" | "hiddenBadges", item: NavigationItem, hide: boolean) {
    edit((s) => {
      const entries = s.navigation[field].filter((v) => v !== item);
      if (hide) entries.push(item);
      return { ...s, navigation: { ...s.navigation, [field]: entries } };
    });
  }
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify(draft, null, 2) + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "virga-settings.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file: File) {
    if (file.size > 512 * 1024) throw Error("配置文件请小于 512 KiB");
    const result = settingsSchema.safeParse(JSON.parse(await file.text()));
    if (!result.success)
      throw Error(
        "配置无效 · " +
          result.error.issues
            .map((i) => i.path.join(".") + " " + i.message)
            .join(" / "),
      );
    edit(() => result.data);
  }
  const metric = (key: Metric) => (
    <Slider
      key={key}
      name={key}
      value={draft[key]}
      onChange={(v) => change(key, v)}
    />
  );
  return (
    <main class="settings">
      <aside class="settings-sidebar">
        <div class="wordmark" role="img" aria-label="Virga 悬雨"
          style={{ "--wordmark": 'url("' + wordmark + '")' }} />
        <nav aria-label="外观选项">
          {sections.map((x) => (
            <button key={x} aria-pressed={section === x}
              onClick={() => {
                if (section === x) return;
                setSection(x);
                setConfirmReset(false);
                setConfirmHideSettings(false);
                if (page.current) page.current.scrollTop = 0;
              }}
            >{x}</button>
          ))}
        </nav>
      </aside>
      <section class="settings-page" ref={page} aria-label={section}>
      <header class="page-header">
        <h1>{section}</h1>
        {close && <button class="window-close" type="button" aria-label="关闭 Virga 设置" onClick={close}>×</button>}
      </header>
      {(error || appearance.error) && (
        <div class="problem" role="alert">
          {error || appearance.error}{" "}
          {appearance.error && (
            <button type="button" disabled={busy || appearance.saving}
              onClick={() => void task(runtime.retry)}>
              重新读取
            </button>
          )}
        </div>
      )}
      {section === "概览" && (
        <div class="overview">
          <figure class="overview-art">
            <img src={overview} alt="Virga 悬雨，雨幕悬在远山上方" />
          </figure>
          <dl class="overview-status">
            <div><dt>界面模式</dt><dd>{modeOptions[draft.mode]}</dd></div>
            <div><dt>当前主题色</dt><dd><i style={{ backgroundColor: draft[activeScheme].accent }} />
              {presets.find((preset) => preset[activeScheme] === draft[activeScheme].accent)?.name ?? draft[activeScheme].accent.toUpperCase()}
            </dd></div>
            <div><dt>导航栏</dt><dd>{draft.navigation.autoHide ? "自动收回" : "常驻"}</dd></div>
          </dl>
        </div>
      )}
      <fieldset disabled={!appearance.settings || busy} inert={!appearance.settings || busy}>
        {section === "配色" && (
          <>
            <Preview
              s={draft}
              scheme={scheme}
              select={setScheme}
              audition={false}
            />
            <div class="presets row">
              <span id="virga-presets-label">主题色</span>
              <div class="preset-choices" role="group" aria-labelledby="virga-presets-label">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    aria-pressed={schemes.every(
                      (k) => draft[k].accent === p[k],
                    )}
                    onClick={() => edit((s) => applyPreset(s, p))}
                  >
                    <i aria-hidden="true" style={{ background: p[scheme] }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <Choices
              label="界面模式"
              value={draft.mode}
              options={modeOptions}
              onChange={(v) => {
                setScheme(undefined);
                change("mode", v);
              }}
            />
            <details class="palette">
              <summary>
                自定义{scheme === "light" ? "浅色" : "深色"}色板{" "}
                <span aria-hidden="true" class="palette-chips">
                  {(["list", "panel", "accent", "outgoing"] as const).map(
                    (k) => (
                      <i style={{ background: draft[scheme][k] }} />
                    ),
                  )}
                </span>
              </summary>
              <div class="colors">
                {colorKeys.map((k) => (
                  <label key={k} class="swatch">
                    <span>{colorLabels[k]}</span>
                    <small>{draft[scheme][k].toUpperCase()}</small>
                    <input
                      aria-label={colorLabels[k]}
                      type="color"
                      value={draft[scheme][k]}
                      onInput={(e) => {
                        const color = e.currentTarget.value;
                        edit((s) => ({ ...s, [scheme]: { ...s[scheme], [k]: color } }));
                      }}
                    />
                  </label>
                ))}
              </div>
            </details>
          </>
        )}
        {section === "文字与形状" && (
          <>
            <Preview
              s={draft}
              scheme={scheme}
              select={setScheme}
              audition={false}
            />
            <label class="check">
              <span>合并连续消息头像</span>
              <input
                type="checkbox"
                checked={draft.groupAvatars}
                onChange={(e) =>
                  change("groupAvatars", e.currentTarget.checked)
                }
              />
            </label>
            <Choices
              label="气泡形状"
              value={draft.bubbleShape}
              options={{ directional: "靠头像一侧收角", round: "均匀圆角" }}
              onChange={(v) => change("bubbleShape", v)}
            />
            <Choices
              label="消息字体"
              value={draft.font}
              options={fontOptions}
              onChange={(v) => change("font", v)}
            />
            {(
              [
                "fontSize",
                "lineHeight",
                "bubbleRadius",
                "bubblePadding",
                "controlRadius",
                "avatarRadius",
              ] as const
            ).map(metric)}
          </>
        )}
        {section === "界面" && (
          <>
            {/Mac/i.test(window.navigator.platform) && (
              <Choices
                label="标题栏"
                value={draft.titlebar}
                options={{ full: "完整", compact: "紧凑" }}
                onChange={(value) => change("titlebar", value)}
              />
            )}
            <Check label="导航栏自动收回" checked={draft.navigation.autoHide}
              onChange={(autoHide) => edit((s) => ({
                ...s, navigation: { ...s.navigation, autoHide },
              }))} />
            <div class="row rail-actions">
              <h2>导航项目</h2>
              <button type="button" aria-keyshortcuts={shortcut.aria}
                onClick={() => {
                  setConfirmHideSettings(false);
                  change("navigation", defaultNavigation());
                }}>恢复导航栏 <kbd>{shortcut.label}</kbd></button>
            </div>
            <table class="rail-items">
              <thead>
                <tr><th scope="col">入口</th><th scope="col">显示入口</th><th scope="col">显示角标</th></tr>
              </thead>
              <tbody>
                {(Object.entries(navigationItems) as [NavigationItem, string][]).map(([id, label]) => (
                  <tr key={id}>
                    <th scope="row">{label}</th>
                    <td>
                      {id === "settings" && !draft.navigation.hidden.includes(id) ? (
                        <button type="button" class="rail-hide-settings" onClick={() => setConfirmHideSettings(true)}>
                          隐藏
                        </button>
                      ) : (
                        <input type="checkbox" aria-label={"显示" + label}
                          checked={!draft.navigation.hidden.includes(id)}
                          onChange={(e) => railEntry("hidden", id, !e.currentTarget.checked)} />
                      )}
                    </td>
                    <td>
                      <input type="checkbox" aria-label={"显示" + label + "角标"}
                        checked={!draft.navigation.hiddenBadges.includes(id)}
                        onChange={(e) => railEntry("hiddenBadges", id, !e.currentTarget.checked)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {confirmHideSettings && (
              <div class="problem rail-warning" role="group" aria-label="隐藏设置入口确认">
                <p>底部主菜单包含 QQ 设置。按 <kbd>{shortcut.label}</kbd> 可恢复全部导航入口和角标。</p>
                <button type="button" onClick={() => setConfirmHideSettings(false)}>取消</button>
                <button type="button" onClick={() => {
                  railEntry("hidden", "settings", true);
                  setConfirmHideSettings(false);
                }}>确认隐藏设置入口</button>
              </div>
            )}
            <Check label="隐藏群成员的「更新说说」" checked={draft.hideMemberActivity}
              onChange={(v) => change("hideMemberActivity", v)} />
            <Check label="隐藏「折叠置顶聊天」" checked={draft.hidePinnedToggle}
              onChange={(v) => change("hidePinnedToggle", v)} />
            <Check label="表情面板主题样式" checked={draft.styleEmoji}
              onChange={(v) => change("styleEmoji", v)} />
            <Check label="好友与群聊通知主题样式" checked={draft.styleNotifications}
              onChange={(v) => change("styleNotifications", v)} />
            <Check label="频道主题样式" checked={draft.styleChannels}
              onChange={(v) => change("styleChannels", v)} />
          </>
        )}
        {section === "动效" && (
          <>
            <Preview s={draft} scheme={scheme} select={setScheme} audition />
            <label class="check">
              <span>交互动效</span>
              <input
                type="checkbox"
                checked={draft.motion}
                onChange={(e) => change("motion", e.currentTarget.checked)}
              />
            </label>
            {draft.motion && (
              <>
                <label class="check">
                  <span>切换会话动效</span>
                  <input
                    type="checkbox"
                    checked={draft.conversationMotion}
                    onChange={(e) =>
                      change("conversationMotion", e.currentTarget.checked)
                    }
                  />
                </label>
                <label class="check">
                  <span>新消息入场</span>
                  <input
                    type="checkbox"
                    checked={draft.messageMotion}
                    onChange={(e) =>
                      change("messageMotion", e.currentTarget.checked)
                    }
                  />
                </label>
                {metric("duration")}
              </>
            )}
          </>
        )}
        {section === "配置文件" && (
          <>
            <div class="row file-row">
              <span>界面检查</span>
              <button
                type="button"
                onClick={() =>
                  void task(async () => setReport(await runtime.inspect()))
                }
              >
                检查当前界面
              </button>
            </div>
            {report && (
              <output class="coverage">
                {report
                  .split("\n")
                  .filter(Boolean)
                  .map((part, i) => (
                    <p key={i}>{part}</p>
                  ))}
              </output>
            )}
            <div class="row file-row">
              <span>外观配置</span>
              <div>
                <button onClick={() => importRef.current?.click()}>
                  导入 JSON
                </button>
                <button onClick={download}>导出 JSON</button>
              </div>
            </div>
            <input
              ref={importRef}
              hidden
              type="file"
              accept=".json,application/json"
              aria-label="导入外观配置"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (f) void task(() => importFile(f));
              }}
            />
            <div class="row file-row">
              <span>默认外观</span>
              {confirmReset ? (
                <div>
                  <button onClick={() => setConfirmReset(false)}>取消</button>
                  <button
                    onClick={() => {
                      edit(defaults);
                    }}
                  >
                    确认恢复
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmReset(true)}>恢复默认</button>
              )}
            </div>
          </>
        )}
      </fieldset>
      <footer>
        <span role="status">
          {busy
            ? "处理中…"
            : appearance.saving ? "正在应用…" : appearance.error ? "配置未同步"
              : appearance.settings ? "已与配置同步" : "读取配置中…"}
        </span>
      </footer>
      </section>
    </main>
  );
}

function SettingsDialog({ runtime }: { runtime: ThemeRuntime }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button class="launch-settings" type="button" onClick={() => dialog.current!.showModal()}>
        打开 Virga 设置
      </button>
      <dialog class="settings-dialog" ref={dialog} aria-label="Virga 悬雨">
        <Panel runtime={runtime} close={() => dialog.current!.close()} />
      </dialog>
    </>
  );
}
export function mountSettings(view: HTMLElement, runtime: ThemeRuntime) {
  let root = view.querySelector<HTMLElement>(":scope > [data-virga-settings]");
  if (!root) {
    root = document.createElement("div");
    root.dataset.virgaSettings = "";
    view.append(root);
  }
  const standalone = view.dataset.settingsPresentation === "window";
  root.toggleAttribute("data-virga-settings-window", standalone);
  const shadow = root.shadowRoot ?? root.attachShadow({ mode: "open" });
  render(
    <>
      <style>{sheet}</style>
      {standalone ? <Panel runtime={runtime} /> : <SettingsDialog runtime={runtime} />}
    </>,
    shadow,
  );
  return () => {
    render(null, shadow);
    root.remove();
  };
}
