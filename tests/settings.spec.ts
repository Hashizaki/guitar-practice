import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('a2hs-close').click();
});

test('表示設定：テーマ・文字の大きさ・左利き表示が反映され、保存される', async ({ page }) => {
  await page.getByTestId('set-theme').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(246, 239, 228)');
  await page.getByTestId('set-zoom').selectOption('1.3');
  await expect(page.locator('main')).toHaveCSS('zoom', '1.3');

  // 左利き表示：指板のナット（開放弦の印）が右側に来る
  await page.locator('#nav button[data-tab="fret"]').click();
  const board = page.getByTestId('sv-board');
  const openMark = board.locator('[data-mark="0-0"] circle');
  const before = Number(await openMark.getAttribute('cx'));
  await page.locator('#nav button[data-tab="learn"]').click();
  await page.getByTestId('set-lefty').check();
  await page.locator('#nav button[data-tab="fret"]').click();
  expect(Number(await openMark.getAttribute('cx'))).toBe(372 - before);
  // 反転していても、タップした位置の音が正しく鳴る（6弦5フレット = A）
  await board.scrollIntoViewIfNeeded();
  const box = (await board.boundingBox())!;
  const k = box.width / 372;
  await page.mouse.click(box.x + (372 - (26 + 28 * 5 - 14)) * k, box.y + (16 + 5 * 24) * k);
  await expect(board.locator('[data-mark="5-5"] circle')).toHaveAttribute('stroke', '#fff');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByTestId('set-lefty')).toBeChecked();
});

test('バックアップ：書き出したファイルを読み込むと記録が戻る', async ({ page }) => {
  // 記録を作る：BPM を変え、レッスン完了の印をつける
  await page.locator('#nav button[data-tab="metro"]').click();
  await page.getByRole('button', { name: '+5' }).click();
  await page.evaluate(() => localStorage.setItem('gtr_lessonsDone', '["notes","board"]'));
  await page.reload();
  await page.locator('#nav button[data-tab="learn"]').click(); // 再読み込み後は前回のタブが開く
  await expect(page.getByTestId('lesson-progress')).toHaveText('2 / 14 レッスン完了');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-export').click()]);
  expect(download.suggestedFilename()).toMatch(/^guitar-practice-backup-\d{8}\.json$/);
  const text = await readFile((await download.path())!, 'utf8');
  const backup = JSON.parse(text);
  expect(backup.app).toBe('guitar-practice');
  expect(backup.data.bpm).toBe(95);
  expect(backup.data.lessonsDone).toEqual(['notes', 'board']);

  // すべて消す → 初期状態に戻る
  page.on('dialog', (d) => void d.accept());
  await page.getByTestId('backup-reset').click();
  await expect(page.getByTestId('lesson-progress')).toHaveText('0 / 14 レッスン完了'); // 初回と同じく「学ぶ」タブが開く

  // 読み込む → 元に戻る
  await page.getByTestId('backup-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.locator('#nav button[data-tab="learn"]').click(); // バックアップ時のタブ（メトロノーム）も復元される
  await expect(page.getByTestId('lesson-progress')).toHaveText('2 / 14 レッスン完了');
  await page.locator('#nav button[data-tab="metro"]').click();
  await expect(page.getByTestId('bpm')).toHaveText('95');
});

test('バックアップ：関係ないファイルは読み込まない', async ({ page }) => {
  await page.getByTestId('backup-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByTestId('backup-msg')).toHaveText('このアプリのバックアップファイルではありません。');
});
