import { useEffect, useRef, useState } from 'react';
import { Check } from '../components/common';
import { ac, pluckMidi } from '../lib/audio';
import { detectPitch, ensureMic, freqToNote, MIC_FAIL, releaseMic } from '../lib/mic';
import { NOTE, OPEN, sharp } from '../lib/theory';

const STR_NAMES = [['E', '6弦'], ['A', '5弦'], ['D', '4弦'], ['G', '3弦'], ['B', '2弦'], ['E', '1弦']];

/** 基準音：弦をタップすると開放弦の音が鳴る */
function ReferenceTones() {
  const [sel, setSel] = useState(-1);
  const [repeat, setRepeat] = useState(false);
  useEffect(() => {
    if (!repeat || sel < 0) return;
    const id = setInterval(() => pluckMidi(OPEN[sel], null, 0.6), 1800);
    return () => clearInterval(id);
  }, [repeat, sel]);
  return (
    <div className="card">
      <h2>基準音で合わせる</h2>
      <p className="muted" style={{ margin: '0 0 10px' }}>弦をタップすると開放弦の音が鳴ります。「くり返し」をオンにすると鳴らし続けます。</p>
      <div className="strings">
        {STR_NAMES.map(([n, label], i) => (
          <button key={i} className={sel === i ? 'sel' : ''} onClick={() => { setSel(i); pluckMidi(OPEN[i], null, 0.6); }}>
            <b>{n}</b>
            <small>{label}</small>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <Check checked={repeat} onChange={setRepeat}>くり返し</Check>
      </div>
    </div>
  );
}

interface Reading { note: string; hz: number; cents: number }

/** マイクで音程を測る */
function MicTuner() {
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState('');
  const [r, setR] = useState<Reading | null>(null);
  const an = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!on || !an.current) return;
    const analyser = an.current;
    const buf = new Float32Array(analyser.fftSize);
    let raf = 0;
    let last = 0;
    const loop = (t: number): void => {
      if (t - last > 90) {
        last = t;
        analyser.getFloatTimeDomainData(buf);
        const f = detectPitch(buf.subarray(0, 3072), ac().sampleRate);
        if (f > 0) {
          const { nearest, cents } = freqToNote(f);
          setR({ note: sharp(NOTE[((nearest % 12) + 12) % 12]) + (Math.floor(nearest / 12) - 1), hz: f, cents });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      releaseMic('tuner');
    };
  }, [on]);

  const toggle = async (): Promise<void> => {
    if (on) {
      setOn(false);
      setR(null);
      return;
    }
    try {
      an.current = await ensureMic('tuner');
      setMsg('弦を1本ずつ鳴らしてください。');
      setOn(true);
    } catch {
      setMsg(MIC_FAIL + ' それまでは上の「基準音で合わせる」を使ってください。');
    }
  };
  const good = r !== null && Math.abs(r.cents) <= 5;
  return (
    <div className="card">
      <h2>マイクで測る</h2>
      <div className="tnote" data-testid="tuner-note">{r ? r.note : '—'}</div>
      <div className="meter">
        <div className="center" />
        <div className={`needle${good ? ' good' : ''}`} style={{ left: `${50 + Math.max(-50, Math.min(50, r?.cents ?? 0))}%` }} />
      </div>
      <div className="tsub">
        {r
          ? `${r.hz.toFixed(1)} Hz ／ ${r.cents > 0 ? '+' : ''}${r.cents}¢ ${good ? '✓ OK' : r.cents < 0 ? '（低い：締める）' : '（高い：ゆるめる）'}`
          : '−50¢ ← → +50¢'}
      </div>
      <button className={`primary bigbtn${on ? ' on' : ''}`} style={{ marginTop: 10 }} onClick={() => void toggle()} data-testid="mic-btn">
        {on ? '■ マイクをオフ' : '🎤 マイクをオン'}
      </button>
      <p className="muted" style={{ margin: '8px 0 0' }}>{msg}</p>
    </div>
  );
}

export function TunerTab() {
  return (
    <>
      <ReferenceTones />
      <MicTuner />
    </>
  );
}
