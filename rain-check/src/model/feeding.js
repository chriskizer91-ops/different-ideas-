// When to feed: a fixed interval from the last logged feeding, held back when
// it's too cool for growth, when heavy rain would wash it away, or in heat.

import { daysBetween } from '../lib/dates.js';
import { bedModel } from './planting.js';

const TOO_COOL_C = 10; // 7-day mean below this, most plants barely grow
const HEAVY_RAIN_MM = 12;

export function lastFed(bed, today) {
  const past = (bed.feedLog || []).filter((d) => d <= today).sort();
  return past.length ? past[past.length - 1] : null;
}

// heatLevelByDay: optional map of date -> heat alert level (from alerts.js).
export function feedingPlan(bed, days, todayIdx, sim, heatLevelByDay = {}) {
  const every = Math.round(Number(bed.feedEvery) || 0);
  if (!every) return { status: 'off' };
  const today = days[todayIdx].date;
  const last = lastFed(bed, today);
  if (last === today) return { status: 'done', last };

  const week = days.slice(todayIdx, todayIdx + 7);
  const meanT =
    week.reduce((a, d) => a + ((d.tmax != null ? d.tmax : 20) + (d.tmin != null ? d.tmin : 10)) / 2, 0) / week.length;
  if (meanT < TOO_COOL_C) return { status: 'rest', last, every };

  if (!last) return { status: 'unknown', every };
  const since = daysBetween(last, today);
  const left = every - since;
  if (left > 0) return { status: 'later', last, every, inDays: left };

  const overdue = -left;
  const m = bedModel(bed);
  const rainFactor = m.pot ? m.rainFactor : 1;
  const heavyRain = days
    .slice(todayIdx, todayIdx + 2)
    .some((d) => (d.rain || 0) * rainFactor >= HEAVY_RAIN_MM && (d.prob != null ? d.prob : 100) >= 50);
  if (heavyRain) return { status: 'hold', reason: 'rain', last, every, overdue };
  const hot = [0, 1].some((k) => days[todayIdx + k] && (heatLevelByDay[days[todayIdx + k].date] || 0) >= 2);
  if (hot) return { status: 'hold', reason: 'heat', last, every, overdue };
  if (sim.status === 'water' || sim.status === 'cold') return { status: 'due', waterFirst: true, last, every, overdue };
  return { status: 'due', last, every, overdue };
}
