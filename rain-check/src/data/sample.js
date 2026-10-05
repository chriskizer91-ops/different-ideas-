// Made-up weather for trying the app before setting a location. The sliders
// shape the week around today; the years before follow ordinary seasons.

import { addDays, dayOfYear } from '../lib/dates.js';
import { penmanMonteith } from '../model/et0.js';
import { extraterrestrialRadiation } from '../model/solar.js';
import { historyStart } from '../model/climate.js';
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

export function sampleForecast(opts, today) {
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
  for (let i = 0; i + 1 < days.length; i++) {
    const calm = days[i].u2 < 1.5 && days[i].rhMin < 60 && !days[i].rain && !days[i + 1].rain;
    nights[days[i].date] = { low: days[i + 1].tmin, clearCalm: calm };
  }
  return { days, nights, todayIdx: PAST_DAYS };
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
