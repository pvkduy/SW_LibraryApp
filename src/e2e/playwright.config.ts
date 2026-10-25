import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config (SRS §11: e2e specs live in src/e2e, named by TS id).
 *
 * M0 ships one smoke test. It runs against the existing Vite app, which talks to
 * the local Supabase stack (`npx supabase start --workdir src`). CI starts both.
 *
 * The dev server is started automatically unless PLAYWRIGHT_BASE_URL is set, so
 * a CI job that already serves the app can reuse it.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 5173)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Skip auto-start when the caller supplies a base URL (e.g. CI serving a build).
  // Spread rather than `undefined` because the workspace sets
  // exactOptionalPropertyTypes (tsconfig.base.json).
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: `npm run dev --workspace=frontend -- --host 127.0.0.1 --port ${PORT} --strictPort`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          cwd: '../..',
        },
      }),
})
