import { test, expect } from '@playwright/test';
import { journeySteps, journeyStarts } from '../../src/data/journey';
import reference from '../../src/data/motion-reference.json' with { type: 'json' };
const model = {
  embedding: reference.vectors,
  tokenPieces: ['こんにちは', '、', '今日は', 'いい', '天', '気', 'ですね'],
};
const root = '/LLM-LABORATORY/motion/';
const barName = '最初から最後までの再生位置';
async function seek(page: import('@playwright/test').Page, id: string, p: number) {
  const i = journeySteps.findIndex((s) => s.id === id);
  await page
    .getByLabel(barName, { exact: true })
    .fill(String(Math.round((journeyStarts[i] + journeySteps[i].duration * p) / 10) * 10));
}

test('文字を交換せず、同じ文字列へ境界を入れてTokenに開く', async ({ page }) => {
  await page.goto(root);
  const first = await page.locator('[data-cell="token-0:0:0"] text').elementHandle();
  const getWords = () => page.locator('[data-entity^="token-"] [data-cell] text').allTextContents();
  expect((await getWords()).join('')).toBe(model.tokenPieces.join(''));
  const original = await page.locator('[data-cell="token-0:0:0"]').getAttribute('data-x');
  await seek(page, 'tokenize', 0.15);
  await expect(page.locator('.journey-cut')).toHaveCount(6);
  expect(await first!.evaluate((e) => e.isConnected)).toBe(true);
  expect(await page.locator('[data-cell="token-0:0:0"]').getAttribute('data-x')).toBe(original);
  await page.locator('.journey-theater').screenshot({
    path: '.cache/refine-token-cuts.png',
    style: '.journey-dock{display:none!important}',
  });
  await seek(page, 'tokenize', 0.58);
  expect((await getWords()).join('')).toBe(model.tokenPieces.join(''));
  expect(await first!.evaluate((e) => e.isConnected)).toBe(true);
  await page.locator('.journey-theater').screenshot({
    path: '.cache/refine-token-opening.png',
    style: '.journey-dock{display:none!important}',
  });
  await seek(page, 'tokenize', 0.94);
  expect((await getWords()).join('')).toBe(model.tokenPieces.join(''));
  expect(
    Number(await page.locator('[data-cell="token-0:0:0"]').getAttribute('data-x')),
  ).toBeLessThan(Number(original));
});

test('移動開始時は元の値を保ち、到着直前から行ごとに更新して結果を保持する', async ({ page }) => {
  await page.goto(root);
  await seek(page, 'norm', 0.2);
  await expect(page.locator('[data-entity="hidden"] [data-updated="true"]')).toHaveCount(0);
  await expect(page.locator('[data-cell="hidden:0:0"]')).toHaveAttribute(
    'data-value',
    String(model.embedding[0][0]),
  );
  await expect(page.locator('.journey-code .active')).toHaveCount(0);
  await seek(page, 'norm', 0.57);
  await expect(page.locator('[data-entity="hidden"] [data-updated="true"]')).toHaveCount(0);
  await seek(page, 'norm', 0.7);
  const updated = await page.locator('[data-entity="hidden"] [data-updated="true"]').count();
  expect(updated).toBeGreaterThan(0);
  expect(updated).toBeLessThan(21);
  await seek(page, 'norm', 0.9);
  await expect(page.locator('[data-entity="hidden"] [data-updated="true"]')).toHaveCount(21);
  const before = await page
    .locator('[data-entity="hidden"] [data-cell]')
    .evaluateAll((es) => es.map((e) => e.getAttribute('data-value')));
  await seek(page, 'norm', 0.98);
  expect(
    await page
      .locator('[data-entity="hidden"] [data-cell]')
      .evaluateAll((es) => es.map((e) => e.getAttribute('data-value'))),
  ).toEqual(before);
  await seek(page, 'qkv', 0.2);
  await expect(page.locator('[data-entity="q"] [data-ready="true"]')).toHaveCount(0);
  await seek(page, 'qkv', 0.95);
  await expect(page.locator('[data-entity="q"] [data-ready="true"]')).toHaveCount(42);
});

test('中心の処理を大きくし、並列と保存経路を残したまま強弱を付ける', async ({ page }) => {
  await page.goto(root);
  for (const [id, entity] of [
    ['heads', 'q'],
    ['rope', 'k'],
    ['softmax', 'score'],
    ['silu', 'gate'],
  ] as const) {
    await seek(page, id, 0.95);
    const pose = await page.locator(`[data-entity="${entity}"]`).evaluate((e) => {
      const rects = Array.from(e.querySelectorAll('rect'));
      return {
        center:
          Number(e.getAttribute('transform')?.match(/translate\(([^,]+)/)?.[1]) +
          ((rects.length / 7) * (Number(rects[0].getAttribute('width')) + 4)) / 2,
        width: Number(rects[0].getAttribute('width')),
      };
    });
    expect(pose.center).toBeGreaterThan(460);
    expect(pose.center).toBeLessThan(540);
    expect(pose.width).toBeGreaterThanOrEqual(36);
    await expect(page.locator(`[data-entity="${entity}"]`)).toHaveClass(/is-active/);
    await page.locator('.journey-theater').screenshot({
      path: `.cache/refine-${id}.png`,
      style: '.journey-dock{display:none!important}',
    });
  }
  await expect(page.locator('[data-entity="skip2"]')).toHaveClass(/is-support/);
});
