/** デモ再生用の小さなシーケンサー。一度に1つだけ鳴らす（同じ id でもう一度呼ぶと停止） */
import { useSyncExternalStore } from 'react';
import { ac } from './audio';
import { keepAwake } from './wake';

let active: string | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];
let onStop: (() => void) | null = null;
const subs = new Set<() => void>();
const emit = (): void => subs.forEach((f) => f());

export interface SeqOptions {
  /** ステップ数 */
  n: number;
  /** 1ステップの長さ（秒） */
  len: number;
  /** 音を予約する。t はオーディオ時間 */
  fn: (i: number, t: number) => void;
  /** 音に合わせて画面を更新する */
  ui?: (i: number) => void;
  loop?: boolean;
  onStop?: () => void;
}

export const Seq = {
  active: (): string | null => active,
  stop(): void {
    timers.forEach(clearTimeout);
    timers = [];
    if (active) {
      active = null;
      keepAwake('seq', false);
      emit();
    }
    if (onStop) {
      const f = onStop;
      onStop = null;
      f();
    }
  },
  play(id: string, o: SeqOptions): void {
    if (active === id) {
      Seq.stop();
      return;
    }
    Seq.stop();
    active = id;
    onStop = o.onStop ?? null;
    keepAwake('seq', true);
    emit();
    const c = ac();
    const t0 = c.currentTime + 0.12;
    let k = 0;
    const step = (): void => {
      if (timers.length > 60) timers.splice(0, 40);
      const i = k % o.n;
      const t = t0 + k * o.len;
      o.fn(i, t);
      if (o.ui) timers.push(setTimeout(() => o.ui?.(i), Math.max(0, (t - c.currentTime) * 1000)));
      k++;
      if (k < o.n || o.loop) timers.push(setTimeout(step, Math.max(0, (t0 + k * o.len - c.currentTime - 0.1) * 1000)));
      else timers.push(setTimeout(() => Seq.stop(), (t + o.len + 0.3 - c.currentTime) * 1000));
    };
    step();
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};

/** いま再生中の id（なければ null） */
export const useSeqActive = (): string | null => useSyncExternalStore(Seq.subscribe, Seq.active);
