// Frost, freeze and heat warnings, each on a ladder of four levels.
//
// Cold, by the night's lowest air temperature:
//   1 Frost         36°F / 2°C or colder (or 38°F / 3.5°C under a clear, calm sky)
//   2 Freeze        32°F / 0°C
//   3 Hard freeze   28°F / -2.2°C
//   4 Extreme cold  10°F / -12°C, or, once the 3-year record is loaded, colder than
//                   98% of nights here and at least 20°F / -6.7°C
// Heat, by the day's high:
//   1 Hot           90°F / 32°C
//   2 Very hot      95°F / 35°C
//   3 Extreme heat  100°F / 38°C
//   Three or more hot days in a row make a heat wave, one level higher (up to 4).
//
// The frost, freeze and hard-freeze lines match the US National Weather Service's
// frost advisory, freeze warning and hard freeze warning. Like the Weather Service,
// warnings for conditions that have become routine (say, the fifth hard freeze in a
// week of midwinter) are shown quietly instead of as a new alarm.

import { daysBetween, monthOf } from '../lib/dates.js';
import { isPot, plantOf } from './tables.js';
import { profilesOf, coldNote, heatNote } from './profiles.js';
import { COLD_AT, HEAT_AT, SEVERITY } from './thresholds.js';
import { colderThan, hotterThan, freezeTiming } from './normals.js';

export { COLD_AT, HEAT_AT, SEVERITY };

const COLD_NAMES = ['', 'Frost', 'Freeze', 'Hard freeze', 'Extreme cold'];
const HEAT_NAMES = ['', 'Hot', 'Very hot', 'Extreme heat', 'Extreme heat'];
const WAVE_NAMES = ['', '', 'Heat wave', 'Severe heat wave', 'Extreme heat wave'];

export function coldLevel(low, { clearCalm = false, extremeAt = COLD_AT.extreme } = {}) {
  if (low == null || !Number.isFinite(low)) return 0;
  if (low <= extremeAt) return 4;
  if (low <= COLD_AT.hard) return 3;
  if (low <= COLD_AT.freeze) return 2;
  if (low <= COLD_AT.frost || (clearCalm && low <= COLD_AT.frostClearCalm)) return 1;
  return 0;
}

export function heatLevel(high) {
  if (high == null || !Number.isFinite(high)) return 0;
  if (high >= HEAT_AT.extreme) return 3;
  if (high >= HEAT_AT.veryHot) return 2;
  if (high >= HEAT_AT.hot) return 1;
  return 0;
}

// The extreme-cold line for this place: the 2nd-percentile night from the
// record, but never warmer than 20°F; 10°F when there is no record yet.
export function extremeColdAt(climate) {
  return climate && climate.p02Low != null ? Math.min(climate.p02Low, COLD_AT.extremeFloor) : COLD_AT.extreme;
}

// The low for the night that starts on day i: from the hourly forecast when
// there is one, otherwise the next morning's minimum.
export function nightLow(days, nights, i) {
  const n = nights && nights[days[i].date];
  if (n && n.low != null) return { low: n.low, clearCalm: !!n.clearCalm };
  const next = days[i + 1];
  if (next && next.tmin != null) return { low: next.tmin, clearCalm: false };
  return null;
}

// Level for every day: cold for the night starting that day, heat for its high
// (with heat-wave runs bumped up a level).
export function levelsByDay(days, nights, climate) {
  const extremeAt = extremeColdAt(climate);
  const cold = days.map((d, i) => {
    const n = nightLow(days, nights, i);
    return n ? coldLevel(n.low, { clearCalm: n.clearCalm, extremeAt }) : 0;
  });
  const base = days.map((d) => heatLevel(d.tmax));
  const heat = base.slice();
  const wave = days.map(() => false);
  for (let i = 0; i < base.length; ) {
    if (!base[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < base.length && base[j]) j++;
    if (j - i >= 3) for (let k = i; k < j; k++) (heat[k] = Math.min(4, base[k] + 1)), (wave[k] = true);
    i = j;
  }
  return { cold, heat, wave, extremeAt };
}

// The highest level that has become routine: reached on at least `need` of the past `span` days.
function routineLevel(levels, todayIdx, span, need) {
  let routine = 0;
  for (let L = 1; L <= 4; L++) {
    let c = 0;
    for (let i = Math.max(0, todayIdx - span); i < todayIdx; i++) if (levels[i] >= L) c++;
    if (c >= need) routine = L;
  }
  return routine;
}

const COLD_ACTIONS = [
  '',
  'Cover tender plants before dusk with frost cloth, old sheets or upturned buckets, and uncover them in the morning. Move tender pots against the house or under a porch roof.',
  'Tender plants like tomatoes, peppers, basil and summer annuals will be killed or badly hurt, even under covers. Pick anything ripe, bring tender pots inside, and unhook hoses from outdoor taps.',
  'A hard freeze kills most annuals and can damage new growth on hardy shrubs and trees. Water dry beds the day before, because moist soil holds more heat than dry soil. Move pots into a garage or shed, and drain hoses and irrigation lines.',
  'Roots in pots are far less hardy than the tops, so even hardy plants in pots can die. Move pots into an unheated garage, or group them against a wall and wrap them. Mulch young trees and shrubs, and shield evergreens from drying wind.',
];

const HEAT_ACTIONS = [
  '',
  'Water early in the morning so plants start the day full. Pots, new plantings and vegetables dry out fastest.',
  'Water at dawn, mulch bare soil, and give vegetables afternoon shade if you can. Check pots twice a day. Hold off on feeding, planting and transplanting until it cools.',
  'Leaves can scorch even in moist soil. Move pots into afternoon shade, put shade cloth over vegetables, and give trees and shrubs a slow, deep soak the day before. Tomatoes and peppers may drop their flowers; they recover when it cools.',
  'Leaves can scorch even in moist soil. Move pots into afternoon shade, put shade cloth over vegetables, and give trees and shrubs a slow, deep soak before it starts and once a week while it lasts. Tomatoes and peppers may drop their flowers; they recover when it cools.',
];

// Which of the user's beds and pots a warning touches, and what to do for each.
export function coldRisk(bed, level, sim, low) {
  // Named plants have their own limits.
  const profiles = profilesOf(bed);
  if (profiles.length && low != null) return coldNote(bed, profiles, low, isPot(bed));
  const plant = plantOf(bed);
  const young = sim && sim.growth < 1;
  if (isPot(bed)) {
    if (level >= 4) return 'Move it into a garage or shed; roots in pots freeze first.';
    if (level >= 2) return plant.tender ? 'Bring it inside.' : 'Move it against the house or into a garage.';
    if (plant.tender) return 'Move it against the house or under cover.';
    return null;
  }
  if (plant.tender) {
    if (level >= 3) return 'Pick what’s ripe; covers won’t save tender plants from this.';
    if (level >= 2) return 'Pick what’s ripe and cover the rest. Covers only buy a little time.';
    return 'Cover it overnight.';
  }
  if (young && ['shrubs', 'trees', 'natives'].includes(bed.plant) && level >= 3)
    return 'Still rooting in: water it beforehand if dry, and mulch over the root zone.';
  if (level >= 4 && ['shrubs', 'trees'].includes(bed.plant)) return 'Mulch the root zone and shield evergreens from wind.';
  return null;
}

export function heatRisk(bed, level, sim, high) {
  const profiles = profilesOf(bed);
  if (profiles.length && high != null) {
    const note = heatNote(bed, profiles, high);
    if (note || !isPot(bed)) return note;
  }
  const young = sim && sim.growth < 1;
  if (isPot(bed)) return level >= 2 ? 'Check it morning and afternoon; move it into afternoon shade.' : 'It will dry fast. Check it in the afternoon.';
  if (bed.plant === 'veg' || bed.plant === 'flowers') return level >= 2 ? 'Water at dawn and shade it in the afternoon if you can.' : 'Water early in the day.';
  if (young) return 'Still rooting in, so it can’t reach deep water yet. Keep it moist.';
  if (level >= 3 && (bed.plant === 'lawn' || bed.plant === 'lawnWarm')) return 'It may brown and go dormant. It recovers, so you can let it.';
  if (level >= 3 && (bed.plant === 'trees' || bed.plant === 'shrubs')) return 'Give it a slow, deep soak before the hottest day.';
  return null;
}

// When a night is at or below a temperature, from hourly readings that start at
// 6 pm (index 0) and run to 10 am (index 16). Hours past 24 are the next morning.
function span(temps, c) {
  let from = null;
  let to = null;
  let hours = 0;
  temps.forEach((t, k) => {
    if (t != null && k <= 15 && t <= c) {
      if (from == null) from = 18 + k;
      to = 18 + k + 1;
      hours++;
    }
  });
  return hours ? { from, to, hours } : null;
}

// Hour by hour through one night: the coldest hour, how long it stays at
// frost, freeze and hard-freeze levels, and when it's warm enough to uncover.
export function nightDetail(temps) {
  if (!temps || temps.filter((t) => t != null).length < 10) return null;
  let min = null;
  let minHour = null;
  temps.forEach((t, k) => {
    if (t != null && k <= 15 && (min == null || t < min)) (min = t), (minHour = 18 + k);
  });
  let uncover = null;
  for (let k = minHour - 18 + 1; k < temps.length; k++)
    if (temps[k] != null && temps[k] > COLD_AT.frost) {
      uncover = 18 + k;
      break;
    }
  return {
    temps,
    min,
    minHour,
    frost: span(temps, COLD_AT.frost),
    freeze: span(temps, COLD_AT.freeze),
    hard: span(temps, COLD_AT.hard),
    uncover,
  };
}

/**
 * Builds the warnings for the week ahead.
 *   days, todayIdx  the daily weather, past and forecast
 *   nights          { date: { low, clearCalm } } from hourly data, optional
 *   hour            clock hour at the garden
 *   climate         { p02Low } from the 3-year record, optional
 *   rows            [{ bed, sim }] for naming the beds and pots at risk
 *   normals         30-year normals, optional, for how unusual and how early or late
 */
export function buildAlerts({ days, todayIdx, nights = {}, hour = 12, climate = null, rows = [], lat = 40, normals = null }) {
  const L = levelsByDay(days, nights, climate);
  const T = todayIdx;
  const last = Math.min(days.length - 1, T + 6);
  const out = [];

  // ---- cold ----
  const coldRoutine = routineLevel(L.cold, T, 10, 4);
  const coldDays = [];
  for (let i = T; i <= last; i++) {
    if (!L.cold[i]) continue;
    const n = nightLow(days, nights, i);
    if (!n) continue;
    const night = nights[days[i].date];
    coldDays.push({
      i,
      date: days[i].date,
      level: L.cold[i],
      value: n.low,
      clearCalm: n.clearCalm,
      detail: night && night.temps ? nightDetail(night.temps) : null,
      // the night's low is the next morning's minimum
      colder: normals && days[i + 1] ? colderThan(normals.daily, days[i + 1].date, n.low) : null,
    });
  }
  if (coldDays.length) {
    const peak = coldDays.reduce((a, b) => (b.level > a.level || (b.level === a.level && b.value < a.value) ? b : a));
    const routine = peak.level <= coldRoutine;
    // First of the season: nothing at frost level in the past 60 nights on record.
    let first = false;
    if (T >= 60) {
      first = true;
      for (let i = T - 60; i < T; i++) if (L.cold[i] >= 1) first = false;
    }
    // Late frost: spring, after two mild weeks have pushed out tender new growth.
    const spring = lat >= 0 ? [3, 4, 5, 6].includes(monthOf(days[T].date)) : [9, 10, 11, 12].includes(monthOf(days[T].date));
    let warm = 0;
    let cnt = 0;
    for (let i = Math.max(0, T - 14); i < T; i++)
      if (days[i].tmax != null && days[i].tmin != null) (warm += (days[i].tmax + days[i].tmin) / 2), cnt++;
    const late = spring && cnt >= 7 && warm / cnt >= 10;
    out.push({
      kind: 'cold',
      level: peak.level,
      name: COLD_NAMES[peak.level],
      severity: SEVERITY[peak.level],
      routine,
      first: first && !routine,
      late,
      peak,
      days: coldDays,
      // How often a freeze this early in the fall, or this late in the spring, happened before.
      timing:
        normals && peak.level >= 2
          ? freezeTiming(peak.level >= 3 ? normals.hard : normals.freeze, days[peak.i + 1] ? days[peak.i + 1].date : peak.date, lat)
          : null,
      extremeAt: L.extremeAt,
      action: COLD_ACTIONS[peak.level],
      atRisk: risks(rows, (bed, sim) => coldRisk(bed, peak.level, sim, peak.value)),
      waterFirst:
        peak.level >= 3 && daysBetween(days[T].date, peak.date) <= 2 && (days[T].tmax == null || days[T].tmax >= 4.5)
          ? rows.filter(({ sim }) => sim && !sim.wateredToday && sim.moistureNow < sim.refillAt + 10).map(({ bed }) => bed)
          : [],
    });
  }

  // ---- heat ----
  const heatRoutine = routineLevel(L.heat, T, 10, 5);
  const heatDays = [];
  for (let i = hour >= 16 ? T + 1 : T; i <= last; i++) {
    if (!L.heat[i]) continue;
    heatDays.push({
      i,
      date: days[i].date,
      level: L.heat[i],
      value: days[i].tmax,
      wave: L.wave[i],
      hotter: normals ? hotterThan(normals.daily, days[i].date, days[i].tmax) : null,
    });
  }
  if (heatDays.length) {
    const peak = heatDays.reduce((a, b) => (b.level > a.level || (b.level === a.level && b.value > a.value) ? b : a));
    const routine = peak.level <= heatRoutine;
    out.push({
      kind: 'heat',
      level: peak.level,
      name: peak.wave ? WAVE_NAMES[peak.level] : HEAT_NAMES[peak.level],
      severity: SEVERITY[peak.level],
      routine,
      wave: heatDays.some((d) => d.wave),
      peak,
      days: heatDays,
      action: HEAT_ACTIONS[peak.level],
      atRisk: risks(rows, (bed, sim) => heatRisk(bed, peak.level, sim, peak.value)),
      waterFirst:
        peak.level >= 2 && daysBetween(days[T].date, peak.date) <= 1
          ? rows.filter(({ sim }) => sim && !sim.wateredToday && sim.moistureNow < sim.refillAt + 15).map(({ bed }) => bed)
          : [],
    });
  }

  // Most urgent first; routine ones last.
  out.sort((a, b) => (a.routine - b.routine) || b.level - a.level || a.peak.i - b.peak.i);

  const heatByDate = {};
  const coldByDate = {};
  days.forEach((d, i) => {
    if (L.heat[i]) heatByDate[d.date] = L.heat[i];
    if (L.cold[i]) coldByDate[d.date] = L.cold[i];
  });
  return { alerts: out, heatByDate, coldByDate, levels: L };
}

function risks(rows, fn) {
  const list = [];
  for (const { bed, sim } of rows) {
    const tip = fn(bed, sim);
    if (tip) list.push({ id: bed.id, name: bed.name, tip });
  }
  return list;
}
