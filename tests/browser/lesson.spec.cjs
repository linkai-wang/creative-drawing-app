const { test, expect } = require('@playwright/test');
const TOKEN = 'test-classroom-code-32-characters';
const ENDPOINT = 'http://127.0.0.1:8787/api/lesson-plan';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.goto('/');
  await page.evaluate(() => { window.CREATIVE_DRAWING_CONFIG.storyApiEndpoint = 'http://127.0.0.1:8787/api/story'; });
  await page.locator('#classroom-open').click();
  await page.locator('#lesson-agent-panel summary').click();
});

async function generate(page, request = 'Two beach tasks with short instructions.', token = TOKEN) {
  await page.locator('#lesson-agent-request').fill(request);
  await page.locator('#lesson-agent-code').fill(token);
  await page.locator('#lesson-agent-generate').click();
}

test('agent previews a plan, preserves manual inputs, and only explicit Apply fills an editable draft', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#classroom-name').fill('Teacher draft');
  await generate(page);
  await expect(page.locator('#lesson-agent-preview')).toContainText('Agent beach activity');
  await expect(page.locator('#classroom-name')).toHaveValue('Teacher draft');
  expect(await page.evaluate(() => classroomState.current)).toBeNull();
  await expect(page.locator('#lesson-agent-log li')).toHaveCount(2);
  expect(await page.locator('#lesson-agent-panel').evaluate(node => node.scrollWidth <= node.clientWidth + 2)).toBeTruthy();
  await page.locator('#lesson-agent-apply').click();
  await expect(page.locator('#classroom-name')).toHaveValue('Agent beach activity');
  await expect(page.locator('#classroom-task-picker input:checked')).toHaveCount(2);
  await expect(page.locator('textarea[data-task="shell"]')).toHaveValue('Draw a curve\nAdd lines\nAdd color');
  await page.locator('#classroom-name').fill('Teacher revised activity');
  await page.locator('#classroom-start').click();
  await expect(page.locator('#classroom-banner-title')).toHaveText('Teacher revised activity');
  await expect(page.locator('#tasks-container .task-item')).toHaveCount(2);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(TOKEN);
  expect(await page.content()).not.toContain(TOKEN);
  expect(errors).toEqual([]);
});

test('invalid drafts are repaired using tool feedback and model text stays literal', async ({ page }) => {
  await generate(page, 'repair-example <img src=x onerror=alert(1)>');
  await expect(page.locator('#lesson-agent-preview')).toBeVisible();
  await expect(page.locator('#lesson-agent-log li')).toHaveCount(3);
  await expect(page.locator('#lesson-agent-preview h4')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#lesson-agent-preview img')).toHaveCount(0);
  await page.locator('#lesson-agent-apply').click();
  await expect(page.locator('#classroom-name')).toHaveValue('<img src=x onerror=alert(1)>');
});

test('a generated draft cannot replace a running activity', async ({ page }) => {
  await page.locator('#classroom-start').click();
  const before = await page.evaluate(() => JSON.stringify(classroomState.current));
  await page.locator('#classroom-open').click();
  await generate(page);
  await expect(page.locator('#lesson-agent-preview')).toBeVisible();
  await page.locator('#lesson-agent-apply').click();
  expect(await page.evaluate(() => JSON.stringify(classroomState.current))).toBe(before);
  await expect(page.locator('#classroom-start')).toBeDisabled();
  await expect(page.locator('#classroom-dialog')).toBeVisible();
});

test('wrong access can be corrected and the unconfigured state preserves manual planning', async ({ page }) => {
  await generate(page, 'A short activity.', 'incorrect-classroom-access-code');
  await expect(page.locator('#lesson-agent-generate')).toBeEnabled();
  await expect(page.locator('#lesson-agent-preview')).not.toBeVisible();
  await generate(page);
  await expect(page.locator('#lesson-agent-preview')).toBeVisible();
  await page.evaluate(() => {
    window.CREATIVE_DRAWING_CONFIG.storyApiEndpoint = null;
    window.CREATIVE_DRAWING_CONFIG.lessonApiEndpoint = null;
  });
  await page.locator('#classroom-close').click();
  await page.locator('#classroom-open').click();
  await expect(page.locator('#lesson-agent-preview')).not.toBeVisible();
  await expect(page.locator('#classroom-start')).toBeEnabled();
});

test('closing the workbench cancels a late response without applying it', async ({ page }) => {
  let release;
  let entered;
  let settled;
  const gate = new Promise(resolve => { release = resolve; });
  const began = new Promise(resolve => { entered = resolve; });
  const handled = new Promise(resolve => { settled = resolve; });
  await page.route(ENDPOINT, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    entered(); await gate;
    await route.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8000' }, body: '{}' }).catch(() => {});
    settled();
  });
  await generate(page);
  await began;
  await page.locator('#classroom-close').click();
  release(); await handled;
  await page.locator('#classroom-open').click();
  await expect(page.locator('#lesson-agent-preview')).not.toBeVisible();
  expect(await page.evaluate(() => classroomState.current)).toBeNull();
});
