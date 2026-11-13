/** メトロノームのエンジン（React の外に1つだけ持つ）。コード練習・リズム練習もこれを共有する */
import { useSyncExternalStore } from 'react';
import { ac, clickSound, tickSound } from './audio';
import { subdivisionTimes } from './rhythm';
import { Store } from './store';
import { keepAwake } from './wake';

export type MetroMode = 'metro' | 'chord' | 'rhythm';
export interface MetroState {
  bpm: number;
  beats: number;
  accent: boolean;
  running: boolean;
  mode: MetroMode | null;
  rampOn: boolean;
  rampBars: number;
  rampStep: number;
  /** 1拍をいくつに刻むか（1=4分、2=8分、3=3連、4=16分） */
  sub: number;
}
type BeatListener = (beat: number, count: number) => void;

let state: MetroState = {
  bpm: Store.get('bpm', 90),
  beats: Store.get('beats', 4),
  accent: Store.get('accent', true),
  running: false,
  mode: null,
  rampOn: Store.get('rampOn', false),
  rampBars: Store.get('rampBars', 4),
  rampStep: Store.get('rampStep', 5),
  sub: Store.get('sub', 1),
};
const subs = new Set<() => void>();
const beatSubs = new Set<BeatListener>();
let next = 0;
let beat = 0;
let count = 0;
let timer: ReturnType<typeof setInterval> | undefined;
/** 直近に予約した拍の時刻（オーディオ時間）。リズム練習の判定に使う */
const times: number[] = [];
/** true を返す拍はクリックを鳴らさない（リズム練習の「ときどき消す」用） */
let mute: ((count: number) => boolean) | null = null;

function update(patch: Partial<MetroState>): void {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}

function scheduler(): void {
  const c = ac();
  // バックグラウンドから戻った時などに、遅れたクリックをまとめて鳴らさない
  if (next < c.currentTime - 0.05) next = c.currentTime + 0.05;
  while (next < c.currentTime + 0.12) {
    const b = beat;
    const n = count;
    const t = next;
    if (!(mute && mute(n))) {
      clickSound(t, b === 0 && state.accent);
      // 細かい刻み（リズム練習中は、タップの手がかりになってしまうので鳴らさない）
      if (state.mode !== 'rhythm') subdivisionTimes(t, 60 / state.bpm, state.sub).forEach(tickSound);
    }
    times.push(t);
    if (times.length > 8) times.shift();
    setTimeout(() => beatSubs.forEach((f) => f(b, n)), Math.max(0, (t - c.currentTime) * 1000));
    next += 60 / state.bpm;
    beat = (b + 1) % state.beats;
    count++;
    // テンポアップ練習：指定した小節ごとに BPM を上げる
    if (beat === 0 && state.rampOn) {
      const bars = count / state.beats;
      if (bars > 0 && bars % state.rampBars === 0) setTimeout(() => Metro.setBpm(state.bpm + state.rampStep), 0);
    }
  }
}

export const Metro = {
  get: (): MetroState => state,
  times: (): readonly number[] => times,
  isMuted: (n: number): boolean => !!(mute && mute(n)),
  start(mode: MetroMode, muteFn: ((count: number) => boolean) | null = null): void {
    if (state.running) Metro.stop();
    const c = ac();
    beat = 0;
    count = 0;
    next = c.currentTime + 0.08;
    times.length = 0;
    mute = muteFn;
    timer = setInterval(scheduler, 25);
    keepAwake('metro', true);
    update({ running: true, mode });
    scheduler();
  },
  stop(): void {
    if (!state.running) return;
    clearInterval(timer);
    mute = null;
    keepAwake('metro', false);
    update({ running: false, mode: null });
  },
  toggle(mode: MetroMode): void {
    if (state.running && state.mode === mode) Metro.stop();
    else Metro.start(mode);
  },
  setBpm(v: number): void {
    const bpm = Math.max(30, Math.min(240, Math.round(v)));
    Store.set('bpm', bpm);
    update({ bpm });
  },
  setBeats(beats: number): void {
    beat = 0;
    Store.set('beats', beats);
    update({ beats });
  },
  setSub(sub: number): void {
    Store.set('sub', sub);
    update({ sub });
  },
  setAccent(accent: boolean): void {
    Store.set('accent', accent);
    update({ accent });
  },
  setRamp(patch: Partial<Pick<MetroState, 'rampOn' | 'rampBars' | 'rampStep'>>): void {
    Object.entries(patch).forEach(([k, v]) => Store.set(k, v));
    update(patch);
  },
  /** 拍ごとに呼ばれる（画面更新用。音の時刻とそろえて呼ぶ） */
  onBeat(fn: BeatListener): () => void {
    beatSubs.add(fn);
    return () => beatSubs.delete(fn);
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};

export const useMetro = (): MetroState => useSyncExternalStore(Metro.subscribe, Metro.get);
