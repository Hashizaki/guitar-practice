import { beforeEach, describe, expect, it, vi } from 'vitest';

// stats.ts は読み込み時に localStorage を見るので、テスト用のものを先に用意する
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
});
const { accuracy, bump, pickWeighted, Stats, weakest, weight } = await import('./stats');

describe('苦手の記録', () => {
  beforeEach(() => Stats.clear('t'));

  it('正答率', () => {
    expect(accuracy(undefined)).toBeNull();
    expect(accuracy(bump(undefined, true))).toBe(1);
    expect(accuracy(bump(bump(undefined, true), false))).toBeCloseTo(0.9 / 1.9);
  });
  it('最近の回答ほど重い（昔の間違いは薄れる）', () => {
    let s = bump(undefined, false);
    for (let i = 0; i < 10; i++) s = bump(s, true);
    expect(accuracy(s)).toBeGreaterThan(0.9);
  });
  it('重み：間違いが多いほど大きく、未出題は少し多め', () => {
    expect(weight([5, 0])).toBe(1);
    expect(weight([0, 5])).toBe(5);
    expect(weight(undefined)).toBe(1.5);
    expect(weight([1, 1])).toBe(3);
  });
  it('重みに比例して選ぶ', () => {
    const w = (x: string) => (x === 'b' ? 3 : 1);
    expect(pickWeighted(['a', 'b', 'c'], w, () => 0)).toBe('a');
    expect(pickWeighted(['a', 'b', 'c'], w, () => 0.5)).toBe('b'); // 0.5×5=2.5 → b の区間 [1,4)
    expect(pickWeighted(['a', 'b', 'c'], w, () => 0.99)).toBe('c');
    const counts = { a: 0, b: 0, c: 0 };
    let seed = 1;
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 5000; i++) counts[pickWeighted(['a', 'b', 'c'] as const, w, rng)]++;
    expect(counts.b / 5000).toBeGreaterThan(0.55);
    expect(counts.b / 5000).toBeLessThan(0.65);
  });
  it('苦手な項目を正答率の低い順に返す', () => {
    const g = { x: [1, 3], y: [5, 0], z: [1, 1], few: [0, 1] } as Record<string, [number, number]>;
    expect(weakest(g)).toEqual([{ item: 'x', acc: 0.25 }, { item: 'z', acc: 0.5 }]);
    expect(weakest(undefined)).toEqual([]);
  });
  it('記録は保存され、苦手なものの重みが上がる', () => {
    Stats.record('t', 'p4', false);
    Stats.record('t', 'p4', false);
    Stats.record('t', 'p5', true);
    expect(Stats.weight('t', 'p4')).toBe(5);
    expect(Stats.weight('t', 'p5')).toBe(1);
    expect(Stats.weight('t', 'new')).toBe(1.5);
    expect(JSON.parse(mem.get('gtr_stats') as string).t.p4).toEqual([0, 1.9]);
  });
});
