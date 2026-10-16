const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

test.beforeEach(async ({ page }) => {
  // Classroom functionality should remain usable when third-party CDNs fail.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('/');
  await expect(page.locator('#classroom-open')).toBeVisible();
});

async function startActivity(page) {
  await page.locator('#classroom-open').click();
  await page.locator('#classroom-name').fill('Shapes workshop');
  await page.locator('#classroom-goal').fill('Try one shape at a time');
  await page.locator('textarea[data-task="shell"]').fill('First draw a curve\nThen add color');
  await page.locator('#classroom-start').click();
  await expect(page.locator('#classroom-dialog')).not.toBeVisible();
  await expect(page.locator('#tasks-container .task-item')).toHaveCount(2);
}

async function paint(page) {
  const canvas = page.locator('#drawing-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  await page.mouse.move(rect.x + 25, rect.y + 25);
  await page.mouse.down();
  await page.mouse.move(rect.x + 90, rect.y + 65, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#save-drawing')).toBeEnabled();
}

test('teacher plan, guided painting, PNG download and anonymous CSV form one workflow', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await startActivity(page);
  await expect(page.locator('#classroom-banner-progress')).toContainText('0/2');
  await page.locator('.start-task[data-task="shell"]').click();
  await expect(page.locator('#teacher-instructions')).toHaveText('First draw a curve');
  await page.locator('#guide-next').click();
  await expect(page.locator('#teacher-instructions')).toHaveText('Then add color');
  await expect(page.locator('.brush-btn[data-brush="spray"]')).not.toBeVisible();
  await expect(page.locator('.brush-btn[data-brush="fineliner"]')).toBeVisible();
  await page.locator('#guide-help').click();
  await paint(page);
  await page.evaluate(() => { window.confettiCalls = 0; window.confetti = () => window.confettiCalls++; });
  await page.locator('#save-drawing').click();
  await expect(page.locator('#success-modal')).toBeVisible();
  expect(await page.evaluate(() => window.confettiCalls)).toBe(0);
  await page.locator('#close-modal').click();
  await expect(page.locator('#scene-tasks')).toBeVisible();
  await expect(page.locator('#classroom-banner-progress')).toContainText('1/2');
  await page.locator('.view-artwork[data-task="shell"]').click();
  const pngDownload = page.waitForEvent('download');
  await page.locator('#artwork-download').click();
  const png = await pngDownload;
  const bytes = await fs.readFile(await png.path());
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  await page.locator('#artwork-close').click();
  await page.reload();
  await expect(page.locator('#classroom-banner-progress')).toContainText('1/2');
  await page.locator('#classroom-open').click();
  await expect(page.locator('#classroom-report-rows tr')).toHaveCount(2);
  const firstRow = page.locator('#classroom-report-rows tr').first();
  await expect(firstRow.locator('td').nth(1)).toHaveText('\u5df2\u5b8c\u6210');
  await expect(firstRow.locator('td').nth(3)).toHaveText('1');
  await expect(firstRow.locator('td').nth(5)).toHaveText('1');
  const download = page.waitForEvent('download');
  await page.locator('#classroom-report-download').click();
  const report = await download;
  const csv = await fs.readFile(await report.path(), 'utf8');
  expect(csv).toContain('Shapes workshop');
  expect(csv).toContain('pen_contact_seconds');
  expect(csv).not.toContain('data:image');
  await page.locator('#classroom-finish').click();
  await expect(page.locator('#classroom-banner')).not.toBeVisible();
  await expect(page.locator('#classroom-report-select option')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('teacher-studio.png') });
  expect(errors).toEqual([]);
});

test('reordering tasks and guide position survive a reload', async ({ page }) => {
  await page.locator('#classroom-open').click();
  await page.locator('.classroom-task-row').first().locator('button').last().click();
  await page.locator('#classroom-start').click();
  await page.reload();
  await page.locator('#classroom-return').click();
  await expect(page.locator('#tasks-container .start-task').first()).toHaveAttribute('data-task', 'wave');
  await page.locator('.start-task[data-task="wave"]').click();
  await page.locator('#guide-next').click();
  const instruction = await page.locator('#teacher-instructions').textContent();
  await page.reload();
  await page.locator('#classroom-return').click();
  await page.locator('.start-task[data-task="wave"]').click();
  await expect(page.locator('#teacher-instructions')).toHaveText(instruction);
});

test('empty plans are rejected and teacher text stays plain text', async ({ page }, testInfo) => {
  await page.locator('#classroom-open').click();
  await page.locator('input[data-task="shell"]').uncheck();
  await page.locator('input[data-task="wave"]').uncheck();
  await page.locator('#classroom-start').click();
  await expect(page.locator('#classroom-dialog')).toBeVisible();
  await page.locator('input[data-task="shell"]').check();
  await page.locator('#classroom-name').fill('<img src=x onerror=alert(1)>');
  await page.locator('#classroom-start').click();
  await expect(page.locator('#classroom-banner-title')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#classroom-banner-title img')).toHaveCount(0);
  await page.locator('.start-task[data-task="shell"]').click();
  await page.locator('#classroom-drawing-open').click();
  const box = await page.locator('#classroom-dialog').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.keyboard.press('Escape');
  await expect(page.locator('#classroom-dialog')).not.toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('guided-drawing.png') });
});
