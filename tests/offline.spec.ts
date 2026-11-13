import { expect, test } from '@playwright/test';

test('一度開けば、オフラインでも表示できる', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // 最初の表示で読み込んだ JS / CSS がキャッシュに入るのを待つ
  await expect
    .poll(() => page.evaluate(async () => {
      const keys = await caches.keys();
      if (!keys.length) return 0;
      return (await (await caches.open(keys[0])).keys()).filter((r) => r.url.includes('/assets/')).length;
    }))
    .toBeGreaterThanOrEqual(2);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#nav button')).toHaveCount(6);
  await expect(page.getByTestId('lesson-list').locator('button')).toHaveCount(14);
});
