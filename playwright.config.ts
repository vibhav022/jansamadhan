import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  reporter: [['list']],
  webServer: {
    command: 'node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config wrangler.local.jsonc --var EMAIL_TEST_MODE:mock --var SMTP_HOST:mock --var SMTP_SECURITY:none --var OTP_FROM_EMAIL:noreply@jansamadhan.local --var OTP_SECRET:playwright-smoke-only-secret-32-characters-minimum --var OTP_RESEND_COOLDOWN_SECONDS:15 --var OTP_EXPIRY_SECONDS:60 --local --persist-to .wrangler/state --ip 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      EMAIL_TEST_MODE: 'mock',
      SMTP_HOST: 'mock',
      OTP_RESEND_COOLDOWN_SECONDS: '15',
    },
  },
});
