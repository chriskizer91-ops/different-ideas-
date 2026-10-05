// Recent weather in a few numbers, and the chart's data for each time span.

import { dryStats } from './waterBalance.js';
import { extremesIn } from './climate.js';
import { coldLevel, heatLevel } from './alerts.js';

const sum = (arr, f) => arr.reduce((a, d) => a + (f(d) || 0), 0);
const chanceOf = (d) => (d.prob != null ? d.prob / 100 : 1);

export function recentWeather(days, T) {
  const past = days.slice(0, T);
  let lastIdx = -1;
  for (let i = past.length - 1; i >= 0; i--)
    if ((past[i].rain || 0) >= 2.5) {
      lastIdx = i;
      break;
    }
  const week = past.slice(-7);
  const next = days.slice(T, T + 7);
  return {
    daysSinceRain: lastIdx >= 0 ? T - lastIdx : null,
    lastRainMm: lastIdx >= 0 ? past[lastIdx].rain : 0,
    pastDays: past.length,
    rain7: sum(week, (d) => d.rain),
    et7: sum(week, (d) => d.et0),
    rainNext: sum(next, (d) => (d.rain || 0) * chanceOf(d)),
    today: days[T],
    outlook: next,
  };
}

export const RANGES = [
  { key: '1m', label: '1 month', past: 30, name: 'Past month', bars: 'day' },
  { key: '3m', label: '3 months', past: 91, name: 'Past 3 months', bars: 'day' },
  { key: '12m', label: '12 months', past: 365, name: 'Past 12 months', bars: 'week' },
  { key: '3y', label: '3 years', past: 3 * 365 + 1, name: 'Past 3 years', bars: 'month' },
];
export const rangeOf = (key) => RANGES.find((r) => r.key === key) || RANGES[0];
export const needsHistory = (key) => key === '12m' || key === '3y';

/**
 * Points for the water chart: the bank's level each day (a weekly average on
 * the 3-year view), the refill line, rain grouped into day, week or month
 * bars, and each day's frost or heat level for the strip under the chart.
 */
export function chartData(series, days, T, rangeKey) {
  const R = rangeOf(rangeKey);
  const from = Math.max(0, T - R.past);
  const end = series.length - 1;
  const keyOf = (i) =>
    R.bars === 'week' ? `w${Math.floor((i - from) / 7)}` : R.bars === 'month' ? days[i].date.slice(0, 7) : `d${i}`;

  const buckets = [];
  const byKey = new Map();
  for (let i = from; i <= end; i++) {
    const k = keyOf(i);
    let b = byKey.get(k);
    if (!b) {
      b = { from: i, to: i, rain: 0, forecast: i > T };
      byKey.set(k, b);
      buckets.push(b);
    }
    b.to = i;
    b.rain += (days[i].rain || 0) * (i >= T ? chanceOf(days[i]) : 1);
  }

  // Weekly averages on the long views keep day-to-day noise from hiding the seasons.
  const weekAvg = (i, key) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(from, i - 6); j <= i; j++) (s += series[j][key]), c++;
    return s / c;
  };
  const points = [];
  for (let i = from; i <= end; i++) {
    const moisture = R.key === '3y' ? weekAvg(i, 'moisture') : series[i].moisture;
    const refillAt = R.bars === 'day' ? series[i].refillAt : weekAvg(i, 'refillAt');
    points.push({
      i,
      date: days[i].date,
      moisture,
      refillAt,
      forecast: i > T,
      cold: coldLevel(days[i].tmin),
      heat: heatLevel(days[i].tmax),
      tmax: days[i].tmax,
      tmin: days[i].tmin,
      bucket: byKey.get(keyOf(i)),
    });
  }

  const ticks = [];
  for (const p of points) {
    const d = p.date;
    const first = d.slice(8, 10) === '01';
    if (R.key === '1m' ? (p.i - from) % 7 === 0 : R.key === '3m' ? first : R.key === '12m' ? first && +d.slice(5, 7) % 2 === 1 : first && (d.slice(5, 7) === '01' || d.slice(5, 7) === '07'))
      ticks.push(p.i);
  }

  return {
    R,
    from,
    T,
    end,
    points,
    buckets,
    ticks,
    stats: dryStats(series, from, T - 1),
    rainMm: sum(days.slice(from, T), (d) => d.rain),
    extremes: extremesIn(days, from, T - 1),
    firstDate: days[from].date,
  };
}
