/**
 * アクセス解析（Google タグマネージャー）。
 * - 本番ビルドを公開サイトで開いたときだけ読み込む（開発中・テスト・localhost では送らない）
 * - 設定で「アクセス解析を送らない」を選んだ人には読み込まない
 * - 送るのはページの表示と、どの機能を使ったか程度。練習記録・マイクの音声は送らない
 */
import { getShared } from './store';

export const GTM_ID = 'GTM-TPFVMS5R';
const OPT_OUT_KEY = 'analyticsOptOut';

type DataLayerItem = Record<string, unknown>;
declare global {
  interface Window {
    dataLayer?: DataLayerItem[];
  }
}

let loaded = false;

/** 解析を有効にしてよい環境か */
export function analyticsAllowed(): boolean {
  if (!import.meta.env.PROD) return false;
  if (['localhost', '127.0.0.1', ''].includes(location.hostname)) return false;
  if (navigator.webdriver) return false; // 自動テスト
  return !getShared(OPT_OUT_KEY, false);
}

/** タグマネージャーを読み込む（Google の公式の埋め込みコードと同じ処理） */
export function initAnalytics(): void {
  if (loaded || !analyticsAllowed()) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(s);
}

/** 機能の利用などを、イベントとしてタグマネージャーに渡す（読み込んでいなければ何もしない） */
export function track(event: string, params: Record<string, string | number> = {}): void {
  if (!loaded) return;
  window.dataLayer?.push({ event, ...params });
}

export const OPT_OUT_STORE_KEY = OPT_OUT_KEY;
/** すでに読み込んだかどうか */
export const analyticsLoaded = (): boolean => loaded;
