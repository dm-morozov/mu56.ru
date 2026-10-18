import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const evidence = process.env.BROWSER_QA_OUTPUT || resolve(import.meta.dirname, '../../.local/browser-qa-results');

export default defineConfig({
  testDir: '.',
  testMatch: 'journeys.spec.mjs',
  outputDir: resolve(evidence, 'test-results'),
  reporter: [['list'], ['json', { outputFile: resolve(evidence, 'report.json') }]],
  workers: 1,
  retries: 0,
  timeout: 60_000,
  globalTimeout: 8 * 60_000,
  expect: { timeout: 10_000 },
  use: {
    browserName: 'chromium',
    // Use the runner's installed Chrome with its existing OS sandbox profile.
    channel: 'chrome',
    launchOptions: { chromiumSandbox: true },
    // This origin is intercepted in the fixture below; it never reaches production.
    baseURL: 'http://mu56.ru',
    locale: 'ru-RU',
    timezoneId: 'Asia/Yekaterinburg',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'small-mobile', use: { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true } },
  ],
});
