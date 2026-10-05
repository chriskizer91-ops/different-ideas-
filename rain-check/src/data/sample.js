// Made-up weather for trying the app before setting a location. The sliders
// shape the week around today; the years before follow ordinary seasons.

import { addDays, dayOfYear } from '../lib/dates.js';
import { penmanMonteith } from '../model/et0.js';
import { extraterrestrialRadiation, sunTimes } from '../model/solar.js';
import { historyStart } from '../model/climate.js';
import { normalsStart } from '../model/normals.js';
import { PAST_DAYS, FORECAST_DAYS } from './openMeteo.js';

export const SAMPLE_LAT = 40;
const ELEV = 100;

export const SAMPLE_DEFAULTS = { tHigh: 28, humidity: 55, wind: 2, dryDays: 5, rainSoon: false, coldSnap: 'none' };

// The night low a cold snap brings, °C.
export const COLD_SNAPS = {
  none: { label: 'None', low: null },
  frost: { label: 'Frost', low: 1 },
  freeze: { label: 'Freeze', low: -1 },
  hard: { label: 'Hard freeze', low: -4 },
  extreme: { label: 'Extreme cold', low: -15 },
};

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Seasonal swing: +1 in late July, -1 in late January.
const season = (date) => Math.cos((2 * Math.PI * (dayOfYear(date) - 200)) / 365);
const SWING = 14; // °C between an average day and midsummer or midwinter

function day(date, { high, low, humidity, wind, rain, rainHours, prob, sunShare }) {
  const rhMin = Math.max(5, Math.min(95, humidity - 20 + (rain > 2 ? 25 : 0)));
  const rhMax = Math.max(rhMin + 5, Math.min(100, humidity + 25 + (rain > 2 ? 15 : 0)));
  const rs = sunShare * extraterrestrialRadiation(SAMPLE_LAT, date);
  const et0 = penmanMonteith({ tmax: high, tmin: low, rhMax, rhMin, u2: wind, rs, lat: SAMPLE_LAT, elev: ELEV, date });
  return { date, tmax: high, tmin: low, rain, rainHours, prob, et0, et0Api: null, et0Calc: et0, rs, u2: wind, rhMin, rhMax };
}

// A day's temperature curve: coolest around dawn, warmest mid-afternoon.
// Hours past 24 run into the next day.
function tempAt(days, i, h) {
  if (h >= 24) return days[i + 1] ? tempAt(days, i + 1, h - 24) : days[i].tmin;
  const d = days[i];
  const prev = days[i - 1] || d;
  const next = days[i + 1] || d;
  if (h < 6) return d.tmin + ((prev.tmax - d.tmin) * (1 + Math.cos((Math.PI * (h + 9)) / 15))) / 2;
  if (h <= 15) return d.tmin + ((d.tmax - d.tmin) * (1 - Math.cos((Math.PI * (h - 6)) / 9))) / 2;
  return next.tmin + ((d.tmax - next.tmin) * (1 + Math.cos((Math.PI * (h - 15)) / 15))) / 2;
}

const r1 = (x) => Math.round(x * 10) / 10;

export function sampleForecast(opts, today, { lon = 0, offsetSeconds = 0 } = {}) {
  const o = { ...SAMPLE_DEFAULTS, ...opts };
  const next = rng(7);
  const s0 = season(today);
  const rains = { [-o.dryDays]: [40, 5], [-(o.dryDays + 9)]: [6, 2], [-(o.dryDays + 17)]: [25, 4] };
  [30, 18, 35, 22, 28].forEach((mm, c) => (rains[-(o.dryDays + 31 + 14 * c)] = [mm, 3 + c]));
  const snap = COLD_SNAPS[o.coldSnap] && COLD_SNAPS[o.coldSnap].low;

  const days = [];
  for (let k = -PAST_DAYS; k < FORECAST_DAYS; k++) {
    const date = addDays(today, k);
    let [rain, rainHours] = rains[k] || [0, 0];
    let prob = k >= 0 ? 10 : null;
    if (o.rainSoon && k === 1) (rain = 25), (rainHours = 6), (prob = 80);
    const wet = rain > 2;
    // The season, with the slider's heat building over the last four days
    // (a heat wave arrives; it isn't already routine).
    const base = Math.min(o.tHigh, 26);
    const build = k < 0 ? Math.max(0, Math.min(1, (k + 4) / 4)) : 1;
    let high = base + (o.tHigh - base) * build + SWING * (season(date) - s0) + (next() - 0.5) * 3 - (wet ? 5 : 0);
    let low = high - (wet ? 6 : 11 + next() * 2);
    if (snap != null && (k === 1 || k === 2)) {
      if (k === 2) low = snap;
      high = Math.min(high, snap + (k === 1 ? 12 : 9));
      if (k === 1) low = Math.min(low, snap + 5);
    }
    const humidity = o.humidity + (next() - 0.5) * 8;
    const wind = Math.max(0.3, o.wind + (next() - 0.5) * 0.8);
    days.push(day(date, { high, low, humidity, wind, rain, rainHours: rainHours || null, prob, sunShare: wet ? 0.35 : 0.62 + next() * 0.06 }));
  }
  const nights = {};
  const hours = {};
  const recentFrom = days.length - 13;
  days.forEach((d, i) => {
    const sun = sunTimes({ lat: SAMPLE_LAT, lon, date: d.date, offsetSeconds });
    d.sunrise = sun.rise;
    d.sunset = sun.set;
    if (i + 1 < days.length) {
      const calm = d.u2 < 1.5 && d.rhMin < 60 && !d.rain && !days[i + 1].rain;
      nights[d.date] = { low: days[i + 1].tmin, clearCalm: calm };
      if (i >= recentFrom - 1) nights[d.date].temps = Array.from({ length: 17 }, (_, k) => r1(tempAt(days, i, 18 + k)));
    }
    if (i >= recentFrom) {
      const wet = d.rain > 2;
      const per = d.rain && d.rainHours ? d.rain / d.rainHours : 0;
      hours[d.date] = {
        t: Array.from({ length: 24 }, (_, h) => r1(tempAt(days, i, h))),
        p: Array.from({ length: 24 }, (_, h) => (per && h >= 13 && h < 13 + d.rainHours ? r1(per) : 0)),
        c: Array.from({ length: 24 }, () => (wet ? 85 : 15)),
      };
    }
  });
  return { days, nights, hours, todayIdx: PAST_DAYS };
}

// Three-plus years of ordinary seasons ending where the forecast begins.
export function sampleHistory(opts, today) {
  const o = { ...SAMPLE_DEFAULTS, ...opts };
  const next = rng(11);
  const s0 = season(today);
  const start = historyStart(today, SAMPLE_LAT);
  const end = addDays(today, -PAST_DAYS - 1);
  const yearWet = {};
  const days = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const y = date.slice(0, 4);
    if (yearWet[y] == null) yearWet[y] = 0.6 + next() * 0.8;
    const h = season(date);
    const wet = next() < Math.max(0.03, (0.16 - 0.11 * h) * yearWet[y]);
    const rain = wet ? 2 + -Math.log(1 - next()) * 9 : 0;
    const high = o.tHigh + SWING * (h - s0) + (next() - 0.5) * 4 - (wet ? 4 : 0);
    const low = high - (wet ? 6 : 10 + next() * 2) + (next() - 0.5) * 4;
    const humidity = o.humidity - 8 * h + (next() - 0.5) * 8;
    const wind = Math.max(0.3, o.wind + (next() - 0.5) * 0.8);
    days.push(
      day(date, {
        high,
        low,
        humidity,
        wind,
        rain,
        rainHours: wet ? Math.max(1, Math.round(rain / 3)) : null,
        prob: null,
        sunShare: wet ? 0.35 : 0.58 + next() * 0.08,
      }),
    );
  }
  return days;
}

// Thirty years of highs and lows with some winters harsher than others, for
// frost odds and normals in sample mode.
export function sampleNormals(opts, today) {
  const o = { ...SAMPLE_DEFAULTS, ...opts };
  const next = rng(19);
  const s0 = season(today);
  const end = addDays(today, -7);
  const out = [];
  let year = null;
  let anomaly = 0;
  for (let date = normalsStart(today, SAMPLE_LAT); date <= end; date = addDays(date, 1)) {
    if (date.slice(0, 4) !== year) (year = date.slice(0, 4)), (anomaly = (next() - 0.5) * 3);
    const high = o.tHigh + SWING * (season(date) - s0) + anomaly + (next() - 0.5) * 7;
    const low = high - 10 - next() * 3 + (next() - 0.5) * 3;
    out.push({ date, tmax: r1(high), tmin: r1(low) });
  }
  return out;
}
