import test from 'node:test';
import assert from 'node:assert/strict';
import { frostSeasons, frostSummary, historyStart, percentile, extremesIn } from '../src/model/climate.js';
import { addDays, dayOfYear } from '../src/lib/dates.js';

// A northern-hemisphere year: lows of -8°C in mid-January, 18°C in mid-July.
function seasonal(start, n, shiftDays = 0) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const date = addDays(start, i);
    const phase = (2 * Math.PI * (dayOfYear(date) - 15 - shiftDays)) / 365;
    const tmin = 5 - 13 * Math.cos(phase);
    days.push({ date, tmin, tmax: tmin + 11, rain: 0, et0: 2 });
  }
  return days;
}

test('history starts at a season boundary at least three years back', () => {
  assert.equal(historyStart('2026-10-05', 40), '2023-08-01');
  assert.equal(historyStart('2026-07-15', 40), '2022-08-01');
  assert.equal(historyStart('2026-10-05', -33), '2023-02-01');
});

test('frost seasons find the first fall and last spring freeze', () => {
  const days = seasonal('2023-08-01', 3 * 365 + 66);
  const seasons = frostSeasons(days, 40, 0);
  const complete = seasons.filter((s) => s.complete);
  assert.equal(complete.length, 3);
  for (const s of complete) {
    assert.ok(s.first > s.start && s.first.slice(5, 7) >= '10', `first ${s.first}`);
    assert.ok(s.last.slice(5, 7) <= '04', `last ${s.last}`);
  }
  const sum = frostSummary(days, 40, 0);
  assert.ok(sum.frostFreeDays > 150 && sum.frostFreeDays < 250, `frost-free ${sum.frostFreeDays}`);
  assert.equal(sum.lastSpring.count, 3);
});

test('a place with no freezes says so', () => {
  const days = seasonal('2023-08-01', 3 * 365 + 66).map((d) => ({ ...d, tmin: d.tmin + 20 }));
  const sum = frostSummary(days, 40, 0);
  assert.equal(sum.none, true);
});

test('a partial season at the start of the record is not trusted for its first freeze', () => {
  const days = seasonal('2023-12-01', 400);
  const seasons = frostSeasons(days, 40, 0);
  assert.equal(seasons[0].first, undefined);
  assert.ok(seasons[0].last);
});

test('percentile and extremes', () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  const c = extremesIn([{ date: 'a', tmin: -3, tmax: 30 }, { date: 'b', tmin: 1, tmax: 36 }], 0, 1);
  assert.equal(c.hard, 1);
  assert.equal(c.frost, 2);
  assert.equal(c.veryHot, 1);
  assert.equal(c.hottest.value, 36);
});
