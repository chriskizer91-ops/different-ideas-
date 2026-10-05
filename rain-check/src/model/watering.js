// How water gets onto a bed or pot, and how long that takes.
//
// The plan works in mm that soak into the root zone (net). What has to come
// out of the hose is more (gross), because some blows away, evaporates in the
// air, or lands where the roots aren't: gross = net / efficiency. Typical
// application efficiencies: sprinklers 70 to 80%, hand watering 80 to 90%,
// drip and soaker hoses about 90%.

import { isPot, potCount } from './tables.js';

export const METHODS = {
  sprinkler: { label: 'Sprinkler', eff: 0.75, timed: true, ground: true },
  hose: { label: 'Hose or watering wand', eff: 0.85, timed: true },
  soaker: { label: 'Soaker hose', eff: 0.9, timed: true, ground: true },
  drip: { label: 'Drip emitters', eff: 0.9, timed: true },
  can: { label: 'Watering can', eff: 0.95, timed: false },
};

// Starting values until you measure your own (all metric).
export const WATER_DEFAULTS = {
  sprinklerMmH: 12, // an oscillating or impact sprinkler, about half an inch an hour
  hoseLpm: 11, // a hose with a nozzle, about 3 gallons a minute
  soakerM: 15, // a 50-foot soaker hose
  soakerLpmPerM: 0.2, // about 0.8 gallons a minute per 50 feet at low pressure
  dripLph: 3.8, // 1-gallon-an-hour emitters
  canL: 7.6, // a 2-gallon can
};

export const SOAK_MIN = 30; // rest between runs so the water can sink in

export function defaultMethod(bed) {
  if (isPot(bed)) return 'can';
  return bed.plant === 'lawn' || bed.plant === 'lawnWarm' ? 'sprinkler' : 'hose';
}

// The method in use, falling back when the saved one doesn't suit a pot.
export function methodOf(bed) {
  const m = bed.water && bed.water.method;
  if (!METHODS[m]) return defaultMethod(bed);
  if (isPot(bed) && METHODS[m].ground) return defaultMethod(bed);
  return m;
}

export function waterSettings(bed) {
  const w = { ...WATER_DEFAULTS, ...(bed.water || {}) };
  if (!(w.dripCount > 0)) {
    // Emitters: one per pot, or a typical spacing for the planting.
    w.dripCount = isPot(bed) ? 1 : Math.max(2, Math.round((bed.areaM2 || 1) * (bed.plant === 'veg' || bed.plant === 'flowers' ? 4 : 1.5)));
  }
  return w;
}

/**
 * Cycle and soak: a sprinkler that puts water down faster than the soil takes
 * it in fills the surface dips, then runs off. Runoff starts after
 * store / (rate - intake) hours, so longer waterings are split into runs no
 * longer than that, with a rest between.
 */
export function cycleSoak(minutes, rateMmH, intakeMmH, storeMm) {
  if (!(minutes > 0) || !(rateMmH > intakeMmH)) return null;
  const maxRun = (storeMm / (rateMmH - intakeMmH)) * 60;
  if (minutes <= maxRun) return null;
  const run = Math.max(5, Math.floor(maxRun));
  const n = Math.ceil(minutes / run);
  return { n, runMin: minutes / n, soakMin: SOAK_MIN, maxRunMin: maxRun, tooMany: n > 4 };
}

/**
 * Turns a net amount (mm into the root zone) into what to do:
 * liters, minutes for timed methods, or cans.
 */
export function howToWater(bed, model, netMm) {
  const method = methodOf(bed);
  const M = METHODS[method];
  const w = waterSettings(bed);
  const pots = model.pot ? potCount(bed) : 1;
  const grossMm = Math.max(0, netMm) / M.eff;
  const litersEach = grossMm * model.areaM2; // per pot, or for the whole bed
  const litersAll = litersEach * pots;
  const out = { method, label: M.label, eff: M.eff, netMm, grossMm, litersEach, litersAll, pots, timed: M.timed };
  if (method === 'sprinkler') {
    out.rateMmH = w.sprinklerMmH;
    out.minutes = (grossMm / w.sprinklerMmH) * 60;
    if (!model.pot) out.cycles = cycleSoak(out.minutes, w.sprinklerMmH, model.intake, model.store);
  } else if (method === 'hose') {
    out.flowLpm = w.hoseLpm;
    out.minutes = litersAll / w.hoseLpm;
  } else if (method === 'soaker') {
    out.flowLpm = w.soakerM * w.soakerLpmPerM;
    out.minutes = litersAll / out.flowLpm;
  } else if (method === 'drip') {
    out.flowLpm = (w.dripCount * w.dripLph) / 60 * (model.pot ? pots : 1);
    out.minutes = litersAll / out.flowLpm;
  } else {
    out.canL = w.canL;
    out.cans = litersAll / w.canL;
  }
  return out;
}

// The timer's steps: one run, or runs with rests between for cycle and soak.
export function timerPhases(how) {
  if (!how.timed || !(how.minutes > 0)) return [];
  const whole = (m) => Math.max(1, Math.round(m)) * 60e3;
  const c = how.cycles;
  if (!c) return [{ kind: 'run', ms: whole(how.minutes) }];
  const out = [];
  for (let k = 0; k < c.n; k++) {
    out.push({ kind: 'run', ms: whole(c.runMin) });
    if (k < c.n - 1) out.push({ kind: 'soak', ms: c.soakMin * 60e3 });
  }
  return out;
}

// Calibration helpers.
// Tuna-can test: depth caught in 15 minutes, times 4, is the rate per hour.
export const sprinklerRateFromCatch = (mmIn15) => mmIn15 * 4;
// Bucket test: liters filled in so many seconds.
export const hoseFlowFromFill = (liters, seconds) => (seconds > 0 ? (liters / seconds) * 60 : null);
