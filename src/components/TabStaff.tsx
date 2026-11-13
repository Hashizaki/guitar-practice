import type { Pos } from '../lib/theory';
import { C_HIT } from './common';

/** TAB譜の1ステップ。同時に鳴らす音は配列にまとめる。null は休み。s は弦（0=1弦） */
export type TabEvent = Pos[] | null;

/** かんたんな TAB譜。cur 番目のステップを強調する */
export function TabStaff({ events, cur, testId = 'tab-staff' }: { events: TabEvent[]; cur: number; testId?: string }) {
  const step = Math.min(34, 250 / Math.max(events.length, 1));
  return (
    <svg className="kb" viewBox="0 0 300 92" data-testid={testId}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <line x1="22" x2="296" y1={14 + i * 13} y2={14 + i * 13} stroke="#8a7660" strokeWidth="1" />
          <text x="8" y={17.5 + i * 13} fontSize="8" fill="var(--muted)">{i + 1}弦</text>
        </g>
      ))}
      <line x1="22" x2="22" y1="14" y2="79" stroke="#8a7660" strokeWidth="2" />
      <line x1="296" x2="296" y1="14" y2="79" stroke="#8a7660" strokeWidth="2" />
      {events.map((ev, k) =>
        (ev ?? []).map(({ s, f }) => (
          <g key={`${k}-${s}`} data-step={k} data-cur={k === cur || undefined}>
            <rect x={40 + k * step - 6} y={14 + s * 13 - 6.5} width="12" height="13" rx="3" fill={k === cur ? C_HIT : 'var(--panel)'} />
            <text x={40 + k * step} y={14 + s * 13 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={k === cur ? '#10220f' : 'var(--text)'}>{f}</text>
          </g>
        )),
      )}
    </svg>
  );
}
