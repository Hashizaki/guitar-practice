import { useState } from 'react';
import { IS_IOS } from './lib/audio';
import { gotoTab, useTab, type TabName } from './lib/nav';
import { Store } from './lib/store';
import { ChordTab } from './tabs/ChordTab';
import { FretTab } from './tabs/FretTab';
import { LearnTab } from './tabs/LearnTab';
import { MetronomeTab } from './tabs/MetronomeTab';
import { TrainTab } from './tabs/TrainTab';
import { TunerTab } from './tabs/TunerTab';

const TABS: [TabName, string, string][] = [
  ['learn', '📖', '学ぶ'], ['metro', '⏱', 'メトロノーム'], ['tuner', '🎚', 'チューナー'],
  ['chord', '🎼', 'コード'], ['fret', '🎯', '指板'], ['train', '👂', 'トレーニング'],
];

/** iOS で、ホーム画面に追加していない人に一度だけ出す案内 */
function AddToHomeHint() {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
  const [show, setShow] = useState(() => IS_IOS && !standalone && !Store.get('a2hsDismissed', false));
  if (!show) return null;
  return (
    <div className="card a2hs" data-testid="a2hs">
      <p className="muted">
        📱 共有ボタン <b>⬆︎</b> →「<b>ホーム画面に追加</b>」でアプリのように全画面で使えます。オフラインでも動きます。
      </p>
      <button onClick={() => { setShow(false); Store.set('a2hsDismissed', true); }} data-testid="a2hs-close">
        閉じる
      </button>
    </div>
  );
}

export function App() {
  const tab = useTab();
  // すべてのタブを常に置いたまま表示だけ切り替える（タブを移動しても練習の状態を保つため）
  const sec = (name: TabName) => `tab${tab === name ? ' active' : ''}`;
  return (
    <>
      <header>
        <h1>🎸 ギター練習</h1>
        <span>理論レッスン・メトロノーム・チューナー・コード・指板・耳トレ</span>
      </header>
      <main>
        <AddToHomeHint />
        <section className={sec('learn')} id="tab-learn"><LearnTab /></section>
        <section className={sec('metro')} id="tab-metro"><MetronomeTab /></section>
        <section className={sec('tuner')} id="tab-tuner"><TunerTab /></section>
        <section className={sec('chord')} id="tab-chord"><ChordTab /></section>
        <section className={sec('fret')} id="tab-fret"><FretTab /></section>
        <section className={sec('train')} id="tab-train"><TrainTab /></section>
      </main>
      <nav id="nav">
        {TABS.map(([name, ic, label]) => (
          <button key={name} className={tab === name ? 'active' : ''} onClick={() => gotoTab(name)} data-tab={name}>
            <span className="ic">{ic}</span>
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
