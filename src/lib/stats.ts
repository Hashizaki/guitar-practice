/** クイズの正誤を項目ごとに記録し、苦手なものを多めに出題するための道具 */
import { useSyncExternalStore } from 'react';
import { Store } from './store';

/** [正解, 不正解]。新しい回答ほど重く、古いものは少しずつ薄れる */
export type Stat = [right: number, wrong: number];
export type StatGroup = Record<string, Stat>;

const DECAY = 0.9;

/** 回答を1つ足す（これまでの分は少し薄める。最近の出来を重視するため） */
export function bump(s: Stat | undefined, ok: boolean): Stat {
  const [r, w] = s ?? [0, 0];
  return [r * DECAY + (ok ? 1 : 0), w * DECAY + (ok ? 0 : 1)];
}
/** 正答率（0〜1）。記録がなければ null */
export function accuracy(s: Stat | undefined): number | null {
  if (!s || s[0] + s[1] === 0) return null;
  return s[0] / (s[0] + s[1]);
}
/** 出題の重み。間違いが多いほど大きい（1〜5）。まだ出ていないものは少し多め */
export function weight(s: Stat | undefined): number {
  const acc = accuracy(s);
  return acc === null ? 1.5 : 1 + 4 * (1 - acc);
}
/** 重みに比例した確率で1つ選ぶ */
export function pickWeighted<T>(items: readonly T[], w: (item: T) => number, random: () => number = Math.random): T {
  const ws = items.map((i) => Math.max(0, w(i)));
  let x = random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    x -= ws[i];
    if (x < 0) return items[i];
  }
  return items[items.length - 1];
}
/** 苦手な項目（正答率が低い順）。回答が少なすぎるものと、十分できているものは除く */
export function weakest(group: StatGroup | undefined, top = 3, minCount = 2, maxAcc = 0.8): { item: string; acc: number }[] {
  return Object.entries(group ?? {})
    .filter(([, s]) => s[0] + s[1] >= minCount)
    .map(([item, s]) => ({ item, acc: accuracy(s) as number }))
    .filter((x) => x.acc < maxAcc)
    .sort((a, b) => a.acc - b.acc)
    .slice(0, top);
}

// ---------- 保存つきの記録 ----------
let data: Record<string, StatGroup> = Store.get('stats', {});
let version = 0;
const subs = new Set<() => void>();

export const Stats = {
  group: (g: string): StatGroup | undefined => data[g],
  get: (g: string, item: string | number): Stat | undefined => data[g]?.[String(item)],
  record(g: string, item: string | number, ok: boolean): void {
    const grp = (data[g] ??= {});
    grp[String(item)] = bump(grp[String(item)], ok);
    Store.set('stats', data);
    version++;
    subs.forEach((f) => f());
  },
  weight: (g: string, item: string | number): number => weight(data[g]?.[String(item)]),
  clear(g: string): void {
    delete data[g];
    data = { ...data };
    Store.set('stats', data);
    version++;
    subs.forEach((f) => f());
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};
export const useStatsVersion = (): number => useSyncExternalStore(Stats.subscribe, () => version);
