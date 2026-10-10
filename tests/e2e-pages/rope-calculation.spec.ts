import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('概要と計算一覧で選択を維持し、全計算を表内で読める', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/LLM-LABORATORY/labs/rope/');
  await page.getByRole('button', { name: 'Q6 × K2', exact: true }).click();
  await page.getByRole('button', { name: '計算一覧', exact: true }).click();
  const region = page.getByRole('region', { name: '回転と内積の計算一覧（縦横にスクロール可能）' });
  await expect(page.locator('.rope-selection')).toContainText('Q6 × K2');
  await expect(page.locator('.rope-cell-calculation')).toHaveCount(28);
  await expect(page.locator('.rope-head-calculation')).toHaveCount(14);
  await expect(page.locator('#rope-rotation-title')).toHaveCount(0);
  const selected = page.locator('[data-pair="6-2"]');
  await expect(selected).toHaveClass(/is-pair-selected/);
  expect(await region.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
  expect(await region.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Q0 × K0', exact: true }).click();
  await expect(page.locator('[data-pair="0-0"] .rope-cell-answer math')).toHaveText('S0,0=20');
  await page.getByRole('button', { name: 'Q3 × K1', exact: true }).click();
  await expect(page.locator('[data-pair="3-1"] .rope-cell-answer')).toContainText('23');
  await page.getByLabel('未来位置の内積も調べる').check();
  await expect(page.locator('.rope-cell-calculation')).toHaveCount(49);
  const overflow = await page
    .locator('.rope-inline-math')
    .evaluateAll((es) =>
      es
        .filter((e) => e.scrollWidth > e.clientWidth + 2)
        .map((e) => ({
          width: e.clientWidth,
          scroll: e.scrollWidth,
          text: e.textContent?.slice(0, 35),
        })),
    );
  expect(overflow).toEqual([]);
  await page.getByRole('button', { name: '広く見る', exact: true }).click();
  await expect(page.locator('#sidebar')).toBeHidden();
  await page.getByRole('button', { name: '表の先頭へ', exact: true }).click();
  await expect.poll(() => region.evaluate((e) => e.scrollTop)).toBe(0);
  await region.screenshot({ path: 'docs/reviews/rope-calculation-start.png' });
  await page.getByRole('button', { name: '選択中の計算へ', exact: true }).click();
  await region.screenshot({ path: 'docs/reviews/rope-calculation-selected.png' });
  await region.evaluate((e) => (e.scrollTop += 600));
  await region.screenshot({ path: 'docs/reviews/rope-calculation-middle.png' });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
  }
  await region.focus();
  const x = await region.evaluate((e) => e.scrollLeft);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => region.evaluate((e) => e.scrollLeft)).toBeGreaterThan(x);
  expect((await new AxeBuilder({ page }).include('.rope-lab').analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.getByRole('button', { name: '選択中の計算へ', exact: true }).click();
  await region.screenshot({ path: 'docs/reviews/rope-calculation-mobile.png' });
  await page.getByRole('button', { name: '概要＋下の計算', exact: true }).click();
  await expect(page.locator('.rope-selection')).toContainText('Q3 × K1');
  await expect(page.locator('#rope-dot-title')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/rope-expanded/);
});
