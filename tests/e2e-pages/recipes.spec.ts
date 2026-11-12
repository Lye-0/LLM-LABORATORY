import { test, expect } from '@playwright/test';

const base = '/LLM-LABORATORY';

for (const width of [390, 1280]) {
  test(`目的とAPI名からコードを選び、準備に戻れる（${width}px）`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width, height: 850 });
    await page.goto(base + '/recipes/');
    const query = page.getByLabel('目的・API名で検索');
    await query.fill('隠れ状態');
    const detail = page.getByRole('link', { name: /Layer 0を通った最後のトークン/ });
    await expect(detail).toBeVisible();
    await query.fill('hidden_state');
    await detail.click();
    await expect(page).toHaveURL(/\/recipes\/last-vector\/$/);
    const code = await page.locator('pre code').innerText();
    await page.getByRole('button', { name: 'このコードをコピー' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\r\n/g, '\n')).toBe(code);
    await page.getByRole('link', { name: '全層のHidden Stateを取得する' }).click();
    await expect(page.locator('pre code')).toContainText('output_hidden_states=True');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
