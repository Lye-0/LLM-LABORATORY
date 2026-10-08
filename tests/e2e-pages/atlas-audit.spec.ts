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

test('改造候補は常時表示の選択領域にまとめ、外周の重複配線を作らない', async ({ page }) => {
  for (const slug of ['', 'modification/']) {
    await page.goto('/LLM-LABORATORY/maps/' + slug);
    const group = page.locator('.atlas-block--choices');
    await expect(group.locator('[data-node]')).toHaveCount(6);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(group).toContainText('上下のカードは処理の順番を表しません');
      await expect(group.locator('#n-replace-layer')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      if (width > 600) {
        await expect(page.locator('#s-modifications .atlas-route--choice')).toHaveCount(2);
        await expect(
          page.locator('#s-modifications .atlas-route[data-from="baseline"]'),
        ).toHaveCount(1);
        await expect(page.locator('#s-modifications .atlas-route[data-to="compare"]')).toHaveCount(
          1,
        );
      }
    }
    await group.locator('#n-lora summary').click();
    await expect(
      page.getByRole('dialog').getByRole('link', { name: '変更前を記録', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('link', { name: '変更前後を比べる', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('28層の全体図と1層の拡大図をクリックせず読める', async ({ page }) => {
  for (const slug of ['', 'inference/', 'training/', 'structure/']) {
    await page.goto('/LLM-LABORATORY/maps/' + slug);
    await expect(page.locator('.atlas-stack-layers li')).toHaveCount(28);
    await expect(page.locator('.atlas-stack-layers li').last()).toContainText('Layer 27');
    await expect(page.locator('#decoder-stack')).toContainText('hidden_states[28]');
    await expect(page.locator('#decoder-stack')).toContainText('最終RMSNorm後');
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.locator('#decoder-stack').screenshot({ path: `docs/reviews/stack-${width}.png` });
  }
  await page.goto('/LLM-LABORATORY/maps/data/');
  await page.locator('#n-hidden-tuple .atlas-stack-link').click();
  await expect(page).toHaveURL(/maps\/structure\/#decoder-stack/);
});
