// Reference evapotranspiration (ET₀): how much water a well-watered lawn would
// lose to the air in a day, in mm. Every plant's use is a share of this.

import { extraterrestrialRadiation } from './solar.js';

// Saturation vapour pressure, kPa (FAO-56 eq. 11).
export const satVap = (T) => 0.6108 * Math.exp((17.27 * T) / (T + 237.3));

// Wind measured at 10 m, brought down to the 2 m the equation expects (eq. 47).
export const windAt2m = (u10) => (u10 * 4.87) / Math.log(67.8 * 10 - 5.42);

// FAO-56 Penman-Monteith, daily step (eq. 6), with soil heat flux taken as zero.
// tmax/tmin °C, rhMax/rhMin %, u2 m/s at 2 m, rs MJ m⁻² day⁻¹, lat degrees, elev m.
export function penmanMonteith({ tmax, tmin, rhMax, rhMin, u2, rs, lat, elev = 0, date }) {
  const tmean = (tmax + tmin) / 2;
  const P = 101.3 * Math.pow((293 - 0.0065 * elev) / 293, 5.26); // eq. 7
  const gamma = 0.000665 * P; // eq. 8
  const delta = (4098 * satVap(tmean)) / Math.pow(tmean + 237.3, 2); // eq. 13
  const es = (satVap(tmax) + satVap(tmin)) / 2; // eq. 12
  const ea = (satVap(tmin) * (rhMax / 100) + satVap(tmax) * (rhMin / 100)) / 2; // eq. 17
  const ra = extraterrestrialRadiation(lat, date);
  const rso = (0.75 + 2e-5 * elev) * ra; // eq. 37
  const relSun = rso > 0 ? Math.min(1, Math.max(0.3, rs / rso)) : 0.5;
  const rns = (1 - 0.23) * rs; // eq. 38, grass albedo 0.23
  const sigma = 4.903e-9;
  const rnl =
    sigma *
    ((Math.pow(tmax + 273.16, 4) + Math.pow(tmin + 273.16, 4)) / 2) *
    (0.34 - 0.14 * Math.sqrt(Math.max(0, ea))) *
    (1.35 * relSun - 0.35); // eq. 39
  const rn = rns - rnl;
  const et0 =
    (0.408 * delta * rn + gamma * (900 / (tmean + 273)) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2));
  return Math.max(0, et0);
}

// Hargreaves (FAO-56 eq. 52): a fallback that needs only temperatures.
export function hargreaves({ tmax, tmin, lat, date }) {
  const ra = extraterrestrialRadiation(lat, date);
  const tmean = (tmax + tmin) / 2;
  return Math.max(0, 0.0023 * (tmean + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * 0.408 * ra);
}
