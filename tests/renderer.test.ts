import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaults,
  firstRecord,
  type Saved,
} from '../packages/theme/src/index.ts';
import {
  readConfig,
  writeConfig,
  type ConfigAPI,
} from '../packages/plugin/src/storage.ts';
import { startTheme } from '../packages/plugin/src/runtime.ts';
import { mountSettings } from '../packages/plugin/src/settings.tsx';

function memory() {
  let record = firstRecord();
  return {
    get: vi.fn(async () => structuredClone(record)),
    set: vi.fn(async (_slug: string, r: Saved) => {
      record = structuredClone(r);
      return true;
    }),
  };
}
const stops: Array<() => void> = [];
afterEach(() => {
  for (const fn of stops.splice(0)) fn();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
describe('渲染入口和设置', () => {
  it('以启用的配置加载，重复读取复用样式节点，退出清理', async () => {
    const api = memory(),
      runtime = startTheme(api);
    stops.push(runtime.dispose);
    await runtime.ready;
    expect(document.documentElement.hasAttribute('data-virga')).toBe(true);
    const style = document.querySelector('style[data-virga-settings-style]');
    await runtime.retry();
    expect(document.querySelectorAll('style[data-virga-style]')).toHaveLength(
      1,
    );
    runtime.update((s) => ({ ...s, fontSize: 18 }));
    await vi.waitFor(() => expect(style?.textContent).toContain('--virga-font-size:18px'));
    runtime.dispose();
    expect(style?.isConnected).toBe(false);
    expect(document.documentElement.hasAttribute('data-virga')).toBe(false);
  });
  it('忽略销毁后才完成的初始读取', async () => {
    let resolve!: (s: Saved) => void;
    const api: ConfigAPI = {
      get: () =>
        new Promise((r) => {
          resolve = r;
        }),
      set: async () => true,
    };
    const runtime = startTheme(api);
    await Promise.resolve();
    runtime.dispose();
    resolve(firstRecord());
    await runtime.ready;
    expect(document.querySelector('style[data-virga-style]')).toBeNull();
  });
  it('合并同批配置通知，读取期间的更新只补读一次', async () => {
    const api = memory();
    const runtime = startTheme(api);
    stops.push(runtime.dispose);
    await runtime.ready;
    api.get.mockClear();
    let complete!: (saved: Saved) => void;
    api.get.mockImplementationOnce(() => new Promise((resolve) => {
      complete = resolve;
    }));
    const signal = () => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('pageshow'));
      window.dispatchEvent(new CustomEvent('extension-config-changed', { detail: 'virga' }));
    };
    signal();
    signal();
    await Promise.resolve();
    expect(api.get).toHaveBeenCalledTimes(1);

    signal();
    signal();
    await api.set('virga', { revision: 2, settings: { ...firstRecord().settings, fontSize: 19 } });
    complete({ ...firstRecord(), revision: 1 });
    await vi.waitFor(() =>
      expect(document.documentElement.dataset.virgaRevision).toBe('2'),
    );
    expect(api.get).toHaveBeenCalledTimes(2);
  });
  it('从最新配置合并编辑，宿主拒写或回读校验失败均可见', async () => {
    const api = memory();
    await writeConfig(api, (s) => ({ ...s, mode: 'dark' }));
    await writeConfig(api, (s) => ({ ...s, fontSize: 17 }));
    expect(await api.get()).toMatchObject({ revision: 2, settings: { mode: 'dark', fontSize: 17 } });
    api.set.mockResolvedValueOnce(false);
    await expect(writeConfig(api, defaults)).rejects.toThrow('未能写入');
    api.set.mockResolvedValueOnce(true);
    await expect(writeConfig(api, defaults)).rejects.toThrow('回读');
  });
  it('非法配置不触发写回', async () => {
    const set = vi.fn();
    await expect(
      readConfig({
        get: async () => ({ revision: 1, settings: { version: 8 } }),
        set,
      }),
    ).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });
  it('重复挂载复用节点，连续调字号合并为一次自动写入与热更新', async () => {
    const api = memory(),
      rt = startTheme(api);
    stops.push(rt.dispose);
    await rt.ready;
    const view = document.createElement('section');
    view.dataset.settingsPresentation = 'window';
    document.body.append(view);
    mountSettings(view, rt);
    mountSettings(view, rt);
    expect(view.children).toHaveLength(1);
    const panel = view.firstElementChild!.shadowRoot!;
    const button = (text: string) =>
      Array.from(panel.querySelectorAll('button')).find(
        (b) => b.textContent === text,
      )!;
    await vi.waitFor(() =>
      expect(panel.querySelector('fieldset')?.disabled).toBe(false),
    );
    button('文字与形状').click();
    await vi.waitFor(() =>
      expect(panel.querySelector('[aria-label="消息字号"]')).toBeTruthy(),
    );
    const input = panel.querySelector<HTMLInputElement>(
      '[aria-label="消息字号"]',
    )!;
    for (const value of ['17', '18', '19']) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await vi.waitFor(() => expect(api.set).toHaveBeenCalledOnce());
    expect((await api.get()).settings.fontSize).toBe(19);
    expect(document.querySelector('[data-virga-settings-style]')?.textContent)
      .toContain('--virga-font-size:19px');
  });
  it('在设置页关闭时提交尚未写入的修改', async () => {
    const api = memory(), rt = startTheme(api);
    await rt.ready;
    rt.update((s) => ({ ...s, hideMemberActivity: true }));
    rt.dispose();
    await vi.waitFor(async () => expect((await api.get()).settings.hideMemberActivity).toBe(true));
  });
});
