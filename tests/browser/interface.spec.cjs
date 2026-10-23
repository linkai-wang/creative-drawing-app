const { test, expect } = require('@playwright/test');

const APP_KEYS = ['creative-draw-app:v1', 'creative-draw-drafts:v1', 'creative-classroom:v1', 'ttsSettings'];

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.goto('/');
});

async function capture(page, info, name) {
  await page.screenshot({ path: info.outputPath(name + '.png'), fullPage: true });
  await info.attach(name, { path: info.outputPath(name + '.png'), contentType: 'image/png' });
}

async function expectRecordsCleared(page) {
  await expect(page.locator('#scene-selection')).toBeVisible();
  await expect.poll(() => page.evaluate(keys => keys.map(key => localStorage.getItem(key)), APP_KEYS))
    .toEqual([null, null, null, null]);
  expect(await page.evaluate(() => localStorage.getItem('another-app'))).toBe('keep me');
}

test('scene choices work with the keyboard and view settings stay available without crowding the page', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('button.scene-card')).toHaveCount(5);
  await expect.poll(() => page.locator('.scene-art img').evaluateAll(images =>
    images.every(img => img.complete && img.naturalWidth > 100 && img.dataset.imageState === 'loaded'))).toBeTruthy();
  expect(await page.locator('.scene-grid').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
  await capture(page, info, 'home');
  await page.locator('[data-scene="beach"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#scene-tasks')).toBeVisible();
  await expect(page.locator('#scene-view-options')).not.toHaveAttribute('open', '');
  await expect(page.locator('#background-selector')).not.toBeVisible();
  const preview = await page.locator('#scene-preview').boundingBox();
  const tasks = await page.locator('#tasks-container').boundingBox();
  expect(preview.x).toBeGreaterThanOrEqual(0);
  expect(tasks.x + tasks.width).toBeLessThanOrEqual(page.viewportSize().width);
  const items = page.locator('#tasks-container .start-task');
  await items.last().scrollIntoViewIfNeeded();
  await expect(items.last()).toBeInViewport();
  await page.locator('#scene-title').scrollIntoViewIfNeeded();
  await expect(page.locator('#scene-bg')).toHaveAttribute('data-image-state', 'loaded');
  await capture(page, info, 'scene');
  await page.locator('#scene-view-options summary').click();
  await expect(page.locator('#background-selector button')).toHaveCount(2);
  const original = await page.locator('#scene-bg').evaluate(el => el.style.transform);
  await page.locator('#zoom-in').click();
  expect(await page.locator('#scene-bg').evaluate(el => el.style.transform)).not.toBe(original);
  await page.locator('#zoom-out').click();
  await expect(page.locator('#toggle-element-drag')).toBeDisabled();
  await page.locator('#background-selector button').first().click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('creative-draw-app:v1')).selectedBackgrounds.beach))
    .toContain('sunny-beach.webp');
  await page.locator('#back-to-scenes').click();
  await page.locator('[data-scene="forest"]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#scene-title')).toHaveText('\u68ee\u6797');
  await page.locator('.start-task').first().click();
  await expect(page.locator('#drawing-mode')).toBeVisible();
  await expect(page.locator('#tts-controls')).not.toBeVisible();
  const toolbarFits = await page.locator('#toolbar').evaluate(el => el.scrollWidth <= el.clientWidth + 1);
  expect(toolbarFits).toBeTruthy();
  if (info.project.name === 'mobile-chromium') {
    const canvas = await page.locator('#drawing-canvas').boundingBox();
    const references = await page.locator('#reference-materials').boundingBox();
    expect(canvas.y).toBeLessThan(references.y);
  }
  await page.locator('#drawing-canvas').scrollIntoViewIfNeeded();
  await capture(page, info, 'drawing');
  await page.locator('.drawing-options summary').click();
  await expect(page.locator('#tts-controls')).toBeVisible();
  expect(errors).toEqual([]);
});

test('reset cancellation and Escape preserve all saved records', async ({ page }) => {
  await page.evaluate(keys => {
    for (const key of keys) localStorage.setItem(key, 'test record');
  }, APP_KEYS);
  const before = await page.evaluate(() => ({ ...localStorage }));
  await page.locator('#reset-local-data').click();
  await expect(page.locator('#reset-data-cancel')).toBeFocused();
  const box = await page.locator('#reset-data-dialog').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.locator('#reset-data-cancel').click();
  await expect(page.locator('#reset-local-data')).toBeFocused();
  await page.locator('#reset-local-data').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#reset-data-dialog')).not.toBeVisible();
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(before);
});

test('confirmed reset removes a real activity, artwork, drafts and preferences across reload', async ({ page }) => {
  await page.locator('#classroom-open').click();
  await page.locator('#classroom-start').click();
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 20; canvas.height = 20;
    canvas.getContext('2d').fillRect(0, 0, 10, 10);
    const imageData = canvas.toDataURL('image/png');
    appState.completedTasks.beach = { shell: imageData };
    saveAppState();
    writeDrafts({ 'beach:wave': { imageData, savedAt: Date.now() } });
    localStorage.setItem('ttsSettings', JSON.stringify({ rate: 1.15 }));
    localStorage.setItem('another-app', 'keep me');
  });
  await page.reload();
  await expect(page.locator('#classroom-banner')).toBeVisible();
  await page.locator('#reset-local-data').click();
  await Promise.all([page.waitForEvent('load'), page.locator('#reset-data-confirm').click()]);
  await expectRecordsCleared(page);
  await expect(page.locator('#classroom-banner')).not.toBeVisible();
  expect(await page.evaluate(() => tts.settings.rate)).toBe(0.95);
  await page.reload();
  await expectRecordsCleared(page);
  await page.locator('[data-scene="beach"]').click();
  await expect(page.locator('#progress-text')).toContainText('0/');
  await expect(page.locator('.view-artwork')).toHaveCount(0);
});

test('an older drawing tab cannot recreate records after reset, including without BroadcastChannel', async ({ page, context }) => {
  // Exercise the storage-event fallback used in restrictive browser modes.
  await context.addInitScript(() => { window.BroadcastChannel = undefined; });
  await page.reload();
  await page.locator('[data-scene="beach"]').click();
  await page.locator('.start-task[data-task="shell"]').click();
  const canvas = page.locator('#drawing-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 25, box.y + 25);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 60, { steps: 8 });
  await page.mouse.up();
  // Keep a dirty draft queued: reset must also guard pagehide/beforeunload writes.
  await page.evaluate(() => { clearTimeout(draftSaveTimer); localStorage.setItem('another-app', 'keep me'); });
  const other = await context.newPage();
  await other.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await other.goto('/');
  await other.locator('#reset-local-data').click();
  await Promise.all([
    page.waitForEvent('load'), other.waitForEvent('load'),
    other.locator('#reset-data-confirm').click()
  ]);
  await expectRecordsCleared(page);
  await expectRecordsCleared(other);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expectRecordsCleared(page);
});

test('a blocked reset reports failure and allows retry without claiming success', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('creative-draw-app:v1', 'saved');
    const removeItem = Storage.prototype.removeItem;
    window.restoreStorageRemoval = () => { Storage.prototype.removeItem = removeItem; };
    Storage.prototype.removeItem = function() { throw new Error('Storage blocked'); };
  });
  await page.locator('#reset-local-data').click();
  await page.locator('#reset-data-confirm').click();
  await expect(page.locator('#reset-data-status')).toBeVisible();
  await expect(page.locator('#reset-data-status')).not.toBeEmpty();
  await expect(page.locator('#reset-data-confirm')).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('creative-draw-app:v1'))).toBe('saved');
  await page.evaluate(() => { window.restoreStorageRemoval(); localStorage.setItem('another-app', 'keep me'); });
  await Promise.all([page.waitForEvent('load'), page.locator('#reset-data-confirm').click()]);
  await expectRecordsCleared(page);
});
