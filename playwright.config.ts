import { defineConfig, devices } from '@playwright/test';

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
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'ipad', use: { ...devices['iPad Pro 11 landscape'], browserName: 'chromium' } },
  ],
  webServer: { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
