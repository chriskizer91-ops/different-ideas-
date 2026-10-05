import test from 'node:test';
import assert from 'node:assert/strict';
import { parseForecast, packArchive, unpackArchive, joinHistory, forecastUrl } from '../src/data/openMeteo.js';
import { readBackup, makeBackup, cleanBed, newBed } from '../src/data/store.js';
import { feedingPlan } from '../src/model/feeding.js';
import { simulate } from '../src/model/waterBalance.js';
import { sampleForecast, sampleHistory } from '../src/data/sample.js';
import { addDays } from '../src/lib/dates.js';
import { makeDays, bed } from './helpers.mjs';

function forecastJson() {
  const time = ['2026-10-04', '2026-10-05', '2026-10-06'];
  const hourly = { time: [], temperature_2m: [], relative_humidity_2m: [], wind_speed_10m: [], cloud_cover: [] };
  for (const d of time)
    for (let h = 0; h < 24; h++) {
      hourly.time.push(`${d}T${String(h).padStart(2, '0')}:00`);
      // the night of Oct 5 bottoms out at -3 at 6 am on Oct 6
      hourly.temperature_2m.push(d === '2026-10-06' && h === 6 ? -3 : 8);
      hourly.relative_humidity_2m.push(h < 12 ? 80 : 40);
      hourly.wind_speed_10m.push(1);
      hourly.cloud_cover.push(d === '2026-10-06' || (d === '2026-10-05' && h >= 18) ? 0 : 80);
    }
  return {
    utc_offset_seconds: -21600,
    elevation: 1600,
    daily: {
      time,
      temperature_2m_max: [15, 14, 10],
      temperature_2m_min: [5, 4, -3],
      precipitation_sum: [0, 12, 0],
      precipitation_hours: [0, 3, 0],
      precipitation_probability_max: [null, 70, 5],
      et0_fao_evapotranspiration: [2.1, null, null],
      shortwave_radiation_sum: [15, 8, null],
    },
    hourly,
  };
}

test('forecast parsing: ET0 from the API, then Penman-Monteith, then Hargreaves', () => {
  const f = parseForecast(forecastJson(), 39.7);
  assert.equal(f.days.length, 3);
  assert.equal(f.days[0].et0, 2.1);
  assert.ok(f.days[1].et0Calc > 0 && f.days[1].et0 === f.days[1].et0Calc);
  assert.ok(f.days[2].et0 > 0); // no radiation: Hargreaves
  assert.equal(f.days[1].rainHours, 3);
  assert.equal(f.offsetSeconds, -21600);
});

test('night lows come from the hourly temperatures, with clear and calm noted', () => {
  const f = parseForecast(forecastJson(), 39.7);
  assert.equal(f.nights['2026-10-05'].low, -3);
  assert.equal(f.nights['2026-10-05'].clearCalm, true);
  assert.equal(f.nights['2026-10-04'].clearCalm, false);
});

test('the forecast URL asks for rain hours and the hourly fields frost needs', () => {
  const u = forecastUrl(39.7, -105);
  for (const k of ['precipitation_hours', 'temperature_2m', 'cloud_cover', 'past_days=92', 'forecast_days=10']) assert.ok(u.includes(k), k);
});

test('archive packs small and joins onto the forecast', () => {
  const time = [];
  for (let i = 0; i < 5; i++) time.push(addDays('2026-01-01', i));
  const json = { daily: { time, temperature_2m_max: [1, 2, 3, 4, 5], temperature_2m_min: [-5, -4, -3, -2, -1], precipitation_sum: [0, 1.234, 0, 0, 3], precipitation_hours: [0, 1, 0, 0, 2], et0_fao_evapotranspiration: [0.5, null, 0.5, 0.5, 0.5] } };
  const packed = packArchive(json, 40, 'k', '2026-02-01');
  assert.equal(packed.rain[1], 1.2);
  assert.ok(packed.et0[1] > 0); // filled in by Hargreaves
  const hist = unpackArchive(packed);
  const fc = makeDays(3, { start: '2026-01-06' });
  const joined = joinHistory(hist, fc);
  assert.equal(joined.length, 8);
  assert.equal(joinHistory(hist, makeDays(3, { start: '2026-01-09' })), null); // gap
});

test('backups round-trip and reject other files', () => {
  const beds = [newBed({ name: 'A' }), newBed({ site: 'pot', name: 'B' })];
  const back = readBackup(makeBackup({ units: 'metric', place: { name: 'X', lat: 1, lon: 2 }, beds, chartRange: '3m' }));
  assert.deepEqual(back.beds.map((b) => b.name), ['A', 'B']);
  assert.equal(back.place.lat, 1);
  assert.throws(() => readBackup('{"hello":1}'));
  assert.throws(() => readBackup('not json'));
});

test('damaged beds are repaired', () => {
  const b = cleanBed({ name: 'X', plant: 'cactus', soil: 'moon', waterLog: 'no' });
  assert.equal(b.plant, 'veg');
  assert.equal(b.soil, 'loam');
  assert.deepEqual(b.waterLog, []);
  assert.ok(b.id);
});

test('feeding: unknown until logged, then due on schedule, held for heavy rain', () => {
  const days = makeDays(40, { start: '2026-06-01' });
  const T = 30;
  const sim = simulate(bed(), days, T);
  assert.equal(feedingPlan(bed(), days, T, sim).status, 'unknown');
  assert.equal(feedingPlan(bed({ feedLog: [days[20].date] }), days, T, sim).status, 'later');
  assert.equal(feedingPlan(bed({ feedLog: [days[1].date] }), days, T, sim).status, 'due');
  const wet = makeDays(40, { start: '2026-06-01' }, { 31: { rain: 30, prob: 90 } });
  assert.equal(feedingPlan(bed({ feedLog: [days[1].date] }), wet, T, sim).status, 'hold');
  const cold = makeDays(40, { start: '2026-06-01', tmax: 8, tmin: 0 });
  assert.equal(feedingPlan(bed({ feedLog: [days[1].date] }), cold, T, sim).status, 'rest');
  assert.equal(feedingPlan(bed({ feedEvery: 0 }), days, T, sim).status, 'off');
});

test('sample weather joins its history without a gap and has winters', () => {
  const today = '2026-10-05';
  const f = sampleForecast({}, today);
  const h = sampleHistory({}, today);
  assert.equal(f.days[f.todayIdx].date, today);
  assert.ok(joinHistory(h, f.days));
  assert.ok(h.some((d) => d.tmin <= 0));
});
