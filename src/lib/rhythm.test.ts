import { describe, expect, it } from 'vitest';
import { clampLatency, median, subdivisionTimes, suggestLatency, tapOffsetMs } from './rhythm';

describe('リズム判定', () => {
  const beats = [10, 10.5, 11, 11.5]; // BPM 120
  it('拍ちょうどは 0ms', () => expect(tapOffsetMs(11, beats, 120, 1)).toBe(0));
  it('遅れ・早めを ms で返す', () => {
    expect(tapOffsetMs(11.04, beats, 120, 1)).toBe(40);
    expect(tapOffsetMs(10.975, beats, 120, 1)).toBe(-25);
  });
  it('8分音符の裏拍も判定できる', () => {
    expect(tapOffsetMs(10.76, beats, 120, 2)).toBe(10);
  });
  it('3連符のグリッド', () => {
    expect(tapOffsetMs(10 + 0.5 / 3 + 0.005, beats, 120, 3)).toBe(5);
  });
  it('まだ予約されていない次の拍の直前も、次の拍として判定する', () => {
    expect(tapOffsetMs(11.98, beats, 120, 1)).toBe(-20);
  });
  it('拍の記録がなければ null', () => expect(tapOffsetMs(1, [], 120, 1)).toBeNull());
});

describe('遅延の補正', () => {
  it('中央値', () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('タップが少ないうちは提案しない', () => {
    expect(suggestLatency([120, 130, 110], 0)).toBeNull();
  });
  it('いつも同じだけ遅れるなら、その分を補正値にする（外れ値に強い）', () => {
    const offs = [300, -200, 118, 122, 120, 119, 121, 500, 120, 120];
    expect(suggestLatency(offs, 0)).toBe(120);
  });
  it('すでに補正している場合は、残りのズレを足す', () => {
    expect(suggestLatency([0, 0, 20, 22, 18, 20, 21, 19, 20, 20], 100)).toBe(120);
    expect(suggestLatency([0, 0, -30, -30, -30, -30, -30, -30], 100)).toBe(70);
  });
  it('補正値は範囲内に収める', () => {
    expect(clampLatency(999)).toBe(400);
    expect(clampLatency(-999)).toBe(-100);
    expect(suggestLatency(Array(10).fill(390), 100)).toBe(400);
  });
});

describe('拍の細分化', () => {
  it('拍の頭以外の時刻を返す', () => {
    expect(subdivisionTimes(10, 0.5, 1)).toEqual([]);
    expect(subdivisionTimes(10, 0.5, 2)).toEqual([10.25]);
    expect(subdivisionTimes(10, 0.6, 3).map((x) => +x.toFixed(3))).toEqual([10.2, 10.4]);
    expect(subdivisionTimes(10, 0.4, 4).map((x) => +x.toFixed(3))).toEqual([10.1, 10.2, 10.3]);
  });
});
