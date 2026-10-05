import test from 'node:test';
import assert from 'node:assert/strict';
import { penmanMonteith, hargreaves, windAt2m, satVap } from '../src/model/et0.js';
import { extraterrestrialRadiation, dayLengthHours, dayFraction } from '../src/model/solar.js';
import { near } from './helpers.mjs';

test('saturation vapour pressure matches FAO-56 annex 2', () => {
  assert.ok(near(satVap(21.5), 2.564, 0.002));
  assert.ok(near(satVap(12.3), 1.431, 0.002));
});

test('FAO-56 example 8: Ra at 20°S on 3 September is 32.2 MJ/m²/day', () => {
  assert.ok(near(extraterrestrialRadiation(-20, '2026-09-03'), 32.2, 0.2));
});

test('FAO-56 example 9: 11.7 hours of daylight at 20°S on 3 September', () => {
  assert.ok(near(dayLengthHours(-20, '2026-09-03'), 11.7, 0.1));
});

test('FAO-56 example 18: Uccle, Brussels, 6 July gives ET0 of 3.9 mm/day', () => {
  const et0 = penmanMonteith({
    tmax: 21.5,
    tmin: 12.3,
    rhMax: 84,
    rhMin: 63,
    u2: windAt2m(10 / 3.6),
    rs: 22.07,
    lat: 50 + 48 / 60,
    elev: 100,
    date: '2026-07-06',
  });
  assert.ok(near(et0, 3.9, 0.1), `got ${et0.toFixed(2)}`);
});

test('wind at 10 m is reduced to 2 m by 0.748', () => {
  assert.ok(near(windAt2m(1), 0.748, 0.001));
});

test('Hargreaves gives a sensible midsummer value', () => {
  const v = hargreaves({ tmax: 30, tmin: 18, lat: 40, date: '2026-07-01' });
  assert.ok(v > 4.5 && v < 7, `got ${v}`);
});

test('ET0 rises with heat, sun, wind and dry air', () => {
  const base = { tmax: 25, tmin: 14, rhMax: 80, rhMin: 45, u2: 2, rs: 22, lat: 40, elev: 100, date: '2026-06-15' };
  const e = penmanMonteith(base);
  assert.ok(penmanMonteith({ ...base, tmax: 33 }) > e);
  assert.ok(penmanMonteith({ ...base, u2: 5 }) > e);
  assert.ok(penmanMonteith({ ...base, rhMin: 20 }) > e);
  assert.ok(penmanMonteith({ ...base, rs: 12 }) < e);
});

test('drying follows the sun: none before dawn, half near solar noon, all by dusk', () => {
  const where = { lat: 40, lon: -75, date: '2026-06-21', offsetSeconds: -4 * 3600 };
  assert.equal(dayFraction(3, where), 0);
  assert.ok(near(dayFraction(13, where), 0.5, 0.05)); // solar noon near 1 pm daylight time at 75°W
  assert.equal(dayFraction(23, where), 1);
});
