import { expect, test } from '@playwright/test';

test('全レッスン：デモを操作し、理解度チェックに3問正解して完了できる', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('./');
  await page.getByTestId('a2hs-close').click();
  const items = page.getByTestId('lesson-list').locator('button');
  const n = await items.count();
  expect(n).toBe(14);

  for (let i = 0; i < n; i++) {
    await items.nth(i).click();
    const view = page.getByTestId('lesson-view');
    await expect(view).toBeVisible();
    // デモのボタンをひととおり押す（ほかのタブへ移動するボタン「…→」は除く）
    const buttons = view.locator('.lesson button').filter({ hasNotText: '→' });
    for (let k = 0; k < (await buttons.count()); k++) await buttons.nth(k).click();
    // プルダウンは最後の選択肢に切り替えてみる
    const selects = view.locator('.lesson select');
    for (let k = 0; k < (await selects.count()); k++) {
      const count = await selects.nth(k).locator('option').count();
      await selects.nth(k).selectOption({ index: count - 1 });
    }
    // 理解度チェック：1問目はわざと間違え、そのあと3問正解する
    let wrong = i === 0;
    for (let guard = 0; guard < 8; guard++) {
      if (await page.getByTestId('lquiz-done').isVisible()) break;
      const q = page.getByTestId('lquiz-q');
      const a = Number(await q.getAttribute('data-answer'));
      const opts = page.getByTestId('lquiz-answers').locator('button');
      await opts.nth(wrong ? (a + 1) % (await opts.count()) : a).click();
      wrong = false;
      await expect(page.getByTestId('lquiz-answers').locator('button.ok')).toHaveCount(1);
      // 次の問題に切り替わる（または完了する）のを待つ
      await expect(page.locator('[data-testid="lquiz-answers"] button.ok')).toHaveCount(0, { timeout: 6000 });
    }
    await expect(page.getByTestId('lquiz-done')).toBeVisible();
    await expect(page.getByTestId('lesson-next')).toBeVisible();
    await page.getByTestId('lesson-back').click();
  }
  await expect(page.getByTestId('lesson-progress')).toContainText('全 14 レッスン完了');
  await expect(page.locator('[data-menu="lesson"] small')).toHaveText('完了');
  expect(errors).toEqual([]);
});

test('レッスンから練習機能へ移動できる', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('a2hs-close').click();
  // カポのレッスン → 「曲に合わせて弾く」（キー B♭ はカポ3が選ばれる）
  await page.locator('[data-lesson="capo"]').click();
  await expect(page.getByTestId('capo-out')).toContainText('実際の音は A');
  await expect(page.getByTestId('capo-tbl').locator('.easy')).toContainText('G・C・D・Em');
  await page.getByTestId('capo-to-pa').click();
  await expect(page.locator('#tab-chord')).toBeVisible();
  await expect(page.getByTestId('pa-key')).toHaveValue('B♭');
  await expect(page.getByTestId('pa-capo')).toHaveValue('3');

  // コード進行のレッスン → コードチェンジ練習に、その進行のコードが選ばれる
  await page.locator('#nav button[data-tab="learn"]').click();
  await page.getByTestId('lesson-back').click();
  await page.locator('[data-lesson="prog"]').click();
  await expect(page.getByTestId('prog-row').locator('b')).toHaveText(['G', 'D', 'Em', 'C']);
  await page.getByTestId('prog-practice').click();
  await expect(page.locator('#tab-chord')).toBeVisible();
  await expect(page.getByTestId('chord-chips').locator('.chip.on')).toHaveText(['C', 'D', 'G', 'Em']);

  // バレーコード：B♭m はコード名と同じつづりで表示する
  await page.locator('#nav button[data-tab="learn"]').click();
  await page.getByTestId('lesson-back').click();
  await page.locator('[data-lesson="barre"]').click();
  await page.getByRole('button', { name: 'Am フォーム' }).click();
  await expect(page.getByTestId('barre-out')).toContainText('B♭m');
  await expect(page.getByTestId('barre-board').locator('text[font-weight="700"]')).toHaveText(['B♭', 'F', 'B♭', 'D♭', 'F']);
});
