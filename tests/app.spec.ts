import { expect, test, type Page } from '@playwright/test';

/** ページを開き、JS エラーとコンソールエラーを集める */
async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('./');
  await page.getByTestId('a2hs-close').click(); // iOS 向けの案内を閉じる
  return errors;
}
const tab = (page: Page, name: string) => page.locator(`#nav button[data-tab="${name}"]`).click();

test('すべてのタブが表示でき、エラーが出ない', async ({ page }) => {
  const errors = await open(page);
  for (const t of ['metro', 'tuner', 'chord', 'fret', 'train', 'learn']) {
    await tab(page, t);
    await expect(page.locator(`#tab-${t}`)).toBeVisible();
    await expect(page.locator(`#tab-${t} .card`).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('メトロノーム：BPM の変更と開始・停止', async ({ page }) => {
  const errors = await open(page);
  await tab(page, 'metro');
  await expect(page.getByTestId('bpm')).toHaveText('90');
  await page.getByRole('button', { name: '+5' }).click();
  await expect(page.getByTestId('bpm')).toHaveText('95');
  await page.getByTestId('metro-btn').click();
  await expect(page.getByTestId('metro-btn')).toContainText('ストップ');
  await expect(page.locator('#tab-metro .dot.hit')).toHaveCount(1);
  await page.getByTestId('metro-btn').click();
  await expect(page.getByTestId('metro-btn')).toContainText('スタート');
  await page.reload();
  await tab(page, 'metro');
  await expect(page.getByTestId('bpm')).toHaveText('95'); // 設定は保存される
  expect(errors).toEqual([]);
});

test('指板クイズ：音名を答える／場所を探す', async ({ page }) => {
  const errors = await open(page);
  await tab(page, 'fret');
  const answer = await page.getByTestId('fret-q').getAttribute('data-answer');
  await page.locator(`[data-testid="fret-answers"] button[data-n="${answer}"]`).click();
  await expect(page.getByTestId('fret-q')).toContainText('正解！');
  await expect(page.getByTestId('fret-score').locator('b').first()).toHaveText('1');

  // 場所を探す：正解の位置を指板上でタップ
  await page.getByTestId('fret-mode').selectOption('find');
  await expect(page.getByTestId('fret-answers')).toHaveCount(0);
  const [s, f] = ((await page.getByTestId('fret-q').getAttribute('data-answer')) as string).split('-').map(Number);
  const box = (await page.getByTestId('fret-board').boundingBox())!;
  const k = box.width / 372;
  await page.mouse.click(box.x + (f === 0 ? 12 : 26 + 28 * f - 14) * k, box.y + (16 + s * 24) * k);
  await expect(page.getByTestId('fret-q')).toContainText('正解！');
  await expect(page.getByTestId('fret-score').locator('b').first()).toHaveText('2');
  expect(errors).toEqual([]);
});

test('スケール表示：構成音と再生', async ({ page }) => {
  const errors = await open(page);
  await tab(page, 'fret');
  await expect(page.getByTestId('sv-notes')).toHaveText('構成音: A - C - D - E - G');
  await page.getByTestId('sv-scale').selectOption('major');
  await page.getByTestId('sv-key').selectOption('7');
  await expect(page.getByTestId('sv-notes')).toHaveText('構成音: G - A - B - C - D - E - F♯');
  await page.getByRole('button', { name: '▶ スケールを再生' }).click();
  await expect(page.getByRole('button', { name: '■ 停止' })).toBeVisible();
  await page.getByRole('button', { name: '■ 停止' }).click();
  expect(errors).toEqual([]);
});

test('トレーニング：音程当て・コード当て・フォーム当て・リズム', async ({ page }) => {
  const errors = await open(page);
  await tab(page, 'train');
  for (const id of ['iv', 'ce']) {
    await page.locator(`.seg button[data-mode="${id === 'iv' ? 'interval' : 'chordear'}"]`).click();
    await page.getByTestId(`${id}-play`).click();
    const text = page.getByTestId(`${id}-text`);
    await expect(text).not.toHaveAttribute('data-answer', '');
    const ans = await text.getAttribute('data-answer');
    await page.locator(`[data-testid="${id}-answers"] button[data-v="${ans}"]`).click();
    await expect(text).toContainText('正解！');
  }
  await page.locator('.seg button[data-mode="form"]').click();
  const fm = await page.getByTestId('fm-text').getAttribute('data-answer');
  await page.locator(`[data-testid="fm-answers"] button[data-v="${fm}"]`).click();
  await expect(page.getByTestId('fm-text')).toContainText('正解！');

  await page.locator('.seg button[data-mode="rhythm"]').click();
  await page.getByTestId('rhythm-btn').click();
  await page.waitForTimeout(900);
  for (let i = 0; i < 4; i++) {
    await page.getByTestId('tap-pad').click();
    await page.waitForTimeout(300);
  }
  await expect(page.getByTestId('r-count')).toHaveText('4');
  await expect(page.getByTestId('r-avg')).toContainText('ms');
  await page.getByTestId('rhythm-btn').click();
  await expect(page.getByTestId('tap-label')).toHaveText('スタートしてからタップ');
  expect(errors).toEqual([]);
});

test('曲に合わせて弾く：おすすめカポと再生', async ({ page }) => {
  const errors = await open(page);
  await tab(page, 'chord');
  await page.getByTestId('pa-key').selectOption('B♭');
  await page.getByTestId('pa-auto').click();
  await expect(page.getByTestId('pa-capo')).toHaveValue('3');
  await expect(page.getByTestId('pa-row').locator('b')).toHaveText(['G', 'D', 'Em', 'C']);
  await expect(page.getByTestId('pa-info')).toContainText('キー G のフォーム');
  await page.getByTestId('pa-btn').click();
  await expect(page.getByTestId('pa-cur')).toContainText('カウント');
  await expect(page.getByTestId('pa-cur')).toHaveText('G', { timeout: 8000 });
  await expect(page.getByTestId('pa-row').locator('.cur')).toHaveCount(1);
  await page.getByTestId('pa-btn').click();
  await expect(page.getByTestId('pa-btn')).toContainText('スタート');
  expect(errors).toEqual([]);
});

test('コードチェンジ練習：開始するとコードが切り替わる', async ({ page }) => {
  const errors = await open(page);
  await tab(page, 'chord');
  await page.getByTestId('chord-btn').click();
  const first = await page.getByTestId('cur-chord').textContent();
  await expect(page.getByTestId('cur-chord')).not.toHaveText(first as string, { timeout: 8000 });
  await page.getByTestId('chord-btn').click();
  await expect(page.getByTestId('chord-btn')).toContainText('スタート');
  expect(errors).toEqual([]);
});

test('ホーム：クイズの回答が今日のメニューに反映され、再読み込み後も残る', async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByTestId('menu-head')).toHaveText('今日のメニュー（0 / 5）');
  await tab(page, 'fret');
  for (let i = 0; i < 2; i++) {
    const q = page.getByTestId('fret-q');
    const answer = await q.getAttribute('data-answer');
    await page.locator(`[data-testid="fret-answers"] button[data-n="${answer}"]`).click();
    await expect(q).toContainText('正解！');
    await expect(q).not.toContainText('正解！', { timeout: 5000 });
  }
  await tab(page, 'learn');
  await expect(page.locator('[data-menu="fret"] small')).toHaveText('2 / 10 問');
  await page.reload();
  await expect(page.locator('[data-menu="fret"] small')).toHaveText('2 / 10 問');
  expect(errors).toEqual([]);
});

test('用語集の検索', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('gloss-list').locator('details')).toHaveCount(32);
  await page.getByTestId('gloss-q').fill('カポ');
  await expect(page.getByTestId('gloss-list').locator('details')).toHaveCount(1);
  await expect(page.getByTestId('gloss-list')).toContainText('全部の弦をまとめて押さえる道具');
});
