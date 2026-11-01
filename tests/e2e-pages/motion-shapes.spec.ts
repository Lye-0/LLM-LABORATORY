import { test, expect } from '@playwright/test';
import { journeySteps, journeyStarts } from '../../src/data/journey';
const root = '/LLM-LABORATORY/motion/';
async function seek(page: import('@playwright/test').Page, id: string, p = 0.75) {
  const i = journeySteps.findIndex((s) => s.id === id);
  await page
    .getByRole('slider')
    .fill(String(Math.round((journeyStarts[i] + journeySteps[i].duration * p) / 10) * 10));
}
test('表示切替は再生時刻・再生状態と数値のDOMをリセットしない', async ({ page }) => {
  await page.clock.install();
  await page.goto(root);
  await seek(page, 'weighted');
  const before = await page.locator('[data-entity="attn"]').elementHandle();
  const values = await page.locator('[data-entity="attn"] [data-cell] text').allTextContents();
  const time = await page.getByRole('slider').inputValue();
  await page.getByRole('button', { name: '形と軸で見る', exact: true }).click();
  await expect(page.getByRole('slider')).toHaveValue(time);
  await expect(page.locator('[data-shape-entity="score"]')).toHaveAttribute('data-shape', '7x7');
  await expect(page.locator('[data-shape-entity="v"]')).toHaveAttribute('data-shape', '7x128');
  await page.getByRole('button', { name: '2×', exact: true }).click();
  await page.getByRole('button', { name: '▶ 全体を再生', exact: true }).click();
  await page.clock.runFor(300);
  const playing = Number(await page.getByRole('slider').inputValue());
  await page.getByRole('button', { name: '数値で見る', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ⅱ 一時停止', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '2×', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(Number(await page.getByRole('slider').inputValue())).toBeGreaterThanOrEqual(playing);
  expect(await before!.evaluate((e) => e.isConnected)).toBe(true);
  await page.getByRole('button', { name: 'Ⅱ 一時停止', exact: true }).click();
  await page.getByRole('slider').fill(time);
  expect(await page.locator('[data-entity="attn"] [data-cell] text').allTextContents()).toEqual(
    values,
  );
});
test('全工程に図と説明があり、主要な形と軸を表示する', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(root + '?view=shapes');
  for (const s of journeySteps) {
    await seek(page, s.id, 0.95);
    await expect(page.locator('[data-shape-scene]')).toBeVisible();
    await page
      .locator('.journey-canvas-scroll')
      .screenshot({
        path: `.cache/shape-${s.id}.png`,
        style: '.journey-dock{display:none!important}',
      });
    const overflow = await page.locator('.shape-explanation').evaluateAll((es) =>
      es.flatMap((e) => {
        const b = e.getBoundingClientRect();
        return [...e.querySelectorAll('math,p')].some((n) => {
          const r = n.getBoundingClientRect();
          return r.bottom > b.bottom + 2 || r.right > b.right + 2;
        })
          ? [e.textContent]
          : [];
      }),
    );
    expect(overflow, s.id).toEqual([]);
  }
  await seek(page, 'logits');
  await expect(page.locator('[data-shape-entity="weight"]')).toHaveAttribute(
    'data-shape',
    '1024x151936',
  );
  await expect(page.locator('[data-shape-entity="logits-state"]')).toHaveAttribute(
    'data-shape',
    '7x151936',
  );
  await expect(page.locator('[data-shape-scene]')).toContainText('語彙候補');
  await page.reload();
  await expect(page.getByRole('button', { name: '形と軸で見る', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await expect(page.getByRole('button', { name: '形と軸で見る', exact: true })).toBeInViewport();
  expect(errors).toEqual([]);
});
