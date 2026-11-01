import { test, expect } from '@playwright/test';
import { journeySteps, journeyStarts } from '../../src/data/journey';
const root = '/LLM-LABORATORY/motion/';
async function seek(page: import('@playwright/test').Page, id: string, p = 0.75) {
  const i = journeySteps.findIndex((s) => s.id === id);
  await page
    .getByRole('slider')
    .fill(String(Math.round((journeyStarts[i] + journeySteps[i].duration * p) / 10) * 10));
}
test('表示切替は再生時刻・再生状態と数値のDOMをリセットしない', async ({ page }) => {
  await page.clock.install();
  await page.goto(root);
  await seek(page, 'weighted');
  const before = await page.locator('[data-entity="attn"]').elementHandle();
  const values = await page.locator('[data-entity="attn"] [data-cell] text').allTextContents();
  const time = await page.getByRole('slider').inputValue();
  await page.getByRole('button', { name: '形と軸で見る', exact: true }).click();
  await expect(page.getByRole('slider')).toHaveValue(time);
  await expect(page.locator('[data-shape-entity="score"]')).toHaveAttribute('data-shape', '7x7');
  await expect(page.locator('[data-shape-entity="v"]')).toHaveAttribute('data-shape', '7x128');
  await page.getByRole('button', { name: '2×', exact: true }).click();
  await page.getByRole('button', { name: '▶ 全体を再生', exact: true }).click();
  await page.clock.runFor(300);
  const playing = Number(await page.getByRole('slider').inputValue());
  await page.getByRole('button', { name: '数値で見る', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ⅱ 一時停止', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '2×', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(Number(await page.getByRole('slider').inputValue())).toBeGreaterThanOrEqual(playing);
  expect(await before!.evaluate((e) => e.isConnected)).toBe(true);
  await page.getByRole('button', { name: 'Ⅱ 一時停止', exact: true }).click();
  await page.getByRole('slider').fill(time);
  expect(await page.locator('[data-entity="attn"] [data-cell] text').allTextContents()).toEqual(
    values,
  );
});
test('全工程に図と説明があり、主要な形と軸を表示する', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(root + '?view=shapes');
  for (const s of journeySteps) {
    await seek(page, s.id, 0.95);
    await expect(page.locator('[data-shape-scene]')).toBeVisible();
    await page.locator('.journey-canvas-scroll').screenshot({
      path: `.cache/shape-${s.id}.png`,
      style: '.journey-dock{display:none!important}',
    });
    const overflow = await page.locator('.shape-explanation').evaluateAll((es) =>
      es.flatMap((e) => {
        const b = e.getBoundingClientRect();
        return [...e.querySelectorAll('math,p')].some((n) => {
          const r = n.getBoundingClientRect();
          return r.bottom > b.bottom + 2 || r.right > b.right + 2;
        })
          ? [e.textContent]
          : [];
      }),
    );
    expect(overflow, s.id).toEqual([]);
  }
  await seek(page, 'logits');
  await expect(page.locator('[data-shape-entity="weight"]')).toHaveAttribute(
    'data-shape',
    '1024x151936',
  );
  await expect(page.locator('[data-shape-entity="logits-state"]')).toHaveAttribute(
    'data-shape',
    '7x151936',
  );
  await expect(page.locator('[data-shape-scene]')).toContainText('語彙候補');
  await page.reload();
  await expect(page.getByRole('button', { name: '形と軸で見る', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await expect(page.getByRole('button', { name: '形と軸で見る', exact: true })).toBeInViewport();
  expect(errors).toEqual([]);
});

test('共通のToken・ID・分割線は両ビューで同じ見た目と進行を保つ', async ({ page }) => {
  await page.goto(root);
  for (const stage of ['text', 'tokenize', 'ids', 'embedding', 'append', 'cache', 'decode']) {
    for (const p of [0.25, 0.75]) {
      await page.getByRole('button', { name: '数値で見る', exact: true }).click();
      await seek(page, stage, p);
      const inspect = (svg: Element) =>
        [...svg.querySelectorAll('.journey-tensor')]
          .filter((e) =>
            /^(token|id)-/.test(
              e.getAttribute('data-entity') ?? e.getAttribute('data-shape-entity') ?? '',
            ),
          )
          .map((e) => ({
            id: e.getAttribute('data-entity') ?? e.getAttribute('data-shape-entity'),
            transform: e.getAttribute('transform'),
            opacity: e.getAttribute('opacity'),
            text: [...e.querySelectorAll('text')].map((n) => ({
              text: n.textContent,
              fill: getComputedStyle(n).fill,
              font: getComputedStyle(n).fontSize,
            })),
            rects: [...e.querySelectorAll('rect')].map((n) => ({
              width: n.getAttribute('width'),
              height: n.getAttribute('height'),
              fill: getComputedStyle(n).fill,
              stroke: getComputedStyle(n).stroke,
              opacity: n.getAttribute('opacity'),
            })),
          }));
      const numbers = await page.locator('[data-journey-scene]').evaluate(inspect);
      const cuts = await page
        .locator('[data-journey-scene] .journey-cut')
        .evaluateAll((es) => es.map((e) => e.outerHTML));
      const time = await page.getByRole('slider').inputValue();
      await page.getByRole('button', { name: '形と軸で見る', exact: true }).click();
      expect(await page.locator('[data-shape-scene]').evaluate(inspect), stage).toEqual(numbers);
      expect(
        await page
          .locator('[data-shape-scene] .journey-cut')
          .evaluateAll((es) => es.map((e) => e.outerHTML)),
      ).toEqual(cuts);
      await expect(page.getByRole('slider')).toHaveValue(time);
    }
  }
});

test('全工程の移動中と完了時にラベル・軸・説明が重ならない', async ({ page }) => {
  await page.goto(root + '?view=shapes');
  for (const stage of journeySteps)
    for (const p of [0.1, 0.25, 0.4, 0.55, 0.65, 0.75, 0.85, 0.95]) {
      await seek(page, stage.id, p);
      const overlaps = await page.locator('[data-shape-scene]').evaluate((svg) => {
        const nodes = [
          ...svg.querySelectorAll(
            'text, foreignObject.shape-badge-wrap, foreignObject.shape-explanation',
          ),
        ].filter((e) => {
          let a: Element | null = e;
          while (a && a !== svg) {
            if (Number(a.getAttribute('opacity') ?? 1) < 0.15) return false;
            a = a.parentElement;
          }
          return Boolean(e.textContent?.trim());
        });
        const results: string[][] = [];
        for (let i = 0; i < nodes.length; i++)
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i],
              b = nodes[j];
            if (a.contains(b) || b.contains(a)) continue;
            const x = a.getBoundingClientRect(),
              y = b.getBoundingClientRect();
            const w = Math.min(x.right, y.right) - Math.max(x.left, y.left);
            const h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
            if (w > 3 && h > 3) results.push([a.textContent ?? '', b.textContent ?? '']);
          }
        return results;
      });
      expect(overlaps, `${stage.id} ${p}`).toEqual([]);
    }
});

test('型表示はセルを作らず、Kは同じ長方形を回転して次工程へ渡す', async ({ page }) => {
  await page.goto(root + '?view=shapes');
  for (const stage of journeySteps) {
    await seek(page, stage.id, 0.75);
    await expect(
      page.locator(
        '[data-shape-scene] .shape-cell, [data-shape-scene] .shape-processing-row, [data-shape-scene] .shape-contracted-edge, [data-shape-scene] .shape-swap',
      ),
    ).toHaveCount(0);
    for (const matrix of await page.locator('.shape-matrix').all())
      await expect(matrix.locator('.shape-body')).toHaveCount(1);
  }
  const k = page.locator('[data-shape-entity="k"]');
  for (const p of [0.1, 0.7, 0.95]) {
    await seek(page, 'transpose', p);
    await expect(k.locator('.shape-body')).toHaveAttribute('width', '192');
    await expect(k.locator('.shape-body')).toHaveAttribute('height', '136');
    const angle = Number(await k.getAttribute('data-shape-rotation'));
    if (p === 0.1) expect(angle).toBe(0);
    else if (p === 0.95) expect(angle).toBe(90);
    else {
      expect(angle).toBeGreaterThan(0);
      expect(angle).toBeLessThan(90);
    }
  }
  await seek(page, 'scores', 0);
  await expect(k).toHaveAttribute('data-shape-rotation', '90');
});

test('Maskの禁止領域は処理と連動して現れ、形を保つ処理に式と進行説明がある', async ({ page }) => {
  await page.goto(root + '?view=shapes');
  await seek(page, 'mask', 0.4);
  await expect(page.locator('.shape-mask-region')).toHaveCount(0);
  await seek(page, 'mask', 0.7);
  const mask = Number(await page.locator('.shape-mask-region').getAttribute('data-mask-progress'));
  expect(mask).toBeGreaterThan(0);
  expect(mask).toBeLessThan(1);
  await seek(page, 'mask', 0.95);
  await expect(page.locator('.shape-mask-region')).toHaveAttribute('data-mask-progress', '1');
  await seek(page, 'softmax', 0);
  await expect(page.locator('.shape-mask-region')).toHaveAttribute('data-mask-progress', '1');
  for (const stage of [
    'norm',
    'heads',
    'rope',
    'transpose',
    'mask',
    'softmax',
    'post-norm',
    'silu',
    'layers',
    'final',
    'sampling',
  ]) {
    await seek(page, stage, 0.7);
    const note = page.locator(`[data-shape-process="${stage}"]`);
    await expect(note.locator('math').first()).toBeAttached();
    await expect(note.locator('.shape-process-status')).toContainText('処理中');
    await seek(page, stage, 0.99);
    await expect(note.locator('.shape-process-status')).toContainText('完了');
  }
});
