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
