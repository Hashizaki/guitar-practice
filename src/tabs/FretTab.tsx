import { useEffect, useRef, useState } from 'react';
import { Check, chooseItem, PlayButton, ScoreBar, Select, useScore, WeakList } from '../components/common';
import { Fretboard, type Mark } from '../components/Fretboard';
import { ac, pluckMidi } from '../lib/audio';
import { Log } from '../lib/log';
import { Metro } from '../lib/metronome';
import { ensureMic, MIC_FAIL, releaseMic } from '../lib/mic';
import { createStableNote, detectPitch, noteFromFreq } from '../lib/pitch';
import { Stats } from '../lib/stats';
import { useShared } from '../lib/store';
import { mod12, NOTE, noteAt, noteLabel, OPEN_TOP, SCALES, sharp, type Pos } from '../lib/theory';

export const playPos = (p: Pos): void => pluckMidi(OPEN_TOP[p.s] + p.f, null, 0.5);
const fretName = (f: number): string => (f === 0 ? '開放' : f + 'フレット');

interface Question extends Pos { n: string }
type Mode = 'name' | 'find' | 'play';

// ---------- 指板の音名クイズ ----------
function FretQuiz() {
  const [mode, setMode] = useShared<Mode>('qMode', 'name');
  const [range, setRange] = useShared('qRange', 12);
  const [natural, setNatural] = useShared('qNatural', true);
  const [score, record] = useScore('fret');
  const make = (prev: Question | null): Question => {
    const all: Question[] = [];
    for (let s = 0; s < 6; s++)
      for (let f = 0; f <= range; f++) {
        const n = noteAt(s, f);
        if (natural && n.includes('#')) continue;
        // 直前と同じ問題は出さない
        if (prev && prev.s === s && (mode === 'name' ? prev.f === f : prev.n === n)) continue;
        all.push({ s, f, n });
      }
    // 苦手な弦・苦手な音名ほど出やすくする
    return chooseItem(all, (c) => Stats.weight('fretS', c.s) * Stats.weight('fretN', c.n));
  };
  const [q, setQ] = useState<Question>(() => make(null));
  // 回答後の表示：picked は選んだ音名（音名モード）、hit はタップした位置（場所モード）
  const [res, setRes] = useState<{ ok: boolean; picked?: string; hit?: Pos } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const next = (): void => {
    clearTimeout(timer.current);
    setRes(null);
    setQ((p) => make(p));
  };
  // 設定を変えたら新しい問題にする
  useEffect(next, [mode, range, natural]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);

  const finish = (ok: boolean, r: { picked?: string; hit?: Pos }): void => {
    record(ok);
    Log.count('fret');
    Stats.record('fretS', q.s, ok);
    Stats.record('fretN', q.n, ok);
    setRes({ ok, ...r });
    timer.current = setTimeout(next, ok ? (mode === 'play' ? 1200 : 650) : mode === 'play' ? 2600 : 1600);
  };
  const answerName = (n: string): void => {
    if (res) return;
    playPos(q);
    finish(n === q.n, { picked: n });
  };
  const answerPos = (h: Pos): void => {
    if (res || mode !== 'find') return;
    playPos(h);
    finish(h.s === q.s && noteAt(h.s, h.f) === q.n && h.f <= range, { hit: h });
  };

  const answers = Array.from({ length: range + 1 }, (_, f) => f).filter((f) => noteAt(q.s, f) === q.n);

  // ---- 弾いて答える：マイクで聞き取った音が、出題した音と同じ高さなら正解 ----
  const [micOn, setMicOn] = useState(false);
  const [micMsg, setMicMsg] = useState('');
  const [heard, setHeard] = useState<number | null>(null);
  const an = useRef<AnalyserNode | null>(null);
  const live = useRef({ q, res, answers, finish });
  live.current = { q, res, answers, finish };
  const listening = mode === 'play' && micOn;
  useEffect(() => {
    if (!listening || !an.current) return;
    const analyser = an.current;
    const buf = new Float32Array(analyser.fftSize);
    const stable = createStableNote(3);
    let raf = 0;
    let last = 0;
    const loop = (t: number): void => {
      if (t - last > 90) {
        last = t;
        analyser.getFloatTimeDomainData(buf);
        const midi = stable.feed(noteFromFreq(detectPitch(buf.subarray(0, 3072), ac().sampleRate)));
        if (midi !== null) {
          setHeard(midi);
          const c = live.current;
          const f = midi - OPEN_TOP[c.q.s];
          if (!c.res && c.answers.includes(f)) {
            stable.reset();
            c.finish(true, { hit: { s: c.q.s, f } });
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      releaseMic('fretquiz');
      setHeard(null);
    };
  }, [listening]);
  const micToggle = async (): Promise<void> => {
    if (micOn) {
      setMicOn(false);
      return;
    }
    try {
      an.current = await ensureMic('fretquiz');
      setMicMsg('');
      setMicOn(true);
    } catch {
      setMicMsg(MIC_FAIL);
    }
  };
  const giveUp = (): void => {
    if (!res) finish(false, {});
  };
  const lbl = sharp(q.n);
  let marks: Mark[] = [];
  let text: React.ReactNode;
  if (mode === 'name') {
    marks = [{ ...q, r: 10, ring: '#fff', pulse: true, label: res && !res.ok ? lbl : undefined }];
    text = !res ? `${q.s + 1}弦 ${fretName(q.f)} の音は？` : res.ok ? `正解！ ${noteLabel(q.n)}` : `正解は ${noteLabel(q.n)}`;
  } else if (!res) {
    text = (
      <>
        <b>{q.s + 1}弦</b> の <b style={{ color: 'var(--accent)' }}>{noteLabel(q.n)}</b> を{mode === 'play' ? 'ギターで弾こう' : 'タップ'}（0〜{range}フレット）
      </>
    );
  } else if (res.ok && res.hit) {
    const hit = res.hit;
    marks = answers.map((f) => ({ s: q.s, f, fill: f === hit.f ? 'var(--ok)' : '#4f8a62', label: lbl }));
    text = `正解！ ${q.s + 1}弦 ${fretName(hit.f)}`;
  } else if (res.hit) {
    const hit = res.hit;
    marks = [{ ...hit, fill: 'var(--ng)', label: sharp(noteAt(hit.s, hit.f)), text: '#fff' }, ...answers.map((f) => ({ s: q.s, f, fill: 'var(--ok)', label: lbl }))];
    text = `そこは ${sharp(noteAt(hit.s, hit.f))}。正解は ${answers.map(fretName).join(' / ')}`;
  } else {
    // 「わからない」を押した：答えの場所を見せる
    marks = answers.map((f) => ({ s: q.s, f, fill: 'var(--ok)', label: lbl }));
    text = `${q.s + 1}弦の ${noteLabel(q.n)} は ${answers.map(fretName).join(' / ')}`;
  }
  const heardName = heard === null ? '—' : sharp(NOTE[heard % 12]) + (Math.floor(heard / 12) - 1);
  const list = natural ? ['C', 'D', 'E', 'F', 'G', 'A', 'B'] : [...NOTE];
  return (
    <div className="card wide">
      <h2>指板の音名クイズ</h2>
      <ScoreBar score={score} testId="fret-score" />
      <div className="qtext" data-testid="fret-q" data-answer={mode === 'name' ? q.n : `${q.s}-${answers[0]}`} data-result={res ? (res.ok ? 'ok' : 'ng') : ''}>{text}</div>
      <Fretboard marks={marks} onHit={answerPos} testId="fret-board" />
      {mode === 'play' && (
        <div className="playmode">
          <div className="row">
            <button className={`primary${micOn ? ' on' : ''}`} onClick={() => void micToggle()} data-testid="fret-mic">
              {micOn ? '■ マイクをオフ' : '🎤 マイクをオン'}
            </button>
            <span className="muted">
              聞こえている音：<b data-testid="fret-heard">{heardName}</b>
            </span>
            <span className="grow" />
            <button onClick={giveUp} data-testid="fret-giveup">わからない</button>
          </div>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            {micMsg || '単音をはっきり鳴らしてください。チューニングがずれていると判定されにくいので、先にチューナーで合わせましょう。'}
          </p>
        </div>
      )}
      {mode === 'name' && (
        <div className="answers" data-testid="fret-answers">
          {list.map((n) => (
            <button key={n} data-n={n} className={res ? (n === q.n ? 'ok' : n === res.picked ? 'ng' : '') : ''} onClick={() => answerName(n)}>
              {sharp(n)}
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <Select value={mode} onChange={setMode} options={[['name', '音名を答える'], ['find', '場所を探す'], ['play', '弾いて答える（マイク）']]} testId="fret-mode" />
        <Select value={range} onChange={setRange} options={[[5, '0〜5フレット'], [12, '0〜12フレット']]} />
        <Check checked={natural} onChange={setNatural}>♯/♭なし</Check>
        <span className="grow" />
        <button onClick={next}>スキップ</button>
      </div>
      <WeakList testId="fret-weak" groups={[{ group: 'fretS', label: (i) => `${Number(i) + 1}弦` }, { group: 'fretN', label: sharp }]} />
    </div>
  );
}

// ---------- スケール／バーチャル指板 ----------
function ScaleView() {
  const [key, setKey] = useShared('svKey', 9);
  const [scale, setScale] = useShared('svScale', 'minpenta');
  const [label, setLabel] = useShared<'name' | 'deg'>('svLabel', 'name');
  const [hi, setHi] = useState<Pos | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sc = SCALES[scale] ?? SCALES.minpenta;
  const flash = (p: Pos): void => {
    setHi(p);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHi(null), 350);
  };
  const marks: Mark[] = [];
  for (let s = 0; s < 6; s++)
    for (let f = 0; f <= 12; f++) {
      const k = sc.iv.indexOf(mod12(OPEN_TOP[s] + f - key));
      if (k < 0) continue;
      const on = hi?.s === s && hi.f === f;
      marks.push({ s, f, r: on ? 11 : 9, fill: k === 0 ? 'var(--accent2)' : 'var(--accent)', ring: on ? '#fff' : 'none', label: label === 'deg' ? sc.deg[k] : sharp(noteAt(s, f)), text: k === 0 ? '#fff' : '#2a1a08' });
    }
  if (hi && !marks.some((m) => m.s === hi.s && m.f === hi.f)) marks.push({ ...hi, r: 8, fill: '#6d5a45', ring: '#fff', label: sharp(noteAt(hi.s, hi.f)), text: '#fff' });

  // ▶ 再生：6弦のルートから1オクターブ上がって下がる（実際のポジションを光らせる）
  const makeSeq = () => {
    const root = 40 + mod12(key - 4);
    const up = [...sc.iv.map((i) => root + i), root + 12];
    const seq = [...up, ...up.slice(0, -1).reverse()];
    const lo = Math.max(0, mod12(key - 4) - 1);
    const posOf = (m: number): Pos | null => {
      for (let s = 5; s >= 0; s--) {
        const f = m - OPEN_TOP[s];
        if (f >= lo && f <= lo + 4) return { s, f };
      }
      for (let s = 5; s >= 0; s--) {
        const f = m - OPEN_TOP[s];
        if (f >= 0 && f <= 12) return { s, f };
      }
      return null;
    };
    return {
      n: seq.length,
      len: 30 / Metro.get().bpm, // メトロノームの BPM の8分音符
      fn: (i: number, t: number) => pluckMidi(seq[i], t, 0.5),
      ui: (i: number) => {
        const p = posOf(seq[i]);
        if (p) flash(p);
      },
    };
  };
  return (
    <div className="card wide" id="scale-view">
      <h2>スケール／バーチャル指板</h2>
      <p className="muted" style={{ margin: '0 0 10px' }}>ポジションを目で覚えましょう。指板をタップするとその音が鳴ります（ギターがなくても運指のイメージ練習に）。</p>
      <div className="row">
        <Select value={key} onChange={setKey} options={NOTE.map((n, i) => [i, sharp(n)] as const)} testId="sv-key" />
        <Select className="grow" value={scale} onChange={setScale} options={Object.entries(SCALES).map(([k, v]) => [k, v.n] as const)} testId="sv-scale" />
        <Select value={label} onChange={setLabel} options={[['name', '音名'], ['deg', '度数']]} />
      </div>
      <Fretboard marks={marks} onHit={(p) => { playPos(p); flash(p); }} testId="sv-board" />
      <div className="row">
        <span className="muted grow" data-testid="sv-notes">構成音: {sc.iv.map((i) => sharp(NOTE[(key + i) % 12])).join(' - ')}</span>
        <PlayButton id="scale" label="▶ スケールを再生" make={makeSeq} />
      </div>
    </div>
  );
}

export function FretTab() {
  return (
    <>
      <FretQuiz />
      <ScaleView />
    </>
  );
}
