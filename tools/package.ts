import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { zipSync, type Zippable } from 'fflate';

const root = new URL('../', import.meta.url);
const bytes = (path: string) => readFile(new URL(path, root));
const manifestBytes = await bytes('packages/plugin/manifest.json');
const manifest = JSON.parse(manifestBytes.toString());
const notices = await Promise.all(
  [
    ['Preact', 'packages/plugin/node_modules/preact/LICENSE'],
    ['Zod', 'packages/theme/node_modules/zod/LICENSE'],
  ].map(
    async ([name, file]) =>
      name + '\n\n' + (await bytes(file!)).toString().trim(),
  ),
);
const files: Zippable = {
  'THIRD-PARTY-NOTICES.txt': new TextEncoder().encode(
    notices.join('\n\n') + '\n',
  ),
  'manifest.json': manifestBytes,
  'renderer.js': await bytes('dist/plugin/renderer.js'),
  'icon.svg': await bytes('packages/plugin/assets/icon.svg'),
};
for (const entry of [
  manifest.icon,
  ...Object.values(manifest.injects),
] as string[]) {
  if (!Object.hasOwn(files, entry.replace(/^\.\//, '')))
    throw new Error('清单引用了缺失的文件 ' + entry);
}
const output = new URL('release/Virga-' + manifest.version + '.zip', root);
await mkdir(new URL('./', output), { recursive: true });
await writeFile(
  output,
  zipSync(files, { level: 9, mtime: new Date(2000, 0, 1) }),
);
console.log(fileURLToPath(output));
