import { candidates, chosen, generated } from '../../src/lib/journey-model';
import { test, expect } from '@playwright/test';
import { journeySteps, journeyStarts } from '../../src/data/journey';
import { projectionActors, actorId, binaryActors } from '../../src/lib/journey-actors';
const root = '/LLM-LABORATORY/motion/';
async function seek(page: import('@playwright/test').Page, id: string, p: number) {
  const i = journeySteps.findIndex((s) => s.id === id);
  await page
    .getByRole('slider')
    .fill(String(Math.round((journeyStarts[i] + journeySteps[i].duration * p) / 10) * 10));
}
const focus = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`[data-entity="${id}"] .calculation-component`);
test('無処理の走査をせず、行列積と要素演算で使う全成分を強調する', async ({ page }) => {
  await page.goto(root);
  await seek(page, 'transpose', 0.75);
  await expect(focus(page, 'q')).toHaveCount(0);
  await seek(page, 'concat', 0.7);
  await expect(page.locator('.calculation-component')).toHaveCount(0);
  await seek(page, 'weighted', 0.72);
  await expect(focus(page, 'v')).toHaveCount(12);
  await expect(focus(page, 'attn')).toHaveCount(3);
  await expect(focus(page, 'score')).toHaveCount(4);
  await page.locator('.journey-theater').screenshot({
    path: '.cache/trace-weighted.png',
    style: '.journey-dock{display:none!important}',
  });
  await seek(page, 'logits', 0.7);
  await expect(focus(page, 'weight')).toHaveCount(9);
  await expect(focus(page, actorId('logits', 'gate'))).toHaveCount(3);
  await seek(page, 'residual-attn', 0.7);
  await expect(focus(page, 'skip')).toHaveCount(3);
  await expect(focus(page, actorId('residual-attn', 'attn'))).toHaveCount(3);
});
test('入力の同じパーツを使い続け、右の出力に入力値を複製しない', async ({ page }) => {
  await page.goto(root);
  for (const id of ['o-proj', 'down', 'logits']) {
    const i = journeySteps.findIndex((s) => s.id === id),
      ids = projectionActors(id)!;
    await seek(page, journeySteps[i - 1].id, 0.99);
    const original = await page.locator(`[data-entity="${ids.input}"]`).elementHandle();
    for (const p of [0.2, 0.45, 0.55]) {
      await seek(page, id, p);
      expect(await original!.evaluate((e) => e.isConnected)).toBe(true);
      const result = page.locator(`[data-entity="${ids.output}"]`);
      await expect(result.locator('[data-cell] text')).toHaveText(Array(21).fill('·'));
      await page.locator('.journey-theater').screenshot({
        path: `.cache/trace-${id}-${p}.png`,
        style: '.journey-dock{display:none!important}',
      });
    }
  }
});
test('末尾行から選択・追加・次のForwardへつながり、過去Cacheは再生成しない', async ({ page }) => {
  await page.goto(root);
  await seek(page, 'sampling', 0.55);
  await expect(page.locator('[data-entity="chosen"]')).toHaveAttribute('opacity', '0');
  await expect(page.locator('[data-entity="prob"] .tensor-label')).toContainText('Logits');
  await seek(page, 'sampling', 0.79);
  await expect(page.locator('[data-entity="prob"] .tensor-label')).toContainText('確率');
  await expect(page.locator('[data-entity="chosen"]')).toHaveAttribute('opacity', '0');
  await seek(page, 'sampling', 0.95);
  await expect(page.locator('[data-entity="chosen"] [data-cell] text')).toHaveText(
    String(candidates[chosen].id),
  );
  await page.locator('.journey-theater').screenshot({
    path: '.cache/trace-selection.png',
    style: '.journey-dock{display:none!important}',
  });
  await seek(page, 'append', 0.99);
  await expect(page.locator('[data-entity^="id-"] rect')).toHaveCount(7);
  await expect(page.getByText('保持していた入力ID · 7個', { exact: true })).toBeVisible();
  await seek(page, 'cache', 0.5);
  for (const id of ['k', 'v']) {
    expect(
      (await page.locator(`[data-entity="${id}"] [data-cell] text`).allTextContents()).includes(
        '·',
      ),
    ).toBe(false);
    await expect(focus(page, id)).toHaveCount(0);
  }
  await expect(page.locator('[data-entity="cache-new-k"]')).toHaveAttribute('opacity', '0');
  await seek(page, 'cache', 0.99);
  await expect(page.locator('[data-entity="cache-new-k"]')).toHaveAttribute('opacity', '1');
  await page
    .locator('.journey-theater')
    .screenshot({ path: '.cache/trace-cache.png', style: '.journey-dock{display:none!important}' });
  await seek(page, 'decode', 0.68);
  await expect(page.locator('[data-entity="result"] [data-cell] text')).toHaveText('こんにちは、');
  await seek(page, 'decode', 0.99);
  await expect(page.locator('[data-entity="result"] [data-cell] text')).toHaveText(
    generated.pieces.join(''),
  );
});

test('要素積とResidualは入力を保持して別の結果を作り、その結果を次へ引き継ぐ', async ({ page }) => {
  await page.goto(root);
  for (const id of ['multiply', 'residual-attn', 'residual-mlp']) {
    const ids = binaryActors(id)!;
    await seek(page, id, 0.2);
    const input = page.locator(`[data-entity="${ids.input}"] [data-cell] text`);
    const second = page.locator(`[data-entity="${ids.second}"] [data-cell] text`);
    const values = await input.allTextContents(),
      other = await second.allTextContents();
    const result = page.locator(`[data-entity="${ids.output}"]`);
    expect(
      (await result.locator('[data-cell] text').allTextContents()).every((v) => v === '·'),
    ).toBe(true);
    for (const p of [0.65, 0.8, 0.99]) {
      await seek(page, id, p);
      expect(await input.allTextContents()).toEqual(values);
      expect(await second.allTextContents()).toEqual(other);
      await page.locator('.journey-theater').screenshot({
        path: `.cache/binary-${id}-${p}.png`,
        style: '.journey-dock{display:none!important}',
      });
    }
    expect((await result.locator('[data-cell] text').allTextContents()).includes('·')).toBe(false);
    const handle = await result.elementHandle();
    const finished = await result.locator('[data-cell] text').allTextContents();
    const index = journeySteps.findIndex((s) => s.id === id);
    await seek(page, journeySteps[index + 1].id, 0.01);
    expect(await handle!.evaluate((e) => e.isConnected)).toBe(true);
    expect(await result.locator('[data-cell] text').allTextContents()).toEqual(finished);
  }
});

test('連結後はHeadによる色分けを解消し、計算中の全6成分を同じ色で示す', async ({ page }) => {
  await page.goto(root);
  for (const p of [0.6, 0.72, 0.83]) {
    await seek(page, 'o-proj', p);
    const active = focus(page, 'attn');
    await expect(active).toHaveCount(6);
    const colors = await active.evaluateAll((es) => es.map((e) => getComputedStyle(e).stroke));
    expect(new Set(colors).size).toBe(1);
    expect(colors[0]).toBe('rgb(227, 190, 121)');
    const idle = page.locator('[data-entity="attn"] rect:not(.calculation-component)').first();
    expect(await idle.evaluate((e) => getComputedStyle(e).stroke)).not.toBe(colors[0]);
    const idleRows = await page.locator('[data-entity="attn"] [data-cell]').evaluateAll((cells) => {
      const result: Record<string, string[]> = {};
      for (const cell of cells) {
        const rect = cell.querySelector('rect')!;
        if (rect.classList.contains('calculation-component')) continue;
        const row = cell.getAttribute('data-cell')!.split(':')[1];
        (result[row] ??= []).push(getComputedStyle(rect).stroke);
      }
      return Object.values(result);
    });
    for (const row of idleRows) {
      expect(row).toHaveLength(6);
      expect(new Set(row).size).toBe(1);
    }
    await expect(page.locator('[data-entity="attn"] .head-one-component')).toHaveCount(0);

    await page.locator('.journey-theater').screenshot({
      path: `.cache/head-highlight-${p}.png`,
      style: '.journey-dock{display:none!important}',
    });
  }
  await seek(page, 'o-proj', 0.95);
  await expect(focus(page, 'attn')).toHaveCount(0);
});
