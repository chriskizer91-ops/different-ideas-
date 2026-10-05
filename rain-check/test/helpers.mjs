import { addDays } from '../src/lib/dates.js';

// A run of days with steady weather, overridable per index.
export function makeDays(n, { start = '2026-07-01', et0 = 5, tmax = 28, tmin = 16, rain = 0, rainHours = null, prob = null } = {}, edits = {}) {
  const days = [];
  for (let i = 0; i < n; i++) {
    days.push({ date: addDays(start, i), et0, tmax, tmin, rain, rainHours, prob, ...(edits[i] || {}) });
  }
  return days;
}

export const bed = (over = {}) => ({
  id: 'b',
  name: 'Bed',
  site: 'ground',
  plant: 'veg',
  soil: 'loam',
  sun: 'full',
  slope: 'flat',
  areaM2: 5,
  waterLog: [],
  feedLog: [],
  feedEvery: 28,
  ...over,
});

export const pot = (over = {}) =>
  bed({ site: 'pot', plant: 'veg', potSize: 'l', mix: 'potting', material: 'plastic', rainIn: 'open', spread: 'same', count: 1, ...over });

export const near = (a, b, tol) => Math.abs(a - b) <= tol;
