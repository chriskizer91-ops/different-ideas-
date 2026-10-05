// The water bank. Each bed or pot holds a root zone of water; every day the
// plants draw some out and the rain that soaks in puts some back. D is the
// depletion: how many mm short of full the root zone is (FAO-56 chapter 8).

import { bedModel } from './planting.js';

export const HORIZON = 7; // days ahead the plan looks
export const COLD_WATER_C = 4.5; // 40°F: below this high, soil may be frozen and water won't soak in

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Watering log entries are 'YYYY-MM-DD' (assume early morning) or
// 'YYYY-MM-DDTHH:MM' (logged at that time of day). Keeps the last one per day.
export function parseLog(entries) {
  const m = new Map();
  for (const e of entries || []) {
    if (typeof e !== 'string' || e.length < 10) continue;
    const date = e.slice(0, 10);
    const hour = e.length >= 16 ? +e.slice(11, 13) + +e.slice(14, 16) / 60 : null;
    if (!m.has(date) || (hour ?? 0) > (m.get(date) ?? 0)) m.set(date, hour);
  }
  return m;
}

// Mean of the daily mean temperature over the 7 days ending on each day.
export function rollingT7(days) {
  const out = new Array(days.length);
  let sum = 0;
  let cnt = 0;
  const q = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const t = d.tmax != null && d.tmin != null ? (d.tmax + d.tmin) / 2 : null;
    q.push(t);
    if (t != null) (sum += t), cnt++;
    if (q.length > 7) {
      const old = q.shift();
      if (old != null) (sum -= old), cnt--;
    }
    out[i] = cnt ? sum / cnt : null;
  }
  return out;
}

// One day without watering: rain first, then drying in small steps so a pot
// that can empty in a day slows down properly as it gets dry.
export function dryDay(D, etc, rainIn, taw, raw) {
  D = Math.max(0, D - rainIn);
  const n = Math.min(24, Math.max(1, Math.ceil(etc / (0.1 * taw))));
  for (let k = 0; k < n; k++) {
    // Ks, the water stress coefficient (FAO-56 eq. 84): below the refill
    // line the plants close up and use less.
    const ks = D <= raw ? 1 : Math.max(0, (taw - D) / (taw - raw));
    D = Math.min(taw, D + (ks * etc) / n);
  }
  return D;
}

const defaultFrac = (date, hour) => clamp((hour - 6) / 13, 0, 1);

/**
 * Runs the bank over every day in `days` and works out today's plan.
 *   days      [{ date, et0, rain, rainHours, prob, tmax, tmin }], past then forecast
 *   todayIdx  index of today in days
 *   hour      clock hour at the garden now
 *   fracOf    (date, hour) => share of that day's drying done by that hour
 */
export function simulate(bed, days, todayIdx, { hour = 12, fracOf = defaultFrac, horizon = HORIZON } = {}) {
  const m = bedModel(bed);
  const log = parseLog(bed.waterLog);
  const t7 = rollingT7(days);
  const n = days.length;
  const series = new Array(n);
  let D = 0; // the bank starts full: the oldest day shown is assumed soaked

  for (let i = 0; i < n; i++) {
    const day = days[i];
    const date = day.date;
    const taw = m.taw(date);
    if (bed.plantedOn === date) D = 0; // new plantings are watered in
    D = Math.min(D, taw);
    const et0 = day.et0 || 0;
    const kc = m.kc(date, t7[i]);
    const etc = kc * et0;
    const p = m.pFor(et0, t7[i]);
    const raw = p * taw;
    // Forecast rain counts at its expected value: the amount times its chance.
    const chance = i >= todayIdx && day.prob != null ? day.prob / 100 : 1;
    const r = m.rain(day.rain || 0, day.rainHours, et0);
    const rainIn = r.eff * chance;
    const Dstart = D;
    const watered = i <= todayIdx && log.has(date);
    if (watered) {
      // Drying before the watering is wiped out by it; the rest of the day
      // dries the refilled soil.
      const h = log.get(date);
      const left = 1 - (h == null ? 0 : fracOf(date, h));
      D = clamp(left * (etc - rainIn), 0, taw);
    } else {
      D = dryDay(D, etc, rainIn, taw, raw);
    }
    series[i] = {
      date,
      Dstart,
      D,
      taw,
      raw,
      p,
      kc,
      etc,
      et0,
      rain: day.rain || 0,
      rainIn,
      runoff: r.runoff * chance,
      lost: r.lost * chance,
      moisture: 100 * (1 - D / taw),
      refillAt: 100 * (1 - p),
      forecast: i > todayIdx,
      watered,
    };
  }

  return { model: m, series, ...todayPlan(m, bed, days, todayIdx, series, log, { hour, fracOf, horizon, t7 }) };
}

function todayPlan(m, bed, days, T, series, log, { hour, fracOf, horizon, t7 }) {
  const n = days.length;
  const s = series[T];
  const date = days[T].date;
  const watered = log.has(date);
  const wHour = watered ? log.get(date) : null;
  const nowFrac = fracOf(date, hour);

  // Where the bank ends today if nothing is watered.
  const DendDry = watered ? dryDay(s.Dstart, s.etc, s.rainIn, s.taw, s.raw) : s.D;
  let Dnow;
  if (watered) {
    const f = wHour == null ? 0 : fracOf(date, wHour);
    Dnow = nowFrac <= f ? 0 : (s.D * (nowFrac - f)) / Math.max(1e-6, 1 - f);
  } else {
    Dnow = s.Dstart + nowFrac * (s.D - s.Dstart);
  }

  // Rain likely by tomorrow (at least an even chance), as it would soak in.
  let rainSoon = 0;
  for (let i = T; i <= Math.min(T + 1, n - 1); i++) {
    const prob = days[i].prob != null ? days[i].prob : 100;
    if (prob >= 50) rainSoon += m.rain(days[i].rain || 0, days[i].rainHours, days[i].et0 || 0).eff * (prob / 100);
  }

  const last = Math.min(n - 1, T + horizon);
  const firstDue = (from) => {
    for (let i = from; i <= last; i++) if (series[i].D >= series[i].raw) return i;
    return null;
  };
  const warmDay = (from) => {
    for (let i = from; i <= last; i++) if (days[i].tmax == null || days[i].tmax >= COLD_WATER_C) return i;
    return null;
  };

  let status;
  let dueIdx = null;
  let amountMm = 0;
  if (watered) {
    status = 'done';
    dueIdx = firstDue(T + 1);
    amountMm = dueIdx != null ? series[dueIdx].Dstart : 0;
  } else if (DendDry >= s.raw) {
    amountMm = Dnow;
    const next = series[T + 1] || s;
    const tomorrowDry = DendDry + next.etc < 0.85 * s.taw;
    if (rainSoon >= 0.6 * DendDry && tomorrowDry) status = 'wait';
    else if (days[T].tmax != null && days[T].tmax < COLD_WATER_C) {
      status = 'cold';
      dueIdx = warmDay(T + 1);
    } else {
      status = 'water';
      dueIdx = T;
    }
  } else {
    dueIdx = firstDue(T + 1);
    status = dueIdx == null ? 'ok' : 'later';
    amountMm = dueIdx != null ? series[dueIdx].Dstart : 0;
  }

  // Most recent soaking rain, for showing how much of it counted.
  let lastRain = null;
  for (let i = T; i >= 0; i--) {
    if (series[i].rain >= 2.5 && !series[i].forecast && i < T) {
      lastRain = { date: series[i].date, rain: series[i].rain, soaked: series[i].rainIn, runoff: series[i].runoff, lost: series[i].lost };
      break;
    }
  }

  return {
    status,
    dueIdx,
    daysUntil: dueIdx != null ? dueIdx - T : null,
    amountMm,
    rainSoon,
    taw: s.taw,
    raw: s.raw,
    p: s.p,
    refillAt: s.refillAt,
    rootMm: m.rootMm(date),
    kcToday: s.kc,
    etcToday: s.etc,
    growth: m.growth(date),
    dormancy: m.dormancy(t7[T]),
    Dstart: s.Dstart,
    Dnow,
    Dend: watered ? s.D : DendDry,
    moistureNow: 100 * (1 - Dnow / s.taw),
    moistureTonight: 100 * (1 - (watered ? s.D : DendDry) / s.taw),
    // Dropping below the line later today rather than already there.
    crossesLater: !watered && status === 'water' && Dnow < s.raw,
    veryDry: !watered && Dnow >= s.raw + 0.5 * (s.taw - s.raw),
    // A pot watered at dawn would be back below the line by mid-afternoon.
    twice: m.pot && 0.75 * s.etc >= s.raw,
    wateredToday: watered,
    wateredAt: wHour,
    lastRain,
  };
}

// Stretches of days below the refill line, for the chart summary.
export function dryStats(series, from, to) {
  let below = 0;
  let run = 0;
  let longest = 0;
  let longestEnd = null;
  let days = 0;
  for (let i = Math.max(0, from); i <= Math.min(to, series.length - 1); i++) {
    const s = series[i];
    days++;
    if (s.D >= s.raw) {
      below++;
      run++;
      if (run > longest) (longest = run), (longestEnd = s.date);
    } else run = 0;
  }
  return { days, below, longest, longestEnd, stillGoing: run > 0 && run === longest };
}
