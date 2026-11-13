import { useState } from 'react';
import { ChordDiagram } from '../components/ChordDiagram';
import { C_HIT, C_ROOT, C_TONE, PlayButton, Select } from '../components/common';
import { Keyboard, type KeyMarks } from '../components/Keyboard';
import { ac, pluckMidi } from '../lib/audio';
import { Metro, useMetro } from '../lib/metronome';
import { gotoTab, gotoTrain, scrollToId } from '../lib/nav';
import { playChord } from '../lib/play';
import { Seq } from '../lib/seq';
import { setShared } from '../lib/store';
import {
  chordNotes, diatonic, EASY_KEYS, hasChord, intervalUp, KEYS, parseNote, pick, progChords, PROGS, rnd, ROMAN, rootMidi,
  scaleNotes, shuffle, spell, T_CHORD, T_IV, T_SCALE, type ChordType,
} from '../lib/theory';
import { mkQ, Point, Readout, Tbl, type Lesson } from './types';

const keyOpts = (list: readonly string[] = KEYS) => list.map((k) => [k, k] as const);
const tapKey = (m: number): void => pluckMidi(m, null, 0.5);

// ---------- メジャースケール ----------
function MajorBody() {
  const [key, setKey] = useState('C');
  const [cur, setCur] = useState(-1);
  const ns = [...scaleNotes(key, 'major'), key];
  const ms = [...T_SCALE.major.iv, 12].map((i) => rootMidi(key) + i);
  const marks: KeyMarks = {};
  ms.forEach((m, i) => (marks[m] = { fill: i === cur ? C_HIT : i % 7 === 0 ? C_ROOT : C_TONE, label: ns[i] }));
  const toBoard = (): void => {
    setShared('svKey', parseNote(key).pc);
    setShared('svScale', 'major');
    setShared('svLabel', 'name');
    gotoTab('fret');
    scrollToId('scale-view');
  };
  return (
    <>
      <p>12種類の音から、相性のいい7音を選んで並べたものが<b>スケール（音階）</b>です。いちばん基本になるのが<b>メジャースケール</b>＝「ドレミファソラシド」。</p>
      <p>ドレミ…が明るく聞こえる秘密は、音の<b>間隔</b>にあります。</p>
      <div className="formula">全・全・半・全・全・全・半</div>
      <p>この間隔さえ守れば、<b>どの音から始めても</b>「ドレミファソラシド」に聞こえます。始める音を<b>キー（調）</b>といいます。キーを変えて確かめてみましょう。</p>
      <div className="row">
        <label className="muted">キー <Select value={key} onChange={(k) => { Seq.stop(); setKey(k); }} options={keyOpts()} testId="major-key" /></label>
        <PlayButton id="l-major" label="▶ 鳴らす" make={() => ({ n: 8, len: 0.42, fn: (i, t) => pluckMidi(ms[i], t, 0.5), ui: setCur, onStop: () => setCur(-1) })} />
      </div>
      <Keyboard marks={marks} onTap={tapKey} />
      <div className="steps" data-testid="major-steps">
        {ns.map((n, i) => (
          <span key={i} style={{ display: 'contents' }}>
            <b className={i === cur ? 'cur' : ''}>{n}</b>
            {i < 7 && <i>{[2, 2, 1, 2, 2, 2, 1][i] === 2 ? '全' : '半'}</i>}
          </span>
        ))}
      </div>
      <p>G から始めると、最後の「全・半」を守るために F が <b>F♯</b> になります。キーによって♯や♭がつくのは、この間隔を守るためです。</p>
      <Point>メジャースケール＝全全半全全全半／始まりの音がキー／曲のメロディもコードもここから生まれる</Point>
      <div className="row"><button onClick={toBoard}>🎸 このスケールを指板で見る →</button></div>
    </>
  );
}
const major: Lesson = {
  id: 'major', title: 'メジャースケール', sub: '「全全半全全全半」ですべてが決まる', Body: MajorBody,
  quiz() {
    const k = pick(EASY_KEYS);
    const n = 2 + rnd(6);
    const ns = scaleNotes(k, 'major');
    return [
      mkQ('メジャースケールの音の間隔は？', '全全半全全全半', ['全半全全半全全', '全全全半全全半', '半全全全半全全'], '3番目と4番目、7番目と8番目の間だけが半音です。'),
      mkQ(`${k} メジャースケールの ${n}番目の音は？`, ns[n - 1], shuffle(ns.filter((_, i) => i !== n - 1)), `${k} メジャー：${ns.join(' ')}`),
      mkQ('G メジャースケールで ♯ がつく音は？', 'F♯', ['C♯', 'G♯', 'B♭'], 'G A B C D E F♯。最後の「全・半」を守るために F が F♯ になります。'),
      mkQ('メジャースケールは何種類の音でできている？', '7音', ['5音', '8音', '12音'], 'ドレミファソラシの7音。8番目は最初と同じ名前の音です。'),
      mkQ('スケールの「始まりの音」を何という？', 'キー（調）の主音', ['テンポ', '拍子', 'コード'], '「キー C」は C から始まるスケールを使う、という意味です。'),
    ];
  },
};

// ---------- 音程 ----------
function IntervalBody() {
  const [root, setRoot] = useState<string>('C');
  const [iv, setIv] = useState(0);
  const r = rootMidi(root);
  const marks: KeyMarks = { [r]: { fill: C_ROOT, label: root } };
  if (iv) marks[r + iv] = { fill: C_TONE, label: intervalUp(root, iv) };
  const choose = (i: number): void => {
    const t = ac().currentTime + 0.02;
    pluckMidi(r, t, 0.5);
    pluckMidi(r + i, t + 0.55, 0.5);
    setIv(i);
  };
  return (
    <>
      <p>2つの音の距離を<b>音程（インターバル）</b>といい、「◯度」という単位で数えます。同じ音が1度、となりの音名が2度、その次が3度…という数え方です。</p>
      <p>C から E は「C・D・E」と3つ数えるので<b>3度</b>。ただし3度には広い（半音4つ＝<b>長3度</b>）と狭い（半音3つ＝<b>短3度</b>）があります。この違いが、あとで出てくるメジャーとマイナーの違いになります。</p>
      <div className="row">
        <label className="muted">基準の音 <Select value={root} onChange={(v) => { setRoot(v); setIv(0); }} options={keyOpts(EASY_KEYS)} /></label>
      </div>
      <div className="answers small">
        {T_IV.slice(1).map((x, i) => (
          <button key={i} onClick={() => choose(i + 1)}>{x[0]}</button>
        ))}
      </div>
      <Keyboard marks={marks} onTap={tapKey} />
      <Readout testId="iv-out">{iv ? `${root} → ${intervalUp(root, iv)}：${T_IV[iv][0]}（半音${iv}つ）` : '音程のボタンをタップ'}</Readout>
      <p>特に大事なのは次の3つです。</p>
      <Tbl items={[['長3度', '半音4つ・明るい'], ['短3度', '半音3つ・暗い'], ['完全5度', '半音7つ・安定']]} />
      <Point>音程＝2音の距離／長3度は半音4つ、短3度は3つ、完全5度は7つ</Point>
      <div className="row"><button onClick={() => gotoTrain('interval')}>👂 音程当てで耳を鍛える →</button></div>
    </>
  );
}
const interval: Lesson = {
  id: 'interval', title: '音程（度数）', sub: '2つの音の距離に名前をつける', Body: IntervalBody,
  quiz() {
    const r = pick(EASY_KEYS);
    const r2 = pick(EASY_KEYS);
    const i = pick([3, 4, 5, 7]);
    return [
      mkQ(`${r} の長3度上の音は？`, intervalUp(r, 4), [intervalUp(r, 3), intervalUp(r, 5), intervalUp(r, 7), intervalUp(r, 2)], '長3度は半音4つ分です。'),
      mkQ(`${r2} の完全5度上の音は？`, intervalUp(r2, 7), [intervalUp(r2, 5), intervalUp(r2, 4), intervalUp(r2, 9), intervalUp(r2, 8)], '完全5度は半音7つ分です。'),
      mkQ(`${T_IV[i][0]}は、半音いくつ分？`, i + 'つ', ['2つ', '3つ', '4つ', '5つ', '7つ', '6つ'], '短3度＝3、長3度＝4、完全4度＝5、完全5度＝7。'),
      mkQ('長3度と短3度、明るく聞こえるのは？', '長3度', ['短3度', 'どちらも同じ', '完全5度'], '広い長3度は明るく、狭い短3度は暗く聞こえます。'),
      mkQ('C から E までの音程は？', '長3度', ['短3度', '完全4度', '長2度'], 'C・D・E と数えて3度。半音4つなので長3度です。'),
    ];
  },
};

// ---------- コードのしくみ ----------
const DEG = ['ルート', '3度', '5度', '7度'];
function ChordBody() {
  const [root, setRoot] = useState<string>('C');
  const [ty, setTy] = useState<ChordType>('M');
  const [cmp, setCmp] = useState<ChordType | null>(null); // 聞き比べ中に表示する種類
  const shown = cmp ?? ty;
  const c = T_CHORD[shown];
  const ns = chordNotes(root, shown);
  const r = rootMidi(root);
  const marks: KeyMarks = {};
  c.iv.forEach((s, i) => (marks[r + s] = { fill: i === 0 ? C_ROOT : C_TONE, label: ns[i] }));
  const name = root + c.sym;
  // 1音ずつ → まとめてジャーン
  const sound = (t: ChordType, at: number): void => {
    T_CHORD[t].iv.forEach((s, i) => pluckMidi(r + s, at + i * 0.3, 0.45));
    playChord(root, t, at + T_CHORD[t].iv.length * 0.3 + 0.2);
  };
  return (
    <>
      <p><b>コード（和音）</b>は、複数の音を同時に鳴らしたものです。基本の作り方はとてもシンプルで、スケールの音を<b>1つ飛ばしに3つ</b>重ねるだけ。</p>
      <p>C から「C・<s>D</s>・E・<s>F</s>・G」と取ると <b>C・E・G</b>。これが C コードです。土台の音を<b>ルート</b>、そこから<b>3度</b>、<b>5度</b>の音と呼びます。</p>
      <Tbl items={[['メジャー', 'ルート＋長3度＋完全5度'], ['マイナー', 'ルート＋短3度＋完全5度']]} />
      <p>違いは<b>3度の音が半音違うだけ</b>。それだけで明るい・暗いが変わります。聞き比べてみましょう。</p>
      <div className="row">
        <Select value={root} onChange={(v) => { Seq.stop(); setRoot(v); }} options={keyOpts()} testId="chord-root" />
        <Select className="grow" value={ty} onChange={(v) => { Seq.stop(); setTy(v); }} options={(Object.keys(T_CHORD) as ChordType[]).map((k) => [k, T_CHORD[k].jp] as const)} testId="chord-type" />
      </div>
      <Readout testId="chord-out">
        <b>{name}</b>（{c.jp}）＝{' '}
        {ns.map((n, i) => (
          <span key={i}>{i > 0 && ' ・ '}{n}<small>{DEG[i]}</small></span>
        ))}
        <br />
        <small>{c.f}</small>
      </Readout>
      <Keyboard marks={marks} onTap={tapKey} />
      <div className="row">
        <button className="primary" onClick={() => sound(ty, ac().currentTime + 0.02)}>▶ 鳴らす</button>
        <PlayButton id="l-cmp" className="" label="▶ メジャー／マイナー聞き比べ" make={() => ({ n: 2, len: 2.6, fn: (i, t) => sound(i ? 'm' : 'M', t), ui: (i) => setCmp(i ? 'm' : 'M'), onStop: () => setCmp(null) })} />
      </div>
      {hasChord(name) && (
        <div style={{ textAlign: 'center' }}>
          <p className="muted" style={{ margin: '8px 0 0' }}>ギターではこう押さえます</p>
          <ChordDiagram name={name} w={120} />
        </div>
      )}
      <p>ギターのコードフォームは6本の弦を押さえますが、鳴っているのはこの3種類の音（の重複）だけです。たとえば C のフォームは 5弦から C・E・G・C・E。</p>
      <p>3つの音にもう1つ（7度）を足したのが <b>セブンス系</b>のコード。少し複雑でおしゃれな響きになります。</p>
      <Point>コード＝ルート・3度・5度／3度が長いとメジャー、短いとマイナー</Point>
      <div className="row"><button onClick={() => gotoTrain('chordear')}>🎧 コード当てで聞き分ける →</button></div>
    </>
  );
}
const chord: Lesson = {
  id: 'chord', title: 'コードのしくみ', sub: '1つ飛ばしに3つ重ねる', Body: ChordBody,
  quiz() {
    const r = pick(EASY_KEYS);
    const ty: ChordType = pick(['M', 'm']);
    const r2 = pick(['A', 'D', 'E']);
    const j = (root: string, t: ChordType): string => chordNotes(root, t).join('・');
    return [
      mkQ(`${r}${T_CHORD[ty].sym} の構成音は？`, j(r, ty), [j(r, ty === 'M' ? 'm' : 'M'), j(r, 'dim'), scaleNotes(r, 'major').slice(0, 3).join('・')], `${T_CHORD[ty].jp}＝${T_CHORD[ty].f}`),
      mkQ('メジャーコードとマイナーコードの違いを決めている音は？', '3度の音', ['ルート', '5度の音', 'いちばん高い音'], '3度が半音違うだけで、明るい・暗いが変わります。'),
      mkQ('メジャーコードをマイナーコードにするには？', '3度を半音下げる', ['ルートを半音下げる', '5度を半音上げる', '3度を半音上げる'], '長3度（半音4つ）→ 短3度（半音3つ）にします。'),
      mkQ(`${r2}m の「3度の音」は？`, chordNotes(r2, 'm')[1], [chordNotes(r2, 'M')[1], chordNotes(r2, 'm')[2], spell(r2, 2, 1)], `${r2}m ＝ ${j(r2, 'm')}`),
      mkQ('C コードのフォームで鳴っている音の種類は？', 'C・E・G の3種類', ['6種類ぜんぶ違う音', 'C だけ', 'C・D・E・F・G'], '6本の弦で鳴らしても、音の種類は3つ。同じ音が重なっています。'),
    ];
  },
};

// ---------- ダイアトニックコード ----------
function DiatonicBody() {
  const [key, setKey] = useState('C');
  const [cur, setCur] = useState(-1);
  const d = diatonic(key);
  return (
    <>
      <p>メジャースケールの7音それぞれをルートにして、スケールの音だけで「1つ飛ばし」にコードを作ると、<b>7つのコード</b>ができます。これを<b>ダイアトニックコード</b>といい、そのキーの曲はほぼこの7つでできています。</p>
      <p>順番を<b>ローマ数字</b>で表します。大文字がメジャー、小文字がマイナーです。タップして聞いてみましょう。</p>
      <div className="row">
        <label className="muted">キー <Select value={key} onChange={(k) => { Seq.stop(); setKey(k); }} options={keyOpts()} testId="dia-key" /></label>
        <PlayButton id="l-dia" label="▶ 順番に鳴らす" make={() => ({ n: 8, len: 0.9, fn: (i, t) => playChord(d[i % 7].root, d[i % 7].ty, t), ui: (i) => setCur(i % 7), onStop: () => setCur(-1) })} />
      </div>
      <div className="dia7" data-testid="dia7">
        {d.map((c, i) => (
          <button key={i} className={`${c.fn}${i === cur ? ' cur' : ''}`} onClick={() => playChord(c.root, c.ty)}>
            <small>{c.roman}</small>
            <b>{c.name}</b>
          </button>
        ))}
      </div>
      <p>どのキーでも <b>I・IV・V がメジャー</b>、<b>ii・iii・vi がマイナー</b>という並びは同じです。そしてコードには役割があります。</p>
      <Tbl
        className="fn"
        items={[
          ['トニック', <>I（と vi・iii）<br />落ち着く「家」</>, 'T'],
          ['サブドミナント', <>IV（と ii）<br />少し出かける</>, 'S'],
          ['ドミナント', <>V<br />家に帰りたくなる</>, 'D'],
        ]}
      />
      <p>I・IV・V の3つは<b>スリーコード</b>と呼ばれ、これだけで弾ける曲がたくさんあります。キー G なら G・C・D、キー C なら C・F・G です。</p>
      <Point>キーごとに使えるコードは7つ／I・IV・V はメジャー、ii・iii・vi はマイナー／V → I で落ち着く</Point>
    </>
  );
}
const three = (key: string): string => {
  const x = diatonic(key);
  return [x[0], x[3], x[4]].map((c) => c.name).join('・');
};
const dia: Lesson = {
  id: 'diatonic', title: 'キーとダイアトニックコード', sub: 'そのキーで使える7つのコード', Body: DiatonicBody,
  quiz() {
    const k = pick(EASY_KEYS);
    const i = pick([1, 3, 4, 5]);
    const d = diatonic(k);
    const k2 = pick(['C', 'G', 'D', 'A']);
    return [
      mkQ(`キー ${k} の ${ROMAN[i]} のコードは？`, d[i].name, shuffle(d.filter((_, j) => j !== i).map((c) => c.name)), `キー ${k}：${d.map((c) => c.name).join(' ')}`),
      mkQ('メジャーキーで、マイナーコードになるのは何番目？', 'ii・iii・vi', ['I・IV・V', 'ii・IV・vi', 'iii・V・vii'], 'I・IV・V がメジャー、ii・iii・vi がマイナーです。'),
      mkQ('いちばん落ち着く「家」のようなコードは？', 'I（トニック）', ['V（ドミナント）', 'IV（サブドミナント）', 'vii°'], '曲の最後はたいてい I で終わります。'),
      mkQ('I に戻りたくなる、緊張感のあるコードは？', 'V（ドミナント）', ['I（トニック）', 'vi', 'iii'], 'V → I の動きは音楽でいちばん強い「解決」です。'),
      mkQ(`キー ${k2} のスリーコード（I・IV・V）は？`, three(k2), EASY_KEYS.filter((x) => x !== k2).map(three), 'スケールの1番目・4番目・5番目の音がルートになります。'),
    ];
  },
};

// ---------- コード進行 ----------
function ProgBody() {
  const m = useMetro();
  const [key, setKey] = useState('G');
  const [pi, setPi] = useState(0);
  const [cur, setCur] = useState(-1);
  const cs = progChords(key, PROGS[pi]);
  const names = [...new Set(cs.map((c) => c.name))];
  const have = names.filter(hasChord);
  const practice = (): void => {
    setShared('selChords', have);
    gotoTab('chord');
  };
  return (
    <>
      <p>コードを並べたものが<b>コード進行</b>です。前回のローマ数字で書くと、キーが変わっても同じ進行として覚えられます。世の中の曲は、いくつかの<b>定番の進行</b>の組み合わせでできています。</p>
      <div className="row">
        <label className="muted">キー <Select value={key} onChange={(k) => { Seq.stop(); setKey(k); }} options={keyOpts()} testId="prog-key" /></label>
        <Select className="grow" value={pi} onChange={(v) => { Seq.stop(); setPi(v); }} options={PROGS.map((p, i) => [i, p.name] as const)} testId="prog-sel" />
      </div>
      <div className="progrow" data-testid="prog-row">
        {cs.map((c, i) => (
          <div key={i} className={i === cur ? 'cur' : ''}>
            <small>{c.roman}</small>
            <b>{c.name}</b>
          </div>
        ))}
      </div>
      <div className="row">
        <PlayButton
          id="l-prog"
          label="▶ ループ再生"
          make={() => {
            const beat = 60 / Metro.get().bpm;
            return {
              n: cs.length, len: beat * 4, loop: true,
              fn: (i, t) => {
                [0, 2, 3].forEach((b) => playChord(cs[i].root, cs[i].ty, t + b * beat));
                playChord(cs[i].root, cs[i].ty, t + 3.5 * beat, true);
              },
              ui: setCur,
              onStop: () => setCur(-1),
            };
          }}
        />
        <span className="muted">BPM {m.bpm}</span>
        <span className="grow" />
        <button onClick={practice} disabled={have.length < 2} data-testid="prog-practice">🎼 この進行で練習 →</button>
      </div>
      <p className="muted" style={{ margin: '6px 0 0' }}>
        {have.length === names.length ? 'すべてコード表にあるフォームで弾けます。' : `コード表にあるのは ${have.join('・') || 'なし'}。ほかは構成音で鳴らしています（キー G・C・A・E が弾きやすいです）。`}
      </p>
      <p>聞きながら「家（I）から出かけて、V で帰りたくなり、I に戻る」という流れを感じてみてください。キーを変えても、流れの印象は同じはずです。</p>
      <p>初心者には <b>キー G</b>（G・C・D・Em）と <b>キー C</b>（C・F・G・Am）がおすすめ。F は少し難しいので、最初は Fmaj7 で代用してもOKです。</p>
      <Point>進行はローマ数字で覚える／I–V–vi–IV はポップスの大定番／キーを変えるのは同じ進行の高さを変えるだけ</Point>
    </>
  );
}
const prog: Lesson = {
  id: 'prog', title: 'コード進行', sub: '定番の流れを覚えて曲を弾く', Body: ProgBody,
  quiz() {
    const k = pick(['C', 'G', 'D', 'A']);
    const d = diatonic(k);
    const nm = (idx: number[]): string => idx.map((i) => d[i].name).join(' – ');
    return [
      mkQ(`キー ${k} で「I – V – vi – IV」を弾くと？`, nm([0, 4, 5, 3]), [nm([0, 3, 4, 0]), nm([0, 5, 3, 4]), nm([0, 4, 3, 5])], `キー ${k}：I=${d[0].name}、IV=${d[3].name}、V=${d[4].name}、vi=${d[5].name}`),
      mkQ(`キー ${k} で「I – IV – V」を弾くと？`, nm([0, 3, 4]), [nm([0, 4, 3]), nm([0, 1, 2]), nm([0, 5, 4])], 'スケールの1・4・5番目がルートのメジャーコードです。'),
      mkQ('コード進行をローマ数字で覚える利点は？', 'キーが変わっても同じ進行として使える', ['指が速く動くようになる', 'チューニングが要らなくなる', 'コードが3つで済む'], '「I–V–vi–IV」と覚えれば、どのキーでも弾けます。'),
      mkQ('曲の終わりで「終わった感じ」が強く出る動きは？', 'V → I', ['I → V', 'I → vi', 'IV → V'], 'ドミナント（V）からトニック（I）へ戻ると、落ち着いて終わります。'),
      mkQ('「I – V – vi – IV」の vi はどんなコード？', 'マイナーコード', ['メジャーコード', 'セブンスコード', 'ディミニッシュ'], '小文字のローマ数字はマイナーです。'),
    ];
  },
};

// ---------- マイナーキーと平行調 ----------
function MinorBody() {
  const [key, setKey] = useState('C');
  const [mode, setMode] = useState<'major' | 'minor'>('major');
  const [cur, setCur] = useState(-1);
  const rel = scaleNotes(key, 'major')[5];
  const root = mode === 'minor' ? rel : key;
  const ns = [...scaleNotes(root, mode), root];
  const ms = [...T_SCALE[mode].iv, 12].map((s) => rootMidi(root) + s);
  const marks: KeyMarks = {};
  ms.forEach((mm, i) => (marks[mm] = { fill: i === cur ? C_HIT : i % 7 === 0 ? C_ROOT : C_TONE, label: ns[i] }));
  const seq = (md: 'major' | 'minor') => () => {
    const r = rootMidi(md === 'minor' ? rel : key);
    const notes = [...T_SCALE[md].iv, 12].map((s) => r + s);
    setMode(md);
    return { n: 8, len: 0.42, fn: (i: number, t: number) => pluckMidi(notes[i], t, 0.5), ui: setCur, onStop: () => setCur(-1) };
  };
  return (
    <>
      <p>メジャースケールの<b>6番目の音から</b>同じ音を並べ直すと、暗く切ない響きの<b>マイナースケール</b>になります。</p>
      <p>C メジャー（C D E F G A B）を A から始めると A B C D E F G ＝ <b>A マイナースケール</b>。使う音はまったく同じで、「家」になる音が違うだけです。この関係を<b>平行調</b>といいます。</p>
      <div className="row">
        <label className="muted">メジャーキー <Select value={key} onChange={(k) => { Seq.stop(); setKey(k); setMode('major'); }} options={keyOpts()} testId="minor-key" /></label>
      </div>
      <Readout testId="minor-out">
        <b>{key} メジャー</b>：{scaleNotes(key, 'major').join(' ')}
        <br />
        <b>{rel} マイナー</b>：{scaleNotes(rel, 'minor').join(' ')}
      </Readout>
      <Keyboard marks={marks} onTap={tapKey} />
      <div className="row">
        <PlayButton id="l-maj" label="▶ メジャー" make={seq('major')} />
        <PlayButton id="l-min" label="▶ 平行マイナー" make={seq('minor')} />
      </div>
      <p>マイナースケールの間隔は「全・半・全・全・半・全・全」。メジャーとの大きな違いは <b>3番目の音が半音低い</b>（短3度）ことです。コードのメジャー／マイナーと同じ理屈ですね。</p>
      <p>だから、キー C の曲とキー Am の曲は<b>同じ7つのコード</b>を使います。Am から始めて Am で終わると、同じコードでも切ない曲になります。</p>
      <Point>メジャーの6番目から始めるとマイナー／C と Am、G と Em は同じ音を使う平行調</Point>
    </>
  );
}
const minor: Lesson = {
  id: 'minor', title: 'マイナーキーと平行調', sub: '同じ音なのに暗く聞こえる理由', Body: MinorBody,
  quiz() {
    const k = pick(EASY_KEYS);
    const sc = scaleNotes(k, 'major');
    return [
      mkQ(`${k} メジャーの平行調（同じ音を使うマイナーキー）は？`, sc[5] + 'm', [k + 'm', sc[1] + 'm', sc[2] + 'm', sc[4] + 'm'], 'メジャースケールの6番目の音がルートになります。'),
      mkQ('平行マイナーの始まりの音は、メジャースケールの何番目？', '6番目', ['2番目', '3番目', '5番目'], 'C メジャーなら6番目は A → A マイナーです。'),
      mkQ('ナチュラルマイナースケールの間隔は？', '全半全全半全全', ['全全半全全全半', '全半全全全半全', '半全全半全全全'], 'メジャーの間隔を6番目から読み直したものです。'),
      mkQ('A マイナースケールに ♯ や ♭ はつく？', 'つかない（C メジャーと同じ音）', ['F♯ がつく', 'B♭ がつく', 'C♯ がつく'], 'A B C D E F G。C メジャーと同じ白い鍵盤だけです。'),
      mkQ('メジャースケールとマイナースケールで、響きの違いを決める音は？', '3番目の音', ['1番目の音', '4番目の音', '5番目の音'], 'マイナーは3番目が半音低い（短3度）ので暗く聞こえます。'),
    ];
  },
};

export const THEORY: Lesson[] = [major, interval, chord, dia, prog, minor];
