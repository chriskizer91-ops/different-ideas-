import { Snowflake, ThermometerSun, ThermometerSnowflake } from './icons.js';
import { fmt } from '../lib/units.js';
import { alertWhen, alertDayLabel, routineLine, listWords } from './text.js';
import { COLD_AT, HEAT_AT } from '../model/alerts.js';

function Pips({ level, kind }) {
  return (
    <span class="pips" aria-hidden="true">
      {[1, 2, 3, 4].map((l) => (
        <span key={l} class={`pip ${l <= level ? `on ${kind}-${l}` : ''}`} />
      ))}
    </span>
  );
}

function Ladder({ kind, units, extremeAt }) {
  const t = (c) => fmt.tempUnit(c, units);
  const rows =
    kind === 'cold'
      ? [
          ['Frost', `${t(COLD_AT.frost)} or colder`],
          ['Freeze', t(COLD_AT.freeze)],
          ['Hard freeze', t(COLD_AT.hard)],
          ['Extreme cold', `${t(extremeAt)}${extremeAt > COLD_AT.extreme + 0.1 || extremeAt < COLD_AT.extreme - 0.1 ? ', rare here' : ''}`],
        ]
      : [
          ['Hot', t(HEAT_AT.hot)],
          ['Very hot or heat wave', t(HEAT_AT.veryHot)],
          ['Extreme heat', t(HEAT_AT.extreme)],
          ['Extreme heat wave', `${t(HEAT_AT.extreme)}, 3+ days`],
        ];
  return (
    <ol class="ladder">
      {rows.map(([name, at], i) => (
        <li key={name}>
          <span class={`pip on ${kind}-${i + 1}`} aria-hidden="true" />
          <span>{name}</span>
          <span class="muted">{at}</span>
        </li>
      ))}
    </ol>
  );
}

export function AlertCard({ a, today, units, onPick }) {
  const Icon = a.kind === 'cold' ? (a.level >= 3 ? ThermometerSnowflake : Snowflake) : ThermometerSun;
  if (a.routine) {
    return (
      <p class={`alert-quiet ${a.kind}-${a.level}`}>
        <Icon size={16} aria-hidden="true" />
        <span>{routineLine(a, today, units)}</span>
      </p>
    );
  }
  const tags = [];
  if (a.first) tags.push(a.kind === 'cold' ? 'First of the season' : 'First of the year');
  if (a.late) tags.push('Late frost: new growth is tender');
  if (a.peak.clearCalm && a.kind === 'cold') tags.push('Clear, calm night');
  return (
    <section class={`alert ${a.kind}-${a.level}`} aria-label={`${a.name} ${a.severity.toLowerCase()}`}>
      <div class="alert-top">
        <span class="alert-icon">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span class="alert-title">
          <span class="alert-name display">{a.name}</span>
          <span class="alert-sev">{a.severity}</span>
        </span>
        <Pips level={a.level} kind={a.kind} />
      </div>
      <p class="alert-when">{alertWhen(a, today, units)}</p>
      {tags.length > 0 && (
        <div class="tags">
          {tags.map((t) => (
            <span key={t} class="tag">
              {t}
            </span>
          ))}
        </div>
      )}
      {a.days.length > 1 && (
        <div class="alert-days">
          {a.days.map((d) => (
            <span key={d.date} class={`alert-day ${a.kind}-${d.level}`}>
              {alertDayLabel(a, d, today)} <strong>{fmt.temp(d.value, units)}</strong>
            </span>
          ))}
        </div>
      )}
      <p class="alert-action">{a.action}</p>
      {a.waterFirst.length > 0 && (
        <p class="alert-water">
          {a.kind === 'cold'
            ? `${listWords(a.waterFirst.map((b) => b.name))} ${a.waterFirst.length > 1 ? 'are' : 'is'} on the dry side. Water today, before the freeze: moist soil holds more heat than dry soil.`
            : `${listWords(a.waterFirst.map((b) => b.name))} ${a.waterFirst.length > 1 ? 'are' : 'is'} on the dry side. Water deeply today, before the heat.`}
        </p>
      )}
      {a.atRisk.length > 0 && (
        <ul class="risk">
          {a.atRisk.map((r) => (
            <li key={r.id}>
              <button class="link" onClick={() => onPick(r.id)}>
                {r.name}
              </button>
              : {r.tip}
            </li>
          ))}
        </ul>
      )}
      <details class="ladder-wrap">
        <summary>How the {a.kind === 'cold' ? 'cold' : 'heat'} levels work</summary>
        <Ladder kind={a.kind} units={units} extremeAt={a.extremeAt} />
        <p class="muted xs">
          {a.kind === 'cold'
            ? 'Levels follow the night’s lowest air temperature. Frost can form a few degrees above freezing on clear, calm nights, so those count as frost nights sooner. Extreme cold adapts to your area once three years of records load.'
            : 'Levels follow the day’s high. Three or more hot days in a row count as a heat wave, one level higher.'}
        </p>
      </details>
    </section>
  );
}

export function Alerts({ alerts, today, units, onPick }) {
  if (!alerts.length) return null;
  return (
    <div class="alerts" aria-live="polite">
      {alerts.map((a) => (
        <AlertCard key={a.kind} a={a} today={today} units={units} onPick={onPick} />
      ))}
    </div>
  );
}
