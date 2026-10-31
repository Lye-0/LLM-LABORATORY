import { projectionActors } from '../../src/lib/journey-actors';
import { test, expect } from '@playwright/test';
import { journeySteps, journeyStarts } from '../../src/data/journey';
test('行列名と処理を分け、数値例と演算子を処理のそばに表示する', async ({ page }) => {
  await page.goto('/LLM-LABORATORY/motion/');
  const bar = page.getByLabel('最初から最後までの再生位置', { exact: true });
  for (const id of [
    'ids',
    'embedding',
    'norm',
    'qkv',
    'heads',
    'rope',
    'transpose',
    'scores',
    'mask',
    'softmax',
    'weighted',
    'concat',
    'o-proj',
    'residual-attn',
    'post-norm',
    'gate',
    'silu',
    'multiply',
    'down',
    'residual-mlp',
    'layers',
    'final',
    'logits',
    'sampling',
    'append',
    'cache',
    'decode',
  ]) {
    const i = journeySteps.findIndex((s) => s.id === id);
    await bar.fill(
      String(Math.round((journeyStarts[i] + journeySteps[i].duration * 0.95) / 10) * 10),
    );
    await expect(page.locator('.journey-operation-note').first()).toBeVisible();
    const out = await page.locator('.journey-operation-note').evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const box = node.getBoundingClientRect(),
          content = node.querySelector('.operation-content')!;
        return [...content.querySelectorAll('math,p,mrow,msqrt,mfrac')].some((e) => {
          const r = e.getBoundingClientRect();
          return r.right > box.right + 2 || r.bottom > box.bottom + 2;
        })
          ? [node.textContent]
          : [];
      }),
    );
    expect(out, `${id}: content overflow`).toEqual([]);
    await page.locator('.journey-theater').screenshot({
      path: `.cache/operation-${id}.png`,
      style: '.journey-dock{display:none!important}',
    });
  }
  for (const [id, operator] of [
    ['scores', '×'],
    ['residual-attn', '＋'],
    ['multiply', '⊙'],
  ]) {
    const i = journeySteps.findIndex((s) => s.id === id);
    await bar.fill(String(journeyStarts[i] + journeySteps[i].duration * 0.7));
    await expect(
      page.locator('.journey-operator').filter({ hasText: operator }).first(),
    ).toBeVisible();
    await expect(page.locator('.operation-detail').first()).toBeVisible();
  }
});

test('途中のフレームでも説明と行列が重ならず、分数・根号を組版する', async ({ page }) => {
  await page.goto('/LLM-LABORATORY/motion/');
  const bar = page.getByLabel('最初から最後までの再生位置', { exact: true });
  for (const [i, s] of journeySteps.entries())
    for (const p of [0.2, 0.5, 0.59, 0.75]) {
      await bar.fill(String(Math.round((journeyStarts[i] + s.duration * p) / 10) * 10));
      const conflicts = await page.evaluate(() => {
        const actors = [...document.querySelectorAll('[data-entity]')]
          .filter((e) => Number(e.getAttribute('opacity')) > 0.1)
          .map((e) => e.getBoundingClientRect());
        return [...document.querySelectorAll('.journey-operation-note:not([opacity="0"])')]
          .filter((e) => {
            const n = e.getBoundingClientRect();
            return actors.some(
              (a) => n.left < a.right && n.right > a.left && n.top < a.bottom && n.bottom > a.top,
            );
          })
          .map((e) => e.textContent);
      });
      expect(conflicts, `${s.id}:${p}`).toEqual([]);
    }
  const n = journeySteps.findIndex((s) => s.id === 'norm');
  await bar.fill(String(journeyStarts[n] + journeySteps[n].duration * 0.95));
  await expect(page.locator('.operation-formula msqrt')).toHaveCount(1);
  expect(await page.locator('.operation-formula mfrac').count()).toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test('射影の入力を出力にすり替えず、保存値を演算の外へ分ける', async ({ page }) => {
  await page.goto('/LLM-LABORATORY/motion/');
  const bar = page.getByLabel('最初から最後までの再生位置', { exact: true });
  for (const [id, _old] of [
    ['o-proj', 'attn'],
    ['down', 'gate'],
    ['logits', 'gate'],
  ]) {
    const i = journeySteps.findIndex((s) => s.id === id);
    const { input: source, output: result } = projectionActors(id)!;
    await bar.fill(String(journeyStarts[i] + journeySteps[i].duration * 0.7));
    await expect(page.locator(`[data-entity="${source}"]`)).toHaveAttribute('data-role', 'operand');
    await expect(page.locator(`[data-entity="${result}"]`)).toHaveAttribute('data-role', 'result');
    await expect(
      page.locator(`[data-entity="${result}"] [data-ready="false"]`).first(),
    ).toBeVisible();
    await bar.fill(String(journeyStarts[i] + journeySteps[i].duration * 0.99));
    const current = page.locator(`[data-entity="${result}"]`),
      input = page.locator(`[data-entity="${source}"]`);
    expect((await current.boundingBox())!.x).toBeGreaterThan((await input.boundingBox())!.x + 250);
    for (const note of await page.locator('.journey-operation-note').all())
      await expect(note).toHaveAttribute('opacity', '1');
    await page.locator('.journey-theater').screenshot({
      path: `.cache/scene-audit-final-${id}.png`,
      style: '.journey-dock{display:none!important}',
    });
  }
});
