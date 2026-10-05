// Turns a saved bed or pot into the numbers the water bank needs on a given day:
// how much water its root zone holds, how fast it dries, and how much of a
// day's rain actually soaks in.

import { daysBetween } from '../lib/dates.js';
import {
  PLANTS,
  SOILS,
  SUN,
  SLOPES,
  POT_PLANTS,
  POT_SIZES,
  POT_MIXES,
  POT_MATERIALS,
  POT_RAIN,
  POT_SPREAD,
  POT_ESTABLISH,
  isPot,
} from './tables.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const NO_RAIN = { eff: 0, runoff: 0, lost: 0 };

// Rain lighter than a fifth of the day's ET₀ evaporates from the surface
// before it soaks in (FAO-56 chapter 8).
export const LIGHT_RAIN_SHARE = 0.2;
// Rain on a rainy day is not spread evenly over its wet hours: the heaviest
// bursts decide the runoff, so the soil only gets credit for 60% of those hours.
export const BURST_FACTOR = 0.6;
// Mulch slows runoff and holds a little water on the surface.
const MULCH_INTAKE = 1.3;
const MULCH_STORE_MM = 3;

// Self-correction from finger checks: each "drier than shown" speeds the
// drying rate up, each "wetter" slows it. Only the last 12 checks count.
export function checkTune(log) {
  let t = 1;
  for (const c of (log || []).slice(-12)) t *= c.v < 0 ? 0.85 : c.v > 0 ? 1.18 : 1;
  return clamp(t, 0.5, 2);
}

// 0 on planting day, rising to 1 once the roots have filled their space.
export function establishment(plantedOn, date, days) {
  if (!plantedOn || !days) return 1;
  const n = daysBetween(plantedOn, date);
  return n < 0 ? 0 : Math.min(1, n / days);
}

// Winter slowdown, from the mean temperature of the past 7 days.
export function dormancyFactor(plant, t7) {
  const d = plant.dormant;
  if (!d || t7 == null) return 1;
  const g = clamp((t7 - d.tLow) / (d.tHigh - d.tLow), 0, 1);
  return d.kcFrac + g * (1 - d.kcFrac);
}

// FAO-56 table 22 footnote: on high-demand days plants start to struggle
// sooner, so the share of water they can use before stress drops.
export function adjustP(p, etcMm) {
  return clamp(p + 0.04 * (5 - etcMm), 0.1, 0.8);
}

function groundModel(bed) {
  const plant = PLANTS[bed.plant] || PLANTS.veg;
  const soil = SOILS[bed.soil] || SOILS.loam;
  const sun = SUN[bed.sun] || SUN.full;
  const slope = SLOPES[bed.slope] || SLOPES.flat;
  const mulched = !!bed.mulch && !!plant.mulchKc;
  const tune = checkTune(bed.tuneLog);
  const intake = soil.infil * slope.infilF * (mulched ? MULCH_INTAKE : 1); // mm per hour
  const store = slope.storeMm + (mulched ? MULCH_STORE_MM : 0); // mm
  const growth = (date) => establishment(bed.plantedOn, date, plant.establishDays);
  const rootMm = (date) => plant.rootMm * (plant.rootStart + (1 - plant.rootStart) * growth(date));

  return {
    pot: false,
    plant,
    soil,
    sun,
    slope,
    mulched,
    tune,
    intake,
    store,
    areaM2: Math.max(0.01, Number(bed.areaM2) || 0),
    growth,
    rootMm,
    taw: (date) => soil.awc * rootMm(date),
    dormancy: (t7) => dormancyFactor(plant, t7),
    kc(date, t7) {
      const canopy = plant.canopyStart ? plant.canopyStart + (1 - plant.canopyStart) * growth(date) : 1;
      return plant.kc * canopy * dormancyFactor(plant, t7) * sun.f * (mulched ? plant.mulchKc : 1) * tune;
    },
    pFor: (et0, t7) => adjustP(plant.p, plant.kc * sun.f * dormancyFactor(plant, t7) * et0),
    // P mm of rain falling over `hours` wet hours.
    rain(P, hours, et0) {
      if (!(P > 0)) return NO_RAIN;
      if (P < LIGHT_RAIN_SHARE * et0) return { eff: 0, runoff: 0, lost: P };
      const lost = Math.min(P, plant.interceptMm);
      const net = P - lost;
      const h = hours > 0 ? hours : Math.max(1, P / 3);
      const runoff = Math.max(0, net - (intake * h * BURST_FACTOR + store));
      return { eff: net - runoff, runoff, lost };
    },
  };
}

function potModel(bed) {
  const plant = POT_PLANTS[bed.plant] || POT_PLANTS.veg;
  const size = POT_SIZES[bed.potSize] || POT_SIZES.l;
  const mix = POT_MIXES[bed.mix] || POT_MIXES.potting;
  const wall = POT_MATERIALS[bed.material] || POT_MATERIALS.plastic;
  const spread = POT_SPREAD[bed.spread] || POT_SPREAD.same;
  const shelter = POT_RAIN[bed.rainIn] || POT_RAIN.open;
  const sun = SUN[bed.sun] || SUN.full;
  const tune = checkTune(bed.tuneLog);
  // liters spread over the opening, in mm of depth
  const depthMm = size.liters / size.areaM2;
  const growth = (date) => establishment(bed.plantedOn, date, POT_ESTABLISH.days);
  const rootFrac = (date) => POT_ESTABLISH.rootStart + (1 - POT_ESTABLISH.rootStart) * growth(date);
  const rainFactor = shelter.f * spread.shed;

  return {
    pot: true,
    plant,
    size,
    mix,
    wall,
    spread,
    shelter,
    sun,
    tune,
    rainFactor,
    areaM2: size.areaM2,
    liters: size.liters,
    depthMm,
    growth,
    rootMm: (date) => depthMm * rootFrac(date),
    taw: (date) => depthMm * mix.awc * rootFrac(date),
    dormancy: (t7) => dormancyFactor(plant, t7),
    // Bare mix still loses about half a day's evaporation, however small the plant.
    kc(date, t7) {
      const leaf = Math.max(plant.kc * spread.mult * dormancyFactor(plant, t7), 0.5);
      return sun.f * (leaf + size.wall * wall.excess) * size.exposure * tune;
    },
    // Stress is judged per unit of leaf, not per unit of the small opening.
    pFor: (et0, t7) => adjustP(plant.p, plant.kc * sun.f * dormancyFactor(plant, t7) * et0),
    // Rain only enters through the rim; anything past full drains out the bottom.
    rain(P, hours, et0) {
      if (!(P > 0)) return NO_RAIN;
      if (P < LIGHT_RAIN_SHARE * et0) return { eff: 0, runoff: 0, lost: P };
      const eff = P * rainFactor;
      return { eff, runoff: 0, lost: P - eff };
    },
  };
}

export function bedModel(bed) {
  return isPot(bed) ? potModel(bed) : groundModel(bed);
}
