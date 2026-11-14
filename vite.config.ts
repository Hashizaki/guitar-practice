import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base を相対パスにして、GitHub Pages の /<リポジトリ名>/ 配下でもそのまま動くようにする
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  // 画面テストで「公開サイト」の代わりに使うホスト名を許可する
  preview: { allowedHosts: ['guitar.test'] },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
