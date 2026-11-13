/** マイク入力（チューナーとコード判定で1つのストリームを共有する）。音声は端末内で解析するだけで送信しない */
import { ac, IS_IOS, setAudioSession } from './audio';
import { keepAwake } from './wake';

export const MIC_FAIL = IS_IOS
  ? 'マイクが使えませんでした。iPhone / iPad では「設定 → Safari → マイク」で許可し、https のページ（GitHub Pages など）で開いてください。'
  : 'マイクが使えませんでした。ブラウザのマイク許可を確認し、https のページか localhost で開いてください。';

let stream: MediaStream | null = null;
let analyser: AnalyserNode | null = null;
const users = new Set<string>();

export const micInUse = (): boolean => users.size > 0;

export async function ensureMic(user: string): Promise<AnalyserNode> {
  if (!analyser) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia unavailable');
    // iOS：録音しながら再生できるセッションに切り替える
    setAudioSession('play-and-record');
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const c = ac();
    analyser = c.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.5;
    c.createMediaStreamSource(stream).connect(analyser);
  }
  users.add(user);
  keepAwake('mic', true);
  return analyser;
}

export function releaseMic(user: string): void {
  users.delete(user);
  if (users.size === 0 && stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
    analyser = null;
    setAudioSession('playback');
  }
  keepAwake('mic', users.size > 0);
}

/** 自己相関でピッチ（Hz）を求める。無音や検出不能なら -1 */
export function detectPitch(buf: Float32Array, sr: number): number {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / buf.length) < 0.01) return -1;
  const minLag = Math.floor(sr / 1000);
  const maxLag = Math.floor(sr / 65);
  const n = buf.length - maxLag - 1;
  const corr = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += buf[j] * buf[j + lag];
    corr[lag] = s;
  }
  // 最初に十分高いピークを採用（オクターブ誤検出を防ぐ）
  let maxAll = 0;
  for (let l = minLag; l <= maxLag; l++) if (corr[l] > maxAll) maxAll = corr[l];
  let best = -1;
  for (let l = minLag + 1; l <= maxLag; l++) {
    if (corr[l] > corr[l - 1] && corr[l] >= corr[l + 1] && corr[l] > 0.85 * maxAll) {
      best = l;
      break;
    }
  }
  if (best < 0) return -1;
  const a = corr[best - 1];
  const b = corr[best];
  const c2 = corr[best + 1];
  const shift = (a - c2) / (2 * (a - 2 * b + c2) || 1);
  return sr / (best + shift);
}

/** Hz → MIDI 番号（小数）と、いちばん近い音からのズレ（セント） */
export function freqToNote(f: number): { midi: number; nearest: number; cents: number } {
  const midi = 69 + 12 * Math.log2(f / 440);
  const nearest = Math.round(midi);
  return { midi, nearest, cents: Math.round((midi - nearest) * 100) };
}

/** FFT から12音のクロマ（どの音名がどれだけ鳴っているか）を作る。smooth は前回値で、呼ぶたびに更新される */
export function analyzeChroma(an: AnalyserNode, freq: Float32Array<ArrayBuffer>, time: Float32Array<ArrayBuffer>, smooth: Float32Array): { rms: number; c: number[] } {
  const binHz = ac().sampleRate / an.fftSize;
  an.getFloatFrequencyData(freq);
  an.getFloatTimeDomainData(time);
  let rms = 0;
  for (let i = 0; i < time.length; i++) rms += time[i] * time[i];
  rms = Math.sqrt(rms / time.length);
  const raw = new Float32Array(12);
  const k0 = Math.ceil(75 / binHz);
  const k1 = Math.floor(1500 / binHz);
  for (let k = k0; k <= k1; k++) {
    const db = freq[k];
    if (db < -85 || db < freq[k - 1] || db < freq[k + 1]) continue; // ピークのみ
    const m = 69 + 12 * Math.log2((k * binHz) / 440);
    const r = Math.round(m);
    if (Math.abs(m - r) > 0.35) continue;
    raw[((r % 12) + 12) % 12] += Math.pow(10, db / 20);
  }
  const mx = Math.max(...raw);
  for (let i = 0; i < 12; i++) smooth[i] = 0.55 * smooth[i] + 0.45 * (mx > 0 ? raw[i] / mx : 0);
  const mx2 = Math.max(...smooth) || 1;
  return { rms, c: Array.from(smooth, (v) => v / mx2) };
}
