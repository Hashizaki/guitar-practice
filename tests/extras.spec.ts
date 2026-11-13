import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('a2hs-close').click();
});

test('メトロノーム：刻み（8分・3連・16分）を選べて、保存される', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.locator('#nav button[data-tab="metro"]').click();
  await expect(page.getByTestId('metro-sub')).toHaveValue('1');
  for (const sub of ['2', '3', '4']) {
    await page.getByTestId('metro-sub').selectOption(sub);
    await page.getByTestId('metro-btn').click();
    await expect(page.locator('#tab-metro .dot.hit')).toHaveCount(1);
    await page.waitForTimeout(700); // 細かいクリックを実際に予約させる
    await page.getByTestId('metro-btn').click();
  }
  await page.reload();
  await expect(page.getByTestId('metro-sub')).toHaveValue('4');
  expect(errors).toEqual([]);
});

test('リズム練習：遅延の補正', async ({ page }) => {
  await page.locator('#nav button[data-tab="train"]').click();
  await page.locator('.seg button[data-mode="rhythm"]').click();
  const lat = page.getByTestId('r-latency');
  await expect(lat).toHaveText('0ms');
  await expect(page.getByTestId('r-calibrate')).toBeDisabled(); // タップが足りないうちは押せない

  // 手動で増減できる
  await page.getByRole('button', { name: '補正を10ミリ秒増やす' }).click();
  await page.getByRole('button', { name: '補正を10ミリ秒増やす' }).click();
  await page.getByRole('button', { name: '補正を10ミリ秒減らす' }).click();
  await expect(lat).toHaveText('+10ms');

  // 8回以上タップすると、そのズレから補正値を決められる
  await page.getByTestId('rhythm-btn').click();
  await page.waitForTimeout(800);
  for (let i = 0; i < 9; i++) {
    await page.getByTestId('tap-pad').click();
    await page.waitForTimeout(250);
  }
  await expect(page.getByTestId('r-count')).toHaveText('9');
  await expect(page.getByTestId('r-calibrate')).toBeEnabled();
  await page.getByTestId('r-calibrate').click();
  await expect(lat).toHaveText(/^[+-]?\d+ms$/);
  await expect(page.getByTestId('r-count')).toHaveText('0'); // 測り直しになる
  await page.getByTestId('rhythm-btn').click();

  const saved = (await lat.textContent()) as string;
  await page.reload();
  await expect(page.getByTestId('r-latency')).toHaveText(saved);
});

test('アルペジオ練習：コードとパターンから TAB を作り、再生できる', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.locator('#nav button[data-tab="chord"]').click();
  await page.getByTestId('arp-chord').selectOption('Am');
  await page.getByTestId('arp-pat').selectOption('2'); // 定番：B 3 2 3 1 3 2 3
  // Am は 5弦開放がベース。3弦2フレット、2弦1フレット、1弦開放
  await expect(page.getByTestId('arp-tab').locator('g[data-step] text')).toHaveText(['0', '2', '1', '2', '0', '2', '1', '2']);
  await expect(page.getByTestId('arp-steps').locator('b')).toHaveText(['親', '人', '中', '人', '薬', '人', '中', '人']);
  await expect(page.getByTestId('arp-steps').locator('span').first()).toHaveText('5弦');
  // D はベースが4弦
  await page.getByTestId('arp-chord').selectOption('D');
  await expect(page.getByTestId('arp-steps').locator('span').first()).toHaveText('4弦');

  await page.getByTestId('arp-btn').click();
  await expect(page.getByTestId('arp-steps').locator('.cur')).toHaveCount(1);
  await expect(page.getByTestId('arp-tab').locator('g[data-cur]')).toHaveCount(1);
  await page.getByTestId('arp-btn').click();
  await expect(page.getByTestId('arp-steps').locator('.cur')).toHaveCount(0);
  expect(errors).toEqual([]);
});
