import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// StrictMode は使わない：開発時に effect が2回走り、マイクや再生などの後始末と相性が悪いため
createRoot(document.getElementById('root') as HTMLElement).render(<App />);

// オフライン対応（https か localhost のときだけ）
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // 最初の表示で読み込んだファイル（ビルドごとに名前が変わる）もキャッシュに入れてもらう
        const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
        reg.active?.postMessage({ type: 'cache', urls });
      })
      .catch(() => {});
  });
}
