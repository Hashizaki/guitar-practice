import { useEffect, useState, type ReactNode } from 'react';
import { Metro, useMetro } from '../lib/metronome';
import { Seq, useSeqActive, type SeqOptions } from '../lib/seq';
import { Stats, pickWeighted, useStatsVersion, weakest } from '../lib/stats';
import { getShared, Store, useShared } from '../lib/store';
import { pick } from '../lib/theory';

/** メトロノームの拍を示す丸 */
export function Dots() {
  const { beats, running } = useMetro();
  const [hit, setHit] = useState(-1);
  useEffect(() => Metro.onBeat((b) => setHit(b)), []);
  return (
    <div className="dots">
      {Array.from({ length: beats }, (_, i) => (
        <div key={i} className={`dot${i === 0 ? ' first' : ''}${running && i === hit ? ' hit' : ''}`} />
      ))}
    </div>
  );
}

export interface Score { c: number; t: number; s: number; b: number }
/** クイズの成績（正解・回答・連続・最高連続）。最高連続だけ保存する */
export function useScore(key: string): [Score, (ok: boolean) => void] {
  const [sc, setSc] = useState<Score>(() => ({ c: 0, t: 0, s: 0, b: Store.get('best_' + key, 0) }));
  const record = (ok: boolean): void =>
    setSc((p) => {
      const s = ok ? p.s + 1 : 0;
      const b = Math.max(p.b, s);
      if (b > p.b) Store.set('best_' + key, b);
      return { c: p.c + (ok ? 1 : 0), t: p.t + 1, s, b };
    });
  return [sc, record];
}
export function ScoreBar({ score, testId }: { score: Score; testId?: string }) {
  const cells: [number, string][] = [[score.c, '正解'], [score.t, '回答'], [score.s, '連続'], [score.b, '最高連続']];
  return (
    <div className="score" data-testid={testId}>
      {cells.map(([v, l]) => (
        <div key={l}>
          <b>{v}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

/** デモ再生ボタン。再生中は「■ 停止」になり、もう一度押すと止まる */
export function PlayButton({ id, label, make, className = 'primary', testId }: { id: string; label: ReactNode; make: () => SeqOptions; className?: string; testId?: string }) {
  const on = useSeqActive() === id;
  return (
    <button className={`${className}${on ? ' on' : ''}`} onClick={() => Seq.play(id, make())} data-testid={testId}>
      {on ? '■ 停止' : label}
    </button>
  );
}

export function Select<T extends string | number>({ value, onChange, options, className, testId }: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
  className?: string;
  testId?: string;
}) {
  const num = typeof value === 'number';
  return (
    <select className={className} value={value} onChange={(e) => onChange((num ? Number(e.target.value) : e.target.value) as T)} data-testid={testId}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function Check({ checked, onChange, children, testId }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; testId?: string }) {
  return (
    <label className="chk">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      {children}
    </label>
  );
}

export const C_ROOT = '#e2683c';
export const C_TONE = '#f0a33a';
export const C_HIT = '#6cc48a';

// ---------- 苦手の記録 ----------
export const useWeakMode = () => useShared('weakMode', true);
/** 問題を選ぶ。「苦手を多めに出す」がオンなら、間違いの多いものほど選ばれやすい */
export function chooseItem<T>(pool: readonly T[], weightOf: (item: T) => number): T {
  return getShared('weakMode', true) ? pickWeighted(pool, weightOf) : pick(pool);
}
export interface WeakGroup { group: string; label: (item: string) => string }
/** クイズの下に出す「苦手なところ」の一覧と、重点出題の切り替え */
export function WeakList({ groups, testId }: { groups: WeakGroup[]; testId?: string }) {
  useStatsVersion();
  const [on, setOn] = useWeakMode();
  const items = groups
    .flatMap((g) => weakest(Stats.group(g.group)).map((x) => ({ name: g.label(x.item), acc: x.acc })))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 4);
  return (
    <div className="weak" data-testid={testId}>
      <Check checked={on} onChange={setOn}>苦手を多めに出す</Check>
      <span className="muted" data-testid={testId && `${testId}-list`}>
        {items.length ? <>苦手：{items.map((x, i) => <b key={i}>{x.name}<small>{Math.round(x.acc * 100)}%</small></b>)}</> : 'まちがえた問題は、ここに「苦手」として記録されます。'}
      </span>
    </div>
  );
}
