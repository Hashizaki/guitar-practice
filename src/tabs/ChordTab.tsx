import { useEffect, useRef, useState } from 'react';
import { ChordDiagram } from '../components/ChordDiagram';
import { Check, Dots, Select } from '../components/common';
import { clickSound, strum } from '../lib/audio';
import { PLAY_ALONG_ID } from '../lib/log';
import { Metro, useMetro } from '../lib/metronome';
import { analyzeChroma, ensureMic, MIC_FAIL, releaseMic } from '../lib/mic';
import { playChord, playShape } from '../lib/play';
import { Seq, useSeqActive } from '../lib/seq';
import { useShared } from '../lib/store';
import {
  bestCapo, CHORD_NAMES, chordFrets, chordNotes, chordPcs, hasChord, KEYS, NOTE, pick, progChords, PROGS,
  shapeKey, sharp, strokeMark, STRUM_PATS, type KeyChord,
} from '../lib/theory';

const pcName = (pc: number): string => sharp(NOTE[pc]);
const pickOther = (pool: string[], not: string | null): string => {
  const arr = pool.filter((x) => x !== not);
  return arr.length ? pick(arr) : (not ?? pool[0]);
};
export const useSelectedChords = () => useShared<string[]>('selChords', ['C', 'G', 'Am', 'Em']);

interface Badge { text: string; cls: string }

// ---------- コードチェンジ練習 ----------
function ChangePractice({ cur, nxt, setPair, badge }: { cur: string; nxt: string; setPair: (c: string, n: string) => void; badge: Badge | null }) {
  const m = useMetro();
  const [selected, setSelected] = useSelectedChords();
  const [per, setPer] = useShared('perChange', 4);
  const [strumOn, setStrumOn] = useShared('strumOn', true);
  const live = useRef({ cur, nxt, per, strumOn, selected });
  live.current = { cur, nxt, per, strumOn, selected };

  useEffect(
    () =>
      Metro.onBeat((_, n) => {
        if (Metro.get().mode !== 'chord') return;
        const s = live.current;
        let c = s.cur;
        if (n > 0 && n % s.per === 0) {
          c = s.nxt;
          setPair(c, pickOther(s.selected, c));
        }
        if (n % s.per === 0 && s.strumOn) strum(chordFrets(c));
      }),
    [setPair],
  );

  const on = m.running && m.mode === 'chord';
  const toggle = (name: string): void => {
    if (selected.includes(name)) {
      if (selected.length > 1) setSelected(selected.filter((x) => x !== name));
    } else setSelected([...selected, name]);
  };
  const start = (): void => {
    if (on) {
      Metro.stop();
      return;
    }
    const c = pickOther(selected, null);
    setPair(c, pickOther(selected, c));
    live.current = { ...live.current, cur: c };
    Metro.start('chord');
  };
  return (
    <div className="card">
      <h2>コードチェンジ練習</h2>
      <p className="muted" style={{ margin: '0 0 8px' }}>練習したいコードを選んでスタート。メトロノームに合わせて次々にコードが変わります。</p>
      <div className="chips" data-testid="chord-chips">
        {CHORD_NAMES.map((n) => (
          <button key={n} className={`chip${selected.includes(n) ? ' on' : ''}`} onClick={() => toggle(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="row" style={{ margin: '12px 0' }}>
        <Select value={per} onChange={setPer} options={[[2, '2拍で交代'], [4, '4拍で交代'], [8, '8拍で交代']]} />
        <Check checked={strumOn} onChange={setStrumOn}>コードを鳴らす</Check>
      </div>
      <div className="practice">
        <div className="cur">
          <div className="nm" data-testid="cur-chord">{cur}</div>
          <ChordDiagram name={cur} w={120} />
        </div>
        <div className="nxt">
          <div className="muted">次</div>
          <div className="nm">{nxt}</div>
          <ChordDiagram name={nxt} w={64} />
        </div>
      </div>
      {on && badge && <div className={`judge-badge ${badge.cls}`}>{badge.text}</div>}
      <Dots />
      <button className={`primary bigbtn${on ? ' on' : ''}`} onClick={start} data-testid="chord-btn">
        {on ? '■ ストップ' : '▶ スタート'}
      </button>
      <p className="muted" style={{ margin: '8px 0 0', textAlign: 'center' }}>テンポはメトロノームタブで変更できます（現在 {m.bpm} BPM）</p>
    </div>
  );
}

// ---------- 曲に合わせて弾く（カポ対応） ----------
function PlayAlong() {
  const m = useMetro();
  const playing = useSeqActive() === PLAY_ALONG_ID;
  const [key, setKey] = useShared('paKey', 'G');
  const [capo, setCapo] = useShared('paCapo', 0);
  const [progI, setProgI] = useShared('paProg', 0);
  const [patI, setPatI] = useShared('paPat', 3);
  const [guide, setGuide] = useShared('paGuide', true);
  const [click, setClick] = useShared('paClick', true);
  const [pos, setPos] = useState<{ bar: number; slot: number }>({ bar: -1, slot: -1 });
  const opt = useRef({ guide, click });
  opt.current = { guide, click };

  const prog = PROGS[progI];
  const sKey = shapeKey(key, capo);
  const shapes = progChords(sKey, prog);
  const reals = progChords(key, prog);
  const pat = STRUM_PATS[patI][1];
  const n = shapes.length;
  const countIn = playing && pos.bar < 0;
  const i = pos.bar < 0 ? 0 : pos.bar % n;
  const names = [...new Set(shapes.map((c) => c.name))];
  const missing = names.filter((x) => !hasChord(x)).length;

  // 設定を変えたら再生を止める
  const change = <T,>(set: (v: T) => void) => (v: T): void => {
    if (Seq.active() === PLAY_ALONG_ID) Seq.stop();
    set(v);
  };
  const sound = (k: number, t: number, up: boolean): void => {
    if (hasChord(shapes[k].name)) playShape(shapes[k].name, capo, t, up);
    else playChord(reals[k].root, reals[k].ty, t, up);
  };
  const start = (): void => {
    if (Metro.get().running) Metro.stop();
    const q: [number, number][] = [];
    let g = 0;
    Seq.play(PLAY_ALONG_ID, {
      n: 8,
      len: 30 / Metro.get().bpm,
      loop: true,
      fn: (_, t) => {
        const step = g++;
        const slot = step % 8;
        const bar = Math.floor(step / 8) - 1; // 最初の1小節はカウント
        if (bar < 0) {
          if (slot % 2 === 0) clickSound(t, true);
        } else {
          if (opt.current.click && slot % 2 === 0) clickSound(t, slot === 0);
          const c = pat[slot];
          if (opt.current.guide && c !== '.') sound(bar % n, t, c === 'U');
        }
        q.push([bar, slot]);
      },
      ui: () => {
        const [bar, slot] = q.shift() as [number, number];
        setPos({ bar, slot });
      },
      onStop: () => setPos({ bar: -1, slot: -1 }),
    });
  };
  const Dia = ({ c, w }: { c: KeyChord; w: number }) =>
    hasChord(c.name) ? (
      <ChordDiagram name={c.name} w={w} />
    ) : (
      <div className="nodia" style={{ width: w }}>
        フォーム未収録
        <br />
        {chordNotes(c.root, c.ty).join('・')}
      </div>
    );
  return (
    <div className="card" id="play-along">
      <h2>🎵 曲に合わせて弾く</h2>
      <p className="muted" style={{ margin: '0 0 10px' }}>
        コード進行とストロークを選ぶと、伴奏がループします。画面のコードと矢印に合わせて弾きましょう。ギターがなくても、腕を振りながら聞くだけで練習になります。
      </p>
      <div className="row">
        <label className="muted">
          キー <Select value={key} onChange={change(setKey)} options={KEYS.map((k) => [k, k] as const)} testId="pa-key" />
        </label>
        <label className="muted">
          カポ <Select value={capo} onChange={change(setCapo)} options={[0, 1, 2, 3, 4, 5, 6, 7].map((c) => [c, c ? String(c) : 'なし'] as const)} testId="pa-capo" />
        </label>
        <button onClick={() => change(setCapo)(bestCapo(key, prog))} data-testid="pa-auto">おすすめカポ</button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <Select className="grow" value={progI} onChange={change(setProgI)} options={PROGS.map((p, k) => [k, p.name] as const)} />
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <Select
          className="grow"
          value={patI}
          onChange={change(setPatI)}
          options={STRUM_PATS.map((p, k) => [k, `ストローク：${p[0]}（${[...p[1]].map(strokeMark).join('')}）`] as const)}
        />
      </div>
      <div className="painfo muted" data-testid="pa-info">
        {capo ? (
          <>
            カポ {capo}：<b>キー {sKey} のフォーム</b>で弾くと、実際の音はキー {key} になります。
          </>
        ) : (
          `キー ${key}（カポなし）`
        )}
        {missing > 0 && ` フォーム未収録のコードが ${missing} 個あります。「おすすめカポ」を試してみてください。`}
      </div>
      <div className="practice">
        <div className="cur">
          <div className="nm" data-testid="pa-cur">{countIn ? `カウント ${Math.floor(Math.max(pos.slot, 0) / 2) + 1}` : shapes[i].name}</div>
          <Dia c={shapes[i]} w={120} />
        </div>
        <div className="nxt">
          <div className="muted">次</div>
          <div className="nm">{shapes[(i + 1) % n].name}</div>
          <Dia c={shapes[(i + 1) % n]} w={64} />
        </div>
      </div>
      <div className="progrow" data-testid="pa-row">
        {shapes.map((c, k) => (
          <div key={k} className={pos.bar >= 0 && k === i ? 'cur' : ''}>
            <small>
              {c.roman}
              {capo ? ' ＝ ' + reals[k].name : ''}
            </small>
            <b>{c.name}</b>
          </div>
        ))}
      </div>
      <div className="strokes">
        {[...pat].map((c, k) => (
          <div key={k} className={`${k === pos.slot ? 'cur' : ''}${c === '.' ? ' rest' : ''}`}>
            <b>{strokeMark(c)}</b>
            <span>{k % 2 ? 'と' : k / 2 + 1}</span>
          </div>
        ))}
      </div>
      <div className="row" style={{ margin: '10px 0' }}>
        <Check checked={guide} onChange={setGuide}>伴奏を鳴らす</Check>
        <Check checked={click} onChange={setClick}>クリック</Check>
      </div>
      <button className={`primary bigbtn${playing ? ' on' : ''}`} onClick={start} data-testid="pa-btn">
        {playing ? '■ 停止' : '▶ スタート'}
      </button>
      <p className="muted" style={{ margin: '8px 0 0', textAlign: 'center' }}>最初に1小節カウントが入ります。テンポはメトロノームタブの BPM（現在 {m.bpm}）です。</p>
    </div>
  );
}

// ---------- コード判定（オプション） ----------
interface Judged { name: string; ok: boolean; missing: number[]; extra: number[]; at: number }

function ChordJudge({ cur, onBadge }: { cur: string; onBadge: (b: Badge | null) => void }) {
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState('');
  const [target, setTarget] = useState('follow');
  const [view, setView] = useState<{ bars: number[]; last: Judged | null }>({ bars: Array(12).fill(0), last: null });
  const an = useRef<AnalyserNode | null>(null);
  const name = target === 'follow' ? cur : target;
  const nameRef = useRef(name);
  nameRef.current = name;
  const tones = chordPcs(name);

  useEffect(() => {
    if (!on || !an.current) return;
    const analyser = an.current;
    const freq = new Float32Array(analyser.frequencyBinCount);
    const time = new Float32Array(analyser.fftSize);
    const smooth = new Float32Array(12);
    let last: Judged | null = null;
    let raf = 0;
    let tick = 0;
    const loop = (t: number): void => {
      if (t - tick > 80) {
        tick = t;
        const nm = nameRef.current;
        if (last && last.name !== nm) {
          // コードが変わったら判定をやり直す
          smooth.fill(0);
          last = null;
        }
        const { rms, c } = analyzeChroma(analyser, freq, time, smooth);
        const tn = chordPcs(nm);
        if (rms > 0.012) {
          const missing = tn.filter((pc) => c[pc] < 0.22);
          const extra = [...Array(12).keys()].filter((pc) => !tn.includes(pc) && c[pc] > 0.6);
          last = { name: nm, ok: !missing.length && !extra.length, missing, extra, at: t };
        }
        const recent = last && t - last.at < 1500 ? last : null;
        setView({ bars: c.map((v) => (rms > 0.006 ? v : 0)), last: recent });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      releaseMic('chord');
    };
  }, [on]);

  const j = view.last;
  const text = j ? (j.ok ? `✓ ${name} OK!` : `✗ ${name} もう少し`) : `${name} を鳴らしてください`;
  const cls = j ? (j.ok ? 'ok' : 'ng') : '';
  const detail = j
    ? [j.missing.length ? '鳴っていない音: ' + j.missing.map(pcName).join(', ') : '', j.extra.length ? '余計な音: ' + j.extra.map(pcName).join(', ') : ''].filter(Boolean).join(' ／ ')
    : 'コードの構成音: ' + tones.map(pcName).join(', ');
  const badgeText = !on || target !== 'follow' ? null : j ? text + (detail ? `（${detail}）` : '') : '🎤 聞いています…';
  useEffect(() => onBadge(badgeText === null ? null : { text: badgeText, cls }), [badgeText, cls, onBadge]);

  const toggle = async (v: boolean): Promise<void> => {
    if (!v) {
      setOn(false);
      return;
    }
    setMsg('');
    try {
      an.current = await ensureMic('chord');
      setOn(true);
    } catch {
      setMsg(MIC_FAIL);
      setOn(false);
    }
  };
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>
          🎤 コード判定 <span className="opt">オプション</span>
        </h2>
        <label className="switch">
          <input type="checkbox" checked={on} onChange={(e) => void toggle(e.target.checked)} data-testid="judge-switch" />
          <span />
        </label>
      </div>
      {msg && <p className="muted" style={{ margin: '8px 0 0' }}>{msg}</p>}
      {on && (
        <div>
          <p className="muted" style={{ margin: '10px 0' }}>マイクで聞き取った音と、コードに含まれる音を比べます。ジャーンと鳴らしたあと、音が伸びている間に判定します。</p>
          <div className="row" style={{ marginBottom: 10 }}>
            <Select className="grow" value={target} onChange={setTarget} options={[['follow', '練習中のコードに合わせる'] as const, ...CHORD_NAMES.map((n) => [n, n] as const)]} />
          </div>
          <div className="chroma">
            {NOTE.map((nt, pc) => (
              <div key={pc} className={`col${tones.includes(pc) ? ' tone' : ''}${j?.missing.includes(pc) ? ' miss' : ''}${j?.extra.includes(pc) ? ' extra' : ''}`}>
                <div className="bar" style={{ height: `${Math.round(view.bars[pc] * 100)}%` }} />
                <div className="lb">{sharp(nt)}</div>
              </div>
            ))}
          </div>
          <div className={`jresult ${cls}`}>{text}</div>
          <div className="jsub muted">{detail}</div>
        </div>
      )}
    </div>
  );
}

// ---------- コード表 ----------
function ChordChart() {
  return (
    <div className="card wide">
      <h2>コード表</h2>
      <p className="muted" style={{ margin: '0 0 10px' }}>タップすると音が鳴ります。</p>
      <div className="chordgrid">
        {CHORD_NAMES.map((n) => (
          <div key={n} className="chordcell" onClick={() => strum(chordFrets(n))}>
            <div className="nm">{n}</div>
            <ChordDiagram name={n} w={88} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChordTab() {
  const [pair, setPairState] = useState<[string, string]>(['C', 'G']);
  const [badge, setBadge] = useState<Badge | null>(null);
  const setPair = useRef((c: string, n: string) => setPairState([c, n])).current;
  return (
    <>
      <ChangePractice cur={pair[0]} nxt={pair[1]} setPair={setPair} badge={badge} />
      <PlayAlong />
      <ChordJudge cur={pair[0]} onBadge={setBadge} />
      <ChordChart />
    </>
  );
}
