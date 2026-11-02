// @ts-check
import { defineConfig } from 'astro/config';
import localCmsPlugin from './scripts/local-cms.mjs';
import { fileURLToPath } from 'node:url';

// https://astro.build/config
export default defineConfig({
  server: { host: '127.0.0.1' },
  vite: {
    plugins: [localCmsPlugin(fileURLToPath(new URL('.', import.meta.url)))],
    server: {
      host: '127.0.0.1',
      allowedHosts: ['127.0.0.1'],
      // Archives contain thousands of original files and are not live source modules.
      watch: { ignored: ['**/migration/**', '**/.migration-tools/**', '**/.pnpm-store/**', '**/public/onmam-assets/**'] },
    },
  },
});
