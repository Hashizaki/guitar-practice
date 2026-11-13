import { useEffect, useRef, useState } from 'react';
import { ChordDiagram } from '../components/ChordDiagram';
import { Check, Dots, Select } from '../components/common';
import { ac, clickSound, strum } from '../lib/audio';
import { PLAY_ALONG_ID, setChordActive } from '../lib/log';
import { Metro, useMetro } from '../lib/metronome';
import { analyzeChroma, ensureMic, MIC_FAIL, releaseMic } from '../lib/mic';
import { playChord, playShape } from '../lib/play';
import { Seq, useSeqActive } from '../lib/seq';
import { bestCapoFor, findShape, MAX_BARS, pairKey, parseSongText, transposeChord, type Song } from '../lib/songs';
import { useShared } from '../lib/store';
import { keepAwake } from '../lib/wake';
import {
  bestCapo, CHORD_NAMES, chordFrets, chordNotes, chordPcs, isBarre, KEYS, NOTE, pick, progChords, PROGS,
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

// ---------- 1分間コードチェンジ ----------
const ONE_MIN = 60;
function OneMinuteChanges() {
  const [a, setA] = useShared('omA', 'C');
  const [b, setB] = useShared('omB', 'G');
  const [best, setBest] = useShared<Record<string, number>>('omBest', {});
  const [phase, setPhase] = useState<'idle' | 'count' | 'run' | 'done'>('idle');
  const [left, setLeft] = useState(ONE_MIN);
  const [count, setCount] = useState(0);
  const [isRecord, setIsRecord] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const live = useRef({ count, best, a, b });
  live.current = { count, best, a, b };
  const key = pairKey(a, b);
  const opts = CHORD_NAMES.map((n) => [n, n] as const);

  const stop = (): void => {
    clearInterval(timer.current);
    setChordActive(false);
    keepAwake('onemin', false);
  };
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = (): void => {
    stop();
    const c = live.current;
    const k = pairKey(c.a, c.b);
    const rec = c.count > (c.best[k] ?? 0);
    if (rec) setBest({ ...c.best, [k]: c.count });
    setIsRecord(rec);
    setPhase('done');
    clickSound(ac().currentTime + 0.01, true);
  };
  const start = (): void => {
    if (phase === 'count' || phase === 'run') {
      stop();
      setPhase('idle');
      return;
    }
    if (Metro.get().running) Metro.stop();
    if (Seq.active()) Seq.stop();
    setCount(0);
    setIsRecord(false);
    setLeft(3);
    setPhase('count');
    setChordActive(true);
    keepAwake('onemin', true);
    const t0 = Date.now();
    let lastSec = -1;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      const el = (Date.now() - t0) / 1000;
      if (el < 3) {
        // 3秒のカウントダウン（1秒ごとにクリック）
        const s = Math.floor(el);
        if (s !== lastSec) {
          lastSec = s;
          clickSound(ac().currentTime + 0.01, false);
        }
        setLeft(3 - s);
      } else if (el < 3 + ONE_MIN) {
        if (lastSec < 3) {
          lastSec = 3;
          clickSound(ac().currentTime + 0.01, true);
          setPhase('run');
        }
        setLeft(Math.ceil(3 + ONE_MIN - el));
      } else finish();
    }, 100);
  };
  const tap = (): void => {
    if (phase === 'run') setCount((c) => c + 1);
  };
  const running = phase === 'count' || phase === 'run';
  return (
    <div className="card" id="one-minute">
      <h2>⏱ 1分間コードチェンジ</h2>
      <p className="muted" style={{ margin: '0 0 10px' }}>
        2つのコードを1分間に何回切り替えられるか数えます。コードを替えて鳴らすたびに、下のボタンをタップ。苦手な切り替えを集中的に練習できます。
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Select value={a} onChange={setA} options={opts} testId="om-a" />
        <span className="muted">⇄</span>
        <Select value={b} onChange={setB} options={opts} testId="om-b" />
      </div>
      <div className="practice">
        <div className="cur"><ChordDiagram name={a} w={96} /></div>
        <div className="cur"><ChordDiagram name={b} w={96} /></div>
      </div>
      <div className="omstat">
        <div><b data-testid="om-left">{phase === 'idle' ? ONE_MIN : left}</b><span>{phase === 'count' ? 'スタートまで' : '残り秒'}</span></div>
        <div><b data-testid="om-count">{count}</b><span>回</span></div>
        <div><b data-testid="om-best">{best[key] ?? '—'}</b><span>自己ベスト</span></div>
      </div>
      <div className={`tapzone${phase === 'run' ? ' ok' : ''}`} onPointerDown={(e) => { e.preventDefault(); tap(); }} data-testid="om-tap">
        <span data-testid="om-label">
          {phase === 'idle' && 'スタートを押して、切り替えるたびにここをタップ'}
          {phase === 'count' && `${left}…`}
          {phase === 'run' && '切り替えたらタップ！'}
          {phase === 'done' && (isRecord ? `🎉 ${count}回！ 自己ベスト更新` : `${count}回でした（ベスト ${best[key] ?? count}回）`)}
        </span>
      </div>
      <button className={`primary bigbtn${running ? ' on' : ''}`} style={{ marginTop: 10 }} onClick={start} data-testid="om-btn">
        {running ? '■ やめる' : phase === 'done' ? '▶ もう一度' : '▶ スタート'}
      </button>
    </div>
  );
}

// ---------- 曲に合わせて弾く（カポ対応・自分の曲の登録） ----------
const NEW_SONG = '__new';
interface Draft { id: string | null; name: string; text: string }

function PlayAlong() {
  const m = useMetro();
  const playing = useSeqActive() === PLAY_ALONG_ID;
  const [key, setKey] = useShared('paKey', 'G');
  const [capo, setCapo] = useShared('paCapo', 0);
  /** 選んでいる進行：'p0'〜 は定番、's<id>' は自分の曲 */
  const [src, setSrc] = useShared('paSrc', 'p0');
  const [songs, setSongs] = useShared<Song[]>('songs', []);
  const [patI, setPatI] = useShared('paPat', 3);
  const [guide, setGuide] = useShared('paGuide', true);
  const [click, setClick] = useShared('paClick', true);
  const [pos, setPos] = useState<{ bar: number; slot: number }>({ bar: -1, slot: -1 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  const opt = useRef({ guide, click });
  opt.current = { guide, click };

  const song = src.startsWith('s') ? songs.find((x) => 's' + x.id === src) : undefined;
  const prog = song ? null : (PROGS[Number(src.slice(1))] ?? PROGS[0]);
  // reals: 実際に鳴るコード。shapes: カポをつけたときに押さえるフォーム
  const reals: KeyChord[] = prog ? progChords(key, prog) : parseSongText((song as Song).chords.join(' ')).chords;
  const shapes: KeyChord[] = prog ? progChords(shapeKey(key, capo), prog) : reals.map((c) => transposeChord(c, -capo));
  const forms = shapes.map(findShape);
  const pat = STRUM_PATS[patI][1];
  const n = shapes.length;
  const countIn = playing && pos.bar < 0;
  const i = pos.bar < 0 ? 0 : pos.bar % n;
  const missing = new Set(shapes.filter((_, k) => !forms[k]).map((c) => c.name)).size;

  const halt = (): void => {
    if (Seq.active() === PLAY_ALONG_ID) Seq.stop();
  };
  // 設定を変えたら再生を止める
  const change = <T,>(set: (v: T) => void) => (v: T): void => {
    halt();
    set(v);
  };
  const pickSrc = (v: string): void => {
    halt();
    if (v === NEW_SONG) {
      setErr('');
      setDraft({ id: null, name: '', text: '' });
    } else setSrc(v);
  };
  const save = (): void => {
    if (!draft) return;
    const { chords, bad } = parseSongText(draft.text);
    if (bad.length) return setErr(`読み取れないコードがあります：${bad.join('、')}（使えるのは C、Am、G7、Fmaj7、Dm7、Bdim など）`);
    if (!chords.length) return setErr('コードを1つ以上入れてください（例：G D Em C）。');
    if (chords.length > MAX_BARS) return setErr(`コードは ${MAX_BARS} 個までです（いま ${chords.length} 個）。`);
    const id = draft.id ?? Date.now().toString(36);
    const item: Song = { id, name: draft.name.trim() || `自分の曲 ${songs.length + 1}`, chords: chords.map((c) => c.name) };
    setSongs(draft.id ? songs.map((x) => (x.id === id ? item : x)) : [...songs, item]);
    setSrc('s' + id);
    setCapo(0);
    setDraft(null);
  };
  const remove = (): void => {
    if (!song || !confirm(`「${song.name}」を削除します。よろしいですか？`)) return;
    halt();
    setSongs(songs.filter((x) => x.id !== song.id));
    setSrc('p0');
  };
  const sound = (k: number, t: number, up: boolean): void => {
    const form = forms[k];
    if (form) playShape(form, capo, t, up);
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
  const dia = (k: number, w: number) => {
    const form = forms[k];
    return form ? (
      <ChordDiagram name={form} w={w} />
    ) : (
      <div className="nodia" style={{ width: w }}>
        フォーム未収録
        <br />
        {chordNotes(shapes[k].root, shapes[k].ty).join('・')}
      </div>
    );
  };
  const srcOptions: (readonly [string, string])[] = [
    ...PROGS.map((p, k) => ['p' + k, p.name] as const),
    ...songs.map((x) => ['s' + x.id, `🎵 ${x.name}`] as const),
    [NEW_SONG, '＋ 自分の曲を追加…'],
  ];
  return (
    <div className="card" id="play-along">
      <h2>🎵 曲に合わせて弾く</h2>
      <p className="muted" style={{ margin: '0 0 10px' }}>
        コード進行とストロークを選ぶと、伴奏がループします。画面のコードと矢印に合わせて弾きましょう。練習したい曲のコード進行を自分で登録することもできます。
      </p>
      <div className="row">
        {prog && (
          <label className="muted">
            キー <Select value={key} onChange={change(setKey)} options={KEYS.map((k) => [k, k] as const)} testId="pa-key" />
          </label>
        )}
        <label className="muted">
          カポ <Select value={capo} onChange={change(setCapo)} options={[0, 1, 2, 3, 4, 5, 6, 7].map((c) => [c, c ? String(c) : 'なし'] as const)} testId="pa-capo" />
        </label>
        <button onClick={() => change(setCapo)(prog ? bestCapo(key, prog) : bestCapoFor(reals, isBarre))} data-testid="pa-auto">おすすめカポ</button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <Select className="grow" value={song || prog ? src : 'p0'} onChange={pickSrc} options={srcOptions} testId="pa-src" />
        {song && (
          <>
            <button onClick={() => { halt(); setErr(''); setDraft({ id: song.id, name: song.name, text: song.chords.join(' ') }); }} data-testid="pa-edit">編集</button>
            <button className="danger" onClick={remove} data-testid="pa-delete">削除</button>
          </>
        )}
      </div>
      {draft && (
        <div className="songedit" data-testid="pa-editor">
          <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="曲の名前" maxLength={40} data-testid="pa-song-name" />
          <textarea
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            placeholder={'コードを1小節に1つずつ、空白で区切って入力\n例：G D Em C'}
            rows={3}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            data-testid="pa-song-text"
          />
          {err && <p className="songerr" data-testid="pa-song-err">{err}</p>}
          <div className="row">
            <button className="primary" onClick={save} data-testid="pa-song-save">保存</button>
            <button onClick={() => setDraft(null)}>やめる</button>
            <span className="muted">♯は #、♭は b で入力できます（例：F#m、Bb）</span>
          </div>
        </div>
      )}
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
          prog ? (
            <>カポ {capo}：<b>キー {shapeKey(key, capo)} のフォーム</b>で弾くと、実際の音はキー {key} になります。</>
          ) : (
            <>カポ {capo}：下のフォームで弾くと、登録したコードの音になります。</>
          )
        ) : prog ? (
          `キー ${key}（カポなし）`
        ) : (
          `${(song as Song).name}（${n}小節・カポなし）`
        )}
        {missing > 0 && ` フォーム未収録のコードが ${missing} 個あります。「おすすめカポ」を試してみてください。`}
      </div>
      <div className="practice">
        <div className="cur">
          <div className="nm" data-testid="pa-cur">{countIn ? `カウント ${Math.floor(Math.max(pos.slot, 0) / 2) + 1}` : shapes[i].name}</div>
          {dia(i, 120)}
        </div>
        <div className="nxt">
          <div className="muted">次</div>
          <div className="nm">{shapes[(i + 1) % n].name}</div>
          {dia((i + 1) % n, 64)}
        </div>
      </div>
      <div className="progrow" data-testid="pa-row">
        {shapes.map((c, k) => (
          <div key={k} className={pos.bar >= 0 && k === i ? 'cur' : ''}>
            <small>
              {prog ? c.roman : k + 1}
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
      <OneMinuteChanges />
      <PlayAlong />
      <ChordJudge cur={pair[0]} onBadge={setBadge} />
      <ChordChart />
    </>
  );
}
