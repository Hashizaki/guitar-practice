import { describe, expect, it } from 'vitest';
import { tapOffsetMs } from './rhythm';

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
