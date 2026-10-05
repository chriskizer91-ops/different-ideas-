// A soft chime and a buzz for the watering timer, and keeping the screen on
// while it runs. All of it fails quietly where the browser doesn't allow it.

let ctx = null;
let lock = null;

// Browsers only allow sound after a tap, so this is called from the Start button.
export function unlockSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  } catch {}
}

export function chime(times = 2) {
  try {
    if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
  } catch {}
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = t0 + i * 0.32;
      o.type = 'sine';
      o.frequency.value = i % 2 ? 784 : 1047;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.32);
    }
  } catch {}
}

export async function keepAwake(on) {
  try {
    if (on && !lock && navigator.wakeLock) lock = await navigator.wakeLock.request('screen');
    else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {}
}
