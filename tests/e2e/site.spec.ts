import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
test('ホームからEmbeddingを操作し、shapeを追う', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('内側から');
  await page.getByRole('link', { name: '実験から始める' }).click();
  await choose(page, '入力ID列', '[2, 0, 2]');
  await expect(page.locator('.output-vector')).toHaveCount(3);
  await page.getByLabel('batch軸を追加').check();
  await expect(page.locator('.lab-pane').last()).toContainText('[1,3,3]');
  await page.getByRole('button', { name: 'ID 4 の行を選択' }).click();
  await expect(page.getByRole('combobox', { name: '入力ID列' })).toContainText('[4]');
  await page.getByRole('button', { name: '初期値に戻す' }).click();
  await expect(page.locator('.output-vector')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('Tensorのscalar・slice・軸追加', async ({ page }) => {
  await page.goto('/labs/tensor/');
  await page.getByRole('button', { name: 'unsqueeze(0)', exact: true }).click();
  await expect(page.locator('.stat').first()).toContainText('[1,7]');
  await page.getByRole('button', { name: 'tensor[0]', exact: true }).click();
  await expect(page.locator('.stat').first()).toContainText('[]');
  await expect(page.locator('.stat').nth(2)).toContainText('1');
  await page.getByRole('button', { name: 'tensor[0:1]', exact: true }).click();
  await expect(page.locator('.stat').first()).toContainText('[1]');
  await page.getByRole('button', { name: 'tensor[0].item()', exact: true }).click();
  await expect(page.locator('.stats')).toContainText('int');
});
test('Tokenizerの実処理・入力変更・空文字列', async ({ page }) => {
  await page.goto('/labs/tokenizer/');
  await page.getByRole('button', { name: 'トークンに分ける' }).click();
  await expect(page.locator('.token-chip')).toHaveCount(7, { timeout: 30000 });
  await expect(page.locator('.token-chip').first()).toContainText('89015');
  await page.getByLabel('入力する文章').fill('🦦と🌏');
  await expect(page.locator('.token-chip')).toHaveCount(0);
  await page.getByRole('button', { name: 'トークンに分ける' }).click();
  await expect(page.locator('.stat').last()).toContainText('一致');
  await page.getByLabel('入力する文章').fill('');
  await page.getByRole('button', { name: 'トークンに分ける' }).click();
  await expect(page.locator('.stat').first()).toContainText('0');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('Vocabularyの範囲と日本語の対応', async ({ page }) => {
  await page.goto('/labs/vocabulary/');
  await page.getByRole('button', { name: '語彙を調べる' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(11, { timeout: 30000 });
  await choose(page, '探し方', '文章を分割して対応を探す');
  await page.getByLabel('検索', { exact: true }).fill('こんにちは');
  await page.getByRole('button', { name: '語彙を調べる' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('89015');
});
test('Token辞書のフラグ・URL再現・空状態', async ({ page }) => {
  await page.goto('/reference/tokens/');
  await page.getByLabel('表記・ID・用途から探す').fill('<think>');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('151667');
  await expect(page.locator('tbody')).toContainText('false');
  await page.reload();
  await expect(page.getByLabel('表記・ID・用途から探す')).toHaveValue('<think>');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await choose(page, 'specialフラグ', 'True');
  await expect(page.locator('.empty-state')).toBeVisible();
  await page.getByRole('button', { name: '条件を解除' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(26);
});
test('検索でAPI・日本語・IDを引ける', async ({ page }) => {
  await page.goto('/search/');
  const search = page.getByLabel('キーワードを検索');
  await search.fill('unsqueeze');
  await expect(page.locator('.search-result').first()).toContainText('unsqueeze');
  await search.fill('埋め込み');
  await expect(page.locator('.search-result').first()).toContainText('Embedding');
  await search.fill('151667');
  await expect(page.locator('.search-result').first()).toContainText('151667');
  await search.fill('zzznothing999');
  await expect(page.locator('.empty-state')).toBeVisible();
});
test('テーマが再読込で残る', async ({ page }) => {
  await page.goto('/learn/embedding/');
  await page.getByRole('button', { name: '明暗テーマを切り替える' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
test('残りの実験を操作し、エラーなく値が更新される', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/labs/linear/');
  await page.getByLabel('x[0]', { exact: true }).fill('2');
  await expect(page.locator('.lab-pane').last()).toContainText('2 ×');
  await page.goto('/labs/attention/');
  await page.getByLabel('未来の位置をmask').uncheck();
  await expect(page.locator('.lab-explanation').last()).toContainText('maskを外した');
  await page.goto('/labs/sampling/');
  await page.getByLabel('greedy（最大logitを選ぶ）').check();
  await page.getByRole('button', { name: 'この条件で選ぶ' }).click();
  await expect(page.locator('.value-large')).toHaveText('です');
  await page.goto('/labs/generation/');
  await page.getByRole('button', { name: '次のトークンへ進む' }).click();
  await expect(page.locator('.stat').nth(1)).toContainText('1');
  await page.goto('/labs/gradient/');
  await page.getByRole('button', { name: '1回更新する' }).click();
  await expect(page.locator('.stat').nth(1)).toContainText('1.3000');
  await page.goto('/labs/quantization/');
  await choose(page, 'ビット幅', '2 bit');
  await page.getByLabel('最後の値を外れ値4.0にする').check();
  await expect(page.locator('tbody tr').last()).toContainText('4.000');
  await page.goto('/labs/model/');
  await page.getByRole('button', { name: 'Q projection', exact: true }).click();
  await expect(page.locator('.value-large')).toHaveText('[2048, 1024]');
  await page.goto('/labs/chat-template/');
  await page.getByLabel('Thinkingを有効にする').check();
  await expect(page.locator('.lab-data')).not.toContainText('<think>');
  expect(errors).toEqual([]);
});
test('狭幅で主要画面が横にはみ出さずメニューを操作できる', async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/learn/tensor/',
      '/labs/embedding/',
      '/reference/tokens/',
      '/search/',
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${width} ${route}`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'ナビゲーションを開く' }).click();
  await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'false');
});
test('主要画面のアクセシビリティ', async ({ page }) => {
  for (const route of [
    '/',
    '/learn/tensor/',
    '/labs/embedding/',
    '/reference/tokens/',
    '/search/',
  ]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      route,
    ).toEqual([]);
  }
});
test('代表画面を記録する', async ({ page }) => {
  await mkdir('docs/verification/screenshots', { recursive: true });
  await page.goto('/');
  await page.screenshot({ path: 'docs/verification/screenshots/home.png', fullPage: true });
  await page.goto('/labs/embedding/');
  await page.screenshot({ path: 'docs/verification/screenshots/embedding.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/learn/tensor/');
  await page.screenshot({ path: 'docs/verification/screenshots/mobile.png' });
});
