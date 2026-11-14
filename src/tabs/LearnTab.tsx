import { useEffect, useRef, useState } from 'react';
import { Select } from '../components/common';
import { LESSONS } from '../lessons';
import { GLOSSARY } from '../lessons/glossary';
import type { Lesson, QuizQ } from '../lessons/types';
import { track } from '../lib/analytics';
import { dayKey, fmtMin, Log, useLogVersion, type LogKind } from '../lib/log';
import { gotoTab, gotoTrain } from '../lib/nav';
import { Seq } from '../lib/seq';
import { getShared, useShared } from '../lib/store';
import { rnd, shuffle } from '../lib/theory';
import { SettingsCard } from './Settings';

const useDone = () => useShared<string[]>('lessonsDone', []);

// ---------- 今日の練習（記録） ----------
function TodayCard() {
  useLogVersion();
  const [goalMin, setGoalMin] = useShared('goalMin', 10);
  const data = Log.data();
  const sec = Log.get('sec');
  const goal = goalMin * 60;
  const streak = Log.streak();
  const total = Object.values(data).reduce((a, d) => a + (d.sec || 0), 0);
  const days = Object.values(data).filter((d) => d.sec >= 60).length;
  // 直近5週間のカレンダー（月曜はじまり、今日が最後の週）
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 28);
  const cells = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const s = data[dayKey(d)]?.sec ?? 0;
    const lv = d > today ? 'f' : s >= goal ? 3 : s >= goal / 2 ? 2 : s >= 60 ? 1 : 0;
    return { d, s, cls: `l${lv}${dayKey(d) === dayKey(today) ? ' t' : ''}` };
  });
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>今日の練習</h2>
        <b className="streak" data-testid="streak">{streak > 0 ? `🔥 ${streak}日連続` : '今日から始めよう'}</b>
      </div>
      <div className="htoday">
        <b data-testid="today-min">{fmtMin(sec)}</b>
        <span>
          ／ 目標 <Select value={goalMin} onChange={setGoalMin} options={[[5, '5分'], [10, '10分'], [15, '15分'], [30, '30分'], [60, '60分']]} />
        </span>
      </div>
      <div className="pbar">
        <div className={sec >= goal ? 'full' : ''} style={{ width: `${Math.min(100, (sec / goal) * 100)}%` }} />
      </div>
      <div className="cal">
        {['月', '火', '水', '木', '金', '土', '日'].map((w) => <span key={w}>{w}</span>)}
        {cells.map((c, i) => (
          <i key={i} className={c.cls} title={`${dayKey(c.d)} ${fmtMin(c.s)}`}>{c.d.getDate()}</i>
        ))}
      </div>
      <div className="muted" style={{ marginTop: 6 }} data-testid="total">これまでの合計 {fmtMin(total)} ・ 練習した日 {days}日</div>
    </div>
  );
}

// ---------- 今日のメニュー ----------
interface MenuItem { id: LogKind; ic: string; need: number; unit: string; title: string; go: () => void }
function MenuCard({ open }: { open: (i: number) => void }) {
  useLogVersion();
  const [done] = useDone();
  const nextI = LESSONS.findIndex((l) => !done.includes(l.id));
  const items: MenuItem[] = [
    { id: 'lesson', ic: '📖', need: 1, unit: '回', title: nextI < 0 ? 'レッスンを復習する' : `レッスン ${nextI + 1}：${LESSONS[nextI].title}`, go: () => open(nextI < 0 ? rnd(LESSONS.length) : nextI) },
    { id: 'fret', ic: '🎯', need: 10, unit: '問', title: '指板クイズ', go: () => gotoTab('fret') },
    { id: 'ear', ic: '👂', need: 10, unit: '問', title: '耳トレ（音程・コード当て）', go: () => gotoTrain(getShared<string>('trainMode', 'interval') === 'chordear' ? 'chordear' : 'interval') },
    { id: 'rhythm', ic: '🥁', need: 30, unit: 'タップ', title: 'リズム練習', go: () => gotoTrain('rhythm') },
    { id: 'chord', ic: '🎼', need: 120, unit: '秒', title: 'コードチェンジ練習', go: () => gotoTab('chord') },
  ];
  const nDone = items.filter((m) => Log.get(m.id) >= m.need).length;
  return (
    <div className="card">
      <h2 data-testid="menu-head">{nDone === items.length ? '今日のメニュー ✓ 全部できました！' : `今日のメニュー（${nDone} / ${items.length}）`}</h2>
      <p className="muted" style={{ margin: 0 }}>毎日少しずつが上達の近道。上から順にやってみましょう。</p>
      <div data-testid="menu-list">
        {items.map((m) => {
          const v = Math.min(Log.get(m.id), m.need);
          const ok = v >= m.need;
          return (
            <button key={m.id} className={`litem${ok ? ' done' : ''}`} onClick={m.go} data-menu={m.id}>
              <span className="num">{ok ? '✓' : m.ic}</span>
              <span className="tt">
                <b>{m.title}</b>
                <small>{ok ? '完了' : `${v} / ${m.need} ${m.unit}`}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- レッスン一覧 ----------
function LessonList({ open }: { open: (i: number) => void }) {
  const [done] = useDone();
  const n = LESSONS.filter((l) => done.includes(l.id)).length;
  const next = LESSONS.findIndex((l) => !done.includes(l.id));
  return (
    <div className="card wide" id="learnHome">
      <h2>📖 音楽理論をいちから学ぶ</h2>
      <p className="muted" style={{ margin: 0 }}>
        楽譜が読めなくても大丈夫。音の名前からコード進行・アドリブ、バレーコードやカポまで、音を鳴らしながら順番に学べます。1レッスン5分ほど。最後のクイズに3問正解すると完了です。
      </p>
      <div className="pbar"><div style={{ width: `${(n / LESSONS.length) * 100}%` }} /></div>
      <div className="muted" data-testid="lesson-progress">
        {n === LESSONS.length ? `全 ${n} レッスン完了！ おつかれさまでした 🎉` : `${n} / ${LESSONS.length} レッスン完了`}
      </div>
      <div data-testid="lesson-list">
        {LESSONS.map((l, i) => (
          <button key={l.id} className={`litem${done.includes(l.id) ? ' done' : ''}${i === next ? ' next' : ''}`} onClick={() => open(i)} data-lesson={l.id}>
            <span className="num">{done.includes(l.id) ? '✓' : i + 1}</span>
            <span className="tt">
              <b>{l.title}</b>
              <small>{l.sub}</small>
            </span>
            {i === next && <span className="go">つぎはここ</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- 理解度チェック（3問正解で完了） ----------
function LessonQuiz({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  const pool = useRef<QuizQ[]>([]);
  const draw = (): QuizQ => {
    if (!pool.current.length) pool.current = shuffle(lesson.quiz());
    return pool.current.pop() as QuizQ;
  };
  const [q, setQ] = useState<QuizQ>(draw);
  const [picked, setPicked] = useState<number | null>(null);
  const [ok, setOk] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const finished = ok >= 3 && picked === null;

  const answer = (k: number): void => {
    if (picked !== null) return;
    const right = k === q.a;
    const total = ok + (right ? 1 : 0);
    setPicked(k);
    setOk(total);
    timer.current = setTimeout(() => {
      setPicked(null);
      if (total >= 3) onDone();
      else setQ(draw());
    }, right ? 1500 : 3200);
  };
  return (
    <div className="lquiz" data-testid="lquiz">
      <h3>
        理解度チェック{' '}
        <span id="lqDots">{[0, 1, 2].map((k) => <i key={k} className={k < ok ? 'on' : ''} />)}</span>
      </h3>
      {finished ? (
        <div className="qtext" data-testid="lquiz-done">🎉 レッスン完了！</div>
      ) : (
        <>
          <div className="qtext" data-testid="lquiz-q" data-answer={q.a}>{q.q}</div>
          <div className="answers two" data-testid="lquiz-answers">
            {q.opts.map((o, k) => (
              <button key={k} className={picked === null ? '' : k === q.a ? 'ok' : k === picked ? 'ng' : ''} onClick={() => answer(k)}>
                {o}
              </button>
            ))}
          </div>
          <div className="lwhy">{picked !== null && (picked === q.a ? '✓ 正解！ ' : '✗ ') + q.why}</div>
        </>
      )}
    </div>
  );
}

// ---------- レッスン本体 ----------
function LessonView({ index, open, close }: { index: number; open: (i: number) => void; close: () => void }) {
  const lesson = LESSONS[index];
  const [done, setDone] = useDone();
  const [cleared, setCleared] = useState(false);
  const finish = (): void => {
    if (!done.includes(lesson.id)) setDone([...done, lesson.id]);
    Log.count('lesson');
    track('lesson_complete', { lesson_id: lesson.id });
    setCleared(true);
  };
  const { Body } = lesson;
  return (
    <div className="card wide" id="lessonView" data-testid="lesson-view">
      <div className="row">
        <button onClick={close} data-testid="lesson-back">← 一覧へ</button>
        <span className="muted">レッスン {index + 1} / {LESSONS.length}</span>
      </div>
      <h2 className="ltitle">{lesson.title}</h2>
      <div className="lesson"><Body /></div>
      <LessonQuiz lesson={lesson} onDone={finish} />
      <div className="row" style={{ marginTop: 14 }}>
        <span className="grow" />
        {cleared &&
          (index + 1 < LESSONS.length ? (
            <button className="primary" onClick={() => open(index + 1)} data-testid="lesson-next">次のレッスン：{LESSONS[index + 1].title} →</button>
          ) : (
            <button className="primary" onClick={close} data-testid="lesson-next">一覧へ戻る</button>
          ))}
      </div>
    </div>
  );
}

// ---------- 用語集 ----------
function Glossary() {
  const [q, setQ] = useState('');
  const key = q.trim().toLowerCase();
  const hits = GLOSSARY.filter(([t, d]) => !key || (t + d).toLowerCase().includes(key));
  return (
    <div className="card wide" id="glossCard">
      <h2>📚 用語集</h2>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ことばを探す（例：カポ）" autoComplete="off" data-testid="gloss-q" />
      <div id="glossList" data-testid="gloss-list">
        {hits.map(([t, d]) => (
          <details key={t} open={!!key}>
            <summary>{t}</summary>
            <p>{d}</p>
          </details>
        ))}
        {!hits.length && <p className="muted">見つかりませんでした。</p>}
      </div>
    </div>
  );
}

export function LearnTab() {
  const [cur, setCur] = useState<number | null>(null);
  const open = (i: number): void => {
    Seq.stop();
    setCur(i);
    gotoTab('learn');
  };
  const close = (): void => {
    Seq.stop();
    setCur(null);
    window.scrollTo(0, 0);
  };
  if (cur !== null) return <LessonView key={cur} index={cur} open={open} close={close} />;
  return (
    <>
      <div className="homecards" id="homeCards">
        <TodayCard />
        <MenuCard open={open} />
      </div>
      <LessonList open={open} />
      <Glossary />
      <SettingsCard />
    </>
  );
}
