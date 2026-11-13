import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChordDiagram } from '../components/ChordDiagram';
import { Check, chooseItem, Dots, ScoreBar, Select, useScore, WeakList } from '../components/common';
import { ac, pluckMidi, strum } from '../lib/audio';
import { Log, type LogKind } from '../lib/log';
import { Metro, useMetro } from '../lib/metronome';
import { clampLatency, suggestLatency, tapOffsetMs } from '../lib/rhythm';
import type { TrainMode } from '../lib/nav';
import { Stats } from '../lib/stats';
import { useShared } from '../lib/store';
import { CHORD_NAMES, chordFrets, chordPcs, NOTE, rnd, sharp, shuffle } from '../lib/theory';
import { useSelectedChords } from './ChordTab';

const pcLabel = (m: number): string => sharp(NOTE[((m % 12) + 12) % 12]);

// ---------- 選択式クイズの共通部品 ----------
interface Choice { v: string; label: string }
interface ChoiceQuizProps<Q extends { answer: string }> {
  scoreKey: string;
  title: string;
  /** 問題を作る。prev は直前の問題 */
  make: (prev: Q | null) => Q;
  /** 選択肢（問題ごとに変わる場合は q から作る） */
  choices: (q: Q | null) => Choice[];
  /** 音を鳴らす問題なら指定する。「▶ 聞く」ボタンが出る */
  play?: (q: Q) => void;
  explain: (q: Q) => string;
  prompt: string;
  idle: string;
  delay?: [ok: number, ng: number];
  log?: LogKind;
  /** 項目ごとの正誤を記録する名前と、苦手一覧での表示名 */
  stat?: { group: string; label: (item: string) => string };
  onAnswered?: (q: Q) => void;
  /** 問題の上に表示するもの（コード図など） */
  top?: (q: Q) => ReactNode;
  /** 最初から問題を出す（音を鳴らさないクイズ用） */
  autoStart?: boolean;
  /** 値が変わったら問題をリセットする（設定の変更用） */
  resetKey: string;
  small?: boolean;
  controls: ReactNode;
  footer?: ReactNode;
  testId: string;
}
function ChoiceQuiz<Q extends { answer: string }>(p: ChoiceQuizProps<Q>) {
  const [score, record] = useScore(p.scoreKey);
  const [q, setQ] = useState<Q | null>(() => (p.autoStart ? p.make(null) : null));
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const first = useRef(true);
  const live = useRef(p);
  live.current = p;

  const next = (prev: Q | null): void => {
    clearTimeout(timer.current);
    const nq = live.current.make(prev);
    setPicked(null);
    setQ(nq);
    if (live.current.play) timer.current = setTimeout(() => live.current.play?.(nq), 150);
  };
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    clearTimeout(timer.current);
    setPicked(null);
    setQ(p.autoStart ? live.current.make(null) : null);
  }, [p.resetKey, p.autoStart]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const answer = (v: string): void => {
    if (!q) {
      next(null);
      return;
    }
    if (picked !== null) return;
    const ok = v === q.answer;
    record(ok);
    if (p.log) Log.count(p.log);
    if (p.stat) Stats.record(p.stat.group, q.answer, ok);
    setPicked(v);
    p.onAnswered?.(q);
    const [dOk, dNg] = p.delay ?? [1300, 2400];
    timer.current = setTimeout(() => next(q), ok ? dOk : dNg);
  };
  const text = !q ? p.idle : picked === null ? p.prompt : (picked === q.answer ? '✓ 正解！ ' : '✗ ') + p.explain(q);
  return (
    <div className="card wide tpanel" data-testid={p.testId}>
      <h2>{p.title}</h2>
      <ScoreBar score={score} />
      <div className="qtext" data-testid={`${p.testId}-text`} data-answer={q?.answer ?? ''}>{text}</div>
      {q && p.top?.(q)}
      {p.play && (
        <div className="row" style={{ justifyContent: 'center', margin: '8px 0' }}>
          <button className="primary" onClick={() => (q ? p.play?.(q) : next(null))} data-testid={`${p.testId}-play`}>▶ 聞く</button>
        </div>
      )}
      <div className={`answers${p.small ? ' small' : ''}`} data-testid={`${p.testId}-answers`}>
        {p.choices(q).map((c) => (
          <button key={c.v} data-v={c.v} className={q && picked !== null ? (c.v === q.answer ? 'ok' : c.v === picked ? 'ng' : '') : ''} onClick={() => answer(c.v)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        {p.controls}
        <span className="grow" />
        <button onClick={() => next(q)}>{p.play ? '次の問題' : 'スキップ'}</button>
      </div>
      {p.stat && <WeakList testId={`${p.testId}-weak`} groups={[p.stat]} />}
      {p.footer}
    </div>
  );
}

// ---------- 音程当て ----------
const INTERVALS = [
  { v: 1, label: '短2度', hint: '半音' }, { v: 2, label: '長2度', hint: '全音' }, { v: 3, label: '短3度', hint: '暗い3度' }, { v: 4, label: '長3度', hint: '明るい3度' },
  { v: 5, label: '完全4度' }, { v: 6, label: '増4度', hint: 'トライトーン' }, { v: 7, label: '完全5度', hint: 'パワーコード' }, { v: 8, label: '短6度' },
  { v: 9, label: '長6度' }, { v: 10, label: '短7度' }, { v: 11, label: '長7度' }, { v: 12, label: 'オクターブ' },
];
const IV_LEVEL: Record<string, number[]> = { basic: [2, 4, 5, 7, 12], mid: [2, 3, 4, 5, 7, 9, 10, 12], all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
interface IvQ { answer: string; a: number; b: number; harm: boolean }

function IntervalQuiz() {
  const [level, setLevel] = useShared('ivLevel', 'basic');
  const [dir, setDir] = useShared('ivDir', 'up');
  const pool = IV_LEVEL[level] ?? IV_LEVEL.basic;
  const play = (q: IvQ): void => {
    const t = ac().currentTime + 0.05;
    pluckMidi(q.a, t, 0.5);
    pluckMidi(q.b, q.harm ? t : t + 0.75, 0.5);
  };
  return (
    <ChoiceQuiz<IvQ>
      testId="iv"
      scoreKey="iv"
      title="音程当て（インターバル）"
      log="ear"
      stat={{ group: 'iv', label: (i) => INTERVALS.find((x) => String(x.v) === i)?.label ?? i }}
      delay={[2300, 3300]}
      small
      resetKey={level}
      idle="「▶ 聞く」で2つの音が鳴ります。音の距離（音程）を当てよう"
      prompt="音程は？（「▶ 聞く」でもう一度）"
      choices={() => INTERVALS.filter((x) => pool.includes(x.v)).map((x) => ({ v: String(x.v), label: x.label }))}
      make={(prev) => {
        // 直前と同じ音程はなるべく続けない。苦手な音程ほど出やすい
        const cands = prev && pool.length > 2 && Math.random() < 0.7 ? pool.filter((x) => String(x) !== prev.answer) : pool;
        const iv = chooseItem(cands, (x) => Stats.weight('iv', x));
        const low = 45 + rnd(12); // A2〜G#3 を基準に
        return { answer: String(iv), a: dir === 'down' ? low + iv : low, b: dir === 'down' ? low : low + iv, harm: dir === 'harm' };
      }}
      play={play}
      onAnswered={(q) => setTimeout(() => play(q), 200)}
      explain={(q) => {
        const x = INTERVALS.find((i) => String(i.v) === q.answer)!;
        return `${x.label}${x.hint ? `（${x.hint}）` : ''}：${pcLabel(q.a)} → ${pcLabel(q.b)}`;
      }}
      controls={
        <>
          <Select value={level} onChange={setLevel} options={[['basic', '基本の5種類'], ['mid', '8種類'], ['all', '全12種類']]} />
          <Select value={dir} onChange={setDir} options={[['up', '上行（低→高）'], ['down', '下行（高→低）'], ['harm', '同時に鳴らす']]} />
        </>
      }
      footer={
        <p className="muted" style={{ margin: '10px 0 0' }}>
          覚え方のヒント：長3度＝「聖者の行進」の出だし、完全4度＝ワーグナー「結婚行進曲」の出だし、完全5度＝「きらきら星」の「きら→きら」、オクターブ＝「虹の彼方に」の出だし。
        </p>
      }
    />
  );
}

// ---------- コード当て ----------
const CTYPES = [
  { v: 'M', label: 'メジャー', sym: '', iv: [0, 4, 7], lv: 1, desc: '明るい' },
  { v: 'm', label: 'マイナー', sym: 'm', iv: [0, 3, 7], lv: 1, desc: '暗い・切ない' },
  { v: '7', label: 'セブンス', sym: '7', iv: [0, 4, 7, 10], lv: 2, desc: 'ブルージー・次に進みたがる' },
  { v: 'M7', label: 'メジャー7', sym: 'maj7', iv: [0, 4, 7, 11], lv: 2, desc: 'おしゃれ・浮遊感' },
  { v: 'm7', label: 'マイナー7', sym: 'm7', iv: [0, 3, 7, 10], lv: 2, desc: '柔らかい暗さ' },
  { v: 'sus4', label: 'sus4', sym: 'sus4', iv: [0, 5, 7], lv: 3, desc: '宙ぶらりん' },
  { v: 'dim', label: 'ディミニッシュ', sym: 'dim', iv: [0, 3, 6], lv: 3, desc: '不安・緊張' },
];
interface CeQ { answer: string; root: number; notes: number[]; c: (typeof CTYPES)[number] }

function ChordEarQuiz() {
  const [level, setLevel] = useShared('ceLevel', 1);
  const [style, setStyle] = useShared('ceStyle', 'strum');
  const pool = CTYPES.filter((c) => c.lv <= level);
  const styleRef = useRef(style);
  styleRef.current = style;
  const play = (q: CeQ): void => {
    const t = ac().currentTime + 0.05;
    const arp = styleRef.current === 'arp';
    q.notes.forEach((m, i) => pluckMidi(m, t + i * (arp ? 0.22 : 0.03), arp ? 0.4 : 0.3));
  };
  return (
    <ChoiceQuiz<CeQ>
      testId="ce"
      scoreKey="ce"
      title="コード当て（響きの聞き分け）"
      log="ear"
      stat={{ group: 'ce', label: (i) => CTYPES.find((x) => x.v === i)?.label ?? i }}
      delay={[2500, 3500]}
      small
      resetKey={String(level)}
      idle="「▶ 聞く」でコードが鳴ります。種類を当てよう"
      prompt="このコードの種類は？"
      choices={() => pool.map((c) => ({ v: c.v, label: c.label }))}
      make={() => {
        const c = chooseItem(pool, (x) => Stats.weight('ce', x.v));
        const root = 40 + rnd(12);
        // ギターらしいボイシング：ルート＋1オクターブ上に構成音を重ねる
        const notes = [...new Set([root, ...(c.v === 'dim' ? [] : [root + 7]), ...c.iv.map((i) => root + 12 + i), root + 24])].sort((a, b) => a - b);
        return { answer: c.v, root, notes, c };
      }}
      play={play}
      onAnswered={(q) => setTimeout(() => play(q), 200)}
      explain={(q) => `${pcLabel(q.root)}${q.c.sym}（${q.c.label}・${q.c.desc}）＝ ${q.c.iv.map((i) => pcLabel(q.root + i)).join('・')}`}
      controls={
        <>
          <Select value={level} onChange={setLevel} options={[[1, '初級：メジャー/マイナー'], [2, '中級：＋セブンス系'], [3, '上級：＋sus4/dim']]} />
          <Select value={style} onChange={setStyle} options={[['strum', 'ジャーン'], ['arp', 'アルペジオ']]} />
        </>
      }
    />
  );
}

// ---------- フォーム当て ----------
interface FmQ { answer: string; opts: string[] }
function FormQuiz() {
  const [poolKind, setPoolKind] = useShared('fmPool', 'all');
  const [sound, setSound] = useShared('fmSound', true);
  const [selected] = useSelectedChords();
  return (
    <ChoiceQuiz<FmQ>
      testId="fm"
      scoreKey="fm"
      title="フォーム当て（コードの形を覚える）"
      autoStart
      stat={{ group: 'fm', label: (i) => i }}
      resetKey={poolKind}
      idle=""
      prompt="このコードの名前は？"
      choices={(q) => (q ? q.opts.map((n) => ({ v: n, label: n })) : [])}
      make={(prev) => {
        const pool = poolKind === 'sel' && selected.length >= 2 ? selected : CHORD_NAMES;
        const cands = prev && pool.length > 1 ? pool.filter((n) => n !== prev.answer) : pool;
        const name = chooseItem(cands, (n) => Stats.weight('fm', n));
        // 選択肢：正解＋同じルートの紛らわしいものを優先
        const similar = shuffle(CHORD_NAMES.filter((n) => n !== name && n[0] === name[0])).slice(0, 2);
        const others = shuffle(CHORD_NAMES.filter((n) => n !== name && !similar.includes(n)));
        return { answer: name, opts: shuffle([name, ...similar, ...others].slice(0, 4)) };
      }}
      top={(q) => (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ChordDiagram name={q.answer} w={150} />
        </div>
      )}
      onAnswered={(q) => {
        if (sound) strum(chordFrets(q.answer));
      }}
      explain={(q) => `${q.answer}：${chordPcs(q.answer).map((pc) => sharp(NOTE[pc])).join('・')}`}
      controls={
        <>
          <Select value={poolKind} onChange={setPoolKind} options={[['all', 'すべてのコード'], ['sel', 'コードタブで選んだコード']]} />
          <Check checked={sound} onChange={setSound}>答えたら鳴らす</Check>
        </>
      }
    />
  );
}

// ---------- リズム練習 ----------
/** タップ時刻をオーディオの時間軸に変換（出力遅延も考慮） */
function tapAudioTime(timeStamp: number): number {
  const c = ac();
  const ts = c.getOutputTimestamp?.();
  if (ts && (ts.contextTime ?? 0) > 0 && (ts.performanceTime ?? 0) > 0) {
    const evT = timeStamp > 0 && timeStamp < performance.now() + 1000 ? timeStamp : performance.now();
    return (ts.contextTime as number) + (evT - (ts.performanceTime as number)) / 1000;
  }
  return c.currentTime - (c.outputLatency || 0) - (c.baseLatency || 0);
}
function RhythmPractice({ active }: { active: boolean }) {
  const m = useMetro();
  const [sub, setSub] = useShared('rSub', 1);
  const [gap, setGap] = useShared('rGap', false);
  /** 機器の遅延の補正値（ms）。Bluetooth イヤホンなどで、いつも遅く判定されるのを打ち消す */
  const [lat, setLat] = useShared('rLatency', 0);
  const [offs, setOffs] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [flash, setFlash] = useState(false);
  const live = useRef({ sub, gap, lat });
  live.current = { sub, gap, lat };
  const on = m.running && m.mode === 'rhythm';

  useEffect(
    () =>
      Metro.onBeat((_, n) => {
        if (Metro.get().mode === 'rhythm') setMuted(Metro.isMuted(n));
      }),
    [],
  );
  const start = (): void => {
    if (on) {
      Metro.stop();
      return;
    }
    setOffs([]);
    setLast(null);
    setMuted(false);
    // 2小節鳴らして2小節消す（最初の2小節は必ず鳴らす）
    Metro.start('rhythm', (n) => live.current.gap && Math.floor(n / Metro.get().beats) % 4 >= 2);
  };
  const tap = (timeStamp: number): void => {
    setFlash(true);
    setTimeout(() => setFlash(false), 80);
    const st = Metro.get();
    if (!(st.running && st.mode === 'rhythm')) return;
    const raw = tapOffsetMs(tapAudioTime(timeStamp), Metro.times(), st.bpm, live.current.sub);
    if (raw === null) return;
    const ms = raw - live.current.lat;
    Log.count('rhythm');
    setLast(ms);
    setOffs((p) => [...p, ms].slice(-200));
  };
  // iPad の外付けキーボード：スペースキーでもタップできる
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent): void => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      tap(e.timeStamp);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const range = Math.min(150, (60 / m.bpm / sub) * 500); // ルーラーの端 = ±range ms
  const recent = offs.slice(-16);
  const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const sd = recent.length ? Math.sqrt(recent.reduce((a, b) => a + (b - avg) * (b - avg), 0) / recent.length) : 0;
  const ticks = offs.slice(-12);
  const verdict = last === null ? '' : Math.abs(last) <= 30 ? 'ok' : last < 0 ? 'early' : 'late';
  const label = !on
    ? 'スタートしてからタップ'
    : muted
      ? '🔇 無音中 — テンポをキープ！'
      : last === null
        ? 'ここをタップ'
        : Math.abs(last) <= 30
          ? `ぴったり！ (${last > 0 ? '+' : ''}${last}ms)`
          : last < 0
            ? `少し早い (${last}ms)`
            : `少し遅い (+${last}ms)`;
  return (
    <div className="card wide tpanel" data-testid="rhythm">
      <h2>リズム練習（タップ）</h2>
      <p className="muted" style={{ margin: '0 0 8px' }}>クリックに合わせて下のパッドをタップ。ズレをミリ秒で表示します。iPad のキーボードならスペースキーでもOK。</p>
      <Dots />
      <div
        className={`tapzone${flash ? ' flash' : ''}${on && verdict ? ' ' + verdict : ''}${on && muted ? ' mute' : ''}`}
        onPointerDown={(e) => { e.preventDefault(); tap(e.timeStamp); }}
        data-testid="tap-pad"
      >
        <span data-testid="tap-label">{label}</span>
      </div>
      <div className="ruler">
        <div className="zone" style={{ left: `${50 - (30 / range) * 50}%`, width: `${(60 / range) * 50}%` }} />
        <div className="center" />
        {ticks.map((ms, i) => (
          <div key={offs.length - ticks.length + i} className="tk" style={{ left: `${50 + Math.max(-50, Math.min(50, (ms / range) * 50))}%`, opacity: 0.25 + (0.75 * (i + 1)) / ticks.length }} />
        ))}
        <span className="l">早い</span>
        <span className="r">遅い</span>
      </div>
      <div className="rstats">
        <div><b data-testid="r-avg">{recent.length ? `${avg > 0 ? '+' : ''}${Math.round(avg)}ms` : '—'}</b><span>平均のズレ</span></div>
        <div><b>{recent.length ? `${Math.round(sd)}ms` : '—'}</b><span>ばらつき</span></div>
        <div><b>{offs.length ? `${Math.round((offs.filter((x) => Math.abs(x) <= 30).length / offs.length) * 100)}%` : '—'}</b><span>±30ms以内</span></div>
        <div><b data-testid="r-count">{offs.length}</b><span>タップ数</span></div>
      </div>
      <div className="row" style={{ margin: '10px 0' }}>
        <Select value={sub} onChange={setSub} options={[[1, '4分音符'], [2, '8分音符'], [3, '3連符']]} />
        <Check checked={gap} onChange={setGap}>ときどきクリックを消す</Check>
        <span className="grow" />
        <button onClick={() => Metro.setBpm(m.bpm - 5)}>−5</button>
        <b style={{ minWidth: 44, textAlign: 'center' }}>{m.bpm}</b>
        <button onClick={() => Metro.setBpm(m.bpm + 5)}>+5</button>
      </div>
      <div className="latency">
        <span className="muted">遅延の補正</span>
        <button onClick={() => setLat(clampLatency(lat - 10))} aria-label="補正を10ミリ秒減らす">−10</button>
        <b data-testid="r-latency">{lat > 0 ? '+' : ''}{lat}ms</b>
        <button onClick={() => setLat(clampLatency(lat + 10))} aria-label="補正を10ミリ秒増やす">+10</button>
        <button
          disabled={suggestLatency(offs, lat) === null}
          onClick={() => {
            const v = suggestLatency(offs, lat);
            if (v === null) return;
            setLat(v);
            setOffs([]);
            setLast(null);
          }}
          data-testid="r-calibrate"
        >
          いまのズレで合わせる
        </button>
      </div>
      <button className={`primary bigbtn${on ? ' on' : ''}`} onClick={start} data-testid="rhythm-btn">
        {on ? '■ ストップ' : '▶ スタート'}
      </button>
      <p className="muted" style={{ margin: '8px 0 0' }}>「ときどきクリックを消す」：2小節鳴って2小節無音をくり返します。無音の間も同じテンポを保てるか試しましょう。</p>
      <p className="muted" style={{ margin: '6px 0 0' }}>
        「遅延の補正」：Bluetooth イヤホンなどで、合わせているのにいつも「遅い」と出るときに使います。クリックに合わせて8回以上タップしてから「いまのズレで合わせる」を押すと、その分を差し引きます。
      </p>
    </div>
  );
}

const MODES: [TrainMode, string][] = [['interval', '👂 音程当て'], ['chordear', '🎧 コード当て'], ['rhythm', '🥁 リズム'], ['form', '✋ フォーム当て']];

export function TrainTab() {
  const [mode, setMode] = useShared<TrainMode>('trainMode', 'interval');
  const [tab] = useShared('tab', 'learn');
  const show = (m: TrainMode) => ({ display: mode === m ? undefined : 'none' }) as const;
  return (
    <>
      <div className="card wide">
        <h2>ギターなしでできる練習</h2>
        <p className="muted" style={{ margin: '0 0 10px' }}>移動中や楽器が手元にないときに、耳・リズム感・コードの形を鍛えましょう。イヤホン推奨。</p>
        <div className="seg">
          {MODES.map(([m, label]) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)} data-mode={m}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* 切り替えても成績が消えないよう、4つとも置いたまま表示だけ切り替える */}
      <div className="tslot" style={show('interval')}><IntervalQuiz /></div>
      <div className="tslot" style={show('chordear')}><ChordEarQuiz /></div>
      <div className="tslot" style={show('rhythm')}><RhythmPractice active={tab === 'train' && mode === 'rhythm'} /></div>
      <div className="tslot" style={show('form')}><FormQuiz /></div>
    </>
  );
}
