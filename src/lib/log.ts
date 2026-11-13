/** 練習記録。この端末の localStorage にだけ保存し、どこにも送信しない */
import { useSyncExternalStore } from 'react';
import { Metro } from './metronome';
import { micInUse } from './mic';
import { Seq } from './seq';
import { Store } from './store';

export type LogKind = 'lesson' | 'fret' | 'ear' | 'rhythm' | 'chord';
export type DayLog = { sec: number } & Partial<Record<LogKind, number>>;

export const dayKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let data: Record<string, DayLog> = Store.get('log', {});
let version = 0;
let lastAct = 0;
const subs = new Set<() => void>();
/** 「曲に合わせて弾く」の再生 id。再生中はコード練習の時間として数える */
export const PLAY_ALONG_ID = 'play-along';

function today(): DayLog {
  const k = dayKey();
  return (data[k] ??= { sec: 0 });
}
function save(): void {
  const keys = Object.keys(data).sort();
  while (keys.length > 400) delete data[keys.shift() as string];
  Store.set('log', data);
  version++;
  subs.forEach((f) => f());
}

export const Log = {
  data: (): Readonly<Record<string, DayLog>> => data,
  get: (what: LogKind | 'sec'): number => data[dayKey()]?.[what] ?? 0,
  count(what: LogKind, n = 1): void {
    const t = today();
    t[what] = (t[what] ?? 0) + n;
    save();
  },
  /** 5秒ごと：画面が表示中で、操作してから1分以内か、メトロノーム・マイク・デモ再生が動いていれば練習時間に数える */
  tick(): void {
    if (document.visibilityState !== 'visible') return;
    const m = Metro.get();
    const busy = m.running || micInUse() || Seq.active() !== null;
    if (!busy && Date.now() - lastAct > 60000) return;
    const t = today();
    t.sec += 5;
    if ((m.running && m.mode === 'chord') || Seq.active() === PLAY_ALONG_ID) t.chord = (t.chord ?? 0) + 5;
    save();
  },
  /** 1分以上練習した日が何日続いているか（今日がまだなら昨日から数える） */
  streak(): number {
    let n = 0;
    const d = new Date();
    if (!((data[dayKey(d)]?.sec ?? 0) >= 60)) d.setDate(d.getDate() - 1);
    while ((data[dayKey(d)]?.sec ?? 0) >= 60) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  },
  /** バックアップからの復元用 */
  replace(next: Record<string, DayLog>): void {
    data = next;
    save();
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};

(['pointerdown', 'keydown'] as const).forEach((ev) =>
  document.addEventListener(ev, () => {
    lastAct = Date.now();
  }, true),
);
setInterval(() => Log.tick(), 5000);

/** 記録が変わるたびに再描画するためのフック（値は版番号） */
export const useLogVersion = (): number => useSyncExternalStore(Log.subscribe, () => version);

export const fmtMin = (sec: number): string =>
  sec >= 3600 ? `${Math.floor(sec / 3600)}時間${Math.floor((sec % 3600) / 60)}分` : `${Math.floor(sec / 60)}分`;
