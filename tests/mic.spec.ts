import { expect, test } from '@playwright/test';

// playwright.config.ts が用意した「にせマイク」から、5弦開放（A2 = 110Hz）の音が流れ続ける

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('a2hs-close').click();
});

test('チューナー：マイクの音から音名を検出する', async ({ page }) => {
  await page.locator('#nav button[data-tab="tuner"]').click();
  await page.getByTestId('mic-btn').click();
  await expect(page.getByTestId('tuner-note')).toHaveText('A2');
  await expect(page.locator('#tab-tuner .tsub')).toContainText('✓ OK');
  await page.getByTestId('mic-btn').click();
  await expect(page.getByTestId('tuner-note')).toHaveText('—');
});

test('弾いて答える：出題と同じ高さの音が聞こえたら正解、「わからない」は不正解', async ({ page }) => {
  await page.locator('#nav button[data-tab="fret"]').click();
  await page.getByTestId('fret-mode').selectOption('play');
  const q = page.getByTestId('fret-q');
  await expect(q).toContainText('ギターで弾こう');
  /** A2 が正解になる問題（5弦開放・6弦5フレット）かどうか */
  const isA2 = async (): Promise<boolean> => ['4-0', '5-5'].includes((await q.getAttribute('data-answer')) as string);
  const skipUntil = async (want: boolean): Promise<void> => {
    for (let i = 0; i < 400 && (await isA2()) !== want; i++) await page.getByRole('button', { name: 'スキップ' }).click();
    expect(await isA2()).toBe(want);
  };

  // マイクをオンにする前に、A2 では正解にならない問題にしておく
  await skipUntil(false);
  await page.getByTestId('fret-mic').click();
  await expect(page.getByTestId('fret-heard')).toHaveText('A2');
  await expect(q).toHaveAttribute('data-result', ''); // 違う音では正解にならない
  await page.getByTestId('fret-giveup').click();
  await expect(q).toHaveAttribute('data-result', 'ng');
  await expect(page.getByTestId('fret-score').locator('b').nth(1)).toHaveText('1');
  await expect(q).toHaveAttribute('data-result', '', { timeout: 6000 });

  // A2 が正解の問題になったら、聞こえている音で正解になる
  await skipUntil(true);
  await expect(q).toHaveAttribute('data-result', 'ok');
  await expect(q).toContainText('正解！');
  await expect(page.getByTestId('fret-score').locator('b').first()).toHaveText('1');
});
