import { describe, expect, it } from "vitest";
import {
  defaults,
  palettes,
  applyPreset,
  presets,
  settingsSchema,
  settingsCSS,
  recordSchema,
} from "../packages/theme/src/index.ts";
describe("外观契约", () => {
  it("为每次读取创建独立的浅深色板", () => {
    const a = defaults(),
      b = defaults();
    a.light.text = "#123456";
    expect(b.light).toEqual(palettes.light);
    expect(a.dark).toEqual(palettes.dark);
  });
  it("切换主题色保留两种外观的独立修改", () => {
    const s = defaults();
    s.dark.canvas = "#010203";
    const next = applyPreset(s, presets[2]);
    expect(next.dark.canvas).toBe("#010203");
    expect(next.light.outgoing).toBe(presets[2].light);
    expect(next.dark.badgeText).toBe(presets[2].darkInk);
    expect(s.light.outgoing).toBe(palettes.light.outgoing);
  });
  it.each([
    { version: 2 },
    { bubbleShape: "broken" },
    { titlebar: "broken" },
    { messageMotion: "off" },
    { fontSize: 200 },
    { lineHeight: 0 },
    { duration: -1 },
    { mode: "nightly" },
    { plugin: true },
  ])("拒绝无效字段 %j", (change) => {
    expect(settingsSchema.safeParse({ ...defaults(), ...change }).success).toBe(
      false,
    );
  });
  it("拒绝颜色字段拼接 CSS", () => {
    const s = defaults();
    expect(
      settingsSchema.safeParse({
        ...s,
        light: { ...s.light, text: "#eee;display:none" },
      }).success,
    ).toBe(false);
  });
  it("保留配置、版本和保存修订号", () => {
    const s = defaults();
    s.dark.accent = "#abcdef";
    s.font = "serif";
    const v = { revision: 5, settings: s };
    expect(recordSchema.parse(JSON.parse(JSON.stringify(v)))).toEqual(v);
  });
  it("读取旧配置时迁移为纯色，保留已有配色和修订号", () => {
    const existing = defaults();
    existing.light.canvas = "#eeeede";
    const record = recordSchema.parse({
      revision: 7,
      settings: {
        ...existing,
        idleScene: "rain",
        backdrop: "image",
        image: "data:image/png;base64,AAAA",
        headerRain: true,
      },
    });
    expect(record).toEqual({
      revision: 7,
      settings: existing,
    });
  });
  it("旧配置保留完整标题栏", () => {
    const { titlebar, ...legacy } = defaults();
    expect(settingsSchema.parse(legacy).titlebar).toBe(titlebar);
  });
  it("补齐旧配置的两种聊天动效，并保留主开关", () => {
    const {
      conversationMotion,
      messageMotion,
      bubbleShape,
      groupAvatars,
      ...legacy
    } = defaults();
    const saved = settingsSchema.parse({ ...legacy, motion: false });
    expect(saved).toEqual({
      ...legacy,
      motion: false,
      conversationMotion,
      messageMotion,
      bubbleShape,
      groupAvatars,
    });
  });
  it("按模式生成系统和宿主规则，固定模式不随系统变化", () => {
    const s = defaults();
    expect(settingsCSS(s)).toContain(".q-theme-tokens-dark");
    expect(settingsCSS({ ...s, mode: "system" })).not.toContain(
      ".q-theme-tokens-dark",
    );
    for (const mode of ["light", "dark"] as const) {
      const css = settingsCSS({ ...s, mode });
      expect(css).not.toContain("@media");
      expect(css).toContain("--virga-canvas:" + s[mode].canvas);
    }
  });
});
