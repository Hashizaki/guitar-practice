import { describe, expect, it } from 'vitest';
import { KEYS, PROGS, bestCapo, chordNotes, chordPcs, diatonic, intervalUp, keyByPc, noteAt, progChords, scaleNotes, shapeKey, spell } from './theory';

describe('音名のつづり', () => {
  it('メジャースケールをキーごとに正しく書く', () => {
    expect(scaleNotes('C', 'major').join(' ')).toBe('C D E F G A B');
    expect(scaleNotes('G', 'major').join(' ')).toBe('G A B C D E F♯');
    expect(scaleNotes('F', 'major').join(' ')).toBe('F G A B♭ C D E');
    expect(scaleNotes('E♭', 'major').join(' ')).toBe('E♭ F G A♭ B♭ C D');
    expect(scaleNotes('F♯', 'major').join(' ')).toBe('F♯ G♯ A♯ B C♯ D♯ E♯');
    expect(scaleNotes('D♭', 'major').join(' ')).toBe('D♭ E♭ F G♭ A♭ B♭ C');
  });
  it('すべてのキーで7つの文字を1回ずつ使う', () => {
    for (const k of KEYS) expect(new Set(scaleNotes(k, 'major').map((n) => n[0])).size).toBe(7);
  });
  it('平行マイナーはメジャーと同じ音を使う', () => {
    for (const k of KEYS) {
      const maj = scaleNotes(k, 'major');
      expect([...scaleNotes(maj[5], 'minor')].sort()).toEqual([...maj].sort());
    }
  });
  it('ペンタトニック', () => {
    expect(scaleNotes('A', 'minpenta').join(' ')).toBe('A C D E G');
    expect(scaleNotes('C', 'majpenta').join(' ')).toBe('C D E G A');
  });
  it('音程', () => {
    expect(intervalUp('C', 4)).toBe('E');
    expect(intervalUp('C', 3)).toBe('E♭');
    expect(intervalUp('C', 6)).toBe('F♯');
    expect(intervalUp('F', 5)).toBe('B♭');
    expect(spell('D', -1, 0)).toBe('D♭');
  });
});

describe('コード', () => {
  it('構成音', () => {
    expect(chordNotes('C', 'M').join(' ')).toBe('C E G');
    expect(chordNotes('A', 'm').join(' ')).toBe('A C E');
    expect(chordNotes('B', 'dim').join(' ')).toBe('B D F');
    expect(chordNotes('G', '7').join(' ')).toBe('G B D F');
    expect(chordNotes('E♭', 'm7').join(' ')).toBe('E♭ G♭ B♭ D♭');
  });
  it('フォームから求めた音が理論上の構成音と一致する', () => {
    expect(chordPcs('C').sort()).toEqual([0, 4, 7]);
    expect(chordPcs('Am').sort((a, b) => a - b)).toEqual([0, 4, 9]);
    expect(chordPcs('F♯m').sort((a, b) => a - b)).toEqual([1, 6, 9]);
    expect(chordPcs('B').sort((a, b) => a - b)).toEqual([3, 6, 11]);
  });
  it('ダイアトニックコード', () => {
    expect(diatonic('C').map((c) => c.name).join(' ')).toBe('C Dm Em F G Am Bdim');
    expect(diatonic('G').map((c) => c.name).join(' ')).toBe('G Am Bm C D Em F♯dim');
    expect(diatonic('B♭').map((c) => c.name).join(' ')).toBe('B♭ Cm Dm E♭ F Gm Adim');
  });
  it('進行', () => {
    expect(progChords('G', PROGS[0]).map((c) => c.name).join(' ')).toBe('G D Em C');
    expect(progChords('E', PROGS[6]).map((c) => c.name).slice(0, 5).join(' ')).toBe('E7 E7 E7 E7 A7');
  });
});

describe('カポ', () => {
  it('フォームのキー', () => {
    expect(shapeKey('B♭', 3)).toBe('G');
    expect(shapeKey('A', 2)).toBe('G');
    expect(shapeKey('C', 0)).toBe('C');
  });
  it('おすすめカポは開放コードで弾ける位置を選ぶ', () => {
    expect(bestCapo('G', PROGS[0])).toBe(0);
    expect(bestCapo('B♭', PROGS[0])).toBe(3);
    expect(bestCapo('B', PROGS[0])).toBe(4);
  });
  it('keyByPc は12音すべてに名前を返す', () => {
    for (let pc = 0; pc < 12; pc++) expect(keyByPc(pc)).toBeTruthy();
    expect(keyByPc(-2)).toBe('B♭');
  });
});

describe('指板', () => {
  it('開放弦と12フレット', () => {
    expect([0, 1, 2, 3, 4, 5].map((s) => noteAt(s, 0)).join('')).toBe('EBGDAE');
    expect(noteAt(5, 12)).toBe('E');
    expect(noteAt(5, 3)).toBe('G');
    expect(noteAt(4, 3)).toBe('C');
  });
});
