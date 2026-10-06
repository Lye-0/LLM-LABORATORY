import { test, expect } from '@playwright/test';

const base = '/LLM-LABORATORY';

test('狭幅の教材表をキーボードで横へ読める', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`${base}/learn/tokenizer/`);
  const table = page.locator('.prose table[tabindex="0"]').first();
  await expect(table).toBeVisible();
  await table.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => table.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

test('同じ上部セクションでは一覧と詳細の左ナビが変わらない', async ({ page }) => {
  const sections = [
    {
      root: '/learn/',
      pages: [
        '/learn/tensor/',
        '/learn/qwen/',
        '/learn/maps/',
        '/learn/maps/inference/',
        '/learn/maps/training/small-model/',
        '/environment/',
      ],
    },
    { root: '/labs/', pages: ['/labs/tokenizer/', '/labs/embedding/'] },
    {
      root: '/reference/',
      pages: [
        '/reference/classes/tensor/',
        '/reference/api/unsqueeze/',
        '/topics/runtime/',
        '/reference/sources/',
      ],
    },
    { root: '/projects/', pages: ['/projects/observe/'] },
  ];
  for (const section of sections) {
    await page.goto(`${base}${section.root}`);
    const inventory = await page
      .locator('#sidebar > .sidebar-home, #sidebar .nav-group a, #sidebar .sidebar-bottom a')
      .evaluateAll((links) =>
        links.map((link) => ({ href: link.getAttribute('href'), text: link.textContent?.trim() })),
      );
    for (const route of [section.root, ...section.pages]) {
      await page.goto(`${base}${route}`);
      await expect(page.locator('.top-nav a[aria-current="page"]')).toHaveAttribute(
        'href',
        `${base}${section.root}`,
      );
      expect(
        await page
          .locator('#sidebar > .sidebar-home, #sidebar .nav-group a, #sidebar .sidebar-bottom a')
          .evaluateAll((links) =>
            links.map((link) => ({
              href: link.getAttribute('href'),
              text: link.textContent?.trim(),
            })),
          ),
      ).toEqual(inventory);
      await expect(
        page.locator(
          '#sidebar > .sidebar-home[aria-current], #sidebar .nav-group a[aria-current], #sidebar .sidebar-bottom a[aria-current]',
        ),
      ).toHaveCount(1);
    }
  }
  await page.goto(`${base}/learn/maps/training/small-model/`);
  await expect(page.locator('.nav-group a[aria-current]')).toHaveAttribute(
    'href',
    `${base}/learn/maps/training/small-model/`,
  );
});

test('地図から教材へ移動でき、モバイルでも同じ学ぶメニューを使える', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/learn/maps/inference/`);
  await expect(page.locator('#sidebar .nav-group').first()).toContainText('図でつなぐ');
  await page.screenshot({ path: 'test-results/shared-learning-navigation-desktop.png' });
  await page.locator('#sidebar a[href$="/learn/tensor/"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tensor');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'ナビゲーションを開く' }).click();
  await expect(page.locator('.sidebar-sections a[aria-current]')).toHaveAttribute(
    'href',
    `${base}/learn/`,
  );
  await page.locator('#sidebar a[href$="/learn/maps/inference/"]').click();
  await page.getByRole('button', { name: 'ナビゲーションを開く' }).click();
  await expect(page.locator('.nav-group a[aria-current]')).toHaveAttribute(
    'href',
    `${base}/learn/maps/inference/`,
  );
  await expect(page.locator('#sidebar a[href$="/learn/tensor/"]')).toBeVisible();
  await expect.poll(async () => (await page.locator('#sidebar').boundingBox())?.x).toBe(0);
  await page.screenshot({ path: 'test-results/shared-learning-navigation-mobile.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'ナビゲーションを開く' })).toBeFocused();
});
