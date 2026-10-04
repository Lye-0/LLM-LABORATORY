import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e-pages',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4323', trace: 'retain-on-failure' },
  webServer: {
    command: `"${process.execPath}" node_modules/astro/bin/astro.mjs preview --host 127.0.0.1 --port 4323`,
    url: 'http://127.0.0.1:4323/LLM-LABORATORY/',
    reuseExistingServer: false,
    env: { SITE_BASE: '/LLM-LABORATORY/', ASTRO_TELEMETRY_DISABLED: '1' },
  },
});
