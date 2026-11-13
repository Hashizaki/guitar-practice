import type { FC, ReactNode } from 'react';
import { shuffle } from '../lib/theory';

export interface QuizQ { q: string; opts: string[]; a: number; why: string }
export interface Lesson {
  id: string;
  title: string;
  sub: string;
  /** 解説と、音が鳴るデモ */
  Body: FC;
  /** 理解度チェックの問題（呼ぶたびに作り直す） */
  quiz: () => QuizQ[];
}

/** 問題を作る：正解＋ダミー（重複は除く）をシャッフル */
export function mkQ(q: string, ok: string, wrongs: readonly string[], why: string): QuizQ {
  const opts = shuffle([ok, ...[...new Set(wrongs)].filter((w) => w !== ok).slice(0, 3)]);
  return { q, opts, a: opts.indexOf(ok), why };
}

export const Point = ({ children }: { children: ReactNode }) => <div className="point">ポイント：{children}</div>;
export const Readout = ({ children, testId }: { children: ReactNode; testId?: string }) => <div className="readout" data-testid={testId}>{children}</div>;
/** 見出しつきの小さな表 */
export function Tbl({ items, className = '' }: { items: readonly (readonly [string, ReactNode, string?])[]; className?: string }) {
  return (
    <div className={`tbl ${className}`}>
      {items.map(([head, body, cls]) => (
        <div key={head} className={cls}>
          <b>{head}</b>
          {body}
        </div>
      ))}
    </div>
  );
}
