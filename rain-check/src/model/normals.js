// Thirty years of daily highs and lows, the standard span for climate
// normals: frost odds like the ones NOAA publishes, an estimate of the USDA
// hardiness zone, what's normal for each time of year, and how unusual a
// given day is.

import { addDays, daysBetween } from '../lib/dates.js';
import { frostSeasons, seasonStartMonth } from './climate.js';
import { COLD_AT, HEAT_AT } from './thresholds.js';

export const NORMAL_SEASONS = 30;

const pad2 = (n) => String(n).padStart(2, '0');

// Where a 30-year fetch starts: the boundary 30 frost seasons before the current one.
export function normalsStart(today, lat) {
  const mm = pad2(seasonStartMonth(lat));
  let y = +today.slice(0, 4);
  if (today < `${y}-${mm}-01`) y -= 1;
  return `${y - NORMAL_SEASONS}-${mm}-01`;
}

// The start of the frost season a date falls in.
export function seasonStartOf(date, lat) {
  const mm = pad2(seasonStartMonth(lat));
  const y = +date.slice(0, 4);
  return date >= `${y}-${mm}-01` ? `${y}-${mm}-01` : `${y - 1}-${mm}-01`;
}

// Nearest-rank quantile of a sorted array (works with ±Infinity entries).
function rank(sorted, q) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}

// Linear-interpolated quantile of a sorted array of numbers.
function interp(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const byNumber = (a, b) => a - b;

/**
 * Frost odds at a temperature: in what share of years the last spring freeze
 * came after a date, and the first fall freeze before one.
 *   last.p50  half of springs have their last freeze by this day
 *   last.p90  nine springs in ten have their last freeze by this day
 *   first.p10 one fall in ten has its first freeze by this day
 * Dates are 'MM-DD'. A null means that share of years had no freeze at all.
 */
export function frostOdds(days, lat, thresholdC) {
  const seasons = frostSeasons(days, lat, thresholdC).filter((s) => s.complete);
  if (seasons.length < 5) return null;
  const sdOf = (date, start) => daysBetween(start, date);
  const lastSd = seasons.map((s) => (s.last ? sdOf(s.last, s.start) : -Infinity)).sort(byNumber);
  const firstSd = seasons.map((s) => (s.first ? sdOf(s.first, s.start) : Infinity)).sort(byNumber);
  const ref = `2001-${pad2(seasonStartMonth(lat))}-01`; // a reference season without Feb 29
  const md = (v) => (v == null || !Number.isFinite(v) ? null : addDays(ref, v).slice(5));
  const free = [];
  for (let k = 0; k + 1 < seasons.length; k++) {
    const a = seasons[k].last;
    const b = seasons[k + 1].first;
    if (a && b) free.push(daysBetween(a, b) - 1);
  }
  free.sort(byNumber);
  return {
    thresholdC,
    seasons: seasons.length,
    lastSd,
    firstSd,
    last: { p10: md(rank(lastSd, 0.1)), p50: md(rank(lastSd, 0.5)), p90: md(rank(lastSd, 0.9)) },
    first: { p10: md(rank(firstSd, 0.1)), p50: md(rank(firstSd, 0.5)), p90: md(rank(firstSd, 0.9)) },
    noneYears: seasons.filter((s) => !s.last && !s.first).length,
    frostFree: free.length >= 5 ? { p10: rank(free, 0.1), p50: rank(free, 0.5), p90: rank(free, 0.9) } : null,
  };
}

// How many seasons on record had a freeze as late (spring) or as early (fall) as `date`.
export function freezeTiming(odds, date, lat) {
  if (!odds) return null;
  const sd = daysBetween(seasonStartOf(date, lat), date);
  const inFall = sd < 183;
  const n = inFall ? odds.firstSd.filter((v) => v <= sd).length : odds.lastSd.filter((v) => v >= sd).length;
  return { fall: inFall, count: n, seasons: odds.seasons };
}

/**
 * USDA hardiness zone: from the average of each winter's coldest night, in
 * 10°F zones split into 5°F halves (zone 7a is 0 to 5°F).
 */
export function zoneFromF(f) {
  const x = f + 60;
  const n = Math.max(1, Math.min(13, Math.floor(x / 10) + 1));
  const half = x < 0 ? 'a' : x >= 130 ? 'b' : x - Math.floor(x / 10) * 10 < 5 ? 'a' : 'b';
  return `${n}${half}`;
}

export function hardiness(days, lat) {
  if (!days.length) return null;
  const mm = pad2(seasonStartMonth(lat));
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const mins = [];
  for (let y = +first.slice(0, 4) - 1; y <= +last.slice(0, 4); y++) {
    const start = `${y}-${mm}-01`;
    const end = addDays(`${y + 1}-${mm}-01`, -1);
    if (start < first || end > last) continue;
    let min = null;
    for (const d of days) if (d.date >= start && d.date <= end && d.tmin != null && (min == null || d.tmin < min.value)) min = { value: d.tmin, date: d.date };
    if (min) mins.push(min);
  }
  if (mins.length < 5) return null;
  const avgC = mins.reduce((a, m) => a + m.value, 0) / mins.length;
  const coldest = mins.reduce((a, m) => (m.value < a.value ? m : a));
  return { zone: zoneFromF((avgC * 9) / 5 + 32), avgMinC: avgC, seasons: mins.length, coldest };
}

// Day of a non-leap year, 0 to 364 (Feb 29 counts as Feb 28).
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
export const doyIndex = (date) => {
  const m = +date.slice(5, 7);
  const d = +date.slice(8, 10);
  return CUM[m - 1] + Math.min(d, m === 2 ? 28 : 31) - 1;
};

/**
 * What's normal for each day of the year: the spread of highs and lows within
 * a week either side, over all the years on record (1st to 99th percentile in
 * 1% steps), and how often it freezes or gets hot.
 */
export function dailyNormals(days) {
  const hi = Array.from({ length: 365 }, () => []);
  const lo = Array.from({ length: 365 }, () => []);
  for (const d of days) {
    const k = doyIndex(d.date);
    if (d.tmax != null) hi[k].push(d.tmax);
    if (d.tmin != null) lo[k].push(d.tmin);
  }
  const grid = (s) => Array.from({ length: 101 }, (_, p) => interp(s, p / 100));
  const out = new Array(365);
  for (let k = 0; k < 365; k++) {
    const H = [];
    const L = [];
    for (let j = -7; j <= 7; j++) {
      const kk = (k + j + 365) % 365;
      for (const v of hi[kk]) H.push(v);
      for (const v of lo[kk]) L.push(v);
    }
    H.sort(byNumber);
    L.sort(byNumber);
    out[k] = {
      n: L.length,
      hi: H.length ? grid(H) : null,
      lo: L.length ? grid(L) : null,
      pFrost: L.length ? L.filter((t) => t <= COLD_AT.frost).length / L.length : 0,
      pFreeze: L.length ? L.filter((t) => t <= COLD_AT.freeze).length / L.length : 0,
      pHard: L.length ? L.filter((t) => t <= COLD_AT.hard).length / L.length : 0,
      pHot: H.length ? H.filter((t) => t >= HEAT_AT.hot).length / H.length : 0,
    };
  }
  return out;
}

// Share of a percentile grid below a value (0 to 1).
function cdf(grid, v) {
  if (!grid) return null;
  if (v <= grid[0]) return 0;
  if (v >= grid[100]) return 1;
  for (let p = 0; p < 100; p++) {
    if (v < grid[p + 1]) {
      const span = grid[p + 1] - grid[p];
      return (p + (span > 0 ? (v - grid[p]) / span : 0.5)) / 100;
    }
  }
  return 1;
}

// "Colder than X% of nights at this time of year" and its heat twin.
export const colderThan = (normals, date, low) => {
  const n = normals && normals[doyIndex(date)];
  return n && n.lo ? 1 - cdf(n.lo, low) : null;
};
export const hotterThan = (normals, date, high) => {
  const n = normals && normals[doyIndex(date)];
  return n && n.hi ? cdf(n.hi, high) : null;
};

// The normal (median) high and low for a date.
export function normalFor(normals, date) {
  const n = normals && normals[doyIndex(date)];
  return n && n.hi && n.lo ? { high: n.hi[50], low: n.lo[50], pFreeze: n.pFreeze, pHot: n.pHot } : null;
}

// A day's temperature at each hour from its low (about dawn), high (mid-
// afternoon) and the next morning's low, as a smooth curve.
function hourlyCurve(lo, hi, nextLo, prevHi) {
  const out = new Array(24);
  for (let h = 0; h < 24; h++) {
    if (h < 6) out[h] = lo + ((prevHi - lo) * (1 + Math.cos((Math.PI * (h + 9)) / 15))) / 2;
    else if (h <= 15) out[h] = lo + ((hi - lo) * (1 - Math.cos((Math.PI * (h - 6)) / 9))) / 2;
    else out[h] = nextLo + ((hi - nextLo) * (1 + Math.cos((Math.PI * (h - 15)) / 15))) / 2;
  }
  return out;
}

/**
 * Chill hours: hours between 32 and 45°F from November through February
 * (May through August south of the equator), the measure fruit trees like
 * peaches are bred for. Estimated from daily highs and lows, so about ±15%.
 * Returns the typical winter and the range of most winters.
 */
export function chillHours(days, lat) {
  const months = lat >= 0 ? [11, 12, 1, 2] : [5, 6, 7, 8];
  const byWinter = new Map();
  for (let i = 1; i + 1 < days.length; i++) {
    const d = days[i];
    const m = +d.date.slice(5, 7);
    if (!months.includes(m) || d.tmin == null || d.tmax == null) continue;
    const y = +d.date.slice(0, 4);
    const winter = lat >= 0 ? (m >= 11 ? y : y - 1) : y;
    const prev = days[i - 1];
    const next = days[i + 1];
    const curve = hourlyCurve(d.tmin, d.tmax, next.tmin != null ? next.tmin : d.tmin, prev.tmax != null ? prev.tmax : d.tmax);
    let h = 0;
    for (const t of curve) if (t >= 0 && t <= 7.2) h++;
    const w = byWinter.get(winter) || { hours: 0, days: 0 };
    w.hours += h;
    w.days++;
    byWinter.set(winter, w);
  }
  const full = [...byWinter.values()].filter((w) => w.days >= 115).map((w) => w.hours).sort(byNumber);
  if (full.length < 5) return null;
  return { typical: Math.round(interp(full, 0.5)), low: Math.round(interp(full, 0.1)), high: Math.round(interp(full, 0.9)), winters: full.length };
}

// Everything at once, from 30 years of daily highs and lows (oldest first).
export function climateNormals(days, lat) {
  if (!days || days.length < 3650) return null;
  const daily = dailyNormals(days);
  return {
    firstYear: +days[0].date.slice(0, 4),
    lastYear: +days[days.length - 1].date.slice(0, 4),
    days: days.length,
    freeze: frostOdds(days, lat, COLD_AT.freeze),
    hard: frostOdds(days, lat, COLD_AT.hard),
    frost: frostOdds(days, lat, COLD_AT.frost),
    zone: hardiness(days, lat),
    chill: chillHours(days, lat),
    daily,
    p02Low: interp(
      days.map((d) => d.tmin).filter((t) => t != null).sort(byNumber),
      0.02,
    ),
  };
}
