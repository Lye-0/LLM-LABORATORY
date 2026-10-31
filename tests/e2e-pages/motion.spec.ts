import { test, expect } from '@playwright/test';
import { motionSteps } from '../../src/data/motion';
const root = '/LLM-LABORATORY';
test('全26段階を同じ画面で追え、式・コード・関連リンクが対応する', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${root}/motion/`);
  await expect(page.locator('.top-nav a.active')).toHaveText(/動きで学ぶ/);
  await page.getByLabel('動きを減らす', { exact: true }).check();
  for (const [i, s] of motionSteps.entries()) {
    await page.getByLabel('段階を直接選ぶ', { exact: true }).selectOption(String(i));
    await expect(page.locator('#motion-title')).toHaveText(s.title);
    await expect(
      page
        .locator(s.kind === 'sampling' ? '.motion-candidates' : '.motion-stage svg[role="img"]')
        .first(),
    ).toBeVisible();
    await expect(page.locator('.motion-reading code').first()).toHaveText(s.formula);
    await expect(page.locator('.motion-reading code').nth(1)).toHaveText(s.code);
    await expect(page).toHaveURL(new RegExp(`step=${s.id}(?:&|$)`));
    await expect(page.getByRole('link', { name: '仕組みを読む ↗', exact: true })).toHaveAttribute(
      'href',
      `${root}/learn/${s.lesson}/`,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.locator('.motion-stage').screenshot({
      path: `.cache/motion-stage-${String(i).padStart(2, '0')}.png`,
      style: '.motion-controls { visibility: hidden !important; }',
    });
  }
  expect(errors).toEqual([]);
});
test('再生・一時停止・巻き戻しは図と同期し、章を進めても停止位置を保持する', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${root}/motion/?step=transpose`);
  await expect(page.locator('#motion-title')).toContainText('行と列');
  await page.getByRole('button', { name: '▶ 連続再生', exact: true }).click();
  await page.clock.runFor(1500);
  await page.getByRole('button', { name: 'Ⅱ 一時停止', exact: true }).click();
  const slider = page.getByLabel('この段階の再生位置', { exact: true });
  const value = await slider.inputValue();
  expect(Number(value)).toBeGreaterThan(0);
  await page.clock.runFor(7000);
  await expect(slider).toHaveValue(value);
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveValue('0');
  await page.getByRole('button', { name: '▶ 連続再生', exact: true }).click();
  await page.clock.runFor(6000);
  await expect(page.locator('#motion-title')).toHaveText(motionSteps[5].title);
  await page.getByLabel('動きを減らす', { exact: true }).check();
  await expect(slider).toHaveValue('5600');
  await page.clock.runFor(10000);
  await expect(page.locator('#motion-title')).toHaveText(motionSteps[5].title);
});
test('地図から該当段階へ移動して元へ戻れ、外部の戻り先を受け付けない', async ({ page }) => {
  await page.goto(`${root}/maps/inference/`);
  await page.locator('#n-q-rope > details > summary').click();
  await page
    .locator('.atlas-inspector')
    .getByRole('link', { name: 'この処理を動きで見る →', exact: true })
    .click();
  await expect(page).toHaveURL(/step=rope/);
  await page.getByRole('link', { name: '移動元のページへ戻る ↗', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${root}/maps/inference/#n-q-rope`));
  await page.goto(`${root}/motion/?step=layers&layer=27&from=https://example.com`);
  await expect(page.getByLabel('観察する層')).toHaveValue('27');
  await expect(page.getByRole('link', { name: '移動元のページへ戻る ↗', exact: true })).toHaveCount(
    0,
  );
});
test('狭幅・明暗でも表示を保ち、OSの動き軽減とキーボードへ対応する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${root}/motion/?step=qkv`);
  await expect(page.getByLabel('動きを減らす', { exact: true })).toBeChecked();
  await expect(page.locator('.motion-branch')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.getByRole('button', { name: '明暗テーマを切り替える' }).click();
  const stage = page.locator('.motion-stage');
  await stage.focus();
  await stage.press('ArrowRight');
  await expect(page.locator('#motion-title')).toHaveText(motionSteps[8].title);
  await page.screenshot({ path: '.cache/motion-mobile.png', fullPage: true });
});

test('代表的な処理の開始・途中・完了を描画できる', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${root}/motion/`);
  for (const id of [
    'embedding',
    'transpose',
    'linear',
    'rope',
    'residual-attn',
    'layers',
    'cache',
  ]) {
    const index = motionSteps.findIndex((s) => s.id === id);
    await page.getByLabel('段階を直接選ぶ', { exact: true }).selectOption(String(index));
    for (const [frame, time] of [
      [0, 0],
      [1, 1900],
      [2, 4000],
    ]) {
      const slider = page.getByLabel('この段階の再生位置', { exact: true });
      await slider.fill(String(time));
      await page.locator('.motion-stage').screenshot({
        path: `.cache/motion-frame-${id}-${frame}.png`,
        style: '.motion-controls { visibility: hidden !important; }',
      });
    }
  }
  await page.getByLabel('段階を直接選ぶ', { exact: true }).selectOption('5');
  await page.screenshot({ path: '.cache/motion-desktop.png', fullPage: true });
});
