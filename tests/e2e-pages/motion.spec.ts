import { test, expect } from '@playwright/test';
import { journeyDuration, journeyStarts, journeySteps } from '../../src/data/journey';
const root = '/LLM-LABORATORY';
const sliderName = '最初から最後までの再生位置';

test('全工程が一本のバーと横並び一覧でたどれ、全ての図・式・コードが描画できる', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${root}/motion/`);
  await expect(page.locator('.top-nav a.active')).toHaveText(/動きで学ぶ/);
  await expect(page.locator('.journey select')).toHaveCount(0);
  await expect(page.getByRole('slider')).toHaveCount(1);
  await expect(page.locator('.journey-rail button')).toHaveCount(journeySteps.length);
  const bar = page.getByLabel(sliderName, { exact: true });
  await expect(bar).toHaveAttribute('max', String(journeyDuration));
  for (const [i, s] of journeySteps.entries()) {
    await bar.fill(String(Math.round((journeyStarts[i] + s.duration * 0.95) / 10) * 10));
    await expect(page.locator('#motion-title')).toHaveText(s.title);
    await expect(page.locator('.journey-reference-math math').first()).toBeVisible();
    await expect(page.locator('.journey-code code')).toHaveText(s.code);
    await expect(page.locator('.journey-rail [aria-current]')).toHaveAttribute('data-step', s.id);
    await expect(page.locator('.journey-rail [aria-current]')).toBeInViewport();
    await expect(page.getByRole('link', { name: '仕組みを読む ↗', exact: true })).toHaveAttribute(
      'href',
      `${root}/learn/${s.lesson}/`,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.locator('.journey-theater').screenshot({
      path: `.cache/journey-stage-${s.id}.png`,
      style: '.journey-dock { display:none !important; }',
    });
  }
  expect(errors).toEqual([]);
});

test('工程境界でも同じDOM要素と位置を保持し、時間は全体で進み続ける', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${root}/motion/`);
  const bar = page.getByLabel(sliderName, { exact: true });
  const normIndex = journeySteps.findIndex((s) => s.id === 'norm');
  await bar.fill(String(journeyStarts[normIndex]));
  const cell = await page.locator('[data-cell="hidden:0:0"]').elementHandle();
  const before = await cell!.evaluate((e) => ({
    x: e.getAttribute('data-x'),
    y: e.getAttribute('data-y'),
    value: e.getAttribute('data-value'),
  }));
  await bar.fill(String(journeyStarts[normIndex] + 10));
  expect(await cell!.evaluate((e) => e.isConnected)).toBe(true);
  const after = await cell!.evaluate((e) => ({
    x: e.getAttribute('data-x'),
    y: e.getAttribute('data-y'),
    value: e.getAttribute('data-value'),
  }));
  expect(after.value).toBe(before.value);
  expect(Number(after.x)).toBeCloseTo(Number(before.x), 2);
  expect(Number(after.y)).toBeCloseTo(Number(before.y), 2);
  await bar.fill(String(journeyStarts[normIndex + 1] - 500));
  await page.getByRole('button', { name: '▶ 全体を再生', exact: true }).click();
  await page.clock.runFor(1200);
  expect(Number(await bar.inputValue())).toBeGreaterThan(journeyStarts[normIndex + 1]);
  await expect(page.locator('.journey-rail [aria-current]')).toHaveAttribute('data-step', 'qkv');
  await page.getByRole('button', { name: 'Ⅱ 一時停止', exact: true }).click();
  const paused = await bar.inputValue();
  await page.clock.runFor(3000);
  await expect(bar).toHaveValue(paused);
});

test('地図と往復し、全体位置のURL復元・戻り先の検証・狭幅・動き軽減に対応する', async ({
  page,
}) => {
  await page.goto(`${root}/maps/inference/`);
  await page.locator('#n-q-rope > details > summary').click();
  await page
    .locator('.atlas-inspector')
    .getByRole('link', { name: 'この処理を動きで見る →', exact: true })
    .click();
  await expect(page).toHaveURL(/step=rope/);
  await page.getByRole('link', { name: '移動元のページへ戻る ↗', exact: true }).click();
  await expect(page).toHaveURL(/maps\/inference\/#n-q-rope/);
  const t = journeyStarts[journeySteps.findIndex((s) => s.id === 'weighted')] + 3000;
  await page.goto(`${root}/motion/?t=${t}&from=https://example.com`);
  await expect(page.getByLabel(sliderName, { exact: true })).toHaveValue(String(t));
  await expect(page.getByRole('link', { name: '移動元のページへ戻る ↗', exact: true })).toHaveCount(
    0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.getByRole('button', { name: '▶ 全体を再生', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '明暗テーマを切り替える' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await expect(page.locator('.journey-dock')).toBeInViewport();
  await page.screenshot({ path: '.cache/journey-mobile.png', fullPage: true });
});

test('前後へのシークは同じ値と配置を復元し、レールのボタンから工程を選べる', async ({ page }) => {
  await page.goto(`${root}/motion/`);
  const bar = page.getByLabel(sliderName, { exact: true });
  const i = journeySteps.findIndex((s) => s.id === 'rope'),
    t = journeyStarts[i] + journeySteps[i].duration * 0.8;
  await bar.fill(String(t));
  const values = await page
    .locator('[data-entity="q"] [data-cell]')
    .evaluateAll((es) =>
      es.map((e) => [
        e.getAttribute('data-x'),
        e.getAttribute('data-y'),
        e.getAttribute('data-value'),
      ]),
    );
  await bar.fill('0');
  await bar.fill(String(t));
  expect(
    await page
      .locator('[data-entity="q"] [data-cell]')
      .evaluateAll((es) =>
        es.map((e) => [
          e.getAttribute('data-x'),
          e.getAttribute('data-y'),
          e.getAttribute('data-value'),
        ]),
      ),
  ).toEqual(values);
  await page.locator('[data-step="gate"]').click();
  await expect(page.locator('#motion-title')).toHaveText(
    journeySteps.find((s) => s.id === 'gate')!.title,
  );
  await page.getByLabel('動きを減らす', { exact: true }).check();
  await page.locator('.journey-theater').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.journey-rail [aria-current]')).toHaveAttribute('data-step', 'silu');
  await page.screenshot({ path: '.cache/journey-desktop.png', fullPage: true });
});

test('次へ・前へは現在の時刻から動き、工程の境界で停止する', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${root}/motion/`);
  const bar = page.getByLabel(sliderName, { exact: true }),
    i = journeySteps.findIndex((s) => s.id === 'norm'),
    start = journeyStarts[i];
  await bar.fill(String(start + 2000));
  await page.getByRole('button', { name: '次の工程', exact: true }).click();
  expect(Number(await bar.inputValue())).toBeLessThan(journeyStarts[i + 1]);
  await page.clock.runFor(1000);
  expect(Number(await bar.inputValue())).toBeGreaterThan(start + 2000);
  expect(Number(await bar.inputValue())).toBeLessThan(journeyStarts[i + 1]);
  await page.clock.runFor(journeySteps[i].duration + 1000);
  await expect(bar).toHaveValue(String(journeyStarts[i + 1]));
  await expect(page.getByRole('button', { name: '▶ 全体を再生', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '前の工程', exact: true }).click();
  await page.clock.runFor(1000);
  expect(Number(await bar.inputValue())).toBeLessThan(journeyStarts[i + 1]);
  expect(Number(await bar.inputValue())).toBeGreaterThan(start);
  await page.clock.runFor(journeySteps[i].duration + 1000);
  await expect(bar).toHaveValue(String(start));
});
