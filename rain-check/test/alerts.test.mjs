import test from 'node:test';
import assert from 'node:assert/strict';
import { coldLevel, heatLevel, levelsByDay, buildAlerts, extremeColdAt } from '../src/model/alerts.js';
import { simulate } from '../src/model/waterBalance.js';
import { makeDays, bed, pot } from './helpers.mjs';

test('cold ladder: frost, freeze, hard freeze, extreme cold', () => {
  assert.equal(coldLevel(4), 0);
  assert.equal(coldLevel(1.5), 1);
  assert.equal(coldLevel(3, { clearCalm: true }), 1);
  assert.equal(coldLevel(3), 0);
  assert.equal(coldLevel(-0.5), 2);
  assert.equal(coldLevel(-3), 3);
  assert.equal(coldLevel(-13), 4);
});

test('extreme cold adapts to the local record but never above 20°F', () => {
  assert.equal(extremeColdAt(null), -12.2);
  assert.equal(extremeColdAt({ p02Low: -28 }), -28);
  assert.equal(extremeColdAt({ p02Low: -3 }), -6.7);
  assert.equal(coldLevel(-8, { extremeAt: extremeColdAt({ p02Low: -3 }) }), 4);
  assert.equal(coldLevel(-20, { extremeAt: extremeColdAt({ p02Low: -28 }) }), 3);
});

test('heat ladder and heat waves', () => {
  assert.equal(heatLevel(31), 0);
  assert.equal(heatLevel(33), 1);
  assert.equal(heatLevel(36), 2);
  assert.equal(heatLevel(39), 3);
  const days = makeDays(10, { tmax: 25 }, { 3: { tmax: 33 }, 4: { tmax: 33 }, 5: { tmax: 36 }, 7: { tmax: 33 } });
  const L = levelsByDay(days, {}, null);
  assert.deepEqual(L.heat.slice(2, 9), [0, 2, 2, 3, 0, 1, 0]);
});

test('a hard freeze two nights out warns, names the pots, and says to water dry beds first', () => {
  const days = makeDays(30, { start: '2026-10-01', tmax: 16, tmin: 6, et0: 2 });
  days[22].tmin = -4; // morning after the night of day 21
  const T = 20;
  const beds = [bed({ id: 'v', name: 'Veg' }), pot({ id: 'p', name: 'Patio pot' }), bed({ id: 'l', name: 'Lawn', plant: 'lawn' })];
  const rows = beds.map((b) => ({ bed: b, sim: simulate(b, days, T, { hour: 9 }) }));
  const { alerts } = buildAlerts({ days, todayIdx: T, rows, hour: 9 });
  assert.equal(alerts.length, 1);
  const a = alerts[0];
  assert.equal(a.kind, 'cold');
  assert.equal(a.name, 'Hard freeze');
  assert.equal(a.level, 3);
  assert.equal(a.peak.date, days[21].date);
  assert.equal(a.routine, false);
  const names = a.atRisk.map((r) => r.name);
  assert.ok(names.includes('Patio pot'));
  assert.ok(names.includes('Veg'));
  assert.ok(!names.includes('Lawn'));
  assert.ok(a.waterFirst.length > 0);
});

test('hourly night lows win over the next morning minimum, and clear calm nights raise frost risk', () => {
  const days = makeDays(12, { tmin: 8 });
  const nights = { [days[5].date]: { low: 3, clearCalm: true } };
  const { alerts } = buildAlerts({ days, todayIdx: 5, nights });
  assert.equal(alerts[0].name, 'Frost');
  assert.equal(alerts[0].peak.date, days[5].date);
});

test('freezes that have become routine are shown quietly', () => {
  const days = makeDays(30, { start: '2026-01-01', tmax: 2, tmin: -5 });
  const { alerts } = buildAlerts({ days, todayIdx: 20 });
  assert.equal(alerts[0].routine, true);
  days[23].tmin = -15; // a much colder night still alarms
  const again = buildAlerts({ days, todayIdx: 20 });
  assert.equal(again.alerts[0].level, 4);
  assert.equal(again.alerts[0].routine, false);
});

test('the first frost of the fall is flagged', () => {
  const days = makeDays(100, { start: '2026-07-01', tmax: 22, tmin: 10 });
  days[93].tmin = 1;
  const { alerts } = buildAlerts({ days, todayIdx: 91 });
  assert.equal(alerts[0].first, true);
});
