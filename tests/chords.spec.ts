import { expect, test } from '@playwright/test';

test('自分の曲：登録・おすすめカポ・再生・編集・削除', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByTestId('a2hs-close').click();
  await page.locator('#nav button[data-tab="chord"]').click();

  // 登録：♯♭は # と b で書ける。読めないコードがあれば保存しない
  await page.getByTestId('pa-src').selectOption('__new');
  await page.getByTestId('pa-song-name').fill('テスト曲');
  await page.getByTestId('pa-song-text').fill('Bb F Xyz Gm Eb');
  await page.getByTestId('pa-song-save').click();
  await expect(page.getByTestId('pa-song-err')).toContainText('読み取れないコードがあります：Xyz');
  await page.getByTestId('pa-song-text').fill('Bb F | Gm Eb');
  await page.getByTestId('pa-song-save').click();
  await expect(page.getByTestId('pa-editor')).toHaveCount(0);
  await expect(page.getByTestId('pa-row').locator('b')).toHaveText(['B♭', 'F', 'Gm', 'E♭']);
  await expect(page.getByTestId('pa-info')).toContainText('テスト曲（4小節・カポなし）');
  await expect(page.getByTestId('pa-info')).toContainText('フォーム未収録のコードが 3 個');
  await expect(page.getByTestId('pa-key')).toHaveCount(0); // 自分の曲ではキーは選ばない

  // おすすめカポ：カポ3で開放コードのフォームになる
  await page.getByTestId('pa-auto').click();
  await expect(page.getByTestId('pa-capo')).toHaveValue('3');
  await expect(page.getByTestId('pa-row').locator('b')).toHaveText(['G', 'D', 'Em', 'C']);
  await expect(page.getByTestId('pa-row').locator('small').first()).toHaveText('1 ＝ B♭');

  // 再生できる
  await page.getByTestId('pa-btn').click();
  await expect(page.getByTestId('pa-cur')).toHaveText('G', { timeout: 8000 });
  await page.getByTestId('pa-btn').click();

  // 再読み込み後も残る
  await page.reload();
  await expect(page.getByTestId('pa-src').locator('option:checked')).toHaveText('🎵 テスト曲');

  // 編集
  await page.getByTestId('pa-edit').click();
  await expect(page.getByTestId('pa-song-text')).toHaveValue('B♭ F Gm E♭');
  await page.getByTestId('pa-song-text').fill('Am F C G Am F C G');
  await page.getByTestId('pa-song-save').click();
  await expect(page.getByTestId('pa-row').locator('b')).toHaveCount(8);
  await expect(page.getByTestId('pa-info')).not.toContainText('フォーム未収録');

  // 削除すると定番の進行に戻る
  page.on('dialog', (d) => void d.accept());
  await page.getByTestId('pa-delete').click();
  await expect(page.getByTestId('pa-src')).toHaveValue('p0');
  await expect(page.getByTestId('pa-key')).toBeVisible();
  expect(errors).toEqual([]);
});

test('1分間コードチェンジ：回数を数え、自己ベストを記録する', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await page.getByTestId('a2hs-close').click();
  await page.locator('#nav button[data-tab="chord"]').click();
  await page.getByTestId('om-a').selectOption('Em');
  await page.getByTestId('om-b').selectOption('Am');
  await expect(page.getByTestId('om-best')).toHaveText('—');

  const run = async (taps: number): Promise<void> => {
    await page.getByTestId('om-btn').click();
    await page.getByTestId('om-tap').click(); // カウントダウン中のタップは数えない
    await page.clock.runFor(3300);
    await expect(page.getByTestId('om-label')).toHaveText('切り替えたらタップ！');
    for (let i = 0; i < taps; i++) await page.getByTestId('om-tap').click();
    await expect(page.getByTestId('om-count')).toHaveText(String(taps));
    await page.clock.runFor(30_000);
    await expect(page.getByTestId('om-left')).toHaveText('30');
    await page.clock.runFor(30_500);
  };
  await run(5);
  await expect(page.getByTestId('om-label')).toHaveText('🎉 5回！ 自己ベスト更新');
  await expect(page.getByTestId('om-best')).toHaveText('5');
  await run(3);
  await expect(page.getByTestId('om-label')).toHaveText('3回でした（ベスト 5回）');
  // コードの順番を入れ替えても同じ記録
  await page.getByTestId('om-a').selectOption('Am');
  await page.getByTestId('om-b').selectOption('Em');
  await expect(page.getByTestId('om-best')).toHaveText('5');
  await page.getByTestId('om-b').selectOption('C');
  await expect(page.getByTestId('om-best')).toHaveText('—');
});
