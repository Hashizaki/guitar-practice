import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * マイクのテスト用に、5弦開放（A2 = 110Hz）の音が入った WAV を作る。
 * Chromium の「にせマイク」がこのファイルをくり返し流すので、チューナーや「弾いて答える」を実際に動かせる。
 */
function fakeMicFile(): string {
  const sr = 48000;
  const n = sr * 2;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // モノラル
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  // 110Hz は 2秒でちょうど220周期なので、くり返しても継ぎ目で音が途切れない
  for (let i = 0; i < n; i++) {
    let v = 0;
    [1, 0.6, 0.4, 0.25].forEach((a, h) => (v += a * Math.sin((2 * Math.PI * 110 * (h + 1) * i) / sr)));
    buf.writeInt16LE(Math.round(v * 0.3 * 32767), 44 + i * 2);
  }
  const dir = join(process.cwd(), 'node_modules', '.cache');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'fake-mic-a2.wav');
  writeFileSync(file, buf);
  return file;
}
const MIC_FILE = fakeMicFile();

// ビルド済みのアプリ（vite preview）を、iPhone と iPad の画面サイズで動かして確かめる
export default defineConfig({
  testDir: 'tests',
  timeout: 240_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    actionTimeout: 10_000, // 押せないボタンを待ち続けず、早めに失敗させる
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${MIC_FILE}`,
      ],
    },
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'ipad', use: { ...devices['iPad Pro 11 landscape'], browserName: 'chromium' } },
  ],
  webServer: { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
