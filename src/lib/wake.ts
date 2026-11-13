/** 画面スリープ防止（Wake Lock）。使っている機能が1つでもあれば点けたままにする */
const want = new Set<string>();
let lock: WakeLockSentinel | null = null;

async function update(): Promise<void> {
  try {
    if (want.size && document.visibilityState === 'visible' && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => {
        lock = null;
      });
    } else if (!want.size && lock) {
      const l = lock;
      lock = null;
      await l.release();
    }
  } catch {
    lock = null;
  }
}

export function keepAwake(who: string, on: boolean): void {
  if (on) want.add(who);
  else want.delete(who);
  void update();
}

document.addEventListener('visibilitychange', () => void update());
