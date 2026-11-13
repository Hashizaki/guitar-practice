import { useState } from 'react';
import { C_HIT, C_ROOT, C_TONE, PlayButton, Select } from '../components/common';
import { Fretboard, type Mark } from '../components/Fretboard';
import { TabStaff, type TabEvent } from '../components/TabStaff';
import { clickSound, pluckMidi } from '../lib/audio';
import { ARPEGGIO_ID } from '../lib/log';
import { Metro, useMetro } from '../lib/metronome';
import { Seq } from '../lib/seq';
import { useShared } from '../lib/store';
import { CHORD_NAMES, chordFrets, NOTE, OPEN, sharp } from '../lib/theory';

/**
 * アルペジオのパターン（8分音符×8）。B はそのコードのいちばん低い弦（ベース音）、数字は弦の番号。
 * 右手は、ベース＝親指、3弦＝人差し指、2弦＝中指、1弦＝薬指で弾く。
 */
export const ARP_PATS: readonly (readonly [string, string])[] = [
  ['上り', 'B321B321'],
  ['上り下り', 'B3212323'],
  ['定番（スリーフィンガー風）', 'B3231323'],
  ['ゆったり（4分音符）', 'B.3.2.1.'],
];
const FINGER: Record<string, string> = { B: '親', '3': '人', '2': '中', '1': '薬' };

/** パターンの1文字を、そのコードで弾く弦（0=6弦）にする */
export function arpString(frets: readonly number[], c: string): number | null {
  if (c === '.') return null;
  if (c === 'B') return frets.findIndex((f) => f >= 0);
  return 6 - Number(c);
}

export function ArpeggioPractice() {
  const m = useMetro();
  const [chord, setChord] = useShared('arpChord', 'C');
  const [patI, setPatI] = useShared('arpPat', 0);
  const [cur, setCur] = useState(-1);
  const name = CHORD_NAMES.includes(chord) ? chord : 'C';
  const frets = chordFrets(name);
  const pat = (ARP_PATS[patI] ?? ARP_PATS[0])[1];
  const strings = [...pat].map((c) => arpString(frets, c)); // 0=6弦
  const events: TabEvent[] = strings.map((i) => (i === null ? null : [{ s: 5 - i, f: frets[i] }]));
  const bass = frets.findIndex((f) => f >= 0);
  const now = cur >= 0 ? strings[cur] : null;
  const marks: Mark[] = frets.flatMap((f, i) =>
    f < 0 ? [] : [{ s: 5 - i, f, r: i === now ? 11 : 9, fill: i === now ? C_HIT : i === bass ? C_ROOT : C_TONE, label: sharp(NOTE[(OPEN[i] + f) % 12]), text: i === bass && i !== now ? '#fff' : '#2a1a08' }],
  );
  const change = <T,>(set: (v: T) => void) => (v: T): void => {
    if (Seq.active() === ARPEGGIO_ID) Seq.stop();
    set(v);
  };
  return (
    <div className="card" id="arpeggio">
      <h2>🎶 アルペジオ（指弾き）練習</h2>
      <p className="muted" style={{ margin: '0 0 10px' }}>
        コードの音を1本ずつ順番に弾く練習です。右手は、ベース音を<b>親</b>指、3弦を<b>人</b>差し指、2弦を<b>中</b>指、1弦を<b>薬</b>指で弾きます。左手はコードを押さえたままでOK。
      </p>
      <div className="row">
        <Select value={name} onChange={change(setChord)} options={CHORD_NAMES.map((n) => [n, n] as const)} testId="arp-chord" />
        <Select className="grow" value={patI} onChange={change(setPatI)} options={ARP_PATS.map((p, k) => [k, p[0]] as const)} testId="arp-pat" />
      </div>
      <TabStaff events={events} cur={cur} testId="arp-tab" />
      <div className="strokes" data-testid="arp-steps">
        {[...pat].map((c, k) => (
          <div key={k} className={`${k === cur ? 'cur' : ''}${c === '.' ? ' rest' : ''}`}>
            <b style={{ fontSize: 18 }}>{FINGER[c] ?? '・'}</b>
            <span>{c === '.' ? '\u00a0' : c === 'B' ? `${6 - bass}弦` : `${c}弦`}</span>
          </div>
        ))}
      </div>
      <Fretboard marks={marks} testId="arp-board" />
      <PlayButton
        id={ARPEGGIO_ID}
        className="primary bigbtn"
        label="▶ お手本を聞く（ループ）"
        testId="arp-btn"
        make={() => ({
          n: 8,
          len: 30 / Metro.get().bpm,
          loop: true,
          fn: (i, t) => {
            if (i % 2 === 0) clickSound(t, i === 0);
            const st = strings[i];
            if (st !== null) pluckMidi(OPEN[st] + frets[st], t, st === bass ? 0.55 : 0.45);
          },
          ui: setCur,
          onStop: () => setCur(-1),
        })}
      />
      <p className="muted" style={{ margin: '8px 0 0', textAlign: 'center' }}>テンポはメトロノームタブの BPM（現在 {m.bpm}）。ゆっくりから始めましょう。</p>
    </div>
  );
}
