import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));
export default defineConfig({
  publicDir: false,
  build: {
    target: 'chrome108',
    outDir: here('../../dist/plugin'),
    emptyOutDir: true,
    lib: {
      entry: here('./src/entry.ts'),
      formats: ['es'],
      fileName: () => 'renderer.js',
    },
  },
});
