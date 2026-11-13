/** Web Audio の共通処理。音はすべてプログラムで合成する（録音サンプルなし） */
import { OPEN } from './theory';

let ctx: AudioContext | null = null;

export const IS_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

type AudioSessionType = 'playback' | 'play-and-record';

/** iOS 16.4+：マナーモード中でも音が出るように「再生」セッションにする */
export function setAudioSession(type: AudioSessionType): void {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession && nav.audioSession.type !== type) nav.audioSession.type = type;
  } catch {
    /* 未対応ブラウザでは何もしない */
  }
}

export function ac(): AudioContext {
  if (!ctx) {
    setAudioSession('playback');
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor({ latencyHint: 'interactive' });
  }
  // iOS では 'suspended' のほか、電話・他アプリ再生などで 'interrupted' になる
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

const UNLOCK_EVENTS = ['touchend', 'pointerup', 'keydown'] as const;
/** iOS Safari：最初のタッチ操作の中で無音を鳴らして音声を有効化する */
function unlockAudio(): void {
  const c = ac();
  try {
    const s = c.createBufferSource();
    s.buffer = c.createBuffer(1, 1, c.sampleRate);
    s.connect(c.destination);
    s.start(0);
  } catch {
    /* 失敗しても次の操作で再試行される */
  }
  if (c.state === 'running') UNLOCK_EVENTS.forEach((ev) => document.removeEventListener(ev, unlockAudio, true));
}
UNLOCK_EVENTS.forEach((ev) => document.addEventListener(ev, unlockAudio, true));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
});

export const midiFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

// Karplus-Strong でギターっぽい音を作る（周波数ごとにキャッシュ）
const bufCache = new Map<number, AudioBuffer>();
function pluckBuffer(freq: number): AudioBuffer {
  const key = Math.round(freq * 10);
  const hit = bufCache.get(key);
  if (hit) return hit;
  const c = ac();
  const sr = c.sampleRate;
  const len = Math.floor(sr * 2.2);
  const buf = c.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const cur = ring[idx];
    const nx = ring[(idx + 1) % N];
    ring[idx] = 0.497 * (cur + nx);
    d[i] = cur;
    idx = (idx + 1) % N;
  }
  bufCache.set(key, buf);
  return buf;
}

/** 1音を鳴らす。t を省略すると今すぐ */
export function pluck(freq: number, t?: number | null, vol = 0.45): void {
  const c = ac();
  const at = t ?? c.currentTime;
  const s = c.createBufferSource();
  const g = c.createGain();
  s.buffer = pluckBuffer(freq);
  g.gain.setValueAtTime(vol, at);
  g.gain.setTargetAtTime(0, at + 1.6, 0.15);
  s.connect(g).connect(c.destination);
  s.start(at);
  s.stop(at + 2.2);
}

export const pluckMidi = (m: number, t?: number | null, vol?: number): void => pluck(midiFreq(m), t, vol);

/** コードをジャーンと鳴らす。frets は6弦→1弦、-1 はミュート。up はアップストローク（高い弦から4本） */
export function strum(frets: readonly number[], t?: number | null, up = false, vol = 0.28): void {
  const t0 = t ?? ac().currentTime + 0.01;
  let ms = frets.map((f, i) => (f >= 0 ? OPEN[i] + f : -1)).filter((m) => m >= 0);
  if (up) ms = ms.reverse().slice(0, 4);
  ms.forEach((m, k) => pluck(midiFreq(m), t0 + k * (up ? 0.012 : 0.025), up ? vol * 0.8 : vol));
}

/** メトロノームのクリック音 */
export function clickSound(t: number, strong: boolean): void {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.value = strong ? 1600 : 1000;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(strong ? 0.7 : 0.4, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.06);
}
