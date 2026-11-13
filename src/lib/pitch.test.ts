import { describe, expect, it } from 'vitest';
import { createStableNote, detectPitch, freqToNote, noteFromFreq } from './pitch';

const SR = 48000;
/** 倍音を含むギターっぽい波形を作る */
function tone(freq: number, n = 3072, harmonics = [1, 0.6, 0.4, 0.25, 0.15]): Float32Array {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((a, h) => (v += a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / SR)));
    buf[i] = v * 0.3;
  }
  return buf;
}
const midiFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

describe('音程の検出', () => {
  it('開放弦6本の音を正しく検出する（6弦 E2 〜 1弦 E4）', () => {
    for (const midi of [40, 45, 50, 55, 59, 64]) {
      const f = detectPitch(tone(midiFreq(midi)), SR);
      expect(noteFromFreq(f)).toBe(midi);
      expect(Math.abs(freqToNote(f).cents)).toBeLessThanOrEqual(3);
    }
  });
  it('倍音が強くてもオクターブを間違えない', () => {
    const f = detectPitch(tone(110, 3072, [0.5, 1, 0.8, 0.3]), SR);
    expect(noteFromFreq(f)).toBe(45); // A2
  });
  it('12フレットあたりの高い音も検出する', () => {
    expect(noteFromFreq(detectPitch(tone(midiFreq(76)), SR))).toBe(76); // 1弦12フレット E5
  });
  it('チューニングのズレをセントで返す', () => {
    const sharp = detectPitch(tone(440 * Math.pow(2, 20 / 1200)), SR);
    expect(freqToNote(sharp).cents).toBeGreaterThanOrEqual(18);
    expect(freqToNote(sharp).cents).toBeLessThanOrEqual(22);
  });
  it('無音は検出しない', () => {
    expect(detectPitch(new Float32Array(3072), SR)).toBe(-1);
    expect(noteFromFreq(-1)).toBeNull();
  });
  it('音と音の中間（ズレが大きい）は音として扱わない', () => {
    expect(noteFromFreq(440 * Math.pow(2, 50 / 1200))).toBeNull();
  });
});

describe('安定した音の判定', () => {
  it('同じ音が3回続いたら確定する', () => {
    const d = createStableNote(3);
    expect(d.feed(45)).toBeNull();
    expect(d.feed(45)).toBeNull();
    expect(d.feed(45)).toBe(45);
    expect(d.feed(45)).toBe(45);
  });
  it('途中で別の音や無音が入ったら数え直す', () => {
    const d = createStableNote(3);
    d.feed(45);
    d.feed(45);
    expect(d.feed(47)).toBeNull();
    expect(d.feed(null)).toBeNull();
    d.feed(45);
    d.feed(45);
    expect(d.feed(45)).toBe(45);
  });
});
