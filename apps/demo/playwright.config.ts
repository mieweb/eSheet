import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3101',
    trace: 'on-first-retry',
    launchOptions: {
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    },
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'pnpm build:css && pnpm exec vite --host localhost --port 3101',
    url: 'http://localhost:3101/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
