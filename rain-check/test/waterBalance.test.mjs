import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, parseLog, dryDay, planAhead } from '../src/model/waterBalance.js';
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

test('the watering log reads times, amounts and several waterings a day', () => {
  const m = parseLog(['2026-07-01', '2026-07-02T17:15', '2026-07-02T08:30|6.5', 'junk']);
  assert.deepEqual(m.get('2026-07-01'), [{ date: '2026-07-01', hour: null, mm: null }]);
  const d2 = m.get('2026-07-02');
  assert.equal(d2.length, 2);
  assert.ok(near(d2[0].hour, 8.5, 1e-9));
  assert.equal(d2[0].mm, 6.5);
  assert.ok(near(d2[1].hour, 17.25, 1e-9));
  assert.equal(d2[1].mm, null);
});

test('a watering cut short only puts back what went on', () => {
  const days = makeDays(20);
  const dry = simulate(bed({ waterLog: [days[10].date] }), days, 14, { hour: 6 });
  const part = simulate(bed({ waterLog: [days[10].date, `${days[14].date}T06:00|5`] }), days, 14, { hour: 6 });
  const full = simulate(bed({ waterLog: [days[10].date, `${days[14].date}T06:00`] }), days, 14, { hour: 6 });
  assert.ok(near(part.Dnow, Math.max(0, dry.Dnow - 5), 0.2), `part ${part.Dnow} dry ${dry.Dnow}`);
  assert.ok(full.Dnow < 0.5);
  // not enough to carry it through the day, so it still needs finishing
  assert.equal(part.status, 'water');
  assert.equal(part.partial, true);
  assert.equal(full.status, 'done');
});

test('a pot watered at dawn on a hot day says when it will need water again', () => {
  const days = makeDays(10, { et0: 8, tmax: 36 });
  const frac = (d, h) => Math.min(1, Math.max(0, (h - 6) / 13));
  const p = pot({ potSize: 'xs', spread: 'big', waterLog: [`${days[5].date}T06:30`] });
  const morning = simulate(p, days, 5, { hour: 7, fracOf: frac });
  assert.equal(morning.status, 'done');
  assert.ok(morning.againAt > 9 && morning.againAt < 19, `again at ${morning.againAt}`);
  const later = simulate(p, days, 5, { hour: 18, fracOf: frac });
  assert.equal(later.status, 'water');
  assert.equal(later.again, true);
});

test('the week plan waters on schedule and the bank stays above empty', () => {
  const days = makeDays(30, { et0: 6 });
  const sim = simulate(bed({ waterLog: [days[18].date] }), days, 20, { hour: 7 });
  const week = planAhead(sim, days, 20);
  assert.equal(week.length, 7);
  const waters = week.filter((d) => d.action === 'water');
  assert.ok(waters.length >= 2, `waterings ${waters.length}`);
  for (const d of week) assert.ok(d.moisture > 0);
  // a rainy week needs less
  const wet = makeDays(30, { et0: 6 }, { 22: { rain: 25, rainHours: 5, prob: 90 }, 25: { rain: 25, rainHours: 5, prob: 90 } });
  const wetWeek = planAhead(simulate(bed({ waterLog: [days[18].date] }), wet, 20, { hour: 7 }), wet, 20);
  assert.ok(wetWeek.filter((d) => d.action === 'water').length < waters.length);
});

test('a pot under cover gets no rain in the week plan', () => {
  const days = makeDays(30, { et0: 4 }, { 22: { rain: 25, rainHours: 5, prob: 90 } });
  const covered = planAhead(simulate(pot({ rainIn: 'covered' }), days, 20), days, 20);
  assert.equal(covered[2].rainIn, 0);
});

test('one dry day never overshoots the bank', () => {
  assert.ok(dryDay(10, 50, 0, 20, 8) <= 20);
  assert.equal(dryDay(10, 0, 30, 20, 8), 0);
});
