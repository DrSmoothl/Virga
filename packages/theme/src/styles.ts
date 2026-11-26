import { colorKeys, type Palette, type Settings } from "./config.ts";
const fonts = {
  host: "inherit",
  sans: "system-ui, sans-serif",
  serif: '"Songti SC", "Noto Serif CJK SC", serif',
  mono: 'ui-monospace, "SFMono-Regular", monospace',
};
const cssName = (name: string) =>
  name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

type RGB = [number, number, number];

function rgb(hex: string): RGB {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function linear(channel: number) {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]: RGB) {
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function readableText(preferred: string, background: string) {
  const surface = luminance(rgb(background));
  const contrast = (channels: RGB) => {
    const ink = luminance(channels);
    return (Math.max(surface, ink) + 0.05) / (Math.min(surface, ink) + 0.05);
  };
  const source = rgb(preferred);
  if (contrast(source) >= 4.5) return preferred;

  const target = contrast([0, 0, 0]) > contrast([255, 255, 255]) ? 0 : 255;
  let low = 0;
  let high = 1;
  let result: RGB = [target, target, target];
  const [red, green, blue] = source;
  // Find a tint or shade that reaches 4.5:1 after rounding the RGB channels.
  for (let step = 0; step < 8; step++) {
    const amount = (low + high) / 2;
    const mix = (channel: number) =>
      Math.round(channel + (target - channel) * amount);
    const candidate: RGB = [mix(red), mix(green), mix(blue)];
    if (contrast(candidate) >= 4.5) {
      high = amount;
      result = candidate;
    } else low = amount;
  }
  return (
    "#" + result.map((channel) => channel.toString(16).padStart(2, "0")).join("")
  );
}

export const paletteDeclarations = (p: Palette) =>
  [
    ...colorKeys.map((k) => "--virga-" + cssName(k) + ":" + p[k]),
    "--virga-mention-incoming:" + readableText(p.accent, p.incoming),
    "--virga-mention-outgoing:" + readableText(p.accent, p.outgoing),
    "--virga-jump-text:" + readableText(p.text, p.panel),
    "--virga-jump-primary-text:" + readableText(p.onAccent, p.accent),
  ].join(";");

export const rootSelector = ":root[data-virga]";
const hosts = {
  light:
    ':is(.q-theme-tokens-light,[q-theme="light"],[data-theme="light"],[qq-theme="light"])',
  dark: ':is(.q-theme-tokens-dark,[q-theme="dark"],[data-theme="dark"],[qq-theme="dark"])',
};
export function settingsCSS(s: Settings, root = rootSelector): string {
  const scheme = (which: "light" | "dark") =>
    paletteDeclarations(s[which]) + ";color-scheme:" + which;
  const rule = (selector: string, body: string) => selector + "{" + body + "}";
  const mode = s.mode;
  let colors = rule(root, scheme(mode === "dark" ? "dark" : "light"));
  if (mode === "host" || mode === "system") {
    colors +=
      "@media (prefers-color-scheme:dark){" + rule(root, scheme("dark")) + "}";
    if (mode === "host")
      for (const which of ["light", "dark"] as const) {
        colors += rule(
          root + hosts[which] + "," + root + " " + hosts[which],
          scheme(which),
        );
      }
  }
  return (
    colors +
    rule(
      root,
      [
        "--virga-font:" + fonts[s.font],
        "--virga-font-size:" + s.fontSize + "px",
        "--virga-line-height:" + s.lineHeight,
        "--virga-bubble-radius:" + s.bubbleRadius + "px",
        "--virga-bubble-padding:" + s.bubblePadding + "px",
        "--virga-control-radius:" + s.controlRadius + "px",
        "--virga-avatar-radius:" + s.avatarRadius + "%",
        "--virga-duration:" + (s.motion ? s.duration : 0) + "ms",
      ].join(";"),
    )
  );
}
