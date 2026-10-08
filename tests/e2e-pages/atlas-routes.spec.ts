import { test, expect } from '@playwright/test';
test('接続線が別の地点を横切らず、補足による幅変更にも追従する', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/LLM-LABORATORY/maps/');
  const collisionCheck = () =>
    page.evaluate(() => {
      const problems: string[] = [];
      for (const graph of document.querySelectorAll<HTMLElement>('.atlas-graph, .atlas-canvas')) {
        const nodes = [...graph.querySelectorAll<HTMLElement>('[data-node]')].map((n) => ({
          id: n.dataset.node,
          r: n.getBoundingClientRect(),
        }));
        const r = graph.getBoundingClientRect();
        for (const path of graph.querySelectorAll<SVGPathElement>(
          graph.classList.contains('atlas-canvas') ? '.atlas-cross-route' : '.atlas-route',
        )) {
          const len = path.getTotalLength();
          for (let i = 5; i < len - 5; i += 8) {
            const p = path.getPointAtLength(i);
            const hit = nodes.find(
              (n) =>
                n.id !== path.dataset.from &&
                n.id !== path.dataset.to &&
                p.x + r.left > n.r.left + 2 &&
                p.x + r.left < n.r.right - 2 &&
                p.y + r.top > n.r.top + 2 &&
                p.y + r.top < n.r.bottom - 2,
            );
            if (hit) {
              problems.push(`${path.dataset.from} → ${path.dataset.to} crosses ${hit.id}`);
              break;
            }
          }
        }
      }
      return problems;
    });
  await expect(page.locator('.has-routes')).toHaveCount(12);
  await expect(
    page.locator('.atlas-cross-route[data-from="embedding"][data-to="layer-input"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('.atlas-cross-route[data-from="next-layer"][data-to="final-norm"]'),
  ).toHaveCount(1);
  await page.locator('#atlas-query').focus();
  const searchGeometry = await page.locator('.atlas-search > div').evaluate((el) => {
    const input = el.querySelector('input')!;
    const button = el.querySelector('button')!;
    return {
      gap: button.getBoundingClientRect().left - input.getBoundingClientRect().right,
      offset: parseFloat(getComputedStyle(input).outlineOffset),
    };
  });
  expect(searchGeometry.gap).toBeGreaterThanOrEqual(8);
  expect(searchGeometry.offset).toBeLessThan(0);
  await expect.poll(collisionCheck).toEqual([]);
  await page.locator('#n-q-proj summary').click();
  await expect.poll(collisionCheck).toEqual([]);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 768, height: 900 });
  await expect.poll(collisionCheck).toEqual([]);
  await page.setViewportSize({ width: 720, height: 500 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const errors: string[] = [];
          for (const path of document.querySelectorAll<SVGPathElement>(
            '.atlas-cross-route[data-direct="true"]',
          )) {
            const length = path.getTotalLength(),
              start = path.getPointAtLength(0),
              end = path.getPointAtLength(length);
            if (Math.abs(start.x - end.x) > 1) errors.push('not vertical');
            const bounds = path.ownerSVGElement!.getBoundingClientRect();
            const target = document
              .querySelector('#n-' + path.dataset.to)!
              .closest('.atlas-section')!;
            const text = [
              ...target.querySelectorAll<HTMLElement>(
                '.atlas-boundary h2, .atlas-boundary p, .atlas-boundary a, .atlas-block:first-of-type > .atlas-branch-label',
              ),
            ];
            for (const el of text) {
              const r = el.getBoundingClientRect();
              if (
                start.x + bounds.left > r.left &&
                start.x + bounds.left < r.right &&
                r.bottom > start.y + bounds.top &&
                r.top < end.y + bounds.top
              )
                errors.push('text crossing');
            }
          }
          return errors;
        }),
      )
      .toEqual([]);
    await expect(page.locator('.atlas-cross-route[data-direct="true"]')).toHaveCount(3);
    await expect(page.locator('#heading-decoder')).toContainText('Decoder Layer');
  }
  await page.setViewportSize({width:1440,height:1200});
  await page.locator('#n-embedding').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  await page.screenshot({path:'docs/reviews/atlas-straight-desktop.png'});
  await page.setViewportSize({width:390,height:1100});
  await page.locator('#n-embedding').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  await page.screenshot({path:'docs/reviews/atlas-straight-mobile.png'});
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#n-q-norm')).toBeVisible();
  await expect(page.locator('#n-optimizer')).toBeVisible();
});
