import { chordBarre, chordFrets } from '../lib/theory';

const X = (i: number): number => 14 + i * 14;
const Y = (f: number): number => 22 + f * 20;

/** コードの押さえ方の図（6弦が左） */
export function ChordDiagram({ name, w = 96 }: { name: string; w?: number }) {
  const fr = chordFrets(name);
  const barre = chordBarre(name);
  return (
    <svg viewBox="0 0 98 112" width={w} height={(w * 112) / 98} role="img" aria-label={`${name} のコード図`}>
      {[0, 1, 2, 3, 4].map((f) => (
        <line key={'f' + f} x1="14" x2="84" y1={Y(f)} y2={Y(f)} stroke="#8a7660" strokeWidth={f === 0 ? 4 : 1.2} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={'s' + i} x1={X(i)} x2={X(i)} y1={Y(0)} y2={Y(4)} stroke="#c9b79f" strokeWidth={1.6 - i * 0.15} />
      ))}
      {barre && <rect x={X(barre[1]) - 6} y={Y(barre[0]) - 16} width={X(5) - X(barre[1]) + 12} height="12" rx="6" fill="#f0a33a" />}
      {fr.map((f, i) =>
        f < 0 ? (
          <text key={i} x={X(i)} y="15" textAnchor="middle" fontSize="11" fill="#b3a28c">
            ×
          </text>
        ) : f === 0 ? (
          <circle key={i} cx={X(i)} cy="11" r="4" fill="none" stroke="#b3a28c" strokeWidth="1.4" />
        ) : barre && f === barre[0] && i >= barre[1] ? null : (
          <circle key={i} cx={X(i)} cy={Y(f) - 10} r="5.5" fill="#f0a33a" />
        ),
      )}
    </svg>
  );
}
