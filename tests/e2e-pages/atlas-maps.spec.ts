import { test, expect } from '@playwright/test';
import { maps } from '../../src/data/atlas';

for (const map of maps) {
  test(`派生地図の接続・詳細・狭幅：${map.title}`, async ({ page }) => {
    await page.goto(`/LLM-LABORATORY/maps/${map.slug ? map.slug + '/' : ''}`);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() =>
          page.evaluate(() => {
            const problems: string[] = [];
            if (document.documentElement.scrollWidth > innerWidth) problems.push('page overflow');
            const nodes = [...document.querySelectorAll<HTMLElement>('[data-node]')].map((n) => ({
              id: n.dataset.node,
              r: n.getBoundingClientRect(),
            }));
            for (const path of document.querySelectorAll<SVGPathElement>(
              '.atlas-route,.atlas-cross-route',
            )) {
              const box = path.ownerSVGElement!.getBoundingClientRect();
              const len = path.getTotalLength();
              for (let i = 5; i < len - 5; i += 10) {
                const p = path.getPointAtLength(i);
                const hit = nodes.find(
                  (n) =>
                    n.id !== path.dataset.from &&
                    n.id !== path.dataset.to &&
                    p.x + box.left > n.r.left + 2 &&
                    p.x + box.left < n.r.right - 2 &&
                    p.y + box.top > n.r.top + 2 &&
                    p.y + box.top < n.r.bottom - 2,
                );
                if (hit) {
                  problems.push(`${path.dataset.from}→${path.dataset.to}: ${hit.id}`);
                  break;
                }
              }
            }
            return problems;
          }),
        )
        .toEqual([]);
    }
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      const opener = page.locator('.atlas-detail > summary').first();
      await opener.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').locator('.atlas-detail-io')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
    }
  });
}

test('学習経路はbatchを再Token化せず、labelsと更新ループを別にたどる', async ({ page }) => {
  await page.goto('/LLM-LABORATORY/maps/training/');
  await expect(page.locator('#n-text,#n-template,#n-tokenize')).toHaveCount(0);
  for (const [from, to] of [
    ['labels', 'shift'],
    ['batch', 'device'],
    ['optimizer', 'zero-grad'],
    ['resume', 'zero-grad'],
  ])
    await expect(
      page.locator(`.atlas-cross-route[data-from="${from}"][data-to="${to}"]`),
    ).toHaveCount(1);
  await page.locator('#n-prefill > details > summary').click();
  await expect(page.getByRole('dialog')).toContainText('use_cache=False');
  await expect(page.getByRole('dialog')).not.toContainText('max_new_tokens');
  await page.keyboard.press('Escape');
  await page.locator('#n-shift > details > summary').click();
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'Labels：正解と除外位置', exact: true }),
  ).toBeVisible();
});
