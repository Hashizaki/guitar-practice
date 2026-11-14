import { useEffect, useRef, useState } from 'react';
import { Check, Select } from '../components/common';
import { IS_IOS } from '../lib/audio';
import { backupFileName, clearAll, collectBackup, parseBackup, restoreBackup } from '../lib/backup';
import { analyticsLoaded, initAnalytics, OPT_OUT_STORE_KEY } from '../lib/analytics';
import { useShared } from '../lib/store';

export type Theme = 'dark' | 'light' | 'auto';
export const useTheme = () => useShared<Theme>('theme', 'dark');
export const useZoom = () => useShared('zoom', 1);
/** 左利き用：指板とコード図を左右反転して表示する */
export const useLefty = () => useShared('lefty', false);

/** テーマと文字サイズをページ全体に反映する（App から1回だけ呼ぶ） */
export function useApplyDisplay(): void {
  const [theme] = useTheme();
  const [zoom] = useZoom();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark' || (theme === 'auto' && !matchMedia('(prefers-color-scheme: light)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b1612' : '#f6efe4');
  }, [theme]);
  useEffect(() => {
    document.documentElement.style.setProperty('--zoom', String(zoom));
  }, [zoom]);
}

const makeFile = (name: string, text: string): File => new File([text], name, { type: 'application/json' });
/** ファイルとしてダウンロードする */
function downloadFile(file: File): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
/** 共有シートで保存先を選べるか（iPhone のホーム画面アプリではダウンロードより確実） */
const canShareFile = (): boolean => IS_IOS && !!navigator.canShare?.({ files: [makeFile('a.json', '{}')] });

export function SettingsCard() {
  const [theme, setTheme] = useTheme();
  const [zoom, setZoom] = useZoom();
  const [lefty, setLefty] = useLefty();
  const [optOut, setOptOut] = useShared(OPT_OUT_STORE_KEY, false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = async (how: 'download' | 'share'): Promise<void> => {
    const b = collectBackup(localStorage);
    const file = makeFile(backupFileName(), JSON.stringify(b, null, 2));
    const n = Object.keys(b.data).length;
    if (how === 'download') {
      downloadFile(file);
      setMsg(`${n} 項目を書き出しました（${file.name}）。`);
      return;
    }
    try {
      await navigator.share({ files: [file], title: file.name });
      setMsg(`${n} 項目を共有しました。`);
    } catch {
      setMsg('共有を中止しました。');
    }
  };
  const importData = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    try {
      const b = parseBackup(await file.text());
      const when = new Date(b.exportedAt).toLocaleString('ja-JP');
      if (!confirm(`${when} のバックアップを読み込みます。いまの記録と設定は上書きされます。よろしいですか？`)) return;
      restoreBackup(localStorage, b);
      location.reload(); // 動作中の機能にも確実に反映させるため、読み込み直す
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const reset = (): void => {
    if (!confirm('練習記録・レッスンの進み具合・設定をすべて消します。元に戻せません。よろしいですか？')) return;
    clearAll(localStorage);
    location.reload();
  };
  return (
    <div className="card wide" id="settingsCard">
      <h2>⚙️ 設定</h2>
      <div className="setrow">
        <label className="muted">
          テーマ <Select value={theme} onChange={setTheme} options={[['dark', 'ダーク'], ['light', 'ライト'], ['auto', '端末に合わせる']]} testId="set-theme" />
        </label>
        <label className="muted">
          文字の大きさ <Select value={zoom} onChange={setZoom} options={[[1, '標準'], [1.15, '大'], [1.3, '特大']]} testId="set-zoom" />
        </label>
        <Check checked={lefty} onChange={setLefty} testId="set-lefty">左利き用の表示（指板とコード図を左右反転）</Check>
      </div>
      <h3 className="sethead">アクセス解析</h3>
      <p className="muted" style={{ margin: '0 0 8px' }}>
        アプリの改善のため、Google アナリティクス（Google タグマネージャー経由）で、ページの表示や使った機能、端末・ブラウザの種類などを集計しています。練習記録・バックアップの中身・マイクの音声は送りません。
      </p>
      <Check
        checked={optOut}
        onChange={(v) => {
          setOptOut(v);
          // 一度読み込んだ解析は止められないので、ページを読み込み直して反映する
          if (v && analyticsLoaded()) location.reload();
          if (!v) initAnalytics();
        }}
        testId="set-optout"
      >
        アクセス解析を送らない
      </Check>
      <h3 className="sethead">バックアップ</h3>
      <p className="muted" style={{ margin: '0 0 8px' }}>
        練習記録やレッスンの進み具合は、このブラウザの中だけに保存されています。機種変更の前や、念のための控えとして、ファイルに書き出しておけます。
      </p>
      <div className="row">
        <button onClick={() => void exportData('download')} data-testid="backup-export">⬇︎ 書き出す</button>
        {canShareFile() && <button onClick={() => void exportData('share')}>共有で保存</button>}
        <button onClick={() => fileRef.current?.click()}>⬆︎ 読み込む</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void importData(e.target.files?.[0])} data-testid="backup-file" />
        <span className="grow" />
        <button className="danger" onClick={reset} data-testid="backup-reset">すべての記録を消す</button>
      </div>
      <p className="muted" style={{ margin: '8px 0 0', minHeight: 20 }} data-testid="backup-msg">{msg}</p>
    </div>
  );
}
