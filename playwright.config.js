import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const usesFirebaseEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const serverPort = usesFirebaseEmulator ? 4176 : 4174;
const baseURL = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    channel: process.platform === 'win32' ? 'chrome' : undefined,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
  webServer: {
    command: `npx vite --host=127.0.0.1 --port=${serverPort}`,
    env: {
      VITE_USE_FIREBASE_EMULATOR: usesFirebaseEmulator ? 'true' : 'false',
    },
    url: baseURL,
    reuseExistingServer: !usesFirebaseEmulator && !process.env.CI,
    timeout: 120_000,
  },
});
