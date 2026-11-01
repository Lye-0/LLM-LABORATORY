import { test, expect } from '@playwright/test';
import { journeySteps, journeyStarts } from '../../src/data/journey';

test('両ビューの全体shapeはスライス表示より上に収まり、対応軸の色と分割寸法を示す', async ({
  page,
}) => {
  await page.goto('/LLM-LABORATORY/motion/');
  for (const view of ['numbers', 'shapes']) {
    await page
      .getByRole('button', { name: view === 'shapes' ? '形と軸で見る' : '数値で見る', exact: true })
      .click();
    for (const step of journeySteps) {
      const i = journeySteps.indexOf(step);
      await page
        .getByRole('slider')
        .fill(String(Math.round((journeyStarts[i] + step.duration * 0.95) / 10) * 10));
      const result = await page
        .locator('.journey-svg:visible [data-full-shapes]')
        .evaluate((group) => {
          const texts = [...group.querySelectorAll('text')];
          return texts.map((text) => {
            const b = text.getBBox();
            return { text: text.textContent, x: b.x, right: b.x + b.width, bottom: b.y + b.height };
          });
        });
      for (const r of result) {
        expect(r.x, `${view}:${step.id}:${r.text}`).toBeGreaterThan(210);
        expect(r.right, `${view}:${step.id}:${r.text}`).toBeLessThan(790);
        expect(r.bottom).toBeLessThan(148);
      }
    }
    const i = journeySteps.findIndex((s) => s.id === 'heads');
    await page
      .getByRole('slider')
      .fill(String(Math.round((journeyStarts[i] + journeySteps[i].duration * 0.4) / 10) * 10));
    await expect(page.locator('.journey-svg:visible [data-tensor-shape="Q"]')).toContainText(
      view === 'shapes' ? '[1, 7, 16, 128]' : '[1, 7, 2, 3]',
    );
    const colored = page.locator('.journey-svg:visible [data-tensor-shape="Q"] .shape-axis-drawn');
    await expect(colored).toHaveCount(4);
    const fills = await colored.evaluateAll((elements) =>
      elements.map((e) => getComputedStyle(e).fill),
    );
    expect(new Set(fills).size).toBe(1);
    const muted = await page
      .locator('.journey-svg:visible .journey-shape-caption')
      .evaluate((e) => getComputedStyle(e).fill);
    expect(fills[0]).not.toBe(muted);
    await page
      .locator('.journey-svg:visible')
      .screenshot({ path: `.cache/full-shape-${view}-heads.png` });
    if (view === 'shapes') {
      const merge = journeySteps.findIndex((s) => s.id === 'concat');
      await page
        .getByRole('slider')
        .fill(
          String(Math.round((journeyStarts[merge] + journeySteps[merge].duration * 0.8) / 10) * 10),
        );
      await page
        .locator('.journey-svg:visible')
        .screenshot({ path: '.cache/full-shape-merge-0.8.png' });
    }
  }
});
