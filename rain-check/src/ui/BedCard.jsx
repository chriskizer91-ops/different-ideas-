import { SoilGauge } from './SoilGauge.jsx';
import { BedDetails } from './BedDetails.jsx';
import { LogToggle } from './controls.jsx';
import { TimerPanel } from './Timer.jsx';
import { ChevronDown, Droplets, Sprout, Snowflake, Sun, Timer as TimerIcon, iconFor } from './icons.js';
import { bedLine, statusText, feedText, fillTemps } from './text.js';

const TONE_ICON = { water: Droplets };

export function BedCard({ row, days, T, units, open, onToggle, onUpdate, onLog, onRemove, onShowChart, alerts, timer, now, onStartTimer, onTimerDone, onTimerStop, onOpenProfile }) {
  const { bed, sim, feed, how } = row;
  const today = days[T].date;
  const Icon = iconFor(bed);
  const st = statusText(sim, bed, days, T, units, how);
  const fed = (bed.feedLog || []).includes(today);
  const ft = feed && feed.status !== 'off' ? feedText(feed, today) : null;
  const ToneIcon = TONE_ICON[st.tone];

  // Notes from this week's frost or heat warnings that touch this bed.
  const notes = [];
  for (const a of alerts) {
    if (a.routine) continue;
    const r = a.atRisk.find((x) => x.id === bed.id);
    if (r) notes.push({ kind: a.kind, level: a.level, text: `${a.name}: ${r.tip}` });
  }
  const hot =
    sim.twice && st.tone === 'water' && !sim.again ? 'On a day this hot it can dry out within hours, so check it again this afternoon.' : null;
  const canTime = how.timed && how.minutes > 0 && (sim.status === 'water' || sim.status === 'cold' || sim.status === 'wait');

  return (
    <article class={`card${timer ? ' timing' : ''}`}>
      <div class="card-main">
        <SoilGauge bed={bed} sim={sim} />
        <div class="card-body">
          <button class="card-head" onClick={onToggle} aria-expanded={open}>
            <span class="card-titles">
              <span class="card-name display">
                <Icon size={18} aria-hidden="true" class="leaf-ink" />
                <span class="truncate">{bed.name}</span>
              </span>
              <span class="card-sub">{bedLine(bed, units)}</span>
            </span>
            <ChevronDown size={20} aria-hidden="true" class={`turn${open ? ' turned' : ''}`} />
          </button>
          <div class="card-status">
            <span class={`chip chip-${st.tone}`}>
              {ToneIcon ? <ToneIcon size={15} aria-hidden="true" /> : null}
              {st.chip}
            </span>
          </div>
          <p class="card-line">{st.line}</p>
          {hot && <p class="card-line warn">{hot}</p>}
          {notes.map((n, i) => (
            <p key={i} class={`card-note ${n.kind}-${n.level}`}>
              {n.kind === 'cold' ? <Snowflake size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
              <span>{fillTemps(n.text, units)}</span>
            </p>
          ))}
          {timer ? (
            <TimerPanel t={timer} now={now} onDone={onTimerDone} onStop={onTimerStop} />
          ) : (
            <div class="card-actions">
              {canTime && sim.status === 'water' && (
                <button class="pill pill-go" onClick={onStartTimer}>
                  <TimerIcon size={15} aria-hidden="true" />
                  Timer: {how.cycles ? `${how.cycles.n} × ${Math.max(1, Math.round(how.cycles.runMin))} min` : `${Math.max(1, Math.round(how.minutes))} min`}
                </button>
              )}
              {sim.again ? (
                <button class="pill" onClick={() => onLog('waterLog', 'add-now')}>
                  <Droplets size={15} aria-hidden="true" /> Log another watering
                </button>
              ) : (
                <LogToggle
                  on={sim.wateredToday}
                  onClick={() => onLog('waterLog', 'toggle')}
                  icon={<Droplets size={15} aria-hidden="true" />}
                  label="Log watering"
                  onLabel={sim.waterings > 1 ? `Watered ${sim.waterings}×` : 'Watered today'}
                />
              )}
              {bed.feedEvery > 0 && (
                <LogToggle
                  on={fed}
                  onClick={() => onLog('feedLog', 'toggle')}
                  icon={<Sprout size={15} aria-hidden="true" />}
                  label="Log feeding"
                  onLabel="Fed today"
                />
              )}
            </div>
          )}
          {ft && !fed && <p class={`card-line ${ft.strong ? 'warn' : 'muted'}`}>{ft.text}</p>}
        </div>
      </div>
      {open && (
        <BedDetails
          bed={bed}
          sim={sim}
          days={days}
          T={T}
          units={units}
          onUpdate={onUpdate}
          onLog={onLog}
          onRemove={onRemove}
          onShowChart={onShowChart}
          onOpenProfile={onOpenProfile}
        />
      )}
    </article>
  );
}
