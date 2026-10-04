import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('左ナビのリンクは現在のセクション内へ移動する', async ({ page }) => {
  for (const [route, prefix] of [
    ['/labs/tokenizer/', '/labs/'],
    ['/projects/observe/', '/projects/'],
  ]) {
    await page.goto(route);
    const links = await page
      .locator('#sidebar .nav-group a')
      .evaluateAll((elements) => elements.map((el) => el.getAttribute('href')));
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((href) => href?.startsWith(prefix))).toBe(true);
    await page.locator('#sidebar .nav-group a').first().click();
    await expect(page.locator('.top-nav a.active')).toHaveAttribute('href', prefix);
  }
  await page.goto('/reference/classes/tensor/');
  await expect(page.locator('.top-nav a.active')).toHaveAttribute('href', '/reference/');
  await page.locator('#sidebar .nav-group a[href="/reference/classes/tokenizer/"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tokenizer');
  await expect(page.locator('.top-nav a.active')).toHaveAttribute('href', '/reference/');
});

test('APIをライブラリ・クラス・機能の順に参照する', async ({ page }) => {
  await page.goto('/reference/');
  await page.locator('main a[href="/reference/libraries/pytorch/"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PyTorch');
  await expect(page.locator('main')).not.toContainText('AutoTokenizer');
  await page.locator('main a[href="/reference/classes/tensor/"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('torch.Tensor');
  await expect(page.locator('.api-method-group h2')).toHaveText([
    '属性',
    '参照',
    '変換',
    '形状',
    '作成',
    '学習',
  ]);
  await expect(page.locator('.api-method-groups')).not.toContainText('tokenizer.encode');
  await page.locator('main a[href="/reference/api/unsqueeze/"]').click();
  await expect(page.locator('.breadcrumb')).toContainText('PyTorch');
  await expect(page.locator('.breadcrumb')).toContainText('torch.Tensor');
  await page.goto('/reference/api/');
  await expect(page.locator('main table')).toHaveCount(0);
  await expect(page.locator('.api-library-section')).toHaveCount(2);
});

test('全画面の候補パネル・ラベル余白・キーボードを確認する', async ({ page }) => {
  const routes = [
    '/labs/tokenizer/',
    '/labs/vocabulary/',
    '/labs/embedding/',
    '/labs/attention/',
    '/labs/sampling/',
    '/labs/quantization/',
    '/reference/tokens/',
    '/reference/classes/tensor/',
    '/search/',
  ];
  for (const route of routes) {
    await page.goto(route);
    await page
      .locator('astro-island')
      .first()
      .evaluate(
        (el) =>
          new Promise<void>((resolve) => {
            if (!el.hasAttribute('ssr')) resolve();
            else el.addEventListener('astro:hydrate', () => resolve(), { once: true });
          }),
      );
    const triggers = page.getByRole('combobox');
    expect(await triggers.count(), route).toBeGreaterThan(0);
    for (let i = 0; i < (await triggers.count()); i++) {
      const trigger = triggers.nth(i);
      const field = trigger.locator('..');
      const gap = await field.evaluate((el) => {
        const label = el.querySelector('label')!.getBoundingClientRect();
        const control = el.querySelector('[role=combobox]')!.getBoundingClientRect();
        return control.top - label.bottom;
      });
      expect(gap, route).toBeGreaterThanOrEqual(9);
      await trigger.click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await expect(page.locator('.select-content')).toBeVisible();
      await expect(page.getByRole('option').first()).toHaveCSS('min-height', '44px');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
    }
  }
});

test('開いた候補が明暗・狭幅でも画面内に収まり操作できる', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/labs/tokenizer/');
    for (const theme of ['dark', 'light']) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      await page.getByRole('combobox', { name: '例文' }).click();
      const box = await page.locator('.select-content').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(900);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(
        result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
      await page.getByRole('option', { name: '␠Hello world', exact: true }).click();
      await expect(page.getByLabel('入力する文章')).toHaveValue(' Hello world');
    }
  }
});

test('教材と検索が読書・参照の操作だけで完結する', async ({ page }) => {
  for (const route of ['/learn/', '/learn/tensor/', '/search/', '/environment/']) {
    await page.goto(route);
    await expect(page.locator('body')).not.toContainText('読了');
    await expect(page.locator('body')).not.toContainText('ブックマーク');
  }
});

test('プルダウンと分類の代表画面を記録する', async ({ page }) => {
  await page.goto('/labs/tokenizer/');
  await page.getByRole('combobox', { name: '例文' }).click();
  await page.screenshot({ path: 'docs/verification/screenshots/select-open-dark.png' });
  await page.keyboard.press('Escape');
  await page.goto('/reference/libraries/pytorch/');
  await page.screenshot({
    path: 'docs/verification/screenshots/reference-pytorch.png',
    fullPage: true,
  });
});
