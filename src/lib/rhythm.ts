/**
 * タップ時刻から、いちばん近いグリッド（拍を sub 等分した位置）とのズレを ms で返す。
 * どのグリッドからも半分以上離れていれば null。時刻はすべてオーディオ時間（秒）。
 */
export function tapOffsetMs(t: number, beatTimes: readonly number[], bpm: number, sub: number): number | null {
  const g = 60 / bpm / sub;
  let best: number | null = null;
  for (const bt of beatTimes)
    for (let k = -1; k <= sub; k++) {
      const d = t - (bt + k * g);
      if (best === null || Math.abs(d) < Math.abs(best)) best = d;
    }
  return best === null || Math.abs(best) > g / 2 ? null : Math.round(best * 1000);
}

/** 中央値（空なら 0） */
export function median(xs: readonly number[]): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export const LATENCY_MIN = -100;
export const LATENCY_MAX = 400;
export const clampLatency = (ms: number): number => Math.max(LATENCY_MIN, Math.min(LATENCY_MAX, Math.round(ms)));

/**
 * 遅延の補正値を提案する。offs は「いまの補正値を引いたあと」のズレ（ms）。
 * いつも同じだけ遅れて（早く）判定されるなら、それは演奏ではなく機器の遅延とみなして補正値に足す。
 * タップが少なすぎるときは null。最初の数回は合わせている途中なので捨てる。
 */
export function suggestLatency(offs: readonly number[], current: number, minTaps = 8): number | null {
  if (offs.length < minTaps) return null;
  return clampLatency(current + median(offs.slice(2).slice(-16)));
}

/** 1拍を sub 等分したときの、拍の頭以外の時刻（細かいクリック用） */
export function subdivisionTimes(t: number, beatLen: number, sub: number): number[] {
  return Array.from({ length: Math.max(0, sub - 1) }, (_, k) => t + ((k + 1) * beatLen) / sub);
}
