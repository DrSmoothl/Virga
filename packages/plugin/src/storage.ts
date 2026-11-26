import {
  firstRecord,
  recordSchema,
  settingsSchema,
  type Saved,
  type Settings,
} from '@virga/theme';

export interface ConfigAPI {
  get(slug: string, fallback: Saved): Promise<unknown>;
  set(slug: string, value: Saved): Promise<unknown>;
  setIfRevision?(slug: string, expected: number, value: Saved): Promise<unknown>;
}
export type SettingsEdit = (settings: Settings) => Settings;
declare global {
  interface Window {
    LiteLoader?: { api: { config: ConfigAPI } };
  }
}
const slug = 'virga';
export function hostConfig(): ConfigAPI {
  const api = window.LiteLoader?.api?.config;
  if (!api || typeof api.get !== 'function' || typeof api.set !== 'function')
    throw new Error('Virga 无法访问插件配置接口');
  return api;
}
export async function readConfig(api: ConfigAPI): Promise<Saved> {
  const raw = await api.get(slug, firstRecord());
  return recordSchema.parse(raw);
}
export async function writeConfig(
  api: ConfigAPI,
  edit: SettingsEdit,
): Promise<Saved> {
  const persist = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await readConfig(api);
      const settings = settingsSchema.parse(edit(current.settings));
      if (JSON.stringify(settings) === JSON.stringify(current.settings))
        return current;
      const record = { revision: current.revision + 1, settings };
      if (api.setIfRevision) {
        const result = await api.setIfRevision(slug, current.revision, record);
        if (result === false) continue;
        if (result !== true) throw new Error('宿主返回了无效的配置写入结果');
      } else if (await api.set(slug, record) === false) {
        throw new Error('宿主未能写入 Virga 配置');
      }
      const confirmed = await readConfig(api);
      if (api.setIfRevision && confirmed.revision > record.revision)
        return confirmed;
      if (
        confirmed.revision !== record.revision ||
        JSON.stringify(confirmed.settings) !== JSON.stringify(record.settings)
      )
        throw new Error('宿主回读的配置与本次保存不一致');
      return confirmed;
    }
    throw new Error('外观被其他窗口连续修改，请重试');
  };
  return navigator.locks
    ? navigator.locks.request('virga:config', persist)
    : persist();
}
