const { test, expect } = require('@playwright/test');
const TOKEN = 'test-classroom-code-32-characters';
const ENDPOINT = 'http://127.0.0.1:8787/api/story';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.goto('/');
  await page.evaluate(endpoint => {
    window.CREATIVE_DRAWING_CONFIG.storyApiEndpoint = endpoint;
    window.__storySpeech = [];
    window.speakText = text => window.__storySpeech.push(text);
    switchToScene('beach');
    appState.completedTasks.beach = { shell: 'data:image/png;base64,invalid-test-preview' };
  }, ENDPOINT);
});

async function enterStory(page) {
  await page.locator('#enter-story-mode').click();
  await page.locator('#confirm-listen-story').click();
}

async function submitCode(page, code = TOKEN) {
  await page.locator('#story-access-code').fill(code);
  await page.locator('#story-access-form button[type="submit"]').click();
}

test('story frontend uses a real cross-origin backend, displays text safely and keeps code in memory', async ({ page }) => {
  const requests = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url() === ENDPOINT && request.method() === 'POST') requests.push(request.postDataJSON());
  });
  await enterStory(page);
  await expect(page.locator('#story-access-form')).toBeVisible();
  expect(await page.locator('#story-access-form').evaluate(node => node.scrollWidth <= node.clientWidth + 2)).toBeTruthy();
  await submitCode(page);
  await expect(page.locator('#generated-story')).toContainText('1 completed tasks');
  await expect(page.locator('#generated-story')).toContainText('<img');
  await expect(page.locator('#generated-story img')).toHaveCount(0);
  expect(requests).toEqual([{ sceneId: 'beach', completedTaskIds: ['shell'] }]);
  expect(await page.evaluate(() => window.__storySpeech.length)).toBe(1);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(TOKEN);
  expect(await page.content()).not.toContain(TOKEN);
  expect(errors).toEqual([]);
  await page.locator('#back-from-story').click();
  await enterStory(page);
  await expect(page.locator('#generated-story')).toBeVisible();
  await page.reload();
  await page.evaluate(endpoint => {
    window.CREATIVE_DRAWING_CONFIG.storyApiEndpoint = endpoint;
    switchToScene('beach');
  }, ENDPOINT);
  await enterStory(page);
  await expect(page.locator('#story-access-form')).toBeVisible();
});

test('wrong access code can be corrected without reloading', async ({ page }) => {
  await enterStory(page);
  await submitCode(page, 'this-access-code-is-incorrect');
  await expect(page.locator('#story-access-message')).not.toBeEmpty();
  await submitCode(page);
  await expect(page.locator('#generated-story')).toBeVisible();
});

test('an unconfigured public site preserves artwork and does not send a model request', async ({ page }) => {
  let sent = false;
  page.on('request', request => { if (request.url() === ENDPOINT) sent = true; });
  await page.evaluate(() => { window.CREATIVE_DRAWING_CONFIG.storyApiEndpoint = null; });
  await enterStory(page);
  await expect(page.locator('#story-access-form')).toHaveCount(0);
  await expect(page.locator('#story-content')).not.toBeEmpty();
  expect(sent).toBeFalsy();
  expect(await page.evaluate(() => Object.keys(appState.completedTasks.beach))).toEqual(['shell']);
});

test('rate-limit feedback supports a later retry', async ({ page }) => {
  let attempts = 0;
  await page.route(ENDPOINT, route => {
    if (route.request().method() !== 'POST' || attempts++ > 0) return route.continue();
    return route.fulfill({ status: 429, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8000' },
      body: JSON.stringify({ error: 'request_limit' }) });
  });
  await enterStory(page);
  await submitCode(page);
  await expect(page.locator('#story-error')).toBeVisible();
  await page.locator('#retry-story').click();
  await expect(page.locator('#generated-story')).toBeVisible();
});

test('leaving the story page prevents a late response from speaking or replacing content', async ({ page }) => {
  let release;
  let entered;
  const gate = new Promise(resolve => { release = resolve; });
  const began = new Promise(resolve => { entered = resolve; });
  await page.route(ENDPOINT, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    entered();
    await gate;
    await route.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8000' },
      body: JSON.stringify({ story: 'This late story must not be read.' }) }).catch(() => {});
  });
  await enterStory(page);
  await submitCode(page);
  await began;
  await page.locator('#back-from-story').click();
  await expect(page.locator('#story-mode')).not.toBeVisible();
  release();
  await expect(page.locator('#generated-story')).toHaveCount(0);
  expect(await page.evaluate(() => window.__storySpeech)).toEqual([]);
});
