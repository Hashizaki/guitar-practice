/** マイク入力（チューナーとコード判定で1つのストリームを共有する）。音声は端末内で解析するだけで送信しない */
import { ac, IS_IOS, setAudioSession } from './audio';
import { keepAwake } from './wake';

export { detectPitch, freqToNote } from './pitch';

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
