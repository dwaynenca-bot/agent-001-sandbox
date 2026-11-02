import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173', launchOptions: executablePath ? { executablePath } : {} },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
