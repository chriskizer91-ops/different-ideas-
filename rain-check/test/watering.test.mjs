import test from 'node:test';
import assert from 'node:assert/strict';
import { howToWater, cycleSoak, methodOf, timerPhases, sprinklerRateFromCatch, hoseFlowFromFill, WATER_DEFAULTS } from '../src/model/watering.js';
import { bedModel } from '../src/model/planting.js';
import { bed, pot, near } from './helpers.mjs';

test('lawns default to a sprinkler, beds to a hose, pots to a can', () => {
  assert.equal(methodOf(bed({ plant: 'lawn' })), 'sprinkler');
  assert.equal(methodOf(bed()), 'hose');
  assert.equal(methodOf(pot()), 'can');
  assert.equal(methodOf(pot({ water: { method: 'sprinkler' } })), 'can'); // no sprinklers for pots
});

test('more comes out of the hose than soaks in', () => {
  const b = bed({ areaM2: 10, water: { method: 'sprinkler' } });
  const h = howToWater(b, bedModel(b), 15);
  assert.ok(near(h.grossMm, 15 / 0.75, 1e-9));
  assert.ok(near(h.litersAll, 200, 1e-6));
  assert.ok(near(h.minutes, (20 / WATER_DEFAULTS.sprinklerMmH) * 60, 1e-6));
});

test('hose minutes come from flow, cans from can size', () => {
  const b = bed({ areaM2: 5, water: { method: 'hose', hoseLpm: 10 } });
  const h = howToWater(b, bedModel(b), 17);
  assert.ok(near(h.minutes, (17 / 0.85) * 5 / 10, 1e-6));
  const c = bed({ areaM2: 2, water: { method: 'can', canL: 10 } });
  assert.ok(near(howToWater(c, bedModel(c), 19).cans, (19 / 0.95) * 2 / 10, 1e-6));
});

test('pots multiply by how many are alike', () => {
  const one = pot({ water: { method: 'hose' } });
  const three = pot({ count: 3, water: { method: 'hose' } });
  const a = howToWater(one, bedModel(one), 10);
  const b = howToWater(three, bedModel(three), 10);
  assert.ok(near(b.litersAll, 3 * a.litersAll, 1e-9));
  assert.ok(near(b.litersEach, a.litersEach, 1e-9));
});

test('cycle and soak on clay, not on loam', () => {
  const clay = bed({ soil: 'clay', plant: 'lawn', areaM2: 20 });
  const loam = bed({ soil: 'loam', plant: 'lawn', areaM2: 20 });
  const c = howToWater(clay, bedModel(clay), 20);
  const l = howToWater(loam, bedModel(loam), 20);
  assert.ok(c.cycles && c.cycles.n >= 2, JSON.stringify(c.cycles));
  assert.ok(near(c.cycles.runMin * c.cycles.n, c.minutes, 1e-6));
  assert.equal(l.cycles, null);
  // a steep clay slope needs many short runs
  const steep = bed({ soil: 'clay', plant: 'lawn', slope: 'steep', areaM2: 20 });
  assert.equal(howToWater(steep, bedModel(steep), 20).cycles.tooMany, true);
});

test('cycle math: runoff starts when the surface store fills', () => {
  // 12 mm/h onto soil taking 4 mm/h with 5 mm of surface store: 37.5 minutes before runoff
  const c = cycleSoak(100, 12, 4, 5);
  assert.equal(c.n, 3);
  assert.ok(near(c.maxRunMin, 37.5, 1e-9));
  assert.equal(cycleSoak(30, 12, 4, 5), null);
  assert.equal(cycleSoak(100, 10, 13, 5), null);
});

test('timer phases alternate runs and rests', () => {
  const clay = bed({ soil: 'clay', plant: 'lawn', areaM2: 20 });
  const h = howToWater(clay, bedModel(clay), 20);
  const ph = timerPhases(h);
  assert.equal(ph.filter((p) => p.kind === 'run').length, h.cycles.n);
  assert.equal(ph.filter((p) => p.kind === 'soak').length, h.cycles.n - 1);
  assert.deepEqual(timerPhases(howToWater(pot(), bedModel(pot()), 10)), []); // cans aren't timed
});

test('calibration: tuna cans and buckets', () => {
  assert.equal(sprinklerRateFromCatch(3), 12);
  assert.ok(near(hoseFlowFromFill(3.785, 20), 11.355, 1e-3));
});
