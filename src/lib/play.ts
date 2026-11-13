/** 理論上のコードを実際に鳴らす */
import { ac, pluckMidi, strum } from './audio';
import { chordFrets, chordVoicing, hasChord, parseNote, T_CHORD, type ChordType } from './theory';

/** コードを鳴らす：ギターのフォームがあればそれで、なければ構成音を重ねる */
export function playChord(root: string, ty: ChordType, t?: number | null, up = false): void {
  const name = root + T_CHORD[ty].sym;
  if (hasChord(name)) {
    strum(chordFrets(name), t, up);
    return;
  }
  const ns = chordVoicing(parseNote(root).pc, T_CHORD[ty].iv);
  const t0 = t ?? ac().currentTime + 0.01;
  (up ? ns.reverse().slice(0, 4) : ns).forEach((m, i) => pluckMidi(m, t0 + i * 0.025, 0.28));
}

/** フォーム名＋カポで鳴らす（カポのぶん全弦を上げる） */
export function playShape(name: string, capo: number, t?: number | null, up = false): void {
  strum(chordFrets(name).map((f) => (f < 0 ? f : f + capo)), t, up);
}
