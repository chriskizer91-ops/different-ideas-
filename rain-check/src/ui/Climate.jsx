// "Your climate": 30 years of highs and lows. Hardiness zone, frost odds, and
// a year chart of what's normal for each day, with this year drawn over it.

import { useState } from 'preact/hooks';
import { LoaderCircle } from './icons.js';
import { useWidth } from './hooks.js';
import { fmt } from '../lib/units.js';
import { mdText, monthDay, monthDayYear } from '../lib/dates.js';
import { doyIndex } from '../model/normals.js';
import { COLD_AT, HEAT_AT } from '../model/thresholds.js';

const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const dateOfDoy = (k) => {
  let m = 11;
  while (MONTH_START[m] > k) m--;
  return `2001-${String(m + 1).padStart(2, '0')}-${String(k - MONTH_START[m] + 1).padStart(2, '0')}`;
};

function YearChart({ normals, thisYear, today, units }) {
  const [ref, W] = useWidth(340);
  const [sel, setSel] = useState(null);
  const daily = normals.daily;
  const H = 176;
  const L = 34;
  const R = 6;
  const TOP = 6;
  const plotH = 132;
  const base = TOP + plotH;
  const strip = base + 4;
  let lo = Infinity;
  let hi = -Infinity;
  for (const d of daily) {
    if (!d.lo) continue;
    lo = Math.min(lo, d.lo[5]);
    hi = Math.max(hi, d.hi[95]);
  }
  for (const d of thisYear) {
    if (d.tmin != null) lo = Math.min(lo, d.tmin);
    if (d.tmax != null) hi = Math.max(hi, d.tmax);
  }
  lo -= 2;
  hi += 2;
  const x = (k) => L + (k / 364) * (W - L - R);
  const y = (t) => TOP + ((hi - t) / (hi - lo)) * plotH;
  const band = (key, a, b) => {
    let top = '';
    let bot = '';
    for (let k = 0; k < 365; k += 2) top += `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(daily[k][key][b]).toFixed(1)}`;
    for (let k = 364; k >= 0; k -= 2) bot += `L${x(k).toFixed(1)},${y(daily[k][key][a]).toFixed(1)}`;
    return `${top}${bot}Z`;
  };
  const median = (key) => {
    let d = '';
    for (let k = 0; k < 365; k += 2) d += `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(daily[k][key][50]).toFixed(1)}`;
    return d;
  };
  const series = (field, forecast) => {
    let d = '';
    let pen = false;
    for (const p of thisYear) {
      if (p[field] == null || !!p.forecast !== forecast) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${x(p.k).toFixed(1)},${y(p[field]).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const tk = doyIndex(today);
  const pick = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    setSel(Math.max(0, Math.min(364, Math.round(((clientX - r.left - L) / (W - L - R)) * 364))));
  };
  const k = sel != null ? sel : tk;
  const n = daily[k];
  const mine = thisYear.find((p) => p.k === k);
  const t = (c) => fmt.temp(c, units);
  return (
    <div class="year">
      <p class="readout" aria-live="polite">
        <strong>{monthDay(dateOfDoy(k))}</strong>
        <span>
          Normal {t(n.hi[50])} / {t(n.lo[50])}
        </span>
        <span class="muted">
          most years {t(n.hi[10])} to {t(n.hi[90])}
        </span>
        {mine && (
          <span>
            {mine.forecast ? 'Forecast' : 'This year'} {t(mine.tmax)} / {t(mine.tmin)}
          </span>
        )}
        <span class="cold-ink">{Math.round(n.pFreeze * 100)}% chance of a freezing night</span>
      </p>
      <div ref={ref} class="chart-box">
        <svg
          width={W}
          height={H}
          class="chart"
          tabIndex={0}
          role="img"
          aria-label="Normal highs and lows through the year, with this year's temperatures. Use the arrow keys to read each day."
          onPointerDown={(e) => pick(e.clientX)}
          onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && pick(e.clientX)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') (setSel(Math.max(0, k - 1)), e.preventDefault());
            if (e.key === 'ArrowRight') (setSel(Math.min(364, k + 1)), e.preventDefault());
          }}
        >
          <path d={band('hi', 10, 90)} class="cy-hiband" />
          <path d={band('lo', 10, 90)} class="cy-loband" />
          <path d={median('hi')} class="cy-himed" />
          <path d={median('lo')} class="cy-lomed" />
          {[COLD_AT.freeze, HEAT_AT.hot].map((v) =>
            v > lo && v < hi ? (
              <g key={v}>
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} class={v < 10 ? 'cy-freeze' : 'cy-hot'} />
                <text x={L - 4} y={y(v) + 4} class="axis" text-anchor="end">
                  {t(v)}
                </text>
              </g>
            ) : null,
          )}
          <path d={series('tmax', false)} class="cy-hi" />
          <path d={series('tmin', false)} class="cy-lo" />
          <path d={series('tmax', true)} class="cy-hi ahead" />
          <path d={series('tmin', true)} class="cy-lo ahead" />
          <line x1={x(tk)} x2={x(tk)} y1={TOP} y2={base} class="today" />
          {daily.map((d, i) =>
            d.pFreeze > 0.02 ? (
              <rect key={`f${i}`} x={x(i)} y={strip} width={Math.max(1, (W - L - R) / 365 + 0.4)} height="5" class="cy-pfreeze" opacity={Math.min(1, d.pFreeze * 1.3)} />
            ) : d.pHot > 0.02 ? (
              <rect key={`h${i}`} x={x(i)} y={strip} width={Math.max(1, (W - L - R) / 365 + 0.4)} height="5" class="cy-phot" opacity={Math.min(1, d.pHot * 1.3)} />
            ) : null,
          )}
          {MONTH_START.map((m, i) => (
            <text key={i} x={x(m + 14)} y={H - 4} class="axis" text-anchor="middle">
              {LETTERS[i]}
            </text>
          ))}
          {sel != null && <line x1={x(k)} x2={x(k)} y1={TOP} y2={strip + 5} class="cursor" />}
        </svg>
      </div>
      <p class="muted xs legend">
        <span class="key cy-key-hi" /> Normal highs and <span class="key cy-key-lo" /> lows (the band is 8 years in 10; the line is the middle). Thin lines are this
        year, dashed ahead. The strip shows the chance of a freezing night (blue) or a {fmt.tempUnit(HEAT_AT.hot, units)} day (orange).
      </p>
    </div>
  );
}

function OddsLines({ normals, units }) {
  const f = normals.freeze;
  const h = normals.hard;
  if (!f) return null;
  const t = (c) => fmt.tempUnit(c, units);
  if (f.noneYears === f.seasons) return <p class="small">No freezing nights in the last {f.seasons} winters.</p>;
  const lines = [];
  const last = f.last;
  const first = f.first;
  if (last.p50)
    lines.push(
      <li key="ls">
        <strong>Last spring freeze</strong> ({t(COLD_AT.freeze)}): by {mdText(last.p50)} in half of years
        {last.p90 ? `, and by ${mdText(last.p90)} in 9 years out of 10` : ''}.
      </li>,
    );
  if (first.p50)
    lines.push(
      <li key="ff">
        <strong>First fall freeze</strong>: by {mdText(first.p50)} in half of years
        {first.p10 ? `; 1 year in 10 it comes by ${mdText(first.p10)}` : ''}.
      </li>,
    );
  if (h && h.last.p50 && h.first.p50)
    lines.push(
      <li key="hf">
        <strong>Hard freeze</strong> ({t(COLD_AT.hard)}): last around {mdText(h.last.p50)}, first around {mdText(h.first.p50)} in a typical year.
      </li>,
    );
  if (f.frostFree)
    lines.push(
      <li key="ffs">
        <strong>Frost-free season</strong>: about {f.frostFree.p50} days ({f.frostFree.p10} to {f.frostFree.p90} in most years).
      </li>,
    );
  if (f.noneYears) lines.push(<li key="none">{f.noneYears} of {f.seasons} winters had no freeze at all.</li>);
  return <ul class="odds">{lines}</ul>;
}

export function Climate({ normals, state, onRetry, thisYear, today, units, place }) {
  return (
    <section class="section" aria-label="Your climate">
      <h2 class="display h2">Your climate</h2>
      <div class="panel climate">
        {!normals && state === 'loading' && (
          <div class="chart-msg">
            <LoaderCircle size={16} class="spin" aria-hidden="true" /> Loading 30 years of weather{place ? ` for ${place.name}` : ''}
          </div>
        )}
        {!normals && state === 'failed' && (
          <div class="chart-msg warn-ink">
            <p>Couldn't load the 30-year record. Check your connection and try again.</p>
            <button class="link" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
        {normals && (
          <>
            {normals.zone && (
              <div class="zone">
                <span class="zone-badge display">{normals.zone.zone}</span>
                <p class="small">
                  <strong>Hardiness zone, estimated.</strong> The coldest night most winters is about {fmt.tempUnit(normals.zone.avgMinC, units)}; the
                  coldest in {normals.zone.seasons} winters was {fmt.tempUnit(normals.zone.coldest.value, units)} on {monthDayYear(normals.zone.coldest.date)}.
                </p>
              </div>
            )}
            <OddsLines normals={normals} units={units} />
            <YearChart normals={normals} thisYear={thisYear} today={today} units={units} />
            <p class="muted xs">
              From {normals.firstYear} to {normals.lastYear} in Open-Meteo's weather records, by air temperature. These records average over a few miles, so a frost pocket or a sheltered
              courtyard can run a few degrees colder or warmer, and the zone can be off by half a step.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
