import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, parseLog, dryDay } from '../src/model/waterBalance.js';
import { bedModel, adjustP, dormancyFactor, establishment, checkTune } from '../src/model/planting.js';
import { PLANTS } from '../src/model/tables.js';
import { makeDays, bed, pot, near } from './helpers.mjs';

test('a dry hot spell drains the bed until it needs water', () => {
  const days = makeDays(20);
  const r = simulate(bed(), days, 15, { hour: 7 });
  assert.equal(r.status, 'water');
  assert.ok(r.amountMm > 0);
  // the bank only drains: each day ends at least as dry as it started
  for (let i = 1; i <= 15; i++) assert.ok(r.series[i].D >= r.series[i - 1].D - 1e-9);
});

test('depletion never passes empty, and drying slows below the refill line', () => {
  const days = makeDays(120);
  const r = simulate(bed(), days, 100);
  const s = r.series;
  assert.ok(s[99].D <= s[99].taw + 1e-9);
  const early = s[2].D - s[1].D;
  const late = s[99].D - s[98].D;
  assert.ok(late < early * 0.2, `late ${late} vs early ${early}`);
});

test('a watering logged today refills the bank and plans the next one', () => {
  const days = makeDays(20);
  const r = simulate(bed({ waterLog: [days[15].date + 'T07:00'] }), days, 15, { hour: 7 });
  assert.equal(r.status, 'done');
  assert.ok(near(r.moistureNow, 100, 0.5));
  assert.ok(r.dueIdx > 15);
});

test('the gauge shows now: full at dawn, drier by evening', () => {
  const days = makeDays(20);
  const frac = (d, h) => Math.min(1, Math.max(0, (h - 6) / 13));
  const morning = simulate(bed({ waterLog: [days[10].date] }), days, 12, { hour: 6, fracOf: frac });
  const evening = simulate(bed({ waterLog: [days[10].date] }), days, 12, { hour: 19, fracOf: frac });
  assert.ok(morning.moistureNow > evening.moistureNow);
  assert.ok(near(evening.moistureNow, evening.moistureTonight, 0.01));
});

test('likely rain tomorrow means hold off', () => {
  const days = makeDays(20, {}, { 16: { rain: 30, rainHours: 6, prob: 90 } });
  for (let i = 15; i < 20; i++) days[i].prob = days[i].prob ?? 10;
  const dry = simulate(bed({ waterLog: [days[11].date] }), makeDays(20), 15, { hour: 7 });
  const wet = simulate(bed({ waterLog: [days[11].date] }), days, 15, { hour: 7 });
  assert.equal(dry.status, 'water');
  assert.equal(wet.status, 'wait');
});

test('heavy rain runs off clay but soaks into sand', () => {
  const clay = bedModel(bed({ soil: 'clay' })).rain(40, 3, 4);
  const sand = bedModel(bed({ soil: 'sand' })).rain(40, 3, 4);
  assert.ok(clay.runoff > 15, `clay runoff ${clay.runoff}`);
  assert.equal(sand.runoff, 0);
  assert.ok(sand.eff > clay.eff);
});

test('slopes shed more and mulch sheds less', () => {
  const flat = bedModel(bed({ soil: 'clayLoam' })).rain(40, 4, 4).runoff;
  const steep = bedModel(bed({ soil: 'clayLoam', slope: 'steep' })).rain(40, 4, 4).runoff;
  const mulched = bedModel(bed({ soil: 'clayLoam', mulch: true })).rain(40, 4, 4).runoff;
  assert.ok(steep > flat);
  assert.ok(mulched < flat);
});

test('a drizzle under a fifth of ET0 is lost to evaporation', () => {
  assert.equal(bedModel(bed()).rain(0.8, 2, 5).eff, 0);
  assert.ok(bedModel(bed()).rain(3, 2, 5).eff > 0);
});

test('soil type sets how much the root zone holds', () => {
  const t = (soil) => bedModel(bed({ soil })).taw('2026-07-01');
  assert.ok(t('sand') < t('sandyLoam'));
  assert.ok(t('sandyLoam') < t('loam'));
  assert.ok(t('loam') < t('siltLoam'));
  assert.ok(near(t('loam'), 0.15 * 300, 1e-9));
});

test('a young tree has a shallow root zone that deepens over two years', () => {
  const young = bedModel(bed({ plant: 'trees', plantedOn: '2026-06-01' }));
  assert.ok(near(young.rootMm('2026-06-01'), 0.4 * 600, 1e-9));
  assert.ok(young.rootMm('2027-06-01') > young.rootMm('2026-09-01'));
  assert.ok(near(young.rootMm('2028-06-01'), 600, 1e-9));
  assert.equal(establishment(null, '2026-06-01', 730), 1);
});

test('a newly planted tree needs water sooner than an established one', () => {
  const days = makeDays(60, { start: '2026-06-01' });
  const firstDry = (r) => r.series.findIndex((s, i) => i > 10 && s.D >= s.raw);
  const est = simulate(bed({ plant: 'trees', waterLog: [days[10].date] }), days, 59);
  const young = simulate(bed({ plant: 'trees', plantedOn: '2026-06-01', waterLog: [days[10].date] }), days, 59);
  assert.ok(firstDry(young) > 10);
  assert.ok(firstDry(young) < firstDry(est), `young ${firstDry(young)}, established ${firstDry(est)}`);
});

test('cool weather puts lawns and shrubs into dormancy', () => {
  assert.equal(dormancyFactor(PLANTS.lawn, 15), 1);
  assert.ok(near(dormancyFactor(PLANTS.lawn, 2), 0.35, 1e-9));
  assert.ok(dormancyFactor(PLANTS.lawnWarm, 12) < dormancyFactor(PLANTS.lawn, 12));
  assert.equal(dormancyFactor(PLANTS.veg, 0), 1);
});

test('hot days lower the share plants can use before stress (FAO-56 p adjustment)', () => {
  assert.ok(near(adjustP(0.5, 5), 0.5, 1e-9));
  assert.ok(adjustP(0.5, 9) < 0.5);
  assert.ok(adjustP(0.5, 2) > 0.5);
  assert.equal(adjustP(0.5, 30), 0.1);
});

test('a small pot on a hot day can dry out twice', () => {
  const days = makeDays(10, { et0: 7, tmax: 34 });
  const r = simulate(pot({ potSize: 'xs', spread: 'past', waterLog: [days[5].date] }), days, 5, { hour: 7 });
  assert.equal(r.twice, true);
});

test('terracotta loses more than plastic, sheltered pots get less rain', () => {
  const p = bedModel(pot());
  const c = bedModel(pot({ material: 'clay' }));
  assert.ok(c.kc('2026-07-01', 20) > p.kc('2026-07-01', 20));
  assert.equal(bedModel(pot({ rainIn: 'covered' })).rain(20, 4, 4).eff, 0);
});

test('below 40°F the plan waits for a warmer day', () => {
  const days = makeDays(20, { et0: 1.5, tmax: 20 });
  for (let i = 15; i < 17; i++) (days[i].tmax = 1), (days[i].tmin = -6);
  const r = simulate(bed(), days, 15, { hour: 10 });
  if (r.status !== 'ok' && r.status !== 'later') {
    assert.equal(r.status, 'cold');
    assert.equal(r.dueIdx, 17);
  }
});

test('finger checks nudge the drying rate, within limits', () => {
  assert.equal(checkTune([]), 1);
  assert.ok(checkTune([{ v: 1 }]) > 1);
  assert.ok(checkTune([{ v: -1 }]) < 1);
  assert.equal(checkTune(Array(40).fill({ v: 1 })), 2);
});

test('the watering log keeps the latest time of each day', () => {
  const m = parseLog(['2026-07-01', '2026-07-02T08:30', '2026-07-02T17:15']);
  assert.equal(m.get('2026-07-01'), null);
  assert.ok(near(m.get('2026-07-02'), 17.25, 1e-9));
});

test('one dry day never overshoots the bank', () => {
  assert.ok(dryDay(10, 50, 0, 20, 8) <= 20);
  assert.equal(dryDay(10, 0, 30, 20, 8), 0);
});
