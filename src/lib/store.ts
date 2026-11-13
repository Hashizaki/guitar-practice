import { useCallback, useSyncExternalStore } from 'react';

/** localStorage の薄いラッパー。キーには gtr_ を付け、失敗しても落ちない */
export const Store = {
  get<T>(key: string, def: T): T {
    try {
      const v = localStorage.getItem('gtr_' + key);
      return v === null ? def : (JSON.parse(v) as T);
    } catch {
      return def;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem('gtr_' + key, JSON.stringify(value));
    } catch {
      /* プライベートモードなどで保存できなくても動作は続ける */
    }
  },
};

// ---------- 画面のどこからでも読み書きできる、保存つきの共有状態 ----------
const subs = new Map<string, Set<() => void>>();
const cache = new Map<string, unknown>();

export function getShared<T>(key: string, def: T): T {
  if (!cache.has(key)) cache.set(key, Store.get(key, def));
  return cache.get(key) as T;
}
export function setShared<T>(key: string, value: T): void {
  cache.set(key, value);
  Store.set(key, value);
  subs.get(key)?.forEach((f) => f());
}
/** 保存つきの状態。同じ key を使うコンポーネントどうしで値が共有される */
export function useShared<T>(key: string, def: T): [T, (v: T) => void] {
  const subscribe = useCallback(
    (fn: () => void) => {
      let set = subs.get(key);
      if (!set) subs.set(key, (set = new Set()));
      set.add(fn);
      return () => set.delete(fn);
    },
    [key],
  );
  const value = useSyncExternalStore(subscribe, () => getShared(key, def));
  const set = useCallback((v: T) => setShared(key, v), [key]);
  return [value, set];
}
