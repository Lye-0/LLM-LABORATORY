import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('RoPEの記号計算、49組、未来maskと狭幅を確認', async ({ page }) => {
  await page.goto('/LLM-LABORATORY/labs/rope/');
  await expect(page.locator('.rope-table tbody button')).toHaveCount(49);
  await expect(page.locator('.rope-table button:disabled')).toHaveCount(21);
  await expect(page.locator('.rope-selection')).toContainText('Q3 × K1');
  const formula = page.getByRole('region', { name: '内積の最終式', exact: true });
  await expect(formula).toContainText('14');
  await expect(formula).toContainText('23');
  await expect(formula).toContainText('18');
  await page.getByRole('button', { name: 'Q0 × K0', exact: true }).click();
  await expect(formula.locator('math')).toHaveText('S0,0=20');
  await page.getByLabel('未来位置の内積も調べる').check();
  await page
    .getByRole('button', { name: 'Q0 × K6、位置差6、未来位置・mask対象', exact: true })
    .click();
  await expect(page.locator('.rope-selection')).toContainText('mask対象');
  await expect(page.locator('#rope-score-title').locator('..')).toContainText('−∞');
  await page.getByLabel('各マスに内積の式を表示').check();
  await expect(page.locator('.rope-cell-formula')).toHaveCount(49);
  await page.getByLabel('各マスに内積の式を表示').uncheck();
  await page.getByLabel('未来位置の内積も調べる').uncheck();
  await expect(page.locator('.rope-selection')).toContainText('Q0 × K0');
  await page.getByRole('button', { name: 'Q6 × K2', exact: true }).click();
  await expect(page.locator('.rope-selection')).toContainText('相対位置 t−p = 2−6 = -4');
  await page.getByText('整数ベクトルと相対回転行列を代入する', { exact: true }).click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
  }
  expect((await new AxeBuilder({ page }).include('.rope-lab').analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.locator('.rope-table').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/reviews/rope-desktop.png' });
  await page.getByRole('button', { name: 'Q3 × K1', exact: true }).click();
  await page.locator('.rope-heads').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/reviews/rope-matrices.png' });
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.locator('#rope-dot-title').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/reviews/rope-mobile.png' });
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
  await page.locator('.rope-table').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/reviews/rope-light.png' });
});
