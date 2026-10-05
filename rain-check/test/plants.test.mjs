import test from 'node:test';
import assert from 'node:assert/strict';
import { windowIn, windowsFor, windowsInYear, plantNow, frostDatesFrom, heatSeason } from '../src/model/calendar.js';
import { profileById, waterTraits, coldOutcome, coldNote, heatNote, profilesOf } from '../src/model/profiles.js';
import { bedModel } from '../src/model/planting.js';
import { buildAlerts } from '../src/model/alerts.js';
import { simulate } from '../src/model/waterBalance.js';
import { PLANT_LIBRARY } from '../src/data/plants.js';
import { makeDays, bed, pot } from './helpers.mjs';

// Dallas averages used by Texas A&M AgriLife: last freeze Mar 12, first freeze Nov 22.
const DFW = { last: '03-12', first: '11-22' };
const P = (id) => {
  const p = profileById(id);
  assert.ok(p, `missing plant ${id}`);
  return p;
};

test('windows turn frost-relative weeks into dates', () => {
  const tomato = P('tomato');
  const spring = tomato.windows.find((w) => w.anchor === 'last');
  const o = windowIn(spring, DFW, 2026);
  assert.equal(o.start, '2026-03-19'); // a week after the last freeze
  const fall = tomato.windows.find((w) => w.anchor === 'first');
  const f = windowIn(fall, DFW, 2026);
  assert.ok(f.start >= '2026-06-15' && f.end <= '2026-07-31', `${f.start}..${f.end}`); // late June to July, as DFW guides say
});

test('what is open now, what is coming, and what waits for next year', () => {
  const garlic = windowsFor(P('garlic'), DFW, '2026-10-05');
  assert.equal(garlic[0].status, 'now');
  const tomato = windowsFor(P('tomato'), DFW, '2026-10-05');
  assert.ok(tomato.every((w) => w.status === 'later'));
  assert.ok(tomato[0].start > '2026-10-05');
  const { now } = plantNow([P('garlic'), P('tomato')], DFW, '2026-10-05');
  assert.deepEqual(now.map((x) => x.profile.id), ['garlic']);
});

test('the timeline keeps each window inside the calendar year', () => {
  for (const p of PLANT_LIBRARY) {
    for (const w of windowsInYear(p, DFW, 2026)) {
      assert.ok(w.start >= '2026-01-01' && w.end <= '2026-12-31' && w.start <= w.end, `${p.id} ${w.start}..${w.end}`);
    }
  }
});

test('frost dates: your own first, then 30 years, then the recent record', () => {
  const normals = { freeze: { last: { p50: '03-14', p90: '03-30' }, first: { p50: '11-20', p10: '11-05' } } };
  assert.equal(frostDatesFrom({ normals }).last, '03-14');
  assert.equal(frostDatesFrom({ normals, custom: { last: '03-20', first: '11-15' } }).last, '03-20');
  assert.equal(frostDatesFrom({}), null);
});

test('heat season from normal highs', () => {
  const daily = Array.from({ length: 365 }, (_, k) => ({ hi: Array(101).fill(k >= 160 && k <= 250 ? 35 : 25) }));
  const s = heatSeason(daily, 33.3);
  assert.equal(s.from, '06-10');
  assert.equal(s.to, '09-08');
  assert.equal(heatSeason(daily, 40), null);
});

test('a mixed bed is watered for its thirstiest, shallowest-rooted plant', () => {
  const t = waterTraits([P('tomato'), P('basil')]);
  assert.equal(t.kc, P('tomato').kc);
  assert.equal(t.rootMm, P('basil').rootMm);
  const b = bed({ plants: ['tomato', 'basil'] });
  const m = bedModel(b);
  assert.equal(m.plant.kc, t.kc);
  assert.equal(m.rootMm('2026-07-01'), t.rootMm);
  assert.deepEqual(profilesOf(bed({ plants: ['tomato', 'nope'] })).map((p) => p.id), ['tomato']);
});

test('cold outcomes follow each plant’s own limits', () => {
  assert.equal(coldOutcome(P('tomato'), 1), 'damage'); // frost on the leaves
  assert.equal(coldOutcome(P('tomato'), -3), 'kill');
  assert.equal(coldOutcome(P('kale'), -3), 'fine');
  assert.equal(coldOutcome(P('turks-cap'), -6), 'dieback');
  assert.equal(coldOutcome(P('live-oak'), -6), 'fine');
  const note = coldNote(bed(), [P('tomato'), P('kale')], -3, false);
  assert.match(note, /Tomato dies/);
  assert.match(note, /Kale is fine to about \{\{t:/);
  assert.equal(coldNote(bed(), [P('kale')], -3, false), null);
});

test('heat notes name what the heat does', () => {
  assert.match(heatNote(bed(), [P('tomato'), P('pepper')], 36), /Tomato sets little fruit|Pepper drops/);
  assert.equal(heatNote(bed(), [P('tomato')], 30), null);
});

test('freeze warnings speak about the plants in each bed', () => {
  const days = makeDays(30, { start: '2026-11-01', tmax: 15, tmin: 6, et0: 2 });
  days[22].tmin = -4;
  const beds = [bed({ id: 'v', name: 'Veg', plants: ['tomato', 'kale'] }), pot({ id: 'p', name: 'Lemon', plants: ['meyer-lemon'] })];
  const rows = beds.map((b) => ({ bed: b, sim: simulate(b, days, 20) }));
  const { alerts } = buildAlerts({ days, todayIdx: 20, rows });
  const veg = alerts[0].atRisk.find((r) => r.id === 'v');
  const lemon = alerts[0].atRisk.find((r) => r.id === 'p');
  assert.match(veg.tip, /Tomato/);
  assert.match(lemon.tip, /Meyer lemon/);
});

test('every plant in the library is complete', () => {
  const ids = new Set();
  for (const p of PLANT_LIBRARY) {
    assert.ok(!ids.has(p.id), `duplicate ${p.id}`);
    ids.add(p.id);
    for (const k of ['id', 'name', 'group', 'base', 'kc', 'rootMm', 'p', 'windows']) assert.ok(p[k] != null, `${p.id} lacks ${k}`);
    assert.ok(p.kc > 0 && p.kc <= 1.3, `${p.id} kc ${p.kc}`);
    assert.ok(p.p > 0 && p.p < 1, `${p.id} p ${p.p}`);
    assert.ok(p.windows.length > 0, `${p.id} has no planting window`);
  }
});
