/** 練習記録・進み具合・設定のバックアップ（書き出し／読み込み）。副作用は渡された storage にだけ及ぶ */
const PREFIX = 'gtr_';
export const BACKUP_APP = 'guitar-practice';

export interface Backup {
  app: typeof BACKUP_APP;
  version: 1;
  exportedAt: string;
  /** キー（gtr_ を除いた名前）→ 保存されていた値 */
  data: Record<string, unknown>;
}
/** localStorage のうち、ここで使う部分だけ */
export type StorageLike = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;

function ownKeys(storage: StorageLike): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  return keys;
}

export function collectBackup(storage: StorageLike, now: Date = new Date()): Backup {
  const data: Record<string, unknown> = {};
  for (const k of ownKeys(storage)) {
    try {
      data[k.slice(PREFIX.length)] = JSON.parse(storage.getItem(k) as string);
    } catch {
      /* 壊れた値は書き出さない */
    }
  }
  return { app: BACKUP_APP, version: 1, exportedAt: now.toISOString(), data };
}

/** ファイルの中身を検証して Backup にする。このアプリのバックアップでなければエラー */
export function parseBackup(text: string): Backup {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('ファイルを読み取れませんでした（JSON ではありません）。');
  }
  const b = obj as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP || typeof b.data !== 'object' || b.data === null || Array.isArray(b.data)) {
    throw new Error('このアプリのバックアップファイルではありません。');
  }
  if (b.version !== 1) throw new Error('新しいバージョンのバックアップです。アプリを更新してから読み込んでください。');
  return b as Backup;
}

/** いまの記録を消して、バックアップの内容に置きかえる。戻り値は復元した項目数 */
export function restoreBackup(storage: StorageLike, b: Backup): number {
  clearAll(storage);
  const entries = Object.entries(b.data);
  for (const [k, v] of entries) storage.setItem(PREFIX + k, JSON.stringify(v));
  return entries.length;
}

/** このアプリが保存したものをすべて消す */
export function clearAll(storage: StorageLike): void {
  for (const k of ownKeys(storage)) storage.removeItem(k);
}

export const backupFileName = (d: Date = new Date()): string =>
  `guitar-practice-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
