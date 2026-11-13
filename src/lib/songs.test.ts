import { describe, expect, it } from 'vitest';
import { bestCapoFor, findShape, pairKey, parseChordName, parseSongText, transposeChord } from './songs';
import { isBarre } from './theory';

const names = (text: string): string[] => parseSongText(text).chords.map((c) => c.name);

describe('コード名の読み取り', () => {
  it('いろいろな書き方を受けつける', () => {
    expect(parseChordName('C')).toMatchObject({ root: 'C', ty: 'M', name: 'C' });
    expect(parseChordName('F#m')).toMatchObject({ root: 'F♯', ty: 'm', name: 'F♯m' });
    expect(parseChordName('Bb')).toMatchObject({ root: 'B♭', ty: 'M', name: 'B♭' });
    expect(parseChordName('B')).toMatchObject({ root: 'B', ty: 'M' });
    expect(parseChordName('Bm')).toMatchObject({ root: 'B', ty: 'm' });
    expect(parseChordName('Cmaj7')?.name).toBe('Cmaj7');
    expect(parseChordName('CM7')?.name).toBe('Cmaj7');
    expect(parseChordName('Am7')?.name).toBe('Am7');
    expect(parseChordName('G7')?.name).toBe('G7');
    expect(parseChordName('Bdim')?.name).toBe('Bdim');
  });
  it('読めないものは null', () => {
    for (const t of ['', 'H', 'c', 'Csus4', 'C/G', 'あ']) expect(parseChordName(t)).toBeNull();
  });
  it('曲の入力：空白・｜・カンマ・改行で区切る', () => {
    expect(names('G D Em C')).toEqual(['G', 'D', 'Em', 'C']);
    expect(names('| G | D |\nEm, C')).toEqual(['G', 'D', 'Em', 'C']);
    expect(names('C → Am → F → G7')).toEqual(['C', 'Am', 'F', 'G7']);
  });
  it('読めなかったものを報告する', () => {
    expect(parseSongText('G Xyz D Csus4')).toMatchObject({ bad: ['Xyz', 'Csus4'] });
    expect(names('G Xyz D')).toEqual(['G', 'D']);
  });
});

describe('移調とフォーム', () => {
  it('移調', () => {
    expect(transposeChord(parseChordName('B♭')!, -3).name).toBe('G');
    expect(transposeChord(parseChordName('Gm')!, -3).name).toBe('Em');
    expect(transposeChord(parseChordName('C')!, 2).name).toBe('D');
    expect(transposeChord(parseChordName('Am7')!, 0).name).toBe('Am7');
  });
  it('書き方が違っても同じフォームを見つける', () => {
    expect(findShape(parseChordName('F#m')!)).toBe('F♯m');
    expect(findShape(parseChordName('Gbm')!)).toBe('F♯m');
    expect(findShape(parseChordName('Am')!)).toBe('Am');
    expect(findShape(parseChordName('E♭')!)).toBeNull();
  });
  it('おすすめカポ：開放コードで弾ける位置を選ぶ', () => {
    const song = (t: string) => parseSongText(t).chords;
    expect(bestCapoFor(song('G D Em C'), isBarre)).toBe(0);
    expect(bestCapoFor(song('Bb F Gm Eb'), isBarre)).toBe(3);
    expect(bestCapoFor(song('A E F#m D'), isBarre)).toBe(2); // カポなしだと F♯m がバレー
  });
});

describe('1分間コードチェンジ', () => {
  it('コードの組は順番によらない', () => {
    expect(pairKey('G', 'C')).toBe(pairKey('C', 'G'));
    expect(pairKey('Em', 'Am')).toBe('Am ⇄ Em');
  });
});
