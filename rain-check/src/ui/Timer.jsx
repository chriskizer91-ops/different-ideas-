// The watering timer: runs, with rests between for cycle and soak, then logs
// the watering by itself. Stopping early logs only what went on.

import { CircleStop, Check, Timer as TimerIcon } from './icons.js';

const PHASE_WORDS = {
  sprinkler: ['Sprinkler on', 'Sprinkler off, soaking in'],
  hose: ['Hose on', 'Resting'],
  soaker: ['Soaker hose on', 'Soaker off, soaking in'],
  drip: ['Drip on', 'Drip off'],
};

// Where a timer is: which step, time left in it, and how much running is done.
export function timerState(t, now) {
  const elapsed = Math.max(0, now - t.startedAt);
  let acc = 0;
  let ran = 0;
  for (let k = 0; k < t.phases.length; k++) {
    const p = t.phases[k];
    if (elapsed < acc + p.ms) {
      const into = elapsed - acc;
      return { k, phase: p, left: p.ms - into, ran: ran + (p.kind === 'run' ? into : 0), done: false, elapsed };
    }
    acc += p.ms;
    if (p.kind === 'run') ran += p.ms;
  }
  return { k: t.phases.length, phase: null, left: 0, ran, done: true, elapsed };
}

export const totalRun = (t) => t.phases.filter((p) => p.kind === 'run').reduce((a, p) => a + p.ms, 0);
const totalMs = (t) => t.phases.reduce((a, p) => a + p.ms, 0);

export function clockMs(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

function phaseLabel(t, st) {
  const words = PHASE_WORDS[t.method] || PHASE_WORDS.hose;
  const runs = t.phases.filter((p) => p.kind === 'run').length;
  const runNo = t.phases.slice(0, st.k + 1).filter((p) => p.kind === 'run').length;
  const label = st.phase.kind === 'run' ? words[0] : words[1];
  return runs > 1 ? `${label} · run ${runNo} of ${runs}` : label;
}

export function TimerPanel({ t, now, onDone, onStop }) {
  const st = timerState(t, now);
  if (st.done) return null;
  const pct = Math.min(100, ((now - t.startedAt) / totalMs(t)) * 100);
  const soak = st.phase.kind === 'soak';
  return (
    <div class={`timer${soak ? ' soaking' : ''}`} role="timer" aria-live="off">
      <div class="timer-top">
        <TimerIcon size={16} aria-hidden="true" />
        <span class="timer-phase">{phaseLabel(t, st)}</span>
        <span class="timer-left display">{clockMs(st.left)}</span>
      </div>
      <div class="timer-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      {soak && <p class="xs">Turn it off and let the water sink in. The timer will chime when it's time for the next run.</p>}
      <div class="timer-actions">
        <button class="pill small" onClick={onDone}>
          <Check size={14} aria-hidden="true" /> Done, log it
        </button>
        <button class="pill small" onClick={onStop}>
          <CircleStop size={14} aria-hidden="true" /> Stop early
        </button>
      </div>
    </div>
  );
}

// A strip pinned to the bottom of the screen while any timer runs.
export function TimerBar({ timers, beds, now, onJump, onStop }) {
  const live = timers.filter((t) => !timerState(t, now).done && beds.some((b) => b.id === t.bedId));
  if (!live.length) return null;
  const t = live[0];
  const st = timerState(t, now);
  const bed = beds.find((b) => b.id === t.bedId);
  return (
    <div class={`timerbar${st.phase.kind === 'soak' ? ' soaking' : ''}`} role="status">
      <button class="timerbar-main" onClick={() => onJump(t.bedId)}>
        <TimerIcon size={16} aria-hidden="true" />
        <span class="truncate">
          {bed.name} · {phaseLabel(t, st)}
        </span>
        <strong class="display">{clockMs(st.left)}</strong>
      </button>
      <button class="timerbar-stop" aria-label={`Stop the timer for ${bed.name}`} onClick={() => onStop(t.bedId)}>
        <CircleStop size={18} aria-hidden="true" />
      </button>
      {live.length > 1 && <span class="timerbar-more">+{live.length - 1}</span>}
    </div>
  );
}
