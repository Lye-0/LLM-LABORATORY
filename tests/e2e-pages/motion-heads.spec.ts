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
test('分割したHead 1が上部表示と交差フェードし、Head 0の局所タグは到着後に消える', async ({
  page,
}) => {
  await page.goto(root);
  await seek(page, 'qkv', 0.99);
  const source = await page.locator('[data-cell="q:0:3"]').getAttribute('data-value');
  await seek(page, 'heads', 0);
  const head1 = page.locator('[data-entity="q-head-1"]');
  const upper = page.locator('[data-slice-view="numbers"] [data-slice-head="q"]');
  const local = page.locator('[data-slice-view="numbers"] [data-local-head="q"]');
  await expect(head1.locator('[data-cell="q-head-1:0:0"]')).toHaveAttribute('data-value', source!);
  for (const p of [0.2, 0.4, 0.5]) {
    await seek(page, 'heads', p);
    const a = Number(await head1.getAttribute('opacity')),
      b = Number(await upper.getAttribute('opacity'));
    expect(a + b).toBeCloseTo(1, 8);
    await expect(upper).toHaveAttribute('x', '415');
    await expect(upper).toHaveAttribute('y', '60');
  }
  await seek(page, 'heads', 0.6);
  await expect(head1).toHaveCount(0);
  expect(Number(await local.getAttribute('opacity'))).toBeGreaterThan(0.99);
  await seek(page, 'heads', 0.72);
  expect(Number(await local.getAttribute('opacity'))).toBeGreaterThan(0);
  expect(Number(await local.getAttribute('opacity'))).toBeLessThan(1);
  await seek(page, 'heads', 0.95);
  await expect(local).toHaveAttribute('opacity', '0');
  await expect(upper).toHaveText('Q Head 0 / 全2');
  await seek(page, 'heads', 0.4);
  expect(Number(await head1.getAttribute('opacity'))).toBeGreaterThan(0);
  await seek(page, 'rope', 0.2);
  await expect(head1).toHaveCount(0);
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
  await expect(context.locator('[data-slice-head]').first()).toHaveAttribute('opacity', '0');
  await expect(context).toContainText('Batch 0');
  await expect(context).toContainText('Layer 0');
  const time = await page.getByRole('slider').inputValue();
  await page.getByRole('button', { name: '数値で見る', exact: true }).click();
  await expect(page.getByRole('slider')).toHaveValue(time);
  await expect(page.locator('[data-slice-view="numbers"] .journey-slice-context')).toContainText(
    'Layer 0',
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
        if (['qkv', 'o-proj'].includes(stage) || (stage === 'concat' && p >= 0.95))
          for (const label of await panel.locator('[data-slice-head]').all())
            await expect(label).toHaveAttribute('opacity', '0');
        const fits = await panel.evaluate((el) => {
          const boundary = el.parentElement!.getBoundingClientRect();
          return [...el.querySelectorAll('text,span')].every((child) => {
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

test('上部表示は固定し、両ビューの局所タグを行列付近で消す', async ({ page }) => {
  await page.goto(root);
  for (const view of ['numbers', 'shapes']) {
    await page
      .getByRole('button', {
        name: view === 'numbers' ? '数値で見る' : '形と軸で見る',
        exact: true,
      })
      .click();
    const panel = page.locator(`[data-slice-view="${view}"]`);
    for (const p of [0.3, 0.6, 0.75, 0.99]) {
      await seek(page, 'heads', p);
      await expect(panel.locator('[data-slice-head="q"]')).toHaveAttribute('x', '415');
      await expect(panel.locator('[data-slice-head="q"]')).toHaveAttribute('y', '60');
      await expect(panel.locator('[data-slice-head="k"]')).toHaveAttribute('x', '585');
    }
    await expect(panel.locator('[data-local-head="q"]')).toHaveAttribute('opacity', '0');
    await page.getByRole('checkbox', { name: '動きを減らす' }).check();
    await seek(page, 'heads', 0.7);
    await expect(panel.locator('[data-slice-head="q"]')).toHaveAttribute('y', '60');
    await page.getByRole('checkbox', { name: '動きを減らす' }).uncheck();
  }
});

test('移動するHead名が行列・数式・他の文字に重ならない', async ({ page }) => {
  await page.goto(root);
  for (const view of ['numbers', 'shapes']) {
    await page
      .getByRole('button', {
        name: view === 'numbers' ? '数値で見る' : '形と軸で見る',
        exact: true,
      })
      .click();
    for (const p of [
      0.4, 0.5, 0.6, 0.65, 0.7, 0.73, 0.75, 0.78, 0.8, 0.83, 0.86, 0.89, 0.92, 0.95, 0.99,
    ]) {
      await seek(page, 'heads', p);
      const collisions = await page.locator(`[data-slice-view="${view}"]`).evaluate((panel) => {
        const svg = panel.closest('svg')!;
        const visible = (e: Element) => {
          let n: Element | null = e;
          while (n && n !== svg) {
            if (Number(n.getAttribute('opacity') ?? 1) < 0.15) return false;
            n = n.parentElement;
          }
          return true;
        };
        const labels = [...panel.querySelectorAll('[data-slice-head]')].filter(visible);
        const obstacles = [
          ...svg.querySelectorAll(
            'text, .journey-operation-note, .shape-body, .journey-tensor rect, .journey-slice-context',
          ),
        ].filter(visible);
        const hits: string[] = [];
        for (const label of labels)
          for (const obstacle of obstacles) {
            if (obstacle === label || obstacle.contains(label)) continue;
            const a = label.getBoundingClientRect(),
              b = obstacle.getBoundingClientRect();
            if (
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 3 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3
            )
              hits.push(`${label.textContent} / ${obstacle.textContent || obstacle.tagName}`);
          }
        return hits;
      });
      expect(collisions, `${view} ${p}`).toEqual([]);
      if ([0.6, 0.75, 0.86, 0.95].includes(p))
        await page.locator('.journey-theater').screenshot({
          path: `.cache/slice-travel-${view}-${p}.png`,
          style: '.journey-dock{display:none!important}',
        });
    }
  }
});

test('通常再生でHead名が連続して進み、画面幅が変わっても表示の中心を保つ', async ({ page }) => {
  await page.goto(root);
  for (const view of ['numbers', 'shapes']) {
    await page
      .getByRole('button', {
        name: view === 'numbers' ? '数値で見る' : '形と軸で見る',
        exact: true,
      })
      .click();
    const panel = page.locator(`[data-slice-view="${view}"]`);
    await seek(page, 'heads', 0.6);
    await page.getByRole('button', { name: '▶ 全体を再生', exact: true }).click();
    const ys: number[] = [];
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(220);
      ys.push(
        await panel
          .locator('[data-local-head="k"]')
          .evaluateAll((es) => (es.length ? Number(es[0].getAttribute('opacity')) : 0)),
      );
      await page.locator('.journey-theater').screenshot({
        path: `.cache/slice-play-${view}-${i}.png`,
        style: '.journey-dock{display:none!important}',
      });
    }
    await page.getByRole('button', { name: 'Ⅱ 一時停止', exact: true }).click();
    expect(ys.at(-1)!).toBeLessThan(ys[0]);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThanOrEqual(ys[i - 1]);
    await seek(page, 'mask', 0.8);
    for (const width of [390, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const offset = await panel.evaluate((el) => {
        const svg = el.closest('svg')!.getBoundingClientRect();
        const spans = [...el.querySelectorAll('.journey-slice-context span')].map((n) =>
          n.getBoundingClientRect(),
        );
        return Math.abs((spans[0].left + spans.at(-1)!.right) / 2 - (svg.left + svg.right) / 2);
      });
      expect(offset, `${view} ${width}`).toBeLessThan(1);
      await page.locator('.journey-theater').screenshot({
        path: `.cache/slice-width-${view}-${width}.png`,
        style: '.journey-dock{display:none!important}',
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  }
});

test('結合の途中までHead名を保持して結合先へ戻し、各段階の所属を引き継ぐ', async ({ page }) => {
  await page.goto(root);
  for (const view of ['numbers', 'shapes']) {
    await page
      .getByRole('button', {
        name: view === 'numbers' ? '数値で見る' : '形と軸で見る',
        exact: true,
      })
      .click();
    const panel = page.locator(`[data-slice-view="${view}"]`);
    await seek(page, 'weighted', 0.99);
    const q = panel.locator('[data-slice-head="q"]');
    await expect(q).toHaveAttribute('y', '60');
    await seek(page, 'concat', view === 'numbers' ? 0.3 : 0.48);
    expect(Number(await q.getAttribute('opacity'))).toBeGreaterThan(0);
    expect(Number(await q.getAttribute('y'))).toBeGreaterThan(60);
    await expect(q).toHaveText(view === 'numbers' ? 'Q Head 0 / 全2' : 'Q Head 0 / 全16');
    const mid = { x: await q.getAttribute('x'), y: await q.getAttribute('y') };
    await seek(page, 'concat', 0.99);
    await expect(q).toHaveAttribute('opacity', '0');
    await seek(page, 'concat', view === 'numbers' ? 0.3 : 0.48);
    expect({ x: await q.getAttribute('x'), y: await q.getAttribute('y') }).toEqual(mid);
    for (const stage of ['residual-attn', 'post-norm', 'multiply', 'residual-mlp']) {
      await seek(page, stage, 0.8);
      await expect(panel.locator('[data-slice-layer]')).toHaveAttribute('data-slice-layer', '0');
      await expect(q).toHaveAttribute('opacity', '0');
    }
    await seek(page, 'layers', 0.65);
    const n = Number(await panel.locator('[data-slice-layer]').getAttribute('data-slice-layer'));
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(27);
    await seek(page, 'layers', 0.99);
    await expect(panel.locator('[data-slice-layer]')).toHaveAttribute('data-slice-layer', '27');
    await seek(page, 'logits', 0.5);
    await expect(panel.locator('[data-slice-layer]')).toHaveCount(0);
    await seek(page, 'sampling', 0.4);
    await expect(panel.locator('[data-slice-token]')).toHaveAttribute('opacity', '0');
    await seek(page, 'sampling', 0.75);
    await expect(panel.locator('[data-slice-token]')).toHaveAttribute('opacity', '1');
    await seek(page, 'cache', 0.9);
    await expect(panel.locator('[data-slice-layer]')).toHaveCount(0);
    await expect(panel.locator('[data-slice-cache]')).toHaveAttribute('opacity', '1');
  }
});

test('形ビューは既存の末尾1行から確率へ進み、新しいCacheが既存の保存先へ合流する', async ({
  page,
}) => {
  await page.goto(root + '?view=shapes');
  const scene = page.locator('[data-shape-scene]');
  await seek(page, 'sampling', 0.43);
  const z = scene.locator('[data-shape-entity="logits-state"]');
  const prob = scene.locator('[data-shape-entity="prob"]');
  const band = z.locator('[data-slice-source-row]');
  expect(
    Number(await band.getAttribute('height')) /
      Number(await z.locator('.shape-body').getAttribute('height')),
  ).toBeCloseTo(1 / 7, 8);
  const early = Number(await prob.getAttribute('data-shape-cy'));
  await seek(page, 'sampling', 0.52);
  expect(Number(await prob.getAttribute('data-shape-cy'))).toBeGreaterThan(early);
  await seek(page, 'sampling', 0.75);
  await expect(prob).toHaveAttribute('data-shape', '1x151936');
  await expect(scene.locator('[data-shape-entity="logits-state"]')).toHaveCount(1);
  await seek(page, 'cache', 0.64);
  const fresh = scene.locator('[data-shape-entity="cache-new-k"]');
  const before = Number(await fresh.getAttribute('data-shape-cy'));
  await seek(page, 'cache', 0.8);
  expect(Number(await fresh.getAttribute('data-shape-cy'))).toBeLessThan(before);
  await seek(page, 'cache', 0.999);
  await expect(z).toHaveCount(1); // Hidden actors are retained, not extra comparison copies.
  const past = scene.locator('[data-shape-entity="k"]');
  await expect(past).toHaveAttribute('data-shape', '8x128');
  const geometry = {
    cy: await past.getAttribute('data-shape-cy'),
    h: await past.locator('.shape-body').getAttribute('height'),
  };
  await seek(page, 'decode', 0);
  await expect(scene.locator('[data-shape-entity="cache-new-k"]')).toHaveCount(0);
  expect(Number(await past.getAttribute('data-shape-cy'))).toBeCloseTo(Number(geometry.cy), 0);
  expect(Number(await past.locator('.shape-body').getAttribute('height'))).toBeCloseTo(
    Number(geometry.h),
    2,
  );
});

test('スライスが変わる前・途中・完了を両ビューで確認する', async ({ page }) => {
  await page.goto(root);
  for (const view of ['numbers', 'shapes']) {
    await page
      .getByRole('button', {
        name: view === 'numbers' ? '数値で見る' : '形と軸で見る',
        exact: true,
      })
      .click();
    for (const [stage, p] of [
      ['heads', 0.0],
      ['heads', 0.25],
      ['heads', 0.4],
      ['heads', 0.55],
      ['heads', 0.72],
      ['concat', 0.45],
      ['concat', 0.75],
      ['layers', 0.21],
      ['layers', 0.6],
      ['final', 0.05],
      ['final', 0.3],
      ['sampling', 0.43],
      ['sampling', 0.52],
      ['sampling', 0.75],
      ['cache', 0.64],
      ['cache', 0.78],
      ['cache', 0.95],
    ] as const) {
      await seek(page, stage, p);
      await page.locator('.journey-theater').screenshot({
        path: `.cache/slice-transfer-${view}-${stage}-${p}.png`,
        style: '.journey-dock{display:none!important}',
      });
    }
  }
});

test('冒頭からBatch 0を表示し、結合では完全なスライス名とHead 1が交差フェードする', async ({
  page,
}) => {
  await page.goto(root);
  for (const view of ['numbers', 'shapes']) {
    await page
      .getByRole('button', {
        name: view === 'numbers' ? '数値で見る' : '形と軸で見る',
        exact: true,
      })
      .click();
    const panel = page.locator(`[data-slice-view="${view}"]`);
    for (const stage of ['text', 'tokenize', 'ids', 'embedding']) {
      await seek(page, stage, 0);
      await expect(panel).toBeVisible();
      await expect(panel.locator('.slice-location')).toHaveText('Batch 0');
      await expect(panel.locator('[data-slice-layer]')).toHaveCount(0);
    }
  }
  await page.getByRole('button', { name: '数値で見る', exact: true }).click();
  await seek(page, 'weighted', 0.9);
  await expect(page.locator('[data-entity="context-head-1"]')).toHaveAttribute('opacity', '0');
  for (const p of [0.35, 0.45, 0.55]) {
    await seek(page, 'concat', p);
    const tag = page.locator('[data-slice-view="numbers"] [data-slice-head="q"]');
    await expect(tag).toHaveText('Q Head 0 / 全2');
    expect(
      Number(await tag.getAttribute('opacity')) +
        Number(await page.locator('[data-entity="context-head-1"]').getAttribute('opacity')),
    ).toBeCloseTo(1, 8);
    expect(Number(await tag.getAttribute('y'))).toBeGreaterThan(100);
    await expect(page.locator('[data-entity="context-head-1"] [data-ready="true"]')).toHaveCount(
      21,
    );
  }
});

test('形ビューはQを16 Head、K/Vを8 Headへ分け、注目するHeadと上部表示を引き継ぐ', async ({
  page,
}) => {
  await page.goto(root + '?view=shapes');
  const scene = page.locator('[data-shape-scene]');
  const upper = page.locator('[data-slice-view="shapes"] [data-slice-head="q"]');
  for (const p of [0.1, 0.25, 0.4, 0.55, 0.7, 0.8, 0.95, 0.99]) {
    await seek(page, 'heads', p);
    await expect(scene.locator('[data-head-partition^="q:"]')).toHaveCount(16);
    await expect(scene.locator('[data-head-partition^="k:"]')).toHaveCount(8);
    await expect(scene.locator('[data-head-partition^="v:"]')).toHaveCount(8);
    const other = scene.locator('[data-head-partition="q:15"]');
    if (p >= 0.4)
      expect(
        Number(await other.getAttribute('opacity')) + Number(await upper.getAttribute('opacity')),
      ).toBeCloseTo(1, 8);
    if (p === 0.4) {
      await expect(other).toContainText('Head 15');
      const bounds = await scene
        .locator('[data-head-partition^="q:"]')
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect()));
      expect(new Set(bounds.map((b) => `${Math.round(b.x)},${Math.round(b.y)}`)).size).toBe(16);
    }
    if (p === 0.8) {
      await expect(scene.locator('[data-shape-entity="q"]')).toHaveClass(/is-processing/);
      await expect(scene.locator('[data-shape-entity="v"]')).not.toHaveClass(/is-processing/);
    }
    await page.locator('.journey-theater').screenshot({
      path: `.cache/real-heads-split-${p}.png`,
      style: '.journey-dock{display:none!important}',
    });
  }
  await expect(page.locator('[data-slice-view="shapes"] [data-local-head="q"]')).toHaveAttribute(
    'opacity',
    '0',
  );
  await expect(scene.locator('[data-shape-entity="q"]')).toHaveAttribute('data-shape', '7x128');
  await seek(page, 'heads', 0.55);
  expect(
    Number(await scene.locator('[data-head-partition="q:15"]').getAttribute('opacity')),
  ).toBeGreaterThan(0);
  await seek(page, 'rope', 0.1);
  await expect(scene.locator('[data-head-partition]')).toHaveCount(0);
});

test('形ビューの連結で16個のHeadを復元し、7×2048の一つの行列へつなぐ', async ({ page }) => {
  await page.goto(root + '?view=shapes');
  const scene = page.locator('[data-shape-scene]');
  for (const p of [0.2, 0.48, 0.6, 0.7, 0.8, 0.95, 0.99]) {
    await seek(page, 'concat', p);
    await expect(scene.locator('[data-merge-head]')).toHaveCount(16);
    const label = page.locator('[data-slice-view="shapes"] [data-slice-head="q"]');
    const head15 = scene.locator('[data-merge-head="15"]');
    if (p <= 0.6)
      expect(
        Number(await label.getAttribute('opacity')) + Number(await head15.getAttribute('opacity')),
      ).toBeCloseTo(1, 8);
    if (p === 0.6) {
      await expect(head15).toHaveAttribute('opacity', '1');
      await expect(head15).toContainText('Head 15');
    }
    await page.locator('.journey-theater').screenshot({
      path: `.cache/real-heads-merge-${p}.png`,
      style: '.journey-dock{display:none!important}',
    });
  }
  await expect(scene.locator('[data-shape-entity="attn"]')).toHaveAttribute('data-shape', '7x2048');
  await expect(scene.locator('[data-merge-head="15"]')).toHaveAttribute('opacity', '0');
  await seek(page, 'o-proj', 0);
  await expect(scene.locator('[data-merge-head]')).toHaveCount(0);
});
