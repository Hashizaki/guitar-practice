import { expect, test, type Page } from '@playwright/test';

const GTM = /googletagmanager\.com\/gtm\.js\?id=GTM-TPFVMS5R/;

/** Google への通信を横取りして記録する（実際には送らない） */
async function captureGtm(page: Page): Promise<string[]> {
  const hits: string[] = [];
  await page.route(/googletagmanager\.com/, (route) => {
    hits.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
  });
  return hits;
}
const dataLayer = (page: Page) => page.evaluate(() => (window.dataLayer ?? []).map((x) => x.event));

test('localhost・自動テストでは、アクセス解析を読み込まない', async ({ page }) => {
  const hits = await captureGtm(page);
  await page.goto('./');
  await page.locator('#nav button[data-tab="metro"]').click();
  await page.waitForTimeout(300);
  expect(hits).toEqual([]);
  expect(await dataLayer(page)).toEqual([]);
});

test.describe('公開サイトとして開いたとき', () => {
  // 公開サイトと同じ条件にする：localhost 以外のホスト名で開き、自動テストの印を隠す
  // guitar.test は playwright.config.ts で手元のサーバーに向けてある
  test.use({ baseURL: 'http://guitar.test:4173' });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  });

  test('タグマネージャーを読み込み、タブの表示とレッスン完了をイベントで送る', async ({ page }) => {
    const hits = await captureGtm(page);
    await page.goto('./');
    await expect.poll(() => hits.length).toBe(1);
    expect(hits[0]).toMatch(GTM);
    expect(await dataLayer(page)).toEqual(['gtm.js']);

    await page.locator('#nav button[data-tab="metro"]').click();
    const last = await page.evaluate(() => window.dataLayer?.at(-1));
    expect(last).toEqual({ event: 'tab_view', tab_name: 'metro' });

    // レッスン完了
    await page.evaluate(() => localStorage.setItem('gtr_tab', '"learn"'));
    await page.locator('#nav button[data-tab="learn"]').click();
    await page.locator('[data-lesson="notes"]').click();
    for (let i = 0; i < 3; i++) {
      const a = Number(await page.getByTestId('lquiz-q').getAttribute('data-answer'));
      await page.getByTestId('lquiz-answers').locator('button').nth(a).click();
      await expect(page.locator('[data-testid="lquiz-answers"] button.ok')).toHaveCount(0, { timeout: 6000 });
    }
    await expect(page.getByTestId('lquiz-done')).toBeVisible();
    expect(await page.evaluate(() => window.dataLayer?.at(-1))).toEqual({ event: 'lesson_complete', lesson_id: 'notes' });
  });

  test('「アクセス解析を送らない」を選ぶと、次から読み込まない', async ({ page }) => {
    const hits = await captureGtm(page);
    await page.goto('./');
    await expect.poll(() => hits.length).toBe(1);
    await page.locator('#nav button[data-tab="learn"]').click();
    await page.getByTestId('set-optout').check(); // 読み込み直して反映される
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
    expect(hits.length).toBe(1);
    expect(await dataLayer(page)).toEqual([]);
    await page.locator('#nav button[data-tab="metro"]').click();
    expect(await dataLayer(page)).toEqual([]);

    // 戻すと、その場で読み込む
    await page.locator('#nav button[data-tab="learn"]').click();
    await page.getByTestId('set-optout').uncheck();
    await expect.poll(() => hits.length).toBe(2);
  });
});
