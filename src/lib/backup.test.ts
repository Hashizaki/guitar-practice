import { describe, expect, it } from 'vitest';
import { backupFileName, clearAll, collectBackup, parseBackup, restoreBackup, type StorageLike } from './backup';

function fakeStorage(init: Record<string, string> = {}): StorageLike & { dump: () => Record<string, string> } {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

describe('バックアップ', () => {
  it('このアプリのキーだけを書き出す', () => {
    const s = fakeStorage({ gtr_bpm: '120', gtr_log: '{"2026-01-01":{"sec":300}}', other: '"x"', gtr_broken: '{oops' });
    const b = collectBackup(s, new Date('2026-01-02T03:04:05Z'));
    expect(b).toEqual({ app: 'guitar-practice', version: 1, exportedAt: '2026-01-02T03:04:05.000Z', data: { bpm: 120, log: { '2026-01-01': { sec: 300 } } } });
  });
  it('書き出し → 読み込みで元に戻る（ほかのキーには触れない）', () => {
    const from = fakeStorage({ gtr_bpm: '120', gtr_lessonsDone: '["notes","board"]' });
    const text = JSON.stringify(collectBackup(from));
    const to = fakeStorage({ gtr_bpm: '60', gtr_old: 'true', other: '"keep"' });
    expect(restoreBackup(to, parseBackup(text))).toBe(2);
    expect(to.dump()).toEqual({ other: '"keep"', gtr_bpm: '120', gtr_lessonsDone: '["notes","board"]' });
  });
  it('関係ないファイルは拒否する', () => {
    expect(() => parseBackup('not json')).toThrow('JSON ではありません');
    expect(() => parseBackup('{"app":"other","version":1,"data":{}}')).toThrow('バックアップファイルではありません');
    expect(() => parseBackup('{"app":"guitar-practice","version":1,"data":[]}')).toThrow('バックアップファイルではありません');
    expect(() => parseBackup('null')).toThrow('バックアップファイルではありません');
    expect(() => parseBackup('{"app":"guitar-practice","version":2,"data":{}}')).toThrow('新しいバージョン');
  });
  it('全消去はこのアプリのキーだけ', () => {
    const s = fakeStorage({ gtr_a: '1', gtr_b: '2', other: '3' });
    clearAll(s);
    expect(s.dump()).toEqual({ other: '3' });
  });
  it('ファイル名に日付が入る', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('guitar-practice-backup-20260105.json');
  });
});
