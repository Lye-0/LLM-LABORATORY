import { test, expect } from '@playwright/test';
import { calculations } from '../../src/data/atlas/calculations';
import { nodeById } from '../../src/data/atlas';

test('計算欄は既存の地点に対応し、読み上げ可能なMathMLで表示する', async ({ page }) => {
  await page.goto('/LLM-LABORATORY/maps/');
  for (const [id, calculation] of Object.entries(calculations)) {
    expect(nodeById[id], id).toBeDefined();
    const section = page.locator(`#n-${id} .atlas-calculation`);
    await expect(section, id).toHaveCount(1);
    await expect(section.locator('.atlas-calculation-formulas math')).toHaveCount(
      calculation.formulas.length,
    );
    for (const formula of [...calculation.formulas, ...(calculation.example?.formulas ?? [])]) {
      const parsed = await page.evaluate(({ math, reading }) => {
        const xml = new DOMParser().parseFromString(
          `<math xmlns="http://www.w3.org/1998/Math/MathML">${math}</math>`,
          'application/xml',
        );
        return {
          errors: xml.querySelectorAll('parsererror').length,
          // MathML fractions / scripts require exactly two children.
          invalid: [...xml.querySelectorAll('mfrac,msub,msup')].filter(
            (el) => el.children.length !== 2,
          ).length,
          accessible: reading.length > 0,
        };
      }, formula);
      expect(parsed, `${id}: ${formula.label}`).toEqual({
        errors: 0,
        invalid: 0,
        accessible: true,
      });
    }
  }
  // Files and environment descriptions should not gain a forced numerical formula.
  await expect(page.locator('#n-weights .atlas-calculation')).toHaveCount(0);
});

test('計算・数値例は中央ポップアップで読み、狭幅でも地図を動かさない', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/LLM-LABORATORY/maps/');
  const dialog = page.locator('.atlas-inspector');
  const ids = [
    'lm-head',
    'residual-attn',
    'input-norm',
    'multiply',
    'processors',
    'q-rope',
    'q-heads',
    'loss',
  ];
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of ids) {
      const node = page.locator(`#n-${id}`);
      const original = await node.boundingBox();
      const opener = node.locator(':scope > details > summary');
      await opener.click();
      await expect(dialog).toBeVisible();
      const calculation = dialog.getByRole('region', { name: '計算を読む', exact: true });
      await expect(calculation).toBeVisible();
      const extra = calculation.locator('.atlas-calculation-extra');
      await expect(extra).not.toHaveAttribute('open', '');
      await expect(dialog.locator('.atlas-calculation-formulas math').first()).toBeVisible();
      const io = dialog.locator('.atlas-detail-io');
      expect(
        await io.evaluate((el) => el.nextElementSibling?.classList.contains('atlas-calculation')),
      ).toBe(true);
      const example = dialog.locator('.atlas-calculation-example');
      if (await example.count()) {
        await expect(example).not.toHaveAttribute('open', '');
        await example.locator('summary').click();
        await expect(example).toHaveAttribute('open', '');
        await expect(example.locator('math,table').first()).toBeVisible();
        await expect(extra).not.toHaveAttribute('open', '');
      }
      await extra.locator('summary').click();
      await expect(extra).toHaveAttribute('open', '');
      await expect(extra.locator('.atlas-calculation-symbols')).toBeVisible();
      const geometry = await dialog.evaluate((element) => {
        const r = element.getBoundingClientRect();
        const scrollRegions = [
          ...element.querySelectorAll<HTMLElement>(
            '.atlas-math-scroll, .atlas-calculation-table-scroll',
          ),
        ];
        return {
          contained: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
          noBodyOverflow: element.scrollWidth <= element.clientWidth + 1,
          regionsContained: scrollRegions.every(
            (el) => el.getBoundingClientRect().right <= r.right,
          ),
          mathRendered: [...element.querySelectorAll('math')]
            .filter((el) => el.getBoundingClientRect().width > 0)
            .every(
              (el) =>
                el.namespaceURI === 'http://www.w3.org/1998/Math/MathML' &&
                el.getBoundingClientRect().height > 0,
            ),
        };
      });
      expect(geometry, `${width}px: ${id}`).toEqual({
        contained: true,
        noBodyOverflow: true,
        regionsContained: true,
        mathRendered: true,
      });
      if ((width === 1280 && id === 'processors') || (width === 320 && id === 'q-rope')) {
        await page.screenshot({ path: `.cache/calculation-${id}-${width}.png` });
      }
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(opener).toBeFocused();
      const after = await node.boundingBox();
      expect(after!.width).toBeCloseTo(original!.width, 0);
      expect(after!.height).toBeCloseTo(original!.height, 0);
    }
  }
  // Detail URLs must retain the common calculation display on a derived map.
  await page.goto('/LLM-LABORATORY/maps/inference/?detail=lm-head#n-lm-head');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.atlas-calculation')).toContainText('[151936,1024]');
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(dialog).not.toBeVisible();
});

test('入出力を先に読め、主要な式と計算の展開を別々に確認できる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const dialog = page.locator('.atlas-inspector');
  await page.goto('/LLM-LABORATORY/maps/inference/?detail=gate-proj#n-gate-proj');
  await expect(dialog.locator('.atlas-detail-io')).toBeInViewport();
  await expect(dialog.locator('.atlas-calculation-primary math')).toHaveCount(1);
  await expect(dialog.locator('.atlas-calculation-extra math')).not.toBeVisible();
  const height = await dialog
    .locator('.atlas-calculation')
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(360);
  await expect(
    dialog.getByRole('link', { name: 'RMSNorm：MLP前の正規化', exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: '.cache/calculation-placement-gate.png' });
  const extra = dialog.locator('.atlas-calculation-extra');
  await extra.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(extra.locator('math')).toBeVisible();
  await expect(dialog.locator('.atlas-calculation-example')).not.toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(extra).not.toHaveAttribute('open', '');
  expect(
    await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    }),
  ).toBe(true);

  for (const id of ['input-norm', 'q-rope', 'next-layer', 'sampling']) {
    await page.goto(`/LLM-LABORATORY/maps/inference/?detail=${id}#n-${id}`);
    await expect(dialog.locator('.atlas-calculation-primary math')).toHaveCount(2);
    const primary = dialog.locator('.atlas-calculation-primary');
    expect(
      await primary.locator('math').evaluateAll((es) => es.every((el) => !el.closest('details'))),
    ).toBe(true);
  }
});
