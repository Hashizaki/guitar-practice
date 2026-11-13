/** 音楽理論のデータと計算（副作用なし。単体テストあり） */

export const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const NOTE_JP: Record<string, string> = {
  C: 'C (ド)', D: 'D (レ)', E: 'E (ミ)', F: 'F (ファ)', G: 'G (ソ)', A: 'A (ラ)', B: 'B (シ)',
};
/** 開放弦の MIDI 番号。6弦→1弦 */
export const OPEN = [40, 45, 50, 55, 59, 64] as const;
/** 開放弦の MIDI 番号。1弦→6弦（指板の表示順） */
export const OPEN_TOP = [64, 59, 55, 50, 45, 40] as const;

/** 指板上の位置。s は弦（0=1弦 … 5=6弦）、f はフレット */
export interface Pos { s: number; f: number }

export const sharp = (n: string): string => n.replace('#', '♯');
/** 指板の音名（♯表記）。s: 0=1弦 */
export const noteAt = (s: number, f: number): string => NOTE[(OPEN_TOP[s] + f) % 12];
export const noteLabel = (n: string): string => NOTE_JP[n] ?? sharp(n);
export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

// ---------- コードフォーム ----------
export interface BarreChord { f: number[]; barre: [fret: number, fromString: number] }
/** フレットは6弦→1弦、-1 はミュート */
export const CHORDS: Record<string, number[] | BarreChord> = {
  C: [-1, 3, 2, 0, 1, 0], D: [-1, -1, 0, 2, 3, 2], E: [0, 2, 2, 1, 0, 0], G: [3, 2, 0, 0, 0, 3], A: [-1, 0, 2, 2, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0], Dm: [-1, -1, 0, 2, 3, 1], Em: [0, 2, 2, 0, 0, 0],
  F: { f: [1, 3, 3, 2, 1, 1], barre: [1, 0] }, Bm: { f: [-1, 2, 4, 4, 3, 2], barre: [2, 1] },
  C7: [-1, 3, 2, 3, 1, 0], D7: [-1, -1, 0, 2, 1, 2], E7: [0, 2, 0, 1, 0, 0], G7: [3, 2, 0, 0, 0, 1], A7: [-1, 0, 2, 0, 2, 0], B7: [-1, 2, 1, 2, 0, 2],
  Fmaj7: [-1, -1, 3, 2, 1, 0], Cmaj7: [-1, 3, 2, 0, 0, 0],
  Am7: [-1, 0, 2, 0, 1, 0], Em7: [0, 2, 0, 0, 0, 0], Dm7: [-1, -1, 0, 2, 1, 1],
  B: { f: [-1, 2, 4, 4, 4, 2], barre: [2, 1] }, 'F♯m': { f: [2, 4, 4, 2, 2, 2], barre: [2, 0] },
};
export const CHORD_NAMES = Object.keys(CHORDS);
export const hasChord = (n: string): boolean => n in CHORDS;
export const isBarre = (n: string): boolean => !Array.isArray(CHORDS[n]);
export function chordFrets(n: string): number[] {
  const c = CHORDS[n];
  return Array.isArray(c) ? c : c.f;
}
export function chordBarre(n: string): [number, number] | null {
  const c = CHORDS[n];
  return Array.isArray(c) ? null : c.barre;
}
/** フォームから、そのコードに含まれる音（0=C）を求める */
export function chordPcs(n: string): number[] {
  return [...new Set(chordFrets(n).map((f, i) => (f < 0 ? -1 : (OPEN[i] + f) % 12)).filter((x) => x >= 0))];
}

// ---------- 正しい音名のつづり（F メジャーなら A♯ ではなく B♭） ----------
export const LET = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export const LPC = [0, 2, 4, 5, 7, 9, 11] as const;
export const LET_JP = ['ド', 'レ', 'ミ', 'ファ', 'ソ', 'ラ', 'シ'] as const;
const ACC: Record<string, string> = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
export const KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'B♭', 'E♭', 'A♭', 'B', 'F♯', 'D♭'] as const;
export const EASY_KEYS = ['C', 'G', 'D', 'A', 'E', 'F'] as const;

export function parseNote(n: string): { l: number; pc: number } {
  const l = LET.indexOf(n[0] as (typeof LET)[number]);
  const a = n.includes('♯') ? 1 : n.includes('♭') ? -1 : 0;
  return { l, pc: mod12(LPC[l] + a) };
}
/** root から semi 半音上の音を「step 度ぶん先の文字」で書く（step: 0=同じ文字, 2=3度…） */
export function spell(root: string, semi: number, step: number): string {
  const r = parseNote(root);
  const l = (r.l + step) % 7;
  let d = mod12(mod12(r.pc + semi) - LPC[l]);
  if (d > 6) d -= 12;
  return LET[l] + ACC[String(d)];
}
export const withJP = (n: string): string => `${n}（${LET_JP[LET.indexOf(n[0] as (typeof LET)[number])]}${n.slice(1)}）`;
/** 音の番号（0=C）から、よく使う書き方の音名を返す */
export const keyByPc = (pc: number): string => KEYS.find((k) => parseNote(k).pc === mod12(pc)) as string;
export const rootMidi = (root: string, base = 48): number => base + parseNote(root).pc;

// ---------- スケール ----------
export type ScaleKind = 'major' | 'minor' | 'minpenta' | 'majpenta';
export const T_SCALE: Record<ScaleKind, { jp: string; iv: number[]; st: number[] }> = {
  major: { jp: 'メジャースケール', iv: [0, 2, 4, 5, 7, 9, 11], st: [0, 1, 2, 3, 4, 5, 6] },
  minor: { jp: 'ナチュラルマイナースケール', iv: [0, 2, 3, 5, 7, 8, 10], st: [0, 1, 2, 3, 4, 5, 6] },
  minpenta: { jp: 'マイナーペンタトニック', iv: [0, 3, 5, 7, 10], st: [0, 2, 3, 4, 6] },
  majpenta: { jp: 'メジャーペンタトニック', iv: [0, 2, 4, 7, 9], st: [0, 1, 2, 4, 5] },
};
export const scaleNotes = (root: string, k: ScaleKind): string[] => T_SCALE[k].iv.map((s, i) => spell(root, s, T_SCALE[k].st[i]));

/** 指板のスケール表示用（♯表記・度数つき） */
export const SCALES: Record<string, { n: string; iv: number[]; deg: string[] }> = {
  minpenta: { n: 'マイナーペンタトニック', iv: [0, 3, 5, 7, 10], deg: ['R', '♭3', '4', '5', '♭7'] },
  majpenta: { n: 'メジャーペンタトニック', iv: [0, 2, 4, 7, 9], deg: ['R', '2', '3', '5', '6'] },
  blues: { n: 'ブルース', iv: [0, 3, 5, 6, 7, 10], deg: ['R', '♭3', '4', '♭5', '5', '♭7'] },
  major: { n: 'メジャー（イオニアン）', iv: [0, 2, 4, 5, 7, 9, 11], deg: ['R', '2', '3', '4', '5', '6', '7'] },
  minor: { n: 'ナチュラルマイナー', iv: [0, 2, 3, 5, 7, 8, 10], deg: ['R', '2', '♭3', '4', '5', '♭6', '♭7'] },
  chord: { n: 'メジャーコードトーン', iv: [0, 4, 7], deg: ['R', '3', '5'] },
  mchord: { n: 'マイナーコードトーン', iv: [0, 3, 7], deg: ['R', '♭3', '5'] },
};

// ---------- コードの種類 ----------
export type ChordType = 'M' | 'm' | 'dim' | '7' | 'M7' | 'm7';
export const T_CHORD: Record<ChordType, { sym: string; jp: string; iv: number[]; st: number[]; f: string }> = {
  M: { sym: '', jp: 'メジャー', iv: [0, 4, 7], st: [0, 2, 4], f: 'ルート ＋ 長3度 ＋ 完全5度' },
  m: { sym: 'm', jp: 'マイナー', iv: [0, 3, 7], st: [0, 2, 4], f: 'ルート ＋ 短3度 ＋ 完全5度' },
  dim: { sym: 'dim', jp: 'ディミニッシュ', iv: [0, 3, 6], st: [0, 2, 4], f: 'ルート ＋ 短3度 ＋ 減5度' },
  '7': { sym: '7', jp: 'セブンス', iv: [0, 4, 7, 10], st: [0, 2, 4, 6], f: 'メジャー ＋ 短7度' },
  M7: { sym: 'maj7', jp: 'メジャーセブンス', iv: [0, 4, 7, 11], st: [0, 2, 4, 6], f: 'メジャー ＋ 長7度' },
  m7: { sym: 'm7', jp: 'マイナーセブンス', iv: [0, 3, 7, 10], st: [0, 2, 4, 6], f: 'マイナー ＋ 短7度' },
};
export const chordNotes = (root: string, ty: ChordType): string[] => T_CHORD[ty].iv.map((s, i) => spell(root, s, T_CHORD[ty].st[i]));

/** 音程：[名前, 何度ぶん先の文字か]。添字が半音数 */
export const T_IV: readonly (readonly [string, number])[] = [
  ['同度', 0], ['短2度', 1], ['長2度', 1], ['短3度', 2], ['長3度', 2], ['完全4度', 3], ['増4度', 3],
  ['完全5度', 4], ['短6度', 5], ['長6度', 5], ['短7度', 6], ['長7度', 6], ['オクターブ', 0],
];
export const intervalUp = (root: string, semi: number): string => spell(root, semi, T_IV[semi][1]);

// ---------- ダイアトニックコード・進行 ----------
export const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] as const;
const DQ: ChordType[] = ['M', 'm', 'm', 'M', 'M', 'm', 'dim'];
const DFN = ['T', 'S', 'T', 'S', 'D', 'T', 'D'] as const;
export interface KeyChord { root: string; ty: ChordType; name: string; roman: string; fn?: 'T' | 'S' | 'D' }
export const diatonic = (key: string): KeyChord[] =>
  scaleNotes(key, 'major').map((n, i) => ({ root: n, ty: DQ[i], name: n + T_CHORD[DQ[i]].sym, roman: ROMAN[i], fn: DFN[i] }));

/** 定番のコード進行。deg は0始まりの度数、seventh が true ならすべてセブンスで弾く */
export interface Prog { name: string; deg: number[]; seventh?: boolean }
export const PROGS: Prog[] = [
  { name: 'I – V – vi – IV（ポップスの大定番）', deg: [0, 4, 5, 3] },
  { name: 'I – IV – V – I（スリーコード）', deg: [0, 3, 4, 0] },
  { name: 'I – vi – IV – V（50年代・循環コード）', deg: [0, 5, 3, 4] },
  { name: 'IV – V – iii – vi（王道進行）', deg: [3, 4, 2, 5] },
  { name: 'vi – IV – V – I（小室進行）', deg: [5, 3, 4, 0] },
  { name: 'I – V – vi – iii – IV – I – IV – V（カノン進行）', deg: [0, 4, 5, 2, 3, 0, 3, 4] },
  { name: '12小節ブルース（セブンスで）', deg: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], seventh: true },
];
export function progChords(key: string, p: Prog): KeyChord[] {
  const d = diatonic(key);
  return p.deg.map((i) => (p.seventh ? { root: d[i].root, ty: '7' as ChordType, name: d[i].root + '7', roman: ROMAN[i].toUpperCase() + '7' } : d[i]));
}
/** ストロークパターン（8分音符×8。D=ダウン、U=アップ、.=空振り） */
export const STRUM_PATS: readonly (readonly [string, string])[] = [
  ['4分音符', 'D.D.D.D.'], ['8分音符', 'DUDUDUDU'], ['裏を抜く', 'D.DUD.DU'], ['定番ストローク', 'D.DU.UDU'],
];
export const strokeMark = (c: string): string => (c === 'D' ? '↓' : c === 'U' ? '↑' : '・');

/** カポ c のとき「押さえるフォームのキー」は、実際のキーより半音 c 個ぶん低い */
export const shapeKey = (realKey: string, capo: number): string => keyByPc(parseNote(realKey).pc - capo);
/** フォームがコード表にあるコードがいちばん多く、バレーが少なくなるカポ位置 */
export function bestCapo(realKey: string, p: Prog): number {
  let best = 0;
  let bestScore = -Infinity;
  for (let c = 0; c <= 7; c++) {
    const names = [...new Set(progChords(shapeKey(realKey, c), p).map((x) => x.name))];
    const score = names.filter(hasChord).length / names.length - c * 0.001 - names.filter((n) => hasChord(n) && isBarre(n)).length * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** コードの構成音を、低いルートから重ねた MIDI 番号の並びにする（フォームがないコード用） */
export function chordVoicing(rootPc: number, iv: readonly number[]): number[] {
  const r = 40 + mod12(rootPc - 4);
  return [...new Set([r, ...(iv.includes(7) ? [r + 7] : []), ...iv.map((i) => r + 12 + i), r + 24])].sort((a, b) => a - b);
}

// ---------- 乱数まわりの小道具 ----------
export const rnd = (n: number): number => Math.floor(Math.random() * n);
export const pick = <T,>(a: readonly T[]): T => a[rnd(a.length)];
export function shuffle<T>(src: readonly T[]): T[] {
  const a = [...src];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
