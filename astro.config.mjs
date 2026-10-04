import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://lye-0.github.io',
  base: process.env.SITE_BASE || '/',
  output: 'static',
  trailingSlash: 'always',
  integrations: [react(), mdx()],
  markdown: { shikiConfig: { theme: 'github-dark' } },
  vite: { build: { chunkSizeWarningLimit: 600 } },
});
