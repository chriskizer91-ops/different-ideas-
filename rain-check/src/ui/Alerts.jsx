import { useState } from 'preact/hooks';
import { Snowflake, ThermometerSun, ThermometerSnowflake } from './icons.js';
import { NightChart, nightHour } from './NightChart.jsx';
import { clockText, partOfMonth } from '../lib/dates.js';
import { fmt } from '../lib/units.js';
import { alertWhen, alertDayLabel, routineLine, listWords, fillTemps } from './text.js';
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

// The words under a night's chart: how long, how cold, when to cover and uncover.
function nightWords(detail, units, sunset) {
  const t = (c) => fmt.tempUnit(c, units);
  const span = (sp) => `from ${nightHour(sp.from)} to ${nightHour(sp.to)}`;
  const out = [];
  if (detail.freeze) {
    out.push(`At or below ${t(COLD_AT.freeze)} ${span(detail.freeze)} (${detail.freeze.hours} hour${detail.freeze.hours === 1 ? '' : 's'}).`);
    if (detail.hard) out.push(`${t(COLD_AT.hard)} or colder for ${detail.hard.hours} hour${detail.hard.hours === 1 ? '' : 's'}.`);
  } else if (detail.frost) out.push(`Near freezing, ${t(COLD_AT.frost)} or colder, ${span(detail.frost)}.`);
  out.push(`Coldest ${t(detail.min)} around ${nightHour(detail.minHour)}.`);
  const cover = sunset != null ? `Cover tender plants before sunset (${clockText(sunset)})` : 'Cover tender plants before dusk';
  out.push(detail.uncover != null ? `${cover}, and uncover them after about ${nightHour(detail.uncover)}.` : `${cover}; it stays cold through the morning, so leave covers on.`);
  return out.join(' ');
}

// How this compares with 30 years of records here.
function contextLine(a, d, normals) {
  const bits = [];
  const span = normals ? `in the last ${normals.lastYear - normals.firstYear} years` : '';
  if (a.kind === 'cold' && d.colder != null && d.colder >= 0.9)
    bits.push(`Colder than ${Math.min(99, Math.round(d.colder * 100))}% of ${partOfMonth(d.date)} nights here ${span}.`);
  if (a.kind === 'heat' && d.hotter != null && d.hotter >= 0.9)
    bits.push(`Hotter than ${Math.min(99, Math.round(d.hotter * 100))}% of ${partOfMonth(d.date)} days here ${span}.`);
  if (a.kind === 'cold' && a.timing && a.timing.count <= Math.round(a.timing.seasons / 5) && d === a.peak) {
    const what = a.level >= 3 ? 'hard freeze' : 'freeze';
    const n = a.timing.count === 0 ? 'None' : `Only ${a.timing.count}`;
    bits.push(
      a.timing.fall
        ? `${n} of the last ${a.timing.seasons} falls had a ${what} this early.`
        : `${n} of the last ${a.timing.seasons} springs had a ${what} this late.`,
    );
  }
  return bits.join(' ');
}

export function AlertCard({ a, today, units, onPick, normals, sunsets }) {
  const [pick, setPick] = useState(null);
  const Icon = a.kind === 'cold' ? (a.level >= 3 ? ThermometerSnowflake : Snowflake) : ThermometerSun;
  const shown = a.days.find((d) => d.date === pick) || a.peak;
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
        <div class="alert-days" role="group" aria-label={a.kind === 'cold' ? 'Nights' : 'Days'}>
          {a.days.map((d) => (
            <button
              key={d.date}
              class={`alert-day ${a.kind}-${d.level}${d.date === shown.date ? ' on' : ''}`}
              aria-pressed={d.date === shown.date}
              onClick={() => setPick(d.date)}
            >
              {alertDayLabel(a, d, today)} <strong>{fmt.temp(d.value, units)}</strong>
            </button>
          ))}
        </div>
      )}
      {a.kind === 'cold' && shown.detail && (
        <div class="night">
          <NightChart detail={shown.detail} units={units} />
          <p class="small">{nightWords(shown.detail, units, sunsets && sunsets[shown.date])}</p>
        </div>
      )}
      {contextLine(a, shown, normals) && <p class="alert-context small">{contextLine(a, shown, normals)}</p>}
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
              : {fillTemps(r.tip, units)}
            </li>
          ))}
        </ul>
      )}
      <details class="ladder-wrap">
        <summary>How the {a.kind === 'cold' ? 'cold' : 'heat'} levels work</summary>
        <Ladder kind={a.kind} units={units} extremeAt={a.extremeAt} />
        <p class="muted xs">
          {a.kind === 'cold'
            ? 'Levels follow the night’s lowest air temperature. Frost can form a few degrees above freezing on clear, calm nights, so those count as frost nights sooner. Extreme cold adapts to your area once its weather records load.'
            : 'Levels follow the day’s high. Three or more hot days in a row count as a heat wave, one level higher.'}
        </p>
      </details>
    </section>
  );
}

export function Alerts({ alerts, today, units, onPick, normals, sunsets }) {
  if (!alerts.length) return null;
  return (
    <div class="alerts" aria-live="polite">
      {alerts.map((a) => (
        <AlertCard key={a.kind} a={a} today={today} units={units} onPick={onPick} normals={normals} sunsets={sunsets} />
      ))}
    </div>
  );
}
