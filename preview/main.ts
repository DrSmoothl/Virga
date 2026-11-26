import type { Saved } from '../packages/theme/src/index.ts';
const key = 'virga-preview.v1';
window.LiteLoader = {
  api: {
    config: {
      async get(_slug: string, defaults: Saved) {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaults;
      },
      async set(_slug: string, value: Saved) {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      },
    },
  },
};
const { onSettingWindowCreated } =
  await import('../packages/plugin/src/entry.ts');
onSettingWindowCreated(document.querySelector('#settings')!);
