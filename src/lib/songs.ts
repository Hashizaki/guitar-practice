/** 自分で登録する曲（コード進行）と、コード名の読み取り（副作用なし。単体テストあり） */
import { CHORD_NAMES, keyByPc, parseNote, T_CHORD, type ChordType, type KeyChord } from './theory';

export interface Song { id: string; name: string; /** 1小節に1つのコード名 */ chords: string[] }
export const MAX_BARS = 32;

const QUALITY: Record<string, ChordType> = {
  '': 'M', M: 'M', maj: 'M', m: 'm', min: 'm', '-': 'm', '7': '7', maj7: 'M7', M7: 'M7', '△7': 'M7', m7: 'm7', min7: 'm7', dim: 'dim',
};

/** 「F#m」「Bb」「Cmaj7」などを読み取る。読めなければ null */
export function parseChordName(token: string): KeyChord | null {
  const m = /^([A-G])([#♯b♭]?)(.*)$/.exec(token.trim());
  if (!m) return null;
  const ty = QUALITY[m[3]];
  if (ty === undefined) return null;
  const root = m[1] + (m[2] === '#' || m[2] === '♯' ? '♯' : m[2] ? '♭' : '');
  return { root, ty, name: root + T_CHORD[ty].sym, roman: '' };
}

/** 入力欄の文字列をコードの並びにする。区切りは空白・｜・カンマ・改行 */
export function parseSongText(text: string): { chords: KeyChord[]; bad: string[] } {
  const tokens = text.split(/[\s|｜,、→\-–]+/).filter(Boolean);
  const chords: KeyChord[] = [];
  const bad: string[] = [];
  for (const t of tokens) {
    const c = parseChordName(t);
    if (c) chords.push(c);
    else bad.push(t);
  }
  return { chords, bad };
}

/** コードを半音 semi 個ぶん移調する（カポのフォームを求めるときは負の数） */
export function transposeChord(c: KeyChord, semi: number): KeyChord {
  if (semi === 0) return c;
  const root = keyByPc(parseNote(c.root).pc + semi);
  return { ...c, root, name: root + T_CHORD[c.ty].sym };
}

// コード表にあるフォームを「音の高さ＋種類」で引けるようにする（C♯m と D♭m のような書き方の違いを吸収）
const SHAPES = new Map<string, string>();
for (const n of CHORD_NAMES) {
  const c = parseChordName(n);
  if (c) SHAPES.set(`${parseNote(c.root).pc}:${c.ty}`, n);
}
/** そのコードのフォームがコード表にあれば、その名前を返す */
export const findShape = (c: KeyChord): string | null => SHAPES.get(`${parseNote(c.root).pc}:${c.ty}`) ?? null;

/** フォームがコード表にあるコードがいちばん多く、バレーが少なくなるカポ位置（0〜7） */
export function bestCapoFor(reals: readonly KeyChord[], isBarre: (name: string) => boolean): number {
  let best = 0;
  let bestScore = -Infinity;
  for (let capo = 0; capo <= 7; capo++) {
    const shapes = [...new Map(reals.map((c) => transposeChord(c, -capo)).map((c) => [c.name, c])).values()];
    const found = shapes.map(findShape).filter((x): x is string => x !== null);
    const score = found.length / shapes.length - capo * 0.001 - found.filter(isBarre).length * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = capo;
    }
  }
  return best;
}

/** 1分間コードチェンジの記録用：コードの組を順番によらない名前にする */
export const pairKey = (a: string, b: string): string => [a, b].sort().join(' ⇄ ');
