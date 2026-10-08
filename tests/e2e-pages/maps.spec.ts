import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = '/LLM-LABORATORY';
const slugs = [
  '',
  'inference/',
  'training/',
  'modification/',
  'structure/',
  'data/',
  'runtime/',
  'ecosystem/',
];
test('全体地図には詳細な分岐が初期表示され、検索しても他の地点を隠さない', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/maps/`);
  const count = await page.locator('[data-node]').count();
  expect(count).toBeGreaterThan(100);
  for (const id of [
    'q-proj',
    'q-norm',
    'k-rope',
    'v-gqa',
    'scores',
    'softmax',
    'gate-proj',
    'up-proj',
    'multiply',
    'residual-mlp',
    'backward',
    'lora',
    'tool-run',
  ])
    await expect(page.locator(`#n-${id}`)).toBeVisible();
  await expect(page.locator('.atlas-route[data-from="input-norm"][data-to="v-proj"]')).toHaveCount(
    1,
  );
  await expect(
    page.locator('.atlas-route[data-from="v-heads"][data-to="v-transpose"]'),
  ).toHaveCount(1);
  await page.getByLabel('地図内を探す', { exact: true }).fill('q_norm');
  await page.getByLabel('地図内を探す', { exact: true }).press('Enter');
  await expect(page.locator('.is-current-match')).toHaveCount(1);
  await expect(page.locator('[data-node]')).toHaveCount(count);
  await expect(page.locator('[data-search-status]')).toContainText('Q-Norm / RMSNorm：Qの正規化');
  await page.getByRole('button', { name: '広く見る', exact: true }).click();
  await expect(page.locator('#sidebar')).toBeHidden();
  await page.getByRole('button', { name: '左メニューを戻す' }).click();
  await expect(page.locator('#sidebar')).toBeVisible();
});
test('補足は中央ポップアップで、URL復元・履歴・Escape・フォーカス復帰に対応', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/maps/inference/`);
  const opener = page.locator('#n-embedding summary');
  const originalWidth = (await page.locator('.atlas-canvas').boundingBox())!.width;
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('151936');
  expect(page.url()).toContain('detail=embedding');
  const canvas = await page.locator('.atlas-canvas').boundingBox(),
    detail = await dialog.boundingBox();
  expect(canvas!.width).toBe(originalWidth);
  expect(detail!.width).toBeGreaterThan(650);
  expect(Math.abs(detail!.x + detail!.width / 2 - 720)).toBeLessThan(2);
  expect(await dialog.evaluate((el) => el.matches(':modal'))).toBeTruthy();
  await page.reload();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await page.locator('#n-q-norm summary').click();
  await page.goBack();
  await expect(dialog).toBeHidden();
  await page.goForward();
  await expect(dialog).toContainText('Q-Norm / RMSNorm：Qの正規化');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.matches(':modal'))).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(page.locator('#n-q-norm summary')).toBeFocused();
});
test('8種類の地図は狭幅・明暗でも情報が欠けず、アクセシビリティ違反がない', async ({ page }) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const slug of slugs) {
    await page.goto(`${base}/maps/${slug}`);
    for (const width of [320, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${slug} ${width}`,
      ).toBeTruthy();
    }
    await expect(page.locator('.top-nav a[aria-current]')).toHaveAttribute('href', `${base}/maps/`);
    expect((await new AxeBuilder({ page }).analyze()).violations, slug).toEqual([]);
  }
  await page.goto(`${base}/maps/inference/`);
  await page.getByRole('button', { name: '明暗テーマを切り替える' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#n-embedding summary').click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#n-q-proj').scrollIntoViewIfNeeded();
  expect(errors).toEqual([]);
});
test('旧URLの地点指定が移行し、小モデル教材は学ぶに残る', async ({ page, request }) => {
  for (const [old, next] of [
    ['inference/?inference=embedding', 'inference/#n-embedding'],
    ['structure/?attention=rope', 'structure/#n-q-rope'],
    ['training/?update=step', 'training/#n-optimizer'],
    ['modification/?change=embedding', 'modification/#n-embedding-edit'],
    ['runtime/?runtime=reload', 'runtime/#n-reload'],
  ]) {
    await page.goto(`${base}/learn/maps/${old}`);
    await expect(page).toHaveURL(new RegExp(`/maps/${next}$`));
  }
  await page.goto(`${base}/learn/maps/training/small-model/`);
  await expect(page.locator('.top-nav a[aria-current]')).toHaveAttribute('href', `${base}/learn/`);
  await expect(page.locator('.map-board').first()).toBeVisible();
  const program = await request.get(`${base}/examples/tiny-language-model.py`);
  expect(await program.text()).toContain('class TinyCausalLM');
  const search = await (await request.get(`${base}/search-index.json`)).json();
  expect(JSON.stringify(search)).not.toContain('/learn/maps/inference/');
  expect(JSON.stringify(search)).toContain('/maps/#n-q-norm');
});
test('JavaScriptなしでも8地図・分岐の意味・補足を読める', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4323${base}/maps/inference/`);
  await expect(page.locator('#n-q-proj')).toBeVisible();
  await expect(page.locator('#n-v-transpose')).toContainText('RoPEを適用しない');
  await page.locator('#n-embedding summary').click();
  await expect(page.locator('#n-embedding .atlas-detail-body')).toBeVisible();
  await expect(page.locator('#n-embedding')).toContainText('get_input_embeddings');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.goto(`http://127.0.0.1:4323${base}/learn/maps/inference/`);
  await expect(page.locator('a[href$="/maps/inference/"]').first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://lye-0.github.io/LLM-LABORATORY/maps/inference/',
  );
  await context.close();
});
