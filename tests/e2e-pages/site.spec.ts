import { test, expect } from '@playwright/test';
const base = '/LLM-LABORATORY';
test('project URLでページ・メニュー・コードを表示できる', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('LLM');
  await page.locator('.top-nav a').filter({ hasText: '学ぶ' }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/learn/$`));
  await page.locator('main a[href$="/learn/tensor/"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tensor');
  await expect(page.locator('.top-nav a.active')).toHaveAttribute('href', `${base}/learn/`);
  expect(
    await page
      .locator('a[href^="/"]')
      .evaluateAll((links) =>
        links.every((link) => link.getAttribute('href')?.startsWith('/LLM-LABORATORY/')),
      ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('WorkerのTokenizer資産をサブパスから取得する', async ({ page }) => {
  const bad: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) bad.push(response.url());
  });
  await page.goto(`${base}/labs/tokenizer/`);
  await page.getByRole('button', { name: 'トークンに分ける' }).click();
  await expect(page.locator('.token-chip')).toHaveCount(7, { timeout: 30000 });
  expect(bad).toEqual([]);
});
test('検索索引とPagefindの結果がproject URLへ戻る', async ({ page }) => {
  await page.goto(`${base}/search/`);
  await page.getByLabel('キーワードを検索').fill('unsqueeze');
  await expect(page.locator('.search-result').first()).toContainText('unsqueeze');
  await expect(page.locator('.search-result').first()).toHaveAttribute(
    'href',
    new RegExp(`^${base}/`),
  );
  await page.getByLabel('キーワードを検索').fill('勾配');
  await page.getByRole('combobox', { name: '検索結果の種類' }).click();
  await page.getByRole('option', { name: '本文', exact: true }).click();
  await expect(page.locator('.search-result').first()).toBeVisible();
  await expect(page.locator('.search-result').first()).toHaveAttribute(
    'href',
    new RegExp(`^${base}/`),
  );
  await page.locator('.search-result').first().click();
  await expect(page).toHaveURL(new RegExp(base));
});
test('分類ページとクエリ復元をサブパスで維持する', async ({ page }) => {
  await page.goto(`${base}/reference/classes/tensor/`);
  await page.locator('main a[href$="/reference/api/unsqueeze/"]').click();
  await expect(page.locator('.breadcrumb')).toContainText('torch.Tensor');
  await page.goto(`${base}/reference/tokens/`);
  await page.getByLabel('表記・ID・用途から探す').fill('<think>');
  await page.reload();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page).toHaveURL(new RegExp(`${base}/reference/tokens/`));
});
