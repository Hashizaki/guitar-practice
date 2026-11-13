import { useRef } from 'react';
import { Check, Dots, Select } from '../components/common';
import { Metro, useMetro } from '../lib/metronome';

export function MetronomeTab() {
  const m = useMetro();
  const taps = useRef<number[]>([]);
  // タップテンポ：直近4回の間隔の平均。2.5秒あくとリセット
  const tap = (): void => {
    const now = performance.now();
    taps.current = taps.current.filter((t) => now - t < 2500);
    taps.current.push(now);
    const ts = taps.current;
    if (ts.length >= 2) {
      const iv = ts.slice(1).map((t, i) => t - ts[i]).slice(-4);
      Metro.setBpm(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length));
    }
  };
  const on = m.running && m.mode === 'metro';
  return (
    <>
      <div className="card">
        <div className="bpm">
          <span data-testid="bpm">{m.bpm}</span>
          <small>BPM</small>
        </div>
        <Dots />
        <div className="row" style={{ marginBottom: 10 }}>
          <button onClick={() => Metro.setBpm(m.bpm - 5)}>−5</button>
          <button onClick={() => Metro.setBpm(m.bpm - 1)}>−1</button>
          <input className="grow" type="range" min="30" max="240" value={m.bpm} onChange={(e) => Metro.setBpm(Number(e.target.value))} aria-label="BPM" />
          <button onClick={() => Metro.setBpm(m.bpm + 1)}>+1</button>
          <button onClick={() => Metro.setBpm(m.bpm + 5)}>+5</button>
        </div>
        <div className="row" style={{ marginBottom: 14 }}>
          <label className="muted">
            拍子 <Select value={m.beats} onChange={Metro.setBeats} options={[[2, '2'], [3, '3'], [4, '4'], [6, '6']]} />
          </label>
          <label className="muted">
            刻み <Select value={m.sub} onChange={Metro.setSub} options={[[1, '4分'], [2, '8分'], [3, '3連'], [4, '16分']]} testId="metro-sub" />
          </label>
          <Check checked={m.accent} onChange={Metro.setAccent}>1拍目を強調</Check>
          <span className="grow" />
          <button onPointerDown={(e) => { e.preventDefault(); tap(); }} data-testid="tap-tempo">タップ</button>
        </div>
        <button className={`primary bigbtn${on ? ' on' : ''}`} onClick={() => (m.running ? Metro.stop() : Metro.start('metro'))} data-testid="metro-btn">
          {m.running ? '■ ストップ' : '▶ スタート'}
        </button>
      </div>
      <div className="card">
        <h2>テンポアップ練習</h2>
        <p className="muted" style={{ margin: '0 0 10px' }}>指定した小節ごとにBPMを少しずつ上げます。速いフレーズを無理なく体に入れる練習に。</p>
        <div className="row">
          <Check checked={m.rampOn} onChange={(v) => Metro.setRamp({ rampOn: v })}>オン</Check>
          <Select value={m.rampBars} onChange={(v) => Metro.setRamp({ rampBars: v })} options={[[2, '2小節ごとに'], [4, '4小節ごとに'], [8, '8小節ごとに']]} />
          <Select value={m.rampStep} onChange={(v) => Metro.setRamp({ rampStep: v })} options={[[2, '+2'], [5, '+5'], [10, '+10']]} />
        </div>
      </div>
    </>
  );
}
