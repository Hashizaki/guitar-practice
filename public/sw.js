// オフライン対応用 Service Worker
// 使い方を変えたときは VERSION を上げると古いキャッシュが消えます。
// （JS/CSS はビルドごとにファイル名が変わるので、普段は上げなくても更新されます）
const VERSION = 'gtr-v7';
// サーバーが Vary ヘッダーを付けていても、同じ URL ならキャッシュを使う
const ANY = { ignoreVary: true };
const CORE = ['./', 'index.html', 'manifest.webmanifest',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// ページから「最初の表示で読み込んだファイル」の一覧を受け取ってキャッシュする
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'cache' && Array.isArray(e.data.urls)) {
    e.waitUntil(caches.open(VERSION).then(c => Promise.all(
      e.data.urls.map(u => c.match(u, ANY).then(hit => hit || c.add(u).catch(() => {})))
    )));
  }
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // ページ本体：ネット優先（更新をすぐ反映）、オフライン時はキャッシュ
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put('index.html', copy));
      return res;
    }).catch(() => caches.match('index.html', ANY)));
    return;
  }
  // その他（JS・CSS・アイコン等）：キャッシュ優先、なければ取得して保存
  e.respondWith(caches.match(req, ANY).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
