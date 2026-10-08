import { test, expect } from '@playwright/test';

test('全地点の補足を末尾まで読んでも閉じる操作と横幅を保つ', async ({ page }) => {
  test.setTimeout(120000);
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/LLM-LABORATORY/maps/');
    const ids = await page
      .locator('[data-node]')
      .evaluateAll((es) => es.map((e) => (e as HTMLElement).dataset.node!));
    expect(ids).toHaveLength(114);
    for (const id of ids) {
      await page.locator(`#n-${id} summary`).click();
      const dialog = page.getByRole('dialog');
      await dialog.evaluate((e) => (e.scrollTop = e.scrollHeight));
      const geometry = await dialog.evaluate((e) => {
        const r = e.getBoundingClientRect();
        const close = e.querySelector('button')!.getBoundingClientRect();
        return {
          overflow: e.scrollWidth - e.clientWidth,
          visible: close.top >= r.top && close.bottom <= r.bottom,
          inside: r.left >= 0 && r.right <= innerWidth,
        };
      });
      expect(geometry, `${width}/${id}`).toEqual({ overflow: 0, visible: true, inside: true });
      await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
      await expect(dialog).not.toBeVisible();
    }
  }
});

test('学習の章境界と保存後の分岐が本文と補足で一致する', async ({ page }) => {
  await page.goto('/LLM-LABORATORY/maps/training/');
  await expect(page.locator('#n-prefill h3')).toHaveText('学習用batchの計算を開始');
  await expect(
    page.locator('.atlas-cross-route[data-from="lm-head"][data-to="shift"]'),
  ).toHaveAttribute('data-direct', 'true');
  await page.locator('#n-lm-head summary').click();
  await expect(
    page.getByRole('dialog').getByRole('link', { name: '予測と次の正解を対応', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/LLM-LABORATORY/maps/runtime/');
  const reload = await page.locator('#n-reload').boundingBox();
  const engine = await page.locator('#n-engine').boundingBox();
  expect(Math.abs(reload!.y - engine!.y)).toBeLessThan(1);
  for (const id of ['reload', 'engine']) {
    await expect(page.locator(`.atlas-route[data-from="export"][data-to="${id}"]`)).toHaveCount(1);
  }
});
