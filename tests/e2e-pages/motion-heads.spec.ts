import { test, expect } from '@playwright/test';
import { journeySteps, journeyStarts } from '../../src/data/journey';
import { firstLayer } from '../../src/lib/journey-model';
const root = '/LLM-LABORATORY/motion/';
async function seek(page: import('@playwright/test').Page, id: string, p: number) {
  const i = journeySteps.findIndex((s) => s.id === id);
  await page
    .getByRole('slider')
    .fill(String(Math.round((journeyStarts[i] + journeySteps[i].duration * p) / 10) * 10));
}
test('Qの6成分を2 Headへ分け、同じ値と位置から分割が始まる', async ({ page }) => {
  await page.goto(root);
  await seek(page, 'qkv', 0.99);
  const original = await page.locator('[data-cell="q:0:3"]').evaluate((e) => ({
    x: e.getAttribute('data-x'),
    y: e.getAttribute('data-y'),
    value: e.getAttribute('data-value'),
  }));
  await seek(page, 'heads', 0);
  const split = await page.locator('[data-cell="q-head-1:0:0"]').evaluate((e) => ({
    x: e.getAttribute('data-x'),
    y: e.getAttribute('data-y'),
    value: e.getAttribute('data-value'),
  }));
  expect(split).toEqual(original);
  await expect(page.locator('[data-entity="q"] [data-cell]')).toHaveCount(21);
  await expect(page.locator('[data-entity="q-head-1"] [data-cell]')).toHaveCount(21);
  await seek(page, 'heads', 0.25);
  await expect(page.locator('[data-slice-view="numbers"]')).toHaveAttribute(
    'data-head-state',
    'splitting',
  );
  await seek(page, 'rope', 0.7);
  const context = page.locator('[data-slice-view="numbers"]');
  await expect(context).toContainText('Q Head 0');
  await expect(context).toContainText('KV Head 0 / 全1');
  await expect(context).toContainText('Q Head 0 / 全2');
  await expect(context).toContainText('Batch 0 · Layer 0');
  await expect(context).not.toContainText('Token位置');
  await expect(context).not.toContainText('詳細計算');
});
test('2 Headの結果が各Tokenの横へ並び、その全6成分をo_projへ渡す', async ({ page }) => {
  await page.goto(root);
  await seek(page, 'concat', 0.95);
  await expect(page.locator('[data-slice-view="numbers"]')).toHaveAttribute(
    'data-head-state',
    'joined',
  );
  const a = page.locator('[data-cell="attn:0:0"]'),
    b = page.locator('[data-cell="context-head-1:0:0"]');
  const left = await a.evaluate((e) => ({
    x: Number(e.getAttribute('data-x')),
    y: Number(e.getAttribute('data-y')),
  }));
  const right = await b.evaluate((e) => ({
    x: Number(e.getAttribute('data-x')),
    y: Number(e.getAttribute('data-y')),
  }));
  expect(right.y).toBe(left.y);
  expect(right.x - left.x).toBe(132);
  const values = await page
    .locator('[data-entity="context-head-1"] [data-cell]')
    .evaluateAll((es) => es.map((e) => Number(e.getAttribute('data-value'))));
  values.forEach((value, i) => expect(value).toBeCloseTo(firstLayer.contextHeads[1].flat()[i], 12));
  await seek(page, 'o-proj', 0);
  const input = page.locator('[data-entity="attn"] [data-cell]');
  await expect(input).toHaveCount(42);
  const combined = await input.evaluateAll((es) =>
    es.map((e) => Number(e.getAttribute('data-value'))),
  );
  combined.forEach((value, i) => expect(value).toBeCloseTo(firstLayer.joined.flat()[i], 12));
  for (const p of [0.2, 0.5, 0.8, 0.99]) {
    await seek(page, 'concat', p);
    await page.locator('.journey-theater').screenshot({
      path: `.cache/head-join-${p}.png`,
      style: '.journey-dock{display:none!important}',
    });
  }
});
test('形表示も表示中のHeadと全Headの結合を区別し、切替で時刻を保つ', async ({ page }) => {
  await page.goto(root + '?view=shapes');
  await seek(page, 'heads', 0.95);
  const context = page.locator('[data-slice-view="shapes"]');
  await expect(context).toContainText('Q Head 0 / 全16');
  await expect(context).toContainText('KV Head 0 / 全8');
  await seek(page, 'concat', 0.7);
  await expect(context).toHaveAttribute('data-head-state', 'joining');
  await seek(page, 'concat', 0.95);
  await expect(context).toHaveAttribute('data-head-state', 'joined');
  await expect(context).not.toContainText('Head');
  await expect(context).toContainText('Batch 0 · Layer 0');
  const time = await page.getByRole('slider').inputValue();
  await page.getByRole('button', { name: '数値で見る', exact: true }).click();
  await expect(page.getByRole('slider')).toHaveValue(time);
  await expect(page.locator('[data-slice-view="numbers"]')).toHaveText(
    '表示スライスBatch 0 · Layer 0',
  );
});

test('両ビューの表示範囲が収まり、分割と結合の途中でも読める', async ({ page }) => {
  await page.goto(root);
  for (const view of ['numbers', 'shapes']) {
    await page
      .getByRole('button', {
        name: view === 'numbers' ? '数値で見る' : '形と軸で見る',
        exact: true,
      })
      .click();
    for (const stage of ['qkv', 'heads', 'rope', 'scores', 'weighted', 'concat', 'o-proj'])
      for (const p of [0.1, 0.4, 0.7, 0.95]) {
        await seek(page, stage, p);
        const panel = page.locator(`[data-slice-view="${view}"]`);
        await expect(panel).toBeVisible();
        await expect(panel).not.toContainText(/成分|Token位置|Query位置|処理|正規化/);
        if (['qkv', 'concat', 'o-proj'].includes(stage))
          await expect(panel).not.toContainText('Head');
        const fits = await panel.evaluate((el) => {
          const boundary = el.parentElement!.getBoundingClientRect();
          return [...el.querySelectorAll('strong,span,small')].every((child) => {
            const r = child.getBoundingClientRect();
            return r.right <= boundary.right + 1 && r.bottom <= boundary.bottom + 1;
          });
        });
        expect(fits, `${view}:${stage}:${p}`).toBe(true);
        if (['heads', 'concat'].includes(stage))
          await page.locator('.journey-theater').screenshot({
            path: `.cache/head-${view}-${stage}-${p}.png`,
            style: '.journey-dock{display:none!important}',
          });
      }
  }
});
