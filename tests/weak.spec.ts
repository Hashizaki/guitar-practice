import { expect, test } from '@playwright/test';

test('苦手：まちがえた問題が記録され、一覧に出る', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('a2hs-close').click();
  await page.locator('#nav button[data-tab="train"]').click();
  await expect(page.getByTestId('iv-weak-list')).toContainText('ここに「苦手」として記録されます');

  // 音程当てでわざと間違える → その音程が不正解として記録される
  await page.getByTestId('iv-play').click();
  const text = page.getByTestId('iv-text');
  await expect(text).not.toHaveAttribute('data-answer', '');
  const answer = (await text.getAttribute('data-answer')) as string;
  await page.locator(`[data-testid="iv-answers"] button:not([data-v="${answer}"])`).first().click();
  await expect(text).toContainText('✗');
  expect(await page.evaluate((a) => JSON.parse(localStorage.getItem('gtr_stats') as string).iv[a], answer)).toEqual([0, 1]);
});

test('苦手：これまでの記録から、正答率の低い順に表示する', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() =>
    localStorage.setItem('gtr_stats', JSON.stringify({ iv: { '7': [0, 2], '4': [1, 1], '2': [5, 0] }, fretS: { '2': [1, 3] }, fretN: { F: [0, 2] } })),
  );
  await page.reload();
  await page.getByTestId('a2hs-close').click();
  await page.locator('#nav button[data-tab="train"]').click();
  await expect(page.getByTestId('iv-weak-list').locator('b')).toHaveText(['完全5度0%', '長3度50%']);
  await page.locator('#nav button[data-tab="fret"]').click();
  await expect(page.getByTestId('fret-weak-list').locator('b')).toHaveText(['F0%', '3弦25%']);
  // 切り替えは保存される
  await page.getByTestId('fret-weak').getByRole('checkbox').uncheck();
  await page.reload();
  await page.locator('#nav button[data-tab="fret"]').click();
  await expect(page.getByTestId('fret-weak').getByRole('checkbox')).not.toBeChecked();
});
