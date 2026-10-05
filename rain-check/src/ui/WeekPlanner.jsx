// The week at a glance: each bed and pot across the next seven days, as if
// you follow the plan. Each cell's fill is how much water it ends the day
// with; icons mark waterings, rain that covers it, and frost or heat risk.

import { useState } from 'preact/hooks';
import { Check, CloudRain, Droplet, Droplets, Snowflake, iconFor } from './icons.js';
import { fmt } from '../lib/units.js';
import { weekday, weekdayShort } from '../lib/dates.js';
import { coldRisk, heatRisk } from '../model/alerts.js';
import { howToWater } from '../model/watering.js';
import { waterWords, minutesText, cansText, fillTemps } from './text.js';

const ACTION_ICON = { water: Droplet, again: Droplets, done: Check, wait: CloudRain, cold: Snowflake };
const COLD_WORD = ['', 'Frost', 'Freeze', 'Hard freeze', 'Extreme cold'];
const HEAT_WORD = ['', 'Hot', 'Very hot', 'Extreme heat', 'Extreme heat'];

function cellText(row, d, how, units, risk) {
  const { bed, sim } = row;
  const w = how ? waterWords(how, bed, sim.model, units) : null;
  const depth = w && w.depth ? ` (${w.depth})` : '';
  const parts = [];
  if (d.action === 'water' || d.action === 'again') parts.push(`${d.action === 'again' ? 'Water again' : 'Water'}: ${w.act.charAt(0).toLowerCase()}${w.act.slice(1)}${depth}.`);
  else if (d.action === 'done') parts.push('Watered.');
  else if (d.action === 'wait') parts.push('Rain is likely, so hold off.');
  else if (d.action === 'cold') parts.push('Too cold to water; the plan waits for a warmer day.');
  else if (d.rainIn >= 2) parts.push(`Rain should put back about ${fmt.depth(d.rainIn, units)}.`);
  else parts.push('Nothing needed.');
  parts.push(`Ends the day ${Math.round(d.moisture)}% full.`);
  if (risk.cold) parts.push(`${COLD_WORD[risk.coldLevel]} that night: ${risk.cold}`);
  if (risk.heat) parts.push(`${HEAT_WORD[risk.heatLevel]} that day: ${risk.heat}`);
  return parts.join(' ');
}

export function WeekPlanner({ rows, plans, days, T, units, levels, nights, frost, onOpen }) {
  const [sel, setSel] = useState(null);
  if (!rows.length) return null;
  const week = days.slice(T, T + 7);
  // The night that follows day i.
  const lowOf = (i) => {
    const n = nights && nights[days[i].date];
    return n && n.low != null ? n.low : days[i + 1] ? days[i + 1].tmin : days[i].tmin;
  };

  // Totals for the week.
  let count = 0;
  let liters = 0;
  const risks = {};
  for (const row of rows) {
    const plan = plans[row.bed.id] || [];
    for (const d of plan) {
      const cold = levels.cold[d.i] ? coldRisk(row.bed, levels.cold[d.i], row.sim, lowOf(d.i), { date: days[d.i].date, frost }) : null;
      const heat = levels.heat[d.i] ? heatRisk(row.bed, levels.heat[d.i], row.sim, days[d.i].tmax) : null;
      risks[`${row.bed.id}:${d.i}`] = { cold, heat, coldLevel: levels.cold[d.i], heatLevel: levels.heat[d.i] };
      if (d.action === 'water' || d.action === 'again') {
        count++;
        liters += howToWater(row.bed, row.sim.model, d.amountMm).litersAll;
      }
    }
  }

  const selRow = sel && rows.find((r) => r.bed.id === sel.id);
  const selDay = selRow && (plans[sel.id] || []).find((d) => d.i === sel.i);
  const selHow = selDay && (selDay.action === 'water' || selDay.action === 'again') ? howToWater(selRow.bed, selRow.sim.model, selDay.amountMm) : null;

  return (
    <section class="section planner" aria-label="This week">
      <div class="planner-head">
        <h2 class="display h2">This week</h2>
        <span class="muted small">
          {count ? `${count} watering${count === 1 ? '' : 's'} · about ${fmt.volume(liters, units)}` : 'No watering needed'}
        </span>
      </div>
      <div class="pl-grid pl-days" aria-hidden="true">
        {week.map((d, k) => {
          const i = T + k;
          const night = nights && nights[d.date];
          const low = night && night.low != null ? night.low : days[i + 1] ? days[i + 1].tmin : d.tmin;
          return (
            <div key={d.date} class="pl-day">
              <span class="pl-dname">{k === 0 ? 'Today' : weekdayShort(d.date)}</span>
              <span class={`pl-hi${levels.heat[i] ? ` heat-${levels.heat[i]}` : ''}`}>{fmt.temp(d.tmax, units)}</span>
              <span class={`pl-lo${levels.cold[i] ? ` cold-${levels.cold[i]}` : ''}`}>{fmt.temp(low, units)}</span>
              <span class="pl-rain">{d.prob != null && d.prob >= 30 ? `${Math.round(d.prob)}%` : ''}</span>
            </div>
          );
        })}
      </div>
      {rows.map((row) => {
        const Icon = iconFor(row.bed);
        const plan = plans[row.bed.id] || [];
        const n = plan.filter((d) => d.action === 'water' || d.action === 'again').length;
        let total = '';
        if (n) {
          const hows = plan.filter((d) => d.action === 'water' || d.action === 'again').map((d) => howToWater(row.bed, row.sim.model, d.amountMm));
          total = hows[0].timed ? minutesText(hows.reduce((a, h) => a + h.minutes, 0)) : row.sim.model.pot ? fmt.volume(hows.reduce((a, h) => a + h.litersAll, 0), units) : cansText(hows.reduce((a, h) => a + h.cans, 0));
        }
        return (
          <div class="pl-row" key={row.bed.id}>
            <button class="pl-name" onClick={() => onOpen(row.bed.id)}>
              <Icon size={14} aria-hidden="true" />
              <span class="truncate">{row.bed.name}</span>
              <span class="pl-sum">{n ? `${n}× · ${total}` : 'no water'}</span>
            </button>
            <div class="pl-grid">
              {plan.map((d) => {
                const r = risks[`${row.bed.id}:${d.i}`] || {};
                const A = ACTION_ICON[d.action] || (d.rainIn >= 2 ? CloudRain : null);
                const on = sel && sel.id === row.bed.id && sel.i === d.i;
                const label = `${row.bed.name}, ${d.i === T ? 'today' : weekday(d.date)}: ${d.action || 'no watering'}`;
                return (
                  <button
                    key={d.date}
                    class={`pl-cell${d.action ? ` act-${d.action}` : d.rainIn >= 2 ? ' act-rain' : ''}${on ? ' on' : ''}`}
                    aria-label={label}
                    aria-pressed={on}
                    onClick={() => setSel(on ? null : { id: row.bed.id, i: d.i })}
                  >
                    <span class="pl-fill" style={{ height: `${Math.max(0, Math.min(100, d.moisture))}%` }} />
                    <span class="pl-line" style={{ bottom: `${d.refillAt}%` }} />
                    {A && <A size={14} aria-hidden="true" class="pl-icon" />}
                    {r.cold && <span class={`pl-mark cold-${r.coldLevel}`} />}
                    {r.heat && !r.cold && <span class={`pl-mark heat-${r.heatLevel}`} />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p class="pl-readout small" aria-live="polite">
        {selDay ? (
          <>
            <strong>
              {selRow.bed.name}, {selDay.i === T ? 'today' : weekday(selDay.date)}:
            </strong>{' '}
            {fillTemps(cellText(selRow, selDay, selHow, units, risks[`${sel.id}:${sel.i}`] || {}), units)}
          </>
        ) : (
          <span class="muted">Tap a day for details. Blue is the water each one ends the day with; the gold tick is when to water.</span>
        )}
      </p>
    </section>
  );
}
