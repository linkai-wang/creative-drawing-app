const { test, expect } = require('@playwright/test');

test('all eight brush icons remain painted with external resources blocked', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
  await page.locator('.scene-card[data-scene="beach"]').click();
  await page.locator('.start-task[data-task="shell"]').click();
  const icons = page.locator('#brush-select .brush-btn .fa');
  await expect(icons).toHaveCount(8);
  for (const icon of await icons.all()) {
    await icon.scrollIntoViewIfNeeded();
    await expect(icon).toBeVisible();
    const mask = await icon.evaluate(node => getComputedStyle(node, '::before').maskImage);
    expect(mask).toContain('data:image/svg+xml');
    const screenshot = await icon.screenshot({ animations: 'disabled' });
    // A missing icon leaves this rectangle a single background color.
    // Decode the real element screenshot in Chromium and check painted pixels.
    const colors = await page.evaluate(async bytes => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const values = new Set();
      for (let i = 0; i < data.length; i += 4) values.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
      bitmap.close();
      return values.size;
    }, [...screenshot]);
    expect(colors).toBeGreaterThan(1);
  }
});
