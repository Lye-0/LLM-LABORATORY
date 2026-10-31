import { test, expect } from '@playwright/test';
import { journeyStarts, journeySteps } from '../../src/data/journey';
const root = '/LLM-LABORATORY/motion/';

test('古いrAF時刻でも消えず、全体の時間が非負で進む', async ({ page }) => {
  await page.addInitScript(() => {
    const raf = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => raf((time) => callback(time - 100));
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(root);
  await page.getByRole('button', { name: '▶ 全体を再生', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByLabel('最初から最後までの再生位置', { exact: true }).inputValue()),
    )
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: '次の工程', exact: true }).click();
  await expect(page.locator('[data-motion-lab]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('実時間の反復操作と主要場面の途中表示を確認する', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(root);
  for (const id of [
    'embedding',
    'norm',
    'qkv',
    'rope',
    'transpose',
    'scores',
    'residual-attn',
    'gate',
    'multiply',
    'layers',
    'cache',
  ]) {
    const i = journeySteps.findIndex((s) => s.id === id);
    for (const fraction of [0.2, 0.55, 0.85]) {
      await page
        .getByLabel('最初から最後までの再生位置', { exact: true })
        .fill(
          String(Math.round((journeyStarts[i] + journeySteps[i].duration * fraction) / 10) * 10),
        );
      await page.getByRole('button', { name: '▶ 全体を再生', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Ⅱ 一時停止', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Ⅱ 一時停止', exact: true }).click();
      await expect(page.locator('[data-motion-lab]')).toBeVisible();
      await page.locator('.journey-theater').screenshot({
        path: `.cache/journey-frame-${id}-${fraction}.png`,
        style: '.journey-dock { display:none !important; }',
      });
    }
  }
  expect(errors).toEqual([]);
});
