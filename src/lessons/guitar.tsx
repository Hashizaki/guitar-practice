import { useRef, useState } from 'react';
import { C_HIT, C_ROOT, C_TONE, PlayButton, Select } from '../components/common';
import { Fretboard, type Mark } from '../components/Fretboard';
import { ac, clickSound, pluckMidi, strum } from '../lib/audio';
import { Metro, useMetro } from '../lib/metronome';
import { gotoTab, scrollToId } from '../lib/nav';
import { playShape } from '../lib/play';
import { getShared, setShared } from '../lib/store';
import {
  bestCapo, chordFrets, chordNotes, diatonic, hasChord, isBarre, keyByPc, KEYS, mod12, noteAt, OPEN, OPEN_TOP, parseNote, pick,
  PROGS, shapeKey, sharp, spell, type Pos,
} from '../lib/theory';
import { playPos } from '../tabs/FretTab';
import { mkQ, Point, Readout, Tbl, type Lesson } from './types';

// ---------- ペンタトニック ----------
const AM_PENTA = [0, 3, 5, 7, 10];
function PentaBody() {
  const m = useMetro();
  const [hit, setHit] = useState<Pos | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const marks: Mark[] = [];
  for (let s = 0; s < 6; s++)
    for (let f = 0; f <= 12; f++) {
      const k = AM_PENTA.indexOf(mod12(OPEN_TOP[s] + f - 9));
      if (k < 0) continue;
      const h = hit?.s === s && hit.f === f;
      marks.push({ s, f, r: h ? 11 : 9, fill: h ? C_HIT : k === 0 ? C_ROOT : f >= 5 && f <= 8 ? C_TONE : '#8a6a3a', label: noteAt(s, f), text: k === 0 ? '#fff' : '#2a1a08' });
    }
  const tap = (p: Pos): void => {
    playPos(p);
    setHit(p);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHit(null), 300);
  };
  const toBoard = (): void => {
    setShared('svKey', 9);
    setShared('svScale', 'minpenta');
    gotoTab('fret');
    scrollToId('scale-view');
  };
  return (
    <>
      <p>スケール7音のうち、ぶつかりやすい2音を抜いた<b>5音のスケール</b>が<b>ペンタトニック</b>です（ペンタ＝5）。どの音を弾いても外れにくいので、ギターソロやアドリブの第一歩になります。</p>
      <Tbl items={[['メジャーペンタ', 'メジャーから4番目と7番目を抜く'], ['マイナーペンタ', 'マイナーから2番目と6番目を抜く']]} />
      <p>ロックやブルースの主役は<b>マイナーペンタ</b>。A マイナーペンタは <b>A・C・D・E・G</b> です。下の指板で光っている場所なら、どこを弾いても大丈夫。</p>
      <p>伴奏を流して、指板を自由にタップしてみましょう。オレンジ色（A）で終わると落ち着きます。</p>
      <div className="row">
        <PlayButton
          id="l-penta"
          label="▶ 伴奏を流す（Am – G – F – G）"
          make={() => {
            const cs = ['Am', 'G', 'F', 'G'];
            const beat = 60 / Metro.get().bpm;
            return {
              n: 4, len: beat * 4, loop: true,
              fn: (i, t) => {
                [0, 1, 2, 3].forEach((b) => clickSound(t + b * beat, false));
                [0, 2].forEach((b) => strum(chordFrets(cs[i]), t + b * beat, false, 0.2));
              },
            };
          }}
        />
        <span className="muted">BPM {m.bpm}</span>
      </div>
      <Fretboard marks={marks} onHit={tap} testId="penta-board" />
      <p>5〜8フレットの四角い形（ボックス）は、ギタリストが最初に覚える定番ポジションです。この形ごと横にずらせば、ほかのキーでも使えます。</p>
      <Point>ペンタ＝5音で外れにくい／A マイナーペンタ＝A C D E G／ルートで終わると落ち着く</Point>
      <div className="row"><button onClick={toBoard}>🎸 ほかのキー・スケールを指板で見る →</button></div>
    </>
  );
}
const penta: Lesson = {
  id: 'penta', title: 'ペンタトニックでアドリブ入門', sub: '5つの音で、もうソロが弾ける', Body: PentaBody,
  quiz: () => [
    mkQ('ペンタトニックスケールは何音でできている？', '5音', ['3音', '7音', '12音'], 'ペンタ＝5。スケール7音から2音を抜いたものです。'),
    mkQ('メジャースケールから何番目の音を抜くとメジャーペンタになる？', '4番目と7番目', ['1番目と5番目', '2番目と6番目', '3番目と7番目'], 'C メジャーなら F と B を抜いて C D E G A。'),
    mkQ('A マイナーペンタトニックの音は？', 'A・C・D・E・G', ['A・B・C・D・E', 'A・C♯・E・F♯・G', 'A・C・E・F・G'], 'A マイナー（A B C D E F G）から B と F を抜きます。'),
    mkQ('A マイナーペンタと同じ音でできているのは？', 'C メジャーペンタ', ['A メジャーペンタ', 'E メジャーペンタ', 'G メジャーペンタ'], '平行調の関係（C と Am）はペンタでも同じです。'),
    mkQ('アドリブのフレーズを落ち着いて終わらせるには？', 'ルートの音で終わる', ['いちばん高い音で終わる', '必ず開放弦で終わる', '速く弾いて終わる'], 'キーの「家」であるルートに着地すると安定します。'),
  ],
};

// ---------- パワーコード ----------
/** ルート・5度・オクターブ上のルート */
const powerShape = (p: Pos): Pos[] => [p, { s: p.s - 1, f: p.f + 2 }, { s: p.s - 2, f: p.f + 2 }];
const powerSound = (p: Pos, t?: number): void => powerShape(p).forEach((q, k) => pluckMidi(OPEN_TOP[q.s] + q.f, (t ?? ac().currentTime + 0.01) + k * 0.012, 0.4));
const RIFF: Pos[] = [{ s: 5, f: 3 }, { s: 5, f: 3 }, { s: 5, f: 3 }, { s: 5, f: 3 }, { s: 4, f: 3 }, { s: 4, f: 3 }, { s: 4, f: 5 }, { s: 4, f: 5 }];
function PowerBody() {
  const [root, setRoot] = useState<Pos | null>(null);
  const [warn, setWarn] = useState(false);
  const marks: Mark[] = root ? powerShape(root).map((q, i) => ({ ...q, fill: i === 1 ? C_TONE : C_ROOT, label: sharp(noteAt(q.s, q.f)), text: i === 1 ? '#2a1a08' : '#fff' })) : [];
  const tap = (h: Pos): void => {
    if (h.s < 4) {
      setWarn(true);
      return;
    }
    const p = { s: h.s, f: Math.min(h.f, 10) };
    setWarn(false);
    powerSound(p);
    setRoot(p);
  };
  let out = '6弦か5弦をタップ';
  if (warn) out = 'ルートは6弦か5弦で選んでください';
  else if (root) {
    const r = sharp(noteAt(root.s, root.f));
    out = `${r}5（${r}・${sharp(noteAt(root.s - 1, root.f + 2))}）— ${root.s + 1}弦 ${root.f === 0 ? '開放' : root.f + 'フレット'} がルート`;
  }
  return (
    <>
      <p><b>パワーコード</b>は、コードの3つの音から<b>3度を抜いて、ルートと5度だけ</b>にしたものです。C なら C と G。「C5」のように書きます。</p>
      <p>明るい・暗いを決める3度がないので、<b>メジャーでもマイナーでもない</b>力強い響きになります。音が少ないぶん、歪ませても濁らないのでロックで大活躍します。</p>
      <p>押さえ方は1種類だけ。<b>ルートを人差し指</b>、そこから<b>2フレット先・1本細い弦を薬指</b>（さらにその隣を小指で押さえるとオクターブ上のルートが加わります）。</p>
      <p>下の指板で、<b>6弦か5弦</b>の好きな場所をタップしてください。そこをルートにしたパワーコードが鳴ります。</p>
      <Fretboard marks={marks} onHit={tap} testId="power-board" />
      <Readout testId="power-out">{out}</Readout>
      <div className="row">
        <PlayButton id="l-riff" label="▶ リフを聞く（G5 – C5 – D5）" make={() => ({ n: 16, len: 30 / Math.max(Metro.get().bpm, 100), fn: (i, t) => powerSound(RIFF[i % 8], t), ui: (i) => setRoot(RIFF[i % 8]), onStop: () => setRoot(null) })} />
      </div>
      <p>形はそのまま、横にずらすだけでどのコードにもなります。レッスン2で覚えた「6弦と5弦の音名」がそのままコード名になるわけです。</p>
      <Point>パワーコード＝ルート＋5度／3度がないのでメジャーでもマイナーでもない／同じ形を横にずらすだけ</Point>
    </>
  );
}
const power: Lesson = {
  id: 'power', title: 'パワーコード', sub: '2本の指で弾けるロックの基本', Body: PowerBody,
  quiz() {
    const f = pick([1, 3, 5, 7, 8]);
    const r = noteAt(5, f);
    const r2 = pick(['C', 'D', 'E', 'G', 'A']);
    return [
      mkQ('パワーコードはどの音でできている？', 'ルートと5度', ['ルートと3度', '3度と5度', 'ルート・3度・5度・7度'], '3度を抜いた、ルートと5度の2音です。'),
      mkQ('パワーコードが「メジャーでもマイナーでもない」のはなぜ？', '3度の音がないから', ['5度の音がないから', 'ルートがないから', '音が大きいから'], '明るい・暗いを決めるのは3度。それがないので、どちらでもありません。'),
      mkQ(`6弦 ${f}フレットをルートにしたパワーコードは？`, r + '5', ['F5', 'G5', 'A5', 'B5', 'C5', 'D5', 'E5'], '6弦の音名がそのままコード名になります。'),
      mkQ('G5（6弦3フレット）を、形はそのままで2フレット高い方へずらすと？', 'A5', ['F5', 'B5', 'G♯5'], '2フレット＝全音。G の全音上は A です。'),
      mkQ(`${r2}5 の構成音は？`, `${r2}・${spell(r2, 7, 4)}`, [`${r2}・${spell(r2, 4, 2)}`, `${r2}・${spell(r2, 5, 3)}`, `${r2}・${spell(r2, 3, 2)}`], '5度はルートから半音7つ上です。'),
    ];
  },
};

// ---------- バレーコード ----------
/** [名前, 開放フォーム(6弦→1弦), 記号, ルートの弦(0=6弦)] */
const FORMS: [string, number[], '' | 'm', number][] = [
  ['E フォーム', [0, 2, 2, 1, 0, 0], '', 0], ['Em フォーム', [0, 2, 2, 0, 0, 0], 'm', 0],
  ['A フォーム', [-1, 0, 2, 2, 2, 0], '', 1], ['Am フォーム', [-1, 0, 2, 2, 1, 0], 'm', 1],
];
function BarreBody() {
  const [fm, setFm] = useState(0);
  const [n, setN] = useState(1);
  const [, open, sym, rootI] = FORMS[fm];
  const frets = (form = fm, pos = n): number[] => FORMS[form][1].map((f) => (f < 0 ? f : f + pos));
  const root = keyByPc(OPEN[rootI] + n);
  const tones = chordNotes(root, sym ? 'm' : 'M'); // コード名に合わせたつづり
  const lbl = (midi: number): string => tones.find((t) => parseNote(t).pc === midi % 12) ?? '';
  const marks: Mark[] = frets().flatMap((f, i) => (f < 0 ? [] : [{ s: 5 - i, f, fill: i === rootI ? C_ROOT : open[i] === 0 ? '#c98a3a' : C_TONE, label: lbl(OPEN[i] + f), text: i === rootI ? '#fff' : '#2a1a08' }]));
  return (
    <>
      <p>最初の壁といわれる <b>F</b>。人差し指で複数の弦をまとめて押さえる<b>バレー（セーハ）</b>が必要なコードです。でも、しくみを知ると見え方が変わります。</p>
      <p>F は実は、<b>E のフォームを1フレット横にずらしただけ</b>。開放弦だったところを、人差し指がナット（0フレット）の代わりに押さえています。だから同じ形をずらせば、G にも A にもなります。</p>
      <div className="chips">
        {FORMS.map((x, i) => (
          <button key={i} className={`chip${i === fm ? ' on' : ''}`} onClick={() => { setFm(i); strum(frets(i)); }}>{x[0]}</button>
        ))}
      </div>
      <div className="row">
        <span className="muted">位置</span>
        <input type="range" className="grow" min="0" max="9" value={n} onChange={(e) => setN(Number(e.target.value))} onPointerUp={() => strum(frets())} onKeyUp={() => strum(frets())} aria-label="フレット位置" data-testid="barre-fret" />
        <b style={{ minWidth: 70, textAlign: 'right' }}>{n === 0 ? '開放' : n + 'フレット'}</b>
      </div>
      <Fretboard marks={marks} testId="barre-board" />
      <Readout testId="barre-out">
        <b>{root + sym}</b>
        <br />
        <small>{n === 0 ? 'ふつうの開放コード（バレーなし）' : `${FORMS[fm][0]}を ${n}フレットでバレー／ルートは${6 - rootI}弦`}</small>
      </Readout>
      <div className="row"><button className="primary" onClick={() => strum(frets())}>▶ 鳴らす</button></div>
      <p><b>E フォーム</b>は6弦、<b>A フォーム</b>は5弦がルートです。レッスン2の指板の音名がわかれば、どのコードも自分で作れます。</p>
      <Tbl items={[['コツ1', '人差し指は少し傾けて、側面の硬いところで'], ['コツ2', '親指はネックの真裏あたり'], ['コツ3', 'フレットのすぐ近くを押さえる']]} />
      <p>最初から全部きれいに鳴らなくて大丈夫。<b>Fmaj7</b>（コード表にあります）や、カポを使って簡単なフォームで弾く方法（次のレッスン）で代用しながら、少しずつ慣れましょう。</p>
      <Point>バレーコード＝開放コードの形を人差し指ごと横にずらしたもの／E フォームは6弦、A フォームは5弦がルート</Point>
    </>
  );
}
const barre: Lesson = {
  id: 'barre', title: 'バレーコードと F の攻略', sub: '1つの形で12個のコードになる', Body: BarreBody,
  quiz() {
    const n = pick([3, 5, 7]);
    const m = pick([2, 3, 5]);
    return [
      mkQ('E のフォームを1フレットずらしてバレーすると、何のコード？', 'F', ['E♭', 'G', 'A'], 'E の半音上は F。開放弦のかわりに人差し指で1フレットを押さえます。'),
      mkQ(`E フォームのバレーコードを ${n}フレットで押さえると？`, keyByPc(4 + n), ['F', 'G', 'A', 'B', 'C'], '6弦のそのフレットの音名がコード名になります（6弦：E F F♯ G G♯ A A♯ B）。'),
      mkQ(`Am フォームのバレーコードを ${m}フレットで押さえると？`, keyByPc(9 + m) + 'm', ['Bm', 'Cm', 'Dm', 'Em', 'Am'], '5弦のそのフレットの音名＋m です（5弦：A A♯ B C C♯ D）。'),
      mkQ('E フォームのバレーコードで、ルートがあるのは何弦？', '6弦', ['5弦', '4弦', '1弦だけ'], 'E フォームは6弦、A フォームは5弦がルートです。'),
      mkQ('バレーコードで、人差し指は何の代わりをしている？', 'ナット（0フレット）', ['ピック', 'ブリッジ', 'チューナー'], '開放弦の位置をまるごと上にずらしている、と考えます。'),
    ];
  },
};

// ---------- カポと移調 ----------
const CAPO_SHAPES = ['C', 'G', 'D', 'A', 'E', 'Am', 'Em', 'Dm'];
const CAPOS = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => [c, c ? String(c) : 'なし'] as const);
function CapoBody() {
  const [shape, setShape] = useState('G');
  const [capo, setCapo] = useState(2);
  const [key, setKey] = useState('B♭');
  const minor = shape.endsWith('m');
  const real = keyByPc(parseNote(minor ? shape.slice(0, -1) : shape).pc + capo) + (minor ? 'm' : '');
  const toPlayAlong = (): void => {
    setShared('paKey', key);
    setShared('paCapo', bestCapo(key, PROGS[getShared('paProg', 0)]));
    gotoTab('chord');
    scrollToId('play-along');
  };
  return (
    <>
      <p><b>カポ（カポタスト）</b>は、全部の弦をまとめて押さえる道具です。前回のバレーの人差し指と同じで、<b>ナットの位置を動かす</b>はたらきをします。</p>
      <p>カポを1フレットにつけると、<b>すべての音が半音上がります</b>。つまり、同じフォームのまま曲全体の高さ（キー）を変えられます。これを<b>移調</b>といいます。</p>
      <div className="row">
        <label className="muted">フォーム <Select value={shape} onChange={(v) => { setShape(v); playShape(v, capo); }} options={CAPO_SHAPES.map((s) => [s, s] as const)} testId="capo-shape" /></label>
        <label className="muted">カポ <Select value={capo} onChange={(v) => { setCapo(v); playShape(shape, v); }} options={CAPOS} testId="capo-pos" /></label>
        <button className="primary" onClick={() => playShape(shape, capo)}>▶ 鳴らす</button>
      </div>
      <Readout testId="capo-out">
        {capo ? <>カポ {capo} ＋ <b>{shape}</b> のフォーム ＝ 実際の音は <b>{real}</b></> : <>カポなし：<b>{shape}</b> のまま</>}
      </Readout>
      <p>カポの使い道は2つあります。</p>
      <Tbl items={[['歌に合わせる', '声が出しやすい高さにキーを変える'], ['楽に弾く', '難しいキーを簡単なフォームに置きかえる']]} />
      <p>たとえばキー B♭ の曲は B♭・F・Gm・E♭ とバレーコードだらけ。でも<b>カポ3</b>なら G・D・Em・C のフォームで弾けます。キーを選んで、どのカポ位置が弾きやすいか見てみましょう。</p>
      <div className="row">
        <label className="muted">曲のキー <Select value={key} onChange={setKey} options={KEYS.map((k) => [k, k] as const)} testId="capo-key" /></label>
      </div>
      <div className="capotbl" data-testid="capo-tbl">
        <div className="hd"><span>カポ</span><span>フォームのキー</span><span>I・IV・V・vi のフォーム</span></div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const sk = shapeKey(key, i);
          const d = diatonic(sk);
          const cs = [d[0], d[3], d[4], d[5]].map((x) => x.name);
          const ok = cs.every(hasChord);
          const easy = ok && !cs.some(isBarre);
          return (
            <div key={i} className={easy ? 'easy' : ok ? 'ok' : ''}>
              <span>{i || 'なし'}</span>
              <span>{sk}</span>
              <span>{cs.join('・')}{easy ? ' ◎' : ok ? ' ○' : ''}</span>
            </div>
          );
        })}
        <p className="muted" style={{ margin: '6px 0 0' }}>◎＝開放コードだけで弾ける　○＝バレーコードを含む</p>
      </div>
      <p>「コード進行」のレッスンで進行をローマ数字（I・IV・V・vi）で覚えたのは、このためでもあります。キーが変わっても「I–V–vi–IV」は同じです。</p>
      <Point>カポ1つで半音上がる／フォームはそのまま、キーだけ変わる／難しいキーは「カポ＋簡単なフォーム」で</Point>
      <div className="row"><button onClick={toPlayAlong} data-testid="capo-to-pa">🎵 「曲に合わせて弾く」で試す →</button></div>
    </>
  );
}
const capo: Lesson = {
  id: 'capo', title: 'カポと移調', sub: '難しいキーを簡単なフォームで弾く', Body: CapoBody,
  quiz() {
    const c = pick([1, 2, 3, 5]);
    const s = pick(['C', 'G', 'D', 'A', 'E']);
    const pc = parseNote(s).pc;
    return [
      mkQ('カポを1フレットにつけると、音はどうなる？', 'すべての弦が半音上がる', ['すべての弦が半音下がる', '1弦だけ上がる', '変わらない'], 'カポはナットの位置を動かす道具。1フレット＝半音です。'),
      mkQ(`カポ ${c} で ${s} のフォームを弾くと、実際に鳴るコードは？`, keyByPc(pc + c), [keyByPc(pc - c), keyByPc(pc + c + 1), keyByPc(pc + c - 1), s], `${s} から半音 ${c} つ上の音になります。`),
      mkQ('キー A の曲を、G のフォームで弾きたい。カポの位置は？', '2フレット', ['1フレット', '3フレット', '5フレット'], 'G から A は全音（半音2つ）なので、カポ2です。'),
      mkQ('カポを使う理由として正しいのは？', '難しいキーを簡単なフォームで弾ける', ['音が大きくなる', 'チューニングが不要になる', '弦が切れにくくなる'], 'もう1つの使い道は、歌いやすい高さにキーを変えることです。'),
      mkQ('曲のキーを変えることを何という？', '移調', ['転回', '変拍子', 'チューニング'], 'ローマ数字で進行を覚えていれば、移調しても同じ考え方で弾けます。'),
    ];
  },
};

export const GUITAR: Lesson[] = [penta, power, barre, capo];
