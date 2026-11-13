import type { PointerEvent } from 'react';
import { LPC } from '../lib/theory';

export type KeyMarks = Record<number, { fill: string; label?: string }>;

/** 2オクターブの鍵盤（C3〜C5）。marks で色と音名を付けられる */
export function Keyboard({ marks = {}, onTap }: { marks?: KeyMarks; onTap?: (midi: number) => void }) {
  const down = (e: PointerEvent<SVGSVGElement>): void => {
    const k = (e.target as Element).closest('[data-m]');
    if (!k || !onTap) return;
    e.preventDefault();
    onTap(Number((k as SVGElement).dataset.m));
  };
  const whites = [];
  const blacks = [];
  let w = 0;
  for (let m = 48; m <= 72; m++) {
    const pc = m % 12;
    const mk = marks[m];
    if ((LPC as readonly number[]).includes(pc)) {
      whites.push(
        <g key={m}>
          <rect data-m={m} x={w * 20} y="0" width="20" height="90" rx="3" fill={mk ? mk.fill : '#f3e9dc'} stroke="#1b1612" strokeWidth="1.5" />
          {mk?.label ? (
            <text x={w * 20 + 10} y="80" textAnchor="middle" fontSize={mk.label.length > 2 ? 7.5 : 9.5} fontWeight="700" fill="#2a1a08" pointerEvents="none">
              {mk.label}
            </text>
          ) : (
            pc === 0 && (
              <text x={w * 20 + 10} y="82" textAnchor="middle" fontSize="8" fill="#9b8a74" pointerEvents="none">
                C
              </text>
            )
          )}
        </g>,
      );
      w++;
    } else {
      const x = w * 20 - 6.5;
      blacks.push(
        <g key={m}>
          <rect data-m={m} x={x} y="0" width="13" height="56" rx="2" fill={mk ? mk.fill : '#2a211a'} stroke="#1b1612" strokeWidth="1" />
          {mk?.label && (
            <text x={x + 6.5} y="48" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#2a1a08" pointerEvents="none">
              {mk.label}
            </text>
          )}
        </g>,
      );
    }
  }
  return (
    <svg className="kb" viewBox="0 0 300 90" onPointerDown={down}>
      {whites}
      {blacks}
    </svg>
  );
}
