import type { PointerEvent } from 'react';
import type { Pos } from '../lib/theory';

/** 指板に置く印 */
export interface Mark extends Pos {
  fill?: string;
  label?: string;
  text?: string;
  ring?: string;
  pulse?: boolean;
  r?: number;
}

const NUT = 26;
const FW = 28;
const SY = (i: number): number => 16 + i * 24; // i=0 が1弦（上）
const fretX = (f: number): number => (f === 0 ? 12 : NUT + FW * f - FW / 2);

/** 12フレットまでの指板。onHit を渡すとタップした位置（弦・フレット）を受け取れる */
export function Fretboard({ marks = [], onHit, testId }: { marks?: Mark[]; onHit?: (p: Pos) => void; testId?: string }) {
  const down = (e: PointerEvent<SVGSVGElement>): void => {
    if (!onHit) return;
    const svg = e.currentTarget;
    const m = svg.getScreenCTM();
    if (!m) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    const s = Math.round((p.y - 16) / 24);
    if (s < 0 || s > 5 || Math.abs(p.y - SY(s)) > 13) return;
    if (p.x < 0 || p.x > NUT + FW * 12) return;
    e.preventDefault();
    onHit({ s, f: p.x < NUT ? 0 : Math.min(12, Math.ceil((p.x - NUT) / FW)) });
  };
  return (
    <svg className="fb" viewBox="0 0 372 170" onPointerDown={down} data-testid={testId}>
      <rect x={NUT} y={SY(0) - 8} width={FW * 12} height={SY(5) - SY(0) + 16} fill="#3b2a1b" rx="3" />
      {[3, 5, 7, 9].map((f) => (
        <circle key={f} cx={fretX(f)} cy={(SY(2) + SY(3)) / 2} r="5" fill="#5a4530" />
      ))}
      <circle cx={fretX(12)} cy={(SY(1) + SY(2)) / 2} r="5" fill="#5a4530" />
      <circle cx={fretX(12)} cy={(SY(3) + SY(4)) / 2} r="5" fill="#5a4530" />
      {Array.from({ length: 13 }, (_, f) => (
        <g key={f}>
          <line x1={NUT + FW * f} x2={NUT + FW * f} y1={SY(0) - 8} y2={SY(5) + 8} stroke={f === 0 ? '#e9dcc6' : '#9b8a74'} strokeWidth={f === 0 ? 5 : 1.5} />
          {f > 0 && (
            <text x={fretX(f)} y={SY(5) + 26} textAnchor="middle" fontSize="10" fill="#b3a28c">
              {f}
            </text>
          )}
        </g>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <line x1="4" x2={NUT + FW * 12} y1={SY(i)} y2={SY(i)} stroke="#d8c7ae" strokeWidth={0.8 + i * 0.35} />
          <text x={NUT + FW * 12 + 6} y={SY(i) + 4} fontSize="10" fill="#b3a28c">
            {i + 1}
          </text>
        </g>
      ))}
      {marks.map((m, i) => {
        const r = m.r ?? 9;
        return (
          <g key={i} data-mark={`${m.s}-${m.f}`}>
            <circle cx={fretX(m.f)} cy={SY(m.s)} r={r} fill={m.fill ?? '#f0a33a'} stroke={m.ring ?? 'none'} strokeWidth="2">
              {m.pulse && <animate attributeName="r" values={`${r};${r + 2};${r}`} dur="1.2s" repeatCount="indefinite" />}
            </circle>
            {m.label && (
              <text x={fretX(m.f)} y={SY(m.s) + 3.5} textAnchor="middle" fontSize={m.label.length > 2 ? 8 : 9.5} fontWeight="700" fill={m.text ?? '#2a1a08'}>
                {m.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

