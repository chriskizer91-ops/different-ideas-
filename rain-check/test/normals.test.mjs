import test from 'node:test';
import assert from 'node:assert/strict';
import { zoneFromF, frostOdds, climateNormals, colderThan, hotterThan, normalsStart, freezeTiming, doyIndex, normalFor, chillHours } from '../src/model/normals.js';
import { nightDetail } from '../src/model/alerts.js';
import { sampleNormals } from '../src/data/sample.js';
import { sunTimes } from '../src/model/solar.js';
import { addDays, daysBetween } from '../src/lib/dates.js';
import { near } from './helpers.mjs';

test('USDA zones: 10°F bands split into a and b halves', () => {
  assert.equal(zoneFromF(3), '7a');
  assert.equal(zoneFromF(0), '7a');
  assert.equal(zoneFromF(-0.1), '6b');
  assert.equal(zoneFromF(-3), '6b');
  assert.equal(zoneFromF(-12), '5b');
  assert.equal(zoneFromF(32), '10a');
  assert.equal(zoneFromF(-75), '1a');
  assert.equal(zoneFromF(80), '13b');
});

test('30-year fetch covers 30 whole frost seasons', () => {
  assert.equal(normalsStart('2026-10-05', 40), '1996-08-01');
  assert.equal(normalsStart('2026-03-05', 40), '1995-08-01');
  assert.equal(normalsStart('2026-10-05', -33), '1996-02-01');
});

// Thirty winters where the last spring freeze falls on day `lastDay[y]` after Jan 1
// and the first fall freeze on `firstDay[y]` days after Aug 1.
function winters(lastDays, firstDays) {
  const days = [];
  const start = '1996-08-01';
  const n = lastDays.length;
  for (let s = 0; s < n; s++) {
    const seasonStart = `${1996 + s}-08-01`;
    const jan1 = `${1997 + s}-01-01`;
    const end = addDays(`${1997 + s}-08-01`, -1);
    for (let d = seasonStart; d <= end; d = addDays(d, 1)) {
      const sd = daysBetween(seasonStart, d);
      const jd = daysBetween(jan1, d);
      const freezing = sd >= firstDays[s] && jd <= lastDays[s];
      days.push({ date: d, tmin: freezing ? -3 : 8, tmax: 15 });
    }
  }
  assert.equal(days[0].date, start);
  return days;
}

test('frost odds: the middle and the one-in-ten years', () => {
  const lasts = Array.from({ length: 30 }, (_, k) => 80 + k); // Mar 22 + k
  const firsts = Array.from({ length: 30 }, (_, k) => 60 + k); // Sep 30 + k
  const odds = frostOdds(winters(lasts, firsts), 40, 0);
  assert.equal(odds.seasons, 30);
  assert.equal(odds.noneYears, 0);
  // nearest rank: index 3, 14 or 15, 26 of 0..29
  assert.equal(odds.last.p10, addDays('2002-01-01', 83).slice(5));
  assert.equal(odds.last.p90, addDays('2002-01-01', 106).slice(5));
  assert.equal(odds.first.p10, addDays('2001-08-01', 63).slice(5));
  assert.ok(odds.frostFree.p50 > 150 && odds.frostFree.p50 < 220, `${odds.frostFree.p50}`);
});

test('how often a freeze came this early in the fall', () => {
  const lasts = Array.from({ length: 30 }, () => 90);
  const firsts = Array.from({ length: 30 }, (_, k) => 60 + k);
  const odds = frostOdds(winters(lasts, firsts), 40, 0);
  const t = freezeTiming(odds, '2026-10-02', 40); // season day 62
  assert.equal(t.fall, true);
  assert.equal(t.count, 3); // seasons whose first freeze was on day 60, 61 or 62
});

test('normals from sample years: ordered percentiles, ranks and a zone', () => {
  const days = sampleNormals({}, '2026-10-05');
  const n = climateNormals(days, 40);
  assert.ok(n.freeze && n.hard && n.zone);
  assert.match(n.zone.zone, /^\d{1,2}[ab]$/);
  const d = n.daily[doyIndex('2026-01-15')];
  assert.ok(d.lo[10] <= d.lo[50] && d.lo[50] <= d.lo[90]);
  assert.ok(d.pFreeze > 0.3);
  assert.ok(colderThan(n.daily, '2026-01-15', d.lo[1] - 5) > 0.99);
  assert.ok(near(colderThan(n.daily, '2026-01-15', d.lo[50]), 0.5, 0.05));
  assert.ok(hotterThan(n.daily, '2026-07-15', 60) === 1);
  const norm = normalFor(n.daily, '2026-07-15');
  assert.ok(norm.high > norm.low);
  assert.ok(n.p02Low < d.lo[50]);
});

test('chill hours count winter hours between 32 and 45°F', () => {
  // every winter day 2°C to 12°C: the curve spends roughly a third of each day in the band
  const days = [];
  for (let d = '2000-08-01'; d < '2010-08-01'; d = addDays(d, 1)) days.push({ date: d, tmin: 2, tmax: 12 });
  const c = chillHours(days, 32);
  assert.ok(c.winters >= 9);
  assert.ok(c.typical > 600 && c.typical < 1500, `${c.typical}`);
  // warmer winters chill less
  const warm = chillHours(days.map((x) => ({ ...x, tmin: x.tmin + 6, tmax: x.tmax + 6 })), 32);
  assert.ok(warm.typical < c.typical);
});

test('frost-night detail: hours below freezing, coldest hour, when to uncover', () => {
  // 6 pm 5°C falling to -3°C at 5 am, back to 6°C by 10 am
  const temps = [5, 4, 3, 2.5, 2, 1.5, 1, 0.5, 0, -0.5, -1, -2, -3, -2.5, -1, 1, 3, 6].slice(0, 17);
  const d = nightDetail(temps);
  assert.equal(d.min, -3);
  assert.equal(d.minHour, 30); // 6 am
  assert.deepEqual(d.freeze, { from: 26, to: 33, hours: 7 }); // at or below 32°F from 2 am until 9 am
  assert.deepEqual(d.hard, { from: 30, to: 32, hours: 2 }); // 28°F or colder, 6 to 8 am
  assert.equal(d.uncover, 34); // first hour above 36°F after the low: 10 am
});

test('sunrise and sunset: about 12 hours at the equinox, long days in June', () => {
  const eq = sunTimes({ lat: 40, lon: 0, date: '2026-03-20', offsetSeconds: 0 });
  assert.ok(near(eq.set - eq.rise, 12.1, 0.15), `${eq.set - eq.rise}`);
  const june = sunTimes({ lat: 40, lon: 0, date: '2026-06-21', offsetSeconds: 0 });
  assert.ok(near(june.set - june.rise, 15, 0.2), `${june.set - june.rise}`);
  assert.equal(sunTimes({ lat: 80, lon: 0, date: '2026-12-21' }).polar, 'night');
});
