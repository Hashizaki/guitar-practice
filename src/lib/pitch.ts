/** 音程の検出と判定（副作用なし。単体テストあり） */

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


/**
 * 同じ音が続けて検出されたときだけ「鳴っている」とみなすための判定器。
 * 弾いた瞬間の雑音や、一瞬の誤検出で反応しないようにする。
 */
export function createStableNote(frames = 3): { feed: (midi: number | null) => number | null; reset: () => void } {
  let last: number | null = null;
  let run = 0;
  return {
    /** いちばん近い音（MIDI 番号）を1フレーム分渡す。frames 回続いたらその音を返す */
    feed(midi) {
      if (midi === null || midi !== last) {
        last = midi;
        run = midi === null ? 0 : 1;
      } else run++;
      return midi !== null && run >= frames ? midi : null;
    },
    reset() {
      last = null;
      run = 0;
    },
  };
}

/** 検出した周波数を、十分に合っていれば音（MIDI 番号）にする。ズレが大きければ null */
export function noteFromFreq(f: number, maxCents = 40): number | null {
  if (f <= 0) return null;
  const { nearest, cents } = freqToNote(f);
  return Math.abs(cents) <= maxCents ? nearest : null;
}
