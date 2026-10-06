import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = '/LLM-LABORATORY';
test('全体地図からEmbeddingへ進み、コード・shape・現在地点を追う', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/learn/maps/`);
  await page.getByRole('link', { name: /今学んでいるEmbeddingは、この地点/ }).click();
  const panel = page.locator('#inference-inspection');
  await expect(panel.getByRole('heading')).toHaveText('IDごとに表の行を引く');
  await expect(panel).toContainText('[1, 7, 1024]');
  await expect(panel).toContainText('model.get_input_embeddings()');
  await page
    .getByRole('button', { name: '入力から、次のトークンへの次の地点', exact: true })
    .click();
  await expect(panel.getByRole('heading')).toHaveText('周囲の文脈を反映する');
  await page.reload();
  await expect(panel.getByRole('heading')).toHaveText('周囲の文脈を反映する');
  await page.getByRole('button', { name: /次のIDを1個選ぶ 次の整数ID/ }).press('Enter');
  await expect(panel.getByRole('heading')).toHaveText('次のIDを1個選ぶ');
  await expect(page.locator('.flow-track button[aria-pressed="true"]')).toHaveCount(1);
  await expect(panel).toContainText('argmax');
  await page.screenshot({ path: 'test-results/llm-map-inference.png' });
  expect(errors).toEqual([]);
});

test('構造の各拡大図と改造の分岐を独立に選べる', async ({ page }) => {
  await page.goto(`${base}/learn/maps/structure/`);
  await page
    .locator('[data-flow="model"]')
    .getByRole('button', { name: /LM head/ })
    .click();
  await expect(page.locator('#model-inspection')).toContainText('重みを共有');
  await page
    .locator('[data-flow="attention"]')
    .getByRole('button', { name: /位置を反映する/ })
    .click();
  await expect(page.locator('#attention-inspection')).toContainText('回転');
  await expect(page.locator('#model-inspection')).toContainText('LM head');
  await page.goto(`${base}/learn/maps/modification/?change=embedding`);
  await expect(page.locator('#change-inspection')).toContainText('対象IDを含まない入力');
  await page
    .locator('[data-flow="change"]')
    .getByRole('button', { name: /語彙を追加/ })
    .click();
  await expect(page.locator('#change-inspection')).toContainText('max(len(tokenizer)');
});

test('まとめ全ページの表示と学習用プログラムの配信', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const slug of ['inference', 'structure', 'training', 'modification', 'runtime']) {
    await page.goto(`${base}/learn/maps/${slug}/`);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('.flow-inspection').first()).toBeVisible();
  }
  await page.goto(`${base}/learn/maps/training/small-model/`);
  await expect(page.locator('main')).toContainText('保存前と一致');
  const program = await request.get(`${base}/examples/tiny-language-model.py`);
  expect(program.ok()).toBeTruthy();
  expect(await program.text()).toContain('class TinyCausalLM');
  expect(errors).toEqual([]);
});

test('小画面・明暗テーマ・図の選択・アクセシビリティ', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/learn/maps/inference/`);
  await page.getByRole('button', { name: /IDごとに表の行を引く/ }).click();
  await expect(page.locator('#inference-inspection')).toBeInViewport();
  await expect(page.locator('#inference-inspection')).toContainText('[1, 7, 1024]');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
  for (let theme = 0; theme < 2; theme++) {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('button', { name: '明暗テーマを切り替える' }).click();
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`${base}/learn/maps/structure/`);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
});

test('JavaScriptなしでも図の各地点と関連教材を読める', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4323${base}/learn/maps/inference/`);
  await page.getByText('すべての地点を文章とコードで読む', { exact: true }).click();
  await expect(page.locator('.map-transcript')).toContainText('7個のIDそれぞれに1024成分');
  await expect(page.locator('.map-transcript')).toContainText('tokenizer.decode');
  await context.close();
});
