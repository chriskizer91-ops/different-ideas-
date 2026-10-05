// What the multi-year record says about this place: frost dates, how often it
// gets dangerously hot or cold, and what counts as unusually cold here.

import { addDays, daysBetween } from '../lib/dates.js';
import { COLD_AT, HEAT_AT } from './thresholds.js';

export function percentile(values, q) {
  const v = values.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

// Frost seasons run from the warm part of the year to the next: Aug 1 to
// Jul 31 north of the equator, Feb 1 to Jan 31 south of it. Each season's
// first freeze is in the fall and its last in the spring.
export function seasonStartMonth(lat) {
  return lat >= 0 ? 8 : 2;
}

// Where a history fetch should start so the record holds three whole frost
// seasons and at least three years of days.
export function historyStart(today, lat) {
  const back = addDays(today, -(3 * 365 + 1));
  const m = seasonStartMonth(lat);
  let y = +back.slice(0, 4);
  let start = `${y}-${String(m).padStart(2, '0')}-01`;
  if (start > back) start = `${y - 1}-${String(m).padStart(2, '0')}-01`;
  return start;
}

/**
 * First and last nights at or below `thresholdC` in each frost season the
 * record covers. A season's first freeze needs the record to reach back to the
 * season's start; its last freeze needs the record to run to the season's end.
 * days: observed days only (no forecast), oldest first.
 */
export function frostSeasons(days, lat, thresholdC) {
  if (!days.length) return [];
  const m = String(seasonStartMonth(lat)).padStart(2, '0');
  const first = days[0].date;
  const lastDate = days[days.length - 1].date;
  const seasons = [];
  for (let y = +first.slice(0, 4) - 1; y <= +lastDate.slice(0, 4); y++) {
    const start = `${y}-${m}-01`;
    const end = addDays(`${y + 1}-${m}-01`, -1);
    if (end < first || start > lastDate) continue;
    const inSeason = days.filter((d) => d.date >= start && d.date <= end);
    const cold = inSeason.filter((d) => d.tmin != null && d.tmin <= thresholdC);
    const fromStart = first <= start;
    const toEnd = lastDate >= end;
    const firstFreeze = cold.length && fromStart ? cold[0].date : fromStart && toEnd ? null : undefined;
    const lastFreeze = cold.length && toEnd ? cold[cold.length - 1].date : fromStart && toEnd ? null : undefined;
    seasons.push({ start, end, first: firstFreeze, last: lastFreeze, complete: fromStart && toEnd });
  }
  return seasons;
}

// Position of a date within its frost season, in days, for comparing dates
// from different years.
const seasonDay = (date, start) => daysBetween(start, date);

function spread(entries) {
  // entries: [{ date, start }]; returns the earliest and latest by season day, and the middle one
  if (!entries.length) return null;
  const sorted = entries.slice().sort((a, b) => seasonDay(a.date, a.start) - seasonDay(b.date, b.start));
  return {
    earliest: sorted[0].date,
    latest: sorted[sorted.length - 1].date,
    middle: sorted[Math.floor((sorted.length - 1) / 2)].date,
    count: sorted.length,
  };
}

export function frostSummary(days, lat, thresholdC) {
  const seasons = frostSeasons(days, lat, thresholdC);
  const lasts = seasons.filter((s) => s.last).map((s) => ({ date: s.last, start: s.start }));
  const firsts = seasons.filter((s) => s.first).map((s) => ({ date: s.first, start: s.start }));
  const knownNone = seasons.filter((s) => s.complete && s.first === null).length;
  const frostFree = [];
  // Frost-free stretch: from a season's last freeze to the next season's first.
  for (let k = 0; k + 1 < seasons.length; k++) {
    const a = seasons[k].last;
    const b = seasons[k + 1].first;
    if (a && b) frostFree.push(daysBetween(a, b) - 1);
  }
  return {
    thresholdC,
    seasons,
    lastSpring: spread(lasts),
    firstFall: spread(firsts),
    frostFreeDays: frostFree.length ? Math.round(percentile(frostFree, 0.5)) : null,
    noneSeasons: knownNone,
    none: !lasts.length && !firsts.length && knownNone > 0,
  };
}

// Counts of hot days and cold nights between two indexes, from daily highs and lows.
export function extremesIn(days, from, to) {
  const c = { frost: 0, freeze: 0, hard: 0, hot: 0, veryHot: 0, extremeHeat: 0, coldest: null, hottest: null };
  for (let i = Math.max(0, from); i <= Math.min(to, days.length - 1); i++) {
    const d = days[i];
    if (d.tmin != null) {
      if (d.tmin <= COLD_AT.frost) c.frost++;
      if (d.tmin <= COLD_AT.freeze) c.freeze++;
      if (d.tmin <= COLD_AT.hard) c.hard++;
      if (!c.coldest || d.tmin < c.coldest.value) c.coldest = { value: d.tmin, date: d.date };
    }
    if (d.tmax != null) {
      if (d.tmax >= HEAT_AT.hot) c.hot++;
      if (d.tmax >= HEAT_AT.veryHot) c.veryHot++;
      if (d.tmax >= HEAT_AT.extreme) c.extremeHeat++;
      if (!c.hottest || d.tmax > c.hottest.value) c.hottest = { value: d.tmax, date: d.date };
    }
  }
  return c;
}

// Everything the record says, from observed days (oldest first).
export function climateStats(observed, lat) {
  const enough = observed.length >= 330;
  return {
    days: observed.length,
    p02Low: enough ? percentile(observed.map((d) => d.tmin), 0.02) : null,
    freeze: frostSummary(observed, lat, COLD_AT.freeze),
    hard: frostSummary(observed, lat, COLD_AT.hard),
  };
}
