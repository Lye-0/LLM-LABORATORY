import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = '/LLM-LABORATORY';
test('全体地図を操作前から見渡せる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/learn/maps/`);
  const world = page.locator('.world-map');
  await expect(world.locator('.world-pipeline li')).toHaveCount(6);
  await expect(world).toContainText('[B, T, D]');
  await expect(world).toContainText('[B, T, V]');
  await expect(world).toContainText('損失');
  await expect(world).toContainText('重みの更新');
  await expect(world).toContainText('量子化');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await world.screenshot({ path: 'test-results/llm-world-map.png' });
  await expect(
    page
      .getByRole('navigation', { name: 'メインナビゲーション' })
      .getByRole('link', { name: '01 学ぶ' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('推論の全地点が常時見え、詳細は補足として開閉できる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/learn/maps/inference/`);
  const nodes = page.locator('[data-flow="inference"] .map-nodes');
  await expect(nodes.locator('li')).toHaveCount(7);
  await expect(nodes).toContainText('整数ID [1,7]');
  await expect(nodes).toContainText('ベクトル [1,7,1024]');
  await expect(nodes).toContainText('logits [1,7,151936]');
  await expect(nodes).toContainText('表示用の文字列');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.map-board').screenshot({ path: 'test-results/llm-inference-map.png' });
  const open = page.getByRole('button', { name: '文章を整数IDへの詳細を開く', exact: true });
  await open.press('Enter');
  const dialog = page.getByRole('dialog', { name: '入力から、次のトークンへの詳細' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('tokenizer.encode');
  const padding = await dialog
    .locator('.map-detail-value')
    .first()
    .evaluate((e) => parseFloat(getComputedStyle(e).paddingLeft));
  expect(padding).toBeGreaterThanOrEqual(16);
  await dialog.screenshot({ path: 'test-results/llm-map-detail.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  await expect(nodes).toContainText('表示用の文字列');
  await page.getByRole('button', { name: 'IDごとに表の行を引くの詳細を開く', exact: true }).click();
  await expect(dialog).toContainText('model.get_input_embeddings()');
  await page.reload();
  await expect(dialog).toContainText('[1, 7, 1024]');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('構造と改造の詳細を閉じて、地図の関係へ戻れる', async ({ page }) => {
  await page.goto(`${base}/learn/maps/structure/`);
  await expect(page.locator('[data-flow="model"] .map-nodes')).toContainText('LM head');
  await expect(page.locator('.residual-diagram')).toContainText('r₁');
  await page
    .locator('[data-flow="model"]')
    .getByRole('button', { name: /LM headの詳細を開く/ })
    .click();
  await expect(page.getByRole('dialog')).toContainText('重みを共有');
  await page.keyboard.press('Escape');
  await page
    .locator('[data-flow="attention"]')
    .getByRole('button', { name: /位置を反映するの詳細を開く/ })
    .click();
  await expect(page.getByRole('dialog')).toContainText('回転');
  await page.keyboard.press('Escape');
  await page.goto(`${base}/learn/maps/modification/?change=embedding`);
  await expect(page.getByRole('dialog')).toContainText('対象IDを含まない入力');
  await page.keyboard.press('Escape');
  const branches = page.locator('[data-flow="change"]');
  await expect(branches.locator('.map-route')).toHaveCount(0);
  await branches.getByRole('button', { name: /語彙を追加の詳細を開く/ }).click();
  await expect(page.getByRole('dialog')).toContainText('max(len(tokenizer)');
});

test('全追加ページの地図・小画面・テーマ・アクセシビリティ', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const slug of [
    'inference',
    'structure',
    'training',
    'modification',
    'runtime',
    'training/small-model',
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/learn/maps/${slug}/`);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('.map-board').first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page
      .locator('.map-board')
      .first()
      .screenshot({ path: `test-results/map-${slug.replaceAll('/', '-')}.png` });
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBeTruthy();
    }
  }
  await page.goto(`${base}/learn/maps/inference/`);
  await page.getByRole('button', { name: 'IDごとに表の行を引くの詳細を開く', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let theme = 0; theme < 2; theme++) {
    // Native modal excludes the background from the accessibility tree.
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '明暗テーマを切り替える' }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole('button', { name: 'IDごとに表の行を引くの詳細を開く', exact: true })
      .click();
  }
  await page.keyboard.press('Escape');
  const program = await request.get(`${base}/examples/tiny-language-model.py`);
  expect(program.ok()).toBeTruthy();
  expect(await program.text()).toContain('class TinyCausalLM');
  expect(errors).toEqual([]);
});

test('JavaScriptなしでも処理とデータの変化が見える', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4323${base}/learn/maps/inference/`);
  await expect(page.locator('.map-nodes')).toContainText('ベクトル [1,7,1024]');
  await expect(page.locator('.map-nodes')).toContainText('表示用の文字列');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
  await page.getByText('全文をまとめて読む', { exact: true }).click();
  await expect(page.locator('.map-transcript')).toContainText('tokenizer.decode');
  await context.close();
});
