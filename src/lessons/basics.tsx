import { useState } from 'react';
import { C_HIT, C_TONE, PlayButton } from '../components/common';
import { Fretboard, type Mark } from '../components/Fretboard';
import { Keyboard } from '../components/Keyboard';
import { TabStaff, type TabEvent } from '../components/TabStaff';
import { clickSound, pluckMidi, strum } from '../lib/audio';
import { Metro, useMetro } from '../lib/metronome';
import { gotoTab, gotoTrain } from '../lib/nav';
import { Seq } from '../lib/seq';
import { chordFrets, LET, LET_JP, LPC, noteAt, noteLabel, OPEN_TOP, pick, rnd, sharp, shuffle, spell, strokeMark, STRUM_PATS, withJP, type Pos } from '../lib/theory';
import { playPos } from '../tabs/FretTab';
import { mkQ, Point, Readout, Tbl, type Lesson } from './types';

// ---------- 1. 音の名前 ----------
function NotesBody() {
  const [cur, setCur] = useState<number | null>(null);
  let out = '鍵盤をタップ';
  if (cur !== null) {
    const pc = cur % 12;
    const i = (LPC as readonly number[]).indexOf(pc);
    out = i >= 0 ? withJP(LET[i]) : `${spell(LET[(LPC as readonly number[]).indexOf(pc - 1)], 1, 0)} ＝ ${spell(LET[(LPC as readonly number[]).indexOf(pc + 1)], -1, 0)}（黒い鍵盤）`;
  }
  const run = (ms: number[]) => () => ({ n: ms.length, len: 0.4, fn: (i: number, t: number) => pluckMidi(ms[i], t, 0.5), ui: (i: number) => setCur(ms[i]) });
  return (
    <>
      <p>音楽で使う音は、実は<b>12種類</b>しかありません。そのうち7つに名前がついています。</p>
      <Tbl items={LET.map((l, i) => [l, LET_JP[i]] as const)} />
      <p>ギターのコード名（C、G、Am…）はこの<b>英語の音名</b>で書くので、まずは「C＝ド」から覚えましょう。</p>
      <p>下の鍵盤をタップしてみてください。白い鍵盤が上の7つ、黒い鍵盤が残りの5つです。</p>
      <Keyboard marks={cur === null ? {} : { [cur]: { fill: C_TONE } }} onTap={(m) => { pluckMidi(m, null, 0.5); setCur(m); }} />
      <Readout testId="notes-out">{out}</Readout>
      <div className="row">
        <PlayButton id="l-doremi" className="" label="▶ ドレミファソラシド" make={run([60, 62, 64, 65, 67, 69, 71, 72])} />
        <PlayButton id="l-chroma" className="" label="▶ 12音ぜんぶ" make={run([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72])} />
      </div>
      <p>となり合う鍵盤（黒も含む）の距離を<b>半音</b>、半音2つ分を<b>全音</b>といいます。<b>E–F</b> と <b>B–C</b> の間には黒い鍵盤がないので、ここだけ半音です。</p>
      <p>黒い鍵盤には2通りの呼び方があります。<b>♯（シャープ）</b>は半音上、<b>♭（フラット）</b>は半音下という意味なので、C の半音上＝<b>C♯</b>、D の半音下＝<b>D♭</b> は同じ音です。</p>
      <Point>音は12種類／C D E F G A B ＝ ドレミファソラシ／E–F と B–C は半音</Point>
    </>
  );
}
const notes: Lesson = {
  id: 'notes', title: '音の名前', sub: 'ドレミと CDE、♯と♭', Body: NotesBody,
  quiz() {
    const i = rnd(7);
    const x = pick([0, 1, 3, 4, 5]);
    return [
      mkQ(`「${LET_JP[i]}」を英語の音名でいうと？`, LET[i], shuffle(LET), LET.map((l, k) => l + '=' + LET_JP[k]).join('、')),
      mkQ('E と F の間の距離は？', '半音', ['全音', '全音半', '1オクターブ'], 'E–F と B–C の間には黒い鍵盤がなく、半音です。'),
      mkQ(`${LET[x]}♯ と同じ高さの音は？`, LET[x + 1] + '♭', [LET[x] + '♭', LET[(x + 2) % 7] + '♭', LET[x + 1] + '♯'], '♯は半音上、♭は半音下。となりの音から見ると同じ黒い鍵盤です。'),
      mkQ('1オクターブの中に、音は全部で何種類ある？', '12種類', ['7種類', '8種類', '10種類'], '白い鍵盤7つ＋黒い鍵盤5つ＝12種類です。'),
      mkQ('♯（シャープ）の意味は？', '半音上げる', ['半音下げる', '全音上げる', '1オクターブ上げる'], '♯＝半音上、♭＝半音下です。'),
    ];
  },
};

// ---------- 2. 指板のしくみ ----------
function BoardBody() {
  const [s, setS] = useState(5);
  const [hit, setHit] = useState<number | null>(null);
  const [out, setOut] = useState('指板をタップ');
  const marks: Mark[] = Array.from({ length: 13 }, (_, f) => {
    const n = noteAt(s, f);
    const nat = !n.includes('#');
    return { s, f, r: nat ? 9 : 7, fill: hit === f ? C_HIT : nat ? C_TONE : '#8a7660', label: sharp(n) };
  });
  return (
    <>
      <p>ギターの弦は6本。何も押さえずに鳴らす音（<b>開放弦</b>）は、太い6弦から順に次のとおりです。</p>
      <Tbl items={[['E', '6弦'], ['A', '5弦'], ['D', '4弦'], ['G', '3弦'], ['B', '2弦'], ['E ', '1弦']]} />
      <p>そして大事なルールが1つ。<b>フレットを1つ進むと、音は半音上がります。</b> つまり1本の弦は、前回の鍵盤を横に並べたものと同じです。</p>
      <p>弦を選ぶと、その弦の音名が並びます。指板をタップすると音が鳴ります。</p>
      <div className="chips">
        {[5, 4, 3, 2, 1, 0].map((i) => (
          <button key={i} className={`chip${s === i ? ' on' : ''}`} onClick={() => { setS(i); setHit(null); playPos({ s: i, f: 0 }); }}>
            {i + 1}弦
          </button>
        ))}
      </div>
      <Fretboard marks={marks} onHit={(h) => { playPos(h); setS(h.s); setHit(h.f); setOut(`${h.s + 1}弦 ${h.f === 0 ? '開放' : h.f + 'フレット'} ＝ ${noteLabel(noteAt(h.s, h.f))}`); }} />
      <Readout>{out}</Readout>
      <p>12フレットまで進むと半音12個ぶん＝<b>1オクターブ</b>上の、同じ名前の音に戻ります。12フレットに印（ポジションマーク）が2つあるのはそのためです。</p>
      <Point>開放弦は E A D G B E／1フレット＝半音／12フレットで同じ音名に戻る</Point>
      <div className="row"><button onClick={() => gotoTab('fret')}>🎯 指板クイズで覚える →</button></div>
    </>
  );
}
const board: Lesson = {
  id: 'board', title: 'ギターの指板のしくみ', sub: '開放弦と、フレット＝半音', Body: BoardBody,
  quiz() {
    const n = rnd(6);
    const f = pick([1, 3, 5, 7, 8, 10]);
    return [
      mkQ(`${n + 1}弦の開放弦の音は？`, noteAt(n, 0), shuffle(['E', 'A', 'D', 'G', 'B', 'C']), '6弦から E・A・D・G・B・E です。'),
      mkQ(`6弦（開放は E）の ${f}フレットの音は？`, sharp(noteAt(5, f)), shuffle(['F', 'G', 'A', 'B', 'C', 'D', 'F♯', 'G♯']), 'E から半音ずつ数えます：E→F→F♯→G→G♯→A→A♯→B→C→C♯→D'),
      mkQ('フレットを1つ進むと、音はどれだけ上がる？', '半音', ['全音', '1オクターブ', '変わらない'], '1フレット＝半音、2フレット＝全音です。'),
      mkQ('開放弦と、同じ弦の12フレットの音の関係は？', '同じ音名で1オクターブ高い', ['半音高い', '全音高い', 'まったく別の音'], '半音12個ぶん進むと、同じ名前の高い音になります。'),
      mkQ('5弦の開放弦（A）の2フレットの音は？', 'B', ['A♯', 'C', 'G'], 'A から半音2つ：A→A♯→B'),
    ];
  },
};

// ---------- 3. リズムの基本 ----------
function RhythmBody() {
  const m = useMetro();
  const [p, setP] = useState(3);
  const [cur, setCur] = useState(-1);
  const pat = STRUM_PATS[p][1];
  return (
    <>
      <p>音楽には一定の間隔で刻まれる<b>拍（ビート）</b>があります。手拍子や足踏みで自然に取っているあれです。その速さを表すのが <b>BPM</b>（1分間の拍の数）。</p>
      <p>拍をいくつかずつ区切ったまとまりが<b>小節</b>。ほとんどの曲は「1・2・3・4」と4拍で1小節の<b>4/4拍子</b>です。</p>
      <Tbl items={[['4分音符', '1拍'], ['8分音符', '半拍'], ['2分音符', '2拍'], ['全音符', '4拍']]} />
      <p>ギターのストロークは、腕を<b>8分音符で振り続ける</b>のが基本です。拍の頭（1・2・3・4）は<b>ダウン ↓</b>、あいだの「と」（裏拍）は<b>アップ ↑</b>。弾かないところは空振りします。</p>
      <div className="chips">
        {STRUM_PATS.map((x, i) => (
          <button key={i} className={`chip${i === p ? ' on' : ''}`} onClick={() => { Seq.stop(); setP(i); }}>
            {x[0]}
          </button>
        ))}
      </div>
      <div className="strokes">
        {[...pat].map((c, i) => (
          <div key={i} className={`${i === cur ? 'cur' : ''}${c === '.' ? ' rest' : ''}`}>
            <b>{strokeMark(c)}</b>
            <span>{i % 2 ? 'と' : i / 2 + 1}</span>
          </div>
        ))}
      </div>
      <div className="row">
        <PlayButton
          id="l-strum"
          label="▶ 聞いてみる"
          make={() => ({
            n: 8, len: 30 / Metro.get().bpm, loop: true,
            fn: (i, t) => {
              if (i % 2 === 0) clickSound(t, i === 0);
              if (pat[i] !== '.') strum(chordFrets('Em'), t, pat[i] === 'U');
            },
            ui: setCur,
            onStop: () => setCur(-1),
          })}
        />
        <span className="muted">テンポは メトロノームタブの BPM（{m.bpm}）</span>
      </div>
      <p>最後のパターン（↓・↓↑・↑↓↑）は弾き語りの定番です。ギターがなくても、ひざを叩いて腕の動きを練習できます。</p>
      <Point>4/4拍子＝1小節に4拍／腕は8分で振り続ける／表はダウン、裏はアップ</Point>
      <div className="row"><button onClick={() => gotoTrain('rhythm')}>🥁 リズム練習でタップしてみる →</button></div>
    </>
  );
}
const rhythm: Lesson = {
  id: 'rhythm', title: 'リズムの基本', sub: '拍・小節・ストローク', Body: RhythmBody,
  quiz: () => [
    mkQ('4/4拍子の1小節に、4分音符はいくつ入る？', '4つ', ['2つ', '3つ', '8つ'], '4/4拍子は「4分音符が4つで1小節」という意味です。'),
    mkQ('8分音符2つ分の長さは？', '4分音符1つ分', ['2分音符1つ分', '全音符1つ分', '16分音符1つ分'], '8分音符は4分音符の半分の長さです。'),
    mkQ('BPM 60 は、1分間に何拍？', '60拍', ['30拍', '120拍', '4拍'], 'BPM は1分間の拍数。BPM 60 は1秒に1拍です。'),
    mkQ('「1 と 2 と…」の「と」（裏拍）は、ふつうどちらで弾く？', 'アップ ↑', ['ダウン ↓', 'どちらでもなく弾かない', '必ず両方'], '腕を8分で振り続けると、表がダウン、裏がアップになります。'),
    mkQ('4/4拍子の1小節に、8分音符はいくつ入る？', '8つ', ['4つ', '6つ', '16個'], '4拍 × 2 ＝ 8つです。'),
  ],
};

// ---------- 4. TAB譜の読み方 ----------
const P = (s: number, f: number): Pos[] => [{ s, f }];
const SONGS: [string, TabEvent[]][] = [
  ['ドレミファソラシド', [P(4, 3), P(3, 0), P(3, 2), P(3, 3), P(2, 0), P(2, 2), P(1, 0), P(1, 1)]],
  ['きらきら星', [P(1, 1), P(1, 1), P(0, 3), P(0, 3), P(0, 5), P(0, 5), P(0, 3), null, P(0, 1), P(0, 1), P(0, 0), P(0, 0), P(1, 3), P(1, 3), P(1, 1)]],
  ['コード C', [[{ s: 4, f: 3 }, { s: 3, f: 2 }, { s: 2, f: 0 }, { s: 1, f: 1 }, { s: 0, f: 0 }]]],
];
function TabBody() {
  const [sg, setSg] = useState(0);
  const [cur, setCur] = useState(-1);
  const events = SONGS[sg][1];
  return (
    <>
      <p>ギターには <b>TAB譜（タブ譜）</b>という専用の楽譜があります。「どの弦の何フレットを押さえるか」がそのまま書いてあるので、五線譜が読めなくても弾けます。</p>
      <Tbl items={[['6本の線', '6本の弦'], ['上の線', '1弦（細い）'], ['下の線', '6弦（太い）'], ['数字', 'フレット番号'], ['0', '開放弦']]} />
      <p>ギターを抱えて上からのぞき込んだときの見え方と同じ向きです。左から右へ順番に弾きます。</p>
      <div className="chips">
        {SONGS.map((x, i) => (
          <button key={i} className={`chip${i === sg ? ' on' : ''}`} onClick={() => { Seq.stop(); setSg(i); setCur(-1); }}>
            {x[0]}
          </button>
        ))}
      </div>
      <TabStaff events={events} cur={cur} />
      <Fretboard marks={(events[cur] ?? []).map((p) => ({ ...p, fill: C_HIT, label: sharp(noteAt(p.s, p.f)) }))} />
      <div className="row">
        <PlayButton
          id="l-tab"
          label="▶ 再生"
          make={() => ({
            n: events.length, len: 0.45,
            fn: (i, t) => [...(events[i] ?? [])].reverse().forEach((p, k) => pluckMidi(OPEN_TOP[p.s] + p.f, t + k * 0.03, 0.45)),
            ui: setCur,
            onStop: () => setCur(-1),
          })}
        />
        <span className="muted">下の指板に、押さえる場所が出ます</span>
      </div>
      <p>数字が<b>縦に並んでいる</b>ときは、同時に鳴らします（＝コード）。「コード C」を選ぶと、コード表の C と同じ押さえ方だとわかります。</p>
      <p>TAB譜の弱点は、音の長さ（リズム）がわかりにくいこと。曲を聞いてリズムを覚えてから読むのがコツです。</p>
      <Point>線＝弦（上が1弦）／数字＝フレット／0は開放／縦に並んだ数字は同時に弾く</Point>
    </>
  );
}
const tab: Lesson = {
  id: 'tab', title: 'TAB譜の読み方', sub: '五線譜が読めなくても弾ける楽譜', Body: TabBody,
  quiz() {
    const f = pick([1, 2, 3, 5]);
    const s = pick([1, 2, 3, 4, 5, 6]);
    const ok = `${s}弦の${f}フレット`;
    return [
      mkQ('TAB譜のいちばん上の線は、どの弦？', '1弦（いちばん細い弦）', ['6弦（いちばん太い弦）', '3弦', '決まっていない'], '上が1弦、下が6弦。ギターを上からのぞき込んだ向きです。'),
      mkQ('TAB譜の数字「0」の意味は？', '開放弦（押さえずに弾く）', ['弾かない', 'ミュートする', '0.5フレットを押さえる'], '0 は何も押さえない開放弦です。'),
      mkQ('数字が縦に並んでいるときは？', '同時に鳴らす', ['上から順に弾く', 'どれか1つを選ぶ', '下の数字だけ弾く'], '縦に並んだ数字はコード（和音）です。'),
      mkQ(`上から${s}本目の線に「${f}」と書いてあったら？`, ok, [`${f}弦の${s}フレット`, `${7 - s}弦の${f}フレット`, `${s}弦を${f}回弾く`], '線が弦、数字がフレットです。'),
      mkQ('TAB譜だけではわかりにくいものは？', '音の長さ（リズム）', ['押さえる弦', '押さえるフレット', '弾く順番'], '場所はわかりますが、リズムは曲を聞いて確かめましょう。'),
    ];
  },
};

export const BASICS: Lesson[] = [notes, board, rhythm, tab];
