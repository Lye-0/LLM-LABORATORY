import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('日本語の本文検索が静的Pagefind索引を利用できる', async ({ page }) => {
  await page.goto('/search/');
  await page.getByLabel('キーワードを検索').fill('勾配');
  await page.getByRole('combobox', { name: '検索結果の種類' }).click();
  await page.getByRole('option', { name: '本文', exact: true }).click();
  await expect(page.locator('.search-result').first()).toBeVisible();
  await expect(page.locator('.search-result').first()).toContainText('勾配');
});

test('Tokenizerの取得失敗から再試行できる', async ({ page }) => {
  await page.route('**/data/qwen3/tokenizer.json', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await page.goto('/labs/tokenizer/');
  await page.getByRole('button', { name: 'トークンに分ける' }).click();
  await expect(page.getByRole('alert')).toContainText('取得できませんでした');
  await page.unroute('**/data/qwen3/tokenizer.json');
  await page.getByRole('button', { name: 'トークンに分ける' }).click();
  await expect(page.locator('.token-chip')).toHaveCount(7);
});

test('明色・拡大・動き軽減でも本文と操作にアクセスできる', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/learn/tensor/');
  await page.getByRole('button', { name: '明暗テーマを切り替える' }).click();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.evaluate(() => {
    document.documentElement.style.zoom = '1';
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'ナビゲーションを開く' }).click();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#sidebar a').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#menu-toggle')).toBeFocused();
});
