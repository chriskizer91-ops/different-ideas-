// The water bank. Each bed or pot holds a root zone of water; every day the
// plants draw some out and the rain that soaks in puts some back. D is the
// depletion: how many mm short of full the root zone is (FAO-56 chapter 8).

import { bedModel } from './planting.js';

export const HORIZON = 7; // days ahead the plan looks
export const COLD_WATER_C = 4.5; // 40°F: below this high, soil may be frozen and water won't soak in

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Watering log entries:
//   'YYYY-MM-DD'             a full watering, early that morning
//   'YYYY-MM-DDTHH:MM'       a full watering at that time
//   'YYYY-MM-DDTHH:MM|12.5'  12.5 mm soaked in at that time (a watering cut short)
export function parseEntry(e) {
  if (typeof e !== 'string' || e.length < 10) return null;
  const [stamp, amt] = e.split('|');
  const date = stamp.slice(0, 10);
  const hour = stamp.length >= 16 ? +stamp.slice(11, 13) + +stamp.slice(14, 16) / 60 : null;
  const mm = amt != null && amt !== '' && Number.isFinite(+amt) ? Math.max(0, +amt) : null;
  return { date, hour: Number.isFinite(hour) ? hour : null, mm };
}

// Waterings grouped by day, each day's in time order.
export function parseLog(entries) {
  const m = new Map();
  for (const e of entries || []) {
    const w = parseEntry(e);
    if (!w) continue;
    if (!m.has(w.date)) m.set(w.date, []);
    m.get(w.date).push(w);
  }
  for (const list of m.values()) list.sort((a, b) => (a.hour ?? 0) - (b.hour ?? 0));
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

// Drying without watering: rain first, then drying in small steps so a pot
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

/**
 * One day, with any waterings at their times. The day's rain and drying are
 * spread over it in step with the sun.
 *   day     { etc, rainIn, taw, raw }
 *   events  [{ f, mm }]: f is the share of the day's drying done when the
 *           water went on; mm is how much soaked in, or null for a full soak
 *   until   stop part-way through the day (0 to 1)
 */
export function runDay(D, day, events = [], until = 1) {
  let at = 0;
  const to = (f) => {
    const share = Math.max(0, f - at);
    if (share > 0) D = dryDay(D, day.etc * share, day.rainIn * share, day.taw, day.raw);
    at = Math.max(at, f);
  };
  for (const ev of events) {
    if (ev.f > until) break;
    to(ev.f);
    D = ev.mm == null ? 0 : Math.max(0, D - ev.mm);
  }
  to(until);
  return Math.min(D, day.taw);
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
  const eventsOn = (date) => (log.get(date) || []).map((w) => ({ f: w.hour == null ? 0 : fracOf(date, w.hour), mm: w.mm, hour: w.hour }));

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
    const events = i <= todayIdx ? eventsOn(date) : [];
    D = runDay(D, { etc, rainIn, taw, raw }, events);
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
      watered: events.length > 0,
    };
  }

  const plan = todayPlan(m, days, todayIdx, series, eventsOn(days[todayIdx].date), { hour, fracOf, horizon, t7 });
  return { model: m, series, ...plan };
}

function todayPlan(m, days, T, series, events, { hour, fracOf, horizon, t7 }) {
  const n = days.length;
  const s = series[T];
  const date = days[T].date;
  const watered = events.length > 0;
  const nowFrac = fracOf(date, hour);
  const day = { etc: s.etc, rainIn: s.rainIn, taw: s.taw, raw: s.raw };

  const DendDry = runDay(s.Dstart, day, [], 1); // if nothing had been watered today
  const Dnow = runDay(s.Dstart, day, events, nowFrac);

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
  const cold = days[T].tmax != null && days[T].tmax < COLD_WATER_C;
  // A watering cut short that leaves the bed due again today still needs finishing.
  const partial = watered && events[events.length - 1].mm != null;

  let status;
  let dueIdx = null;
  let amountMm = 0;
  let againAt = null;
  if (watered && Dnow < s.raw && !(partial && s.D >= s.raw)) {
    status = 'done';
    // A pot on a hot day can be back below the line before evening.
    if (s.D >= s.raw) {
      for (let h = Math.ceil(hour * 4) / 4; h <= 24; h += 0.25) {
        if (runDay(s.Dstart, day, events, fracOf(date, h)) >= s.raw) {
          againAt = h;
          break;
        }
      }
    }
    dueIdx = againAt != null ? null : firstDue(T + 1);
    amountMm = dueIdx != null ? series[dueIdx].Dstart : 0;
  } else if (watered || DendDry >= s.raw) {
    amountMm = Dnow;
    const next = series[T + 1] || s;
    const tomorrowDry = DendDry + next.etc < 0.85 * s.taw;
    if (!watered && rainSoon >= 0.6 * DendDry && tomorrowDry) status = 'wait';
    else if (cold) {
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
  for (let i = T - 1; i >= 0; i--) {
    if (series[i].rain >= 2.5) {
      lastRain = { date: series[i].date, rain: series[i].rain, soaked: series[i].rainIn, runoff: series[i].runoff, lost: series[i].lost };
      break;
    }
  }

  const Dend = watered ? s.D : DendDry;
  const lastWatering = watered ? events[events.length - 1] : null;
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
    nowFrac,
    Dstart: s.Dstart,
    Dnow,
    Dend,
    moistureNow: 100 * (1 - Dnow / s.taw),
    moistureTonight: 100 * (1 - Dend / s.taw),
    // Dropping below the line later today rather than already there.
    crossesLater: status === 'water' && Dnow < s.raw,
    veryDry: Dnow >= s.raw + 0.5 * (s.taw - s.raw),
    // A pot watered at dawn would be back below the line by mid-afternoon.
    twice: m.pot && 0.75 * s.etc >= s.raw,
    wateredToday: watered,
    waterings: events.length,
    again: watered && status === 'water',
    partial: watered && status === 'water' && partial,
    againAt,
    wateredAt: lastWatering ? lastWatering.hour : null,
    lastRain,
  };
}

/**
 * The week ahead if you follow the plan: water each morning the bed would
 * otherwise end the day below the line (unless it's too cold), and see how
 * the bank rises and falls.
 */
export function planAhead(sim, days, T, { horizon = HORIZON } = {}) {
  const s = sim.series;
  const out = [];
  let D = s[T].Dstart;
  for (let k = 0; k < horizon && T + k < days.length; k++) {
    const i = T + k;
    const p = s[i];
    const day = { etc: p.etc, rainIn: p.rainIn, taw: p.taw, raw: p.raw };
    const tmax = days[i].tmax;
    let action = null;
    let amountMm = 0;
    if (k === 0) {
      if (sim.status === 'water') {
        action = sim.again ? 'again' : 'water';
        amountMm = sim.amountMm;
        D = runDay(0, day, [], 1 - sim.nowFrac); // watered now; the rest of today still dries it
      } else {
        action = sim.status === 'done' ? 'done' : sim.status === 'wait' ? 'wait' : sim.status === 'cold' ? 'cold' : null;
        D = sim.Dend;
      }
    } else {
      const dry = runDay(D, day);
      if (dry >= p.raw) {
        if (tmax != null && tmax < COLD_WATER_C) {
          action = 'cold';
          D = dry;
        } else {
          action = 'water';
          amountMm = D;
          D = runDay(0, day);
        }
      } else D = dry;
    }
    out.push({
      date: days[i].date,
      i,
      action,
      amountMm,
      moisture: 100 * (1 - D / p.taw),
      refillAt: p.refillAt,
      rainIn: p.rainIn,
      rain: p.rain,
    });
  }
  return out;
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
