import { Gauge } from './Gauge.jsx';
import { BedDetails } from './BedDetails.jsx';
import { LogToggle } from './controls.jsx';
import { ChevronDown, Droplets, Sprout, Snowflake, Sun, iconFor } from './icons.js';
import { bedLine, statusText, feedText } from './text.js';

const TONE_ICON = { water: Droplets };

export function BedCard({ row, days, T, units, open, onToggle, onUpdate, onLog, onRemove, onShowChart, alerts }) {
  const { bed, sim, feed } = row;
  const today = days[T].date;
  const Icon = iconFor(bed);
  const st = statusText(sim, bed, days, T, units);
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
    sim.twice && (st.tone === 'water' || st.tone === 'done')
      ? st.tone === 'done'
        ? 'On a day this hot it can dry out again within hours, so check it again this afternoon.'
        : 'On a day this hot it can dry out within hours, so check it again this afternoon.'
      : null;

  return (
    <article class="card">
      <div class="card-main">
        <Gauge now={sim.moistureNow} tonight={sim.moistureTonight} refillAt={sim.refillAt} pot={sim.model.pot} />
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
              <span>{n.text}</span>
            </p>
          ))}
          <div class="card-actions">
            <LogToggle
              on={sim.wateredToday}
              onClick={() => onLog('waterLog', 'toggle')}
              icon={<Droplets size={15} aria-hidden="true" />}
              label="Log watering"
              onLabel="Watered today"
            />
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
          {sim.wateredToday && sim.twice && sim.moistureNow < sim.refillAt + 5 && (
            <button class="link small" onClick={() => onLog('waterLog', 'again')}>
              Watered it again just now
            </button>
          )}
          {ft && !fed && <p class={`card-line ${ft.strong ? 'warn' : 'muted'}`}>{ft.text}</p>}
        </div>
      </div>
      {open && (
        <BedDetails bed={bed} sim={sim} days={days} T={T} units={units} onUpdate={onUpdate} onLog={onLog} onRemove={onRemove} onShowChart={onShowChart} />
      )}
    </article>
  );
}

