import { z } from "zod";

export const colorLabels = {
  canvas: "聊天底色",
  list: "会话列表",
  rail: "导航栏",
  railText: "导航图标",
  panel: "输入区与面板",
  line: "分隔线",
  text: "正文",
  muted: "次要文字",
  accent: "主题色",
  onAccent: "主题色上的文字",
  link: "链接",
  selected: "选中行",
  incoming: "收到的气泡",
  incomingText: "收到的文字",
  outgoing: "发出的气泡",
  outgoingText: "发出的文字",
  badge: "未读徽标",
  badgeText: "徽标文字",
} as const;
export type ColorKey = keyof typeof colorLabels;
export const colorKeys = Object.keys(colorLabels) as [ColorKey, ...ColorKey[]];
const hex = z.string().regex(/^#[\da-f]{6}$/i, "请输入六位十六进制颜色");
const palette = z.record(z.enum(colorKeys), hex);
export type Palette = z.infer<typeof palette>;
export type Scheme = "light" | "dark";

export const palettes: Record<Scheme, Palette> = {
  light: {
    canvas: "#fcfcfa",
    list: "#f5f6f4",
    rail: "#293237",
    railText: "#d4dfe1",
    panel: "#f2f3f1",
    line: "#dce1df",
    text: "#232c31",
    muted: "#647077",
    accent: "#526d80",
    onAccent: "#ffffff",
    link: "#435f72",
    selected: "#dbe2e4",
    incoming: "#edf0ed",
    incomingText: "#232c31",
    outgoing: "#526d80",
    outgoingText: "#ffffff",
    badge: "#526d80",
    badgeText: "#ffffff",
  },
  dark: {
    canvas: "#20272b",
    list: "#252d31",
    rail: "#192024",
    railText: "#c4d0d4",
    panel: "#282f33",
    line: "#394247",
    text: "#ecf0ed",
    muted: "#9ca9ae",
    accent: "#9fb5c3",
    onAccent: "#17232c",
    link: "#b4c8d4",
    selected: "#39464d",
    incoming: "#30393e",
    incomingText: "#ecf0ed",
    outgoing: "#9fb5c3",
    outgoingText: "#17232c",
    badge: "#9fb5c3",
    badgeText: "#17232c",
  },
};

export const ranges = {
  fontSize: { label: "消息字号", min: 12, max: 24, step: 1, unit: "px" },
  lineHeight: { label: "消息行高", min: 1.2, max: 2.0, step: 0.05, unit: "×" },
  bubbleRadius: { label: "气泡圆角", min: 0, max: 28, step: 1, unit: "px" },
  bubblePadding: { label: "气泡内边距", min: 4, max: 18, step: 1, unit: "px" },
  controlRadius: { label: "控件圆角", min: 0, max: 16, step: 1, unit: "px" },
  avatarRadius: { label: "头像圆度", min: 0, max: 50, step: 1, unit: "%" },
  duration: { label: "过渡时间", min: 0, max: 300, step: 10, unit: "ms" },
} as const;
export const navigationItems = {
  messages: "消息",
  contacts: "联系人",
  space: "空间",
  channels: "频道",
  games: "游戏",
  more: "更多应用",
  mail: "邮箱",
  phone: "我的手机",
  settings: "设置入口",
} as const;
export type NavigationItem = keyof typeof navigationItems;
const navigationItem = z.enum(Object.keys(navigationItems) as NavigationItem[]);
export function defaultNavigation() {
  return {
    autoHide: false,
    hidden: [] as NavigationItem[],
    hiddenBadges: [] as NavigationItem[],
  };
}
const navigation = z.strictObject({
  autoHide: z.boolean(),
  hidden: z.array(navigationItem).max(Object.keys(navigationItems).length),
  hiddenBadges: z.array(navigationItem).max(Object.keys(navigationItems).length),
});
export type Metric = keyof typeof ranges;
const numeric = (k: Metric) => z.number().min(ranges[k].min).max(ranges[k].max);
const oldBackgroundKeys = [
  "backdrop",
  "backdropStrength",
  "image",
  "headerRain",
  "idleScene",
  "sceneStrength",
  "sceneWordmark",
];
export const settingsSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    // Saved v1 records may contain background controls removed from the panel.
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => !oldBackgroundKeys.includes(key)),
    );
  },
  z.strictObject({
    version: z.literal(1),
    mode: z.enum(["host", "system", "light", "dark"]),
    light: palette,
    dark: palette,
    font: z.enum(["host", "sans", "serif", "mono"]),
    fontSize: numeric("fontSize"),
    lineHeight: numeric("lineHeight"),
    bubbleRadius: numeric("bubbleRadius"),
    bubblePadding: numeric("bubblePadding"),
    controlRadius: numeric("controlRadius"),
    avatarRadius: numeric("avatarRadius"),
    groupAvatars: z.boolean().default(true),
    bubbleShape: z.enum(["directional", "round"]).default("directional"),
    motion: z.boolean(),
    conversationMotion: z.boolean().default(true),
    messageMotion: z.boolean().default(true),
    duration: numeric("duration"),
    navigation: navigation.default(defaultNavigation),
    titlebar: z.enum(["full", "compact"]).default("full"),
    styleEmoji: z.boolean().default(true),
    styleNotifications: z.boolean().default(true),
    styleChannels: z.boolean().default(true),
    hideMemberActivity: z.boolean().default(false),
    hidePinnedToggle: z.boolean().default(false),
  }),
);
export type Settings = z.infer<typeof settingsSchema>;
export function defaults(): Settings {
  return {
    version: 1,
    mode: "host",
    light: { ...palettes.light },
    dark: { ...palettes.dark },
    font: "host",
    fontSize: 14,
    lineHeight: 1.55,
    bubbleRadius: 13,
    bubblePadding: 9,
    controlRadius: 7,
    avatarRadius: 50,
    groupAvatars: true,
    bubbleShape: "directional",
    motion: true,
    conversationMotion: true,
    messageMotion: true,
    duration: 200,
    navigation: defaultNavigation(),
    titlebar: "full",
    styleEmoji: true,
    styleNotifications: true,
    styleChannels: true,
    hideMemberActivity: false,
    hidePinnedToggle: false,
  };
}
export const presets = [
  {
    name: "雨青",
    light: "#526d80",
    dark: "#9fb5c3",
    lightInk: "#ffffff",
    darkInk: "#17232c",
  },
  {
    name: "石墨",
    light: "#484f53",
    dark: "#a6adae",
    lightInk: "#ffffff",
    darkInk: "#20272b",
  },
  {
    name: "银雾",
    light: "#abb9bf",
    dark: "#c8d2d5",
    lightInk: "#213038",
    darkInk: "#182329",
  },
] as const;
export function applyPreset(
  settings: Settings,
  preset: (typeof presets)[number],
): Settings {
  const colors = (scheme: Scheme) => {
    const accent = preset[scheme],
      ink = scheme === "light" ? preset.lightInk : preset.darkInk;
    return {
      ...settings[scheme],
      accent,
      onAccent: ink,
      outgoing: accent,
      outgoingText: ink,
      badge: accent,
      badgeText: ink,
    };
  };
  return { ...settings, light: colors("light"), dark: colors("dark") };
}
export const recordSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  settings: settingsSchema,
});
export type Saved = z.infer<typeof recordSchema>;
export const firstRecord = (): Saved => ({ revision: 0, settings: defaults() });
