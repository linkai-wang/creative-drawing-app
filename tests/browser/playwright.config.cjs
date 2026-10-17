const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.cjs',
  workers: 1,
  retries: 0,
  timeout: 30000,
  globalTimeout: 240000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: [{
    command: 'python3 -m http.server 8000 --bind 127.0.0.1 --directory ../..',
    url: 'http://127.0.0.1:8000',
    reuseExistingServer: false,
    timeout: 20000
  }, {
    command: 'node story-backend-fixture.mjs',
    url: 'http://127.0.0.1:8787/healthz',
    reuseExistingServer: false,
    timeout: 20000
  }],
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-chromium', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ]
});
