// Sun geometry from FAO-56 chapter 3: how much sunlight reaches the top of the
// atmosphere, how long the day is, and how a day's drying spreads across the clock.

import { dayOfYear } from '../lib/dates.js';

const GSC = 0.082; // solar constant, MJ m⁻² min⁻¹
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export const solarDeclination = (J) => 0.409 * Math.sin((2 * Math.PI * J) / 365 - 1.39); // eq. 24
export const sunsetHourAngle = (latRad, decl) => Math.acos(clamp(-Math.tan(latRad) * Math.tan(decl), -1, 1)); // eq. 25

// Ra, extraterrestrial radiation, MJ m⁻² day⁻¹ (eq. 21).
export function extraterrestrialRadiation(latDeg, date) {
  const J = dayOfYear(date);
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * J) / 365);
  const d = solarDeclination(J);
  const ws = sunsetHourAngle(phi, d);
  const ra = ((24 * 60) / Math.PI) * GSC * dr * (ws * Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.sin(ws));
  return Math.max(0, ra);
}

// Daylight hours, N (eq. 34).
export function dayLengthHours(latDeg, date) {
  const phi = (latDeg * Math.PI) / 180;
  return (24 / Math.PI) * sunsetHourAngle(phi, solarDeclination(dayOfYear(date)));
}

// Seasonal correction for solar time, hours (FAO-56 eq. 32): the equation of time.
export function seasonalCorrection(J) {
  const b = (2 * Math.PI * (J - 81)) / 364;
  return 0.1645 * Math.sin(2 * b) - 0.1255 * Math.cos(b) - 0.025 * Math.sin(b);
}

// Solar noon on the garden's clock, from its longitude, UTC offset and the date.
export function solarNoonClock({ lon = 0, date, offsetSeconds = 0 }) {
  return 12 + offsetSeconds / 3600 - lon / 15 - (date ? seasonalCorrection(dayOfYear(date)) : 0);
}

// Sunrise and sunset on the clock, when the sun's upper edge meets the
// horizon (0.833° below, allowing for refraction). Null in polar day or night.
export function sunTimes({ lat = 40, lon = 0, date, offsetSeconds = 0 }) {
  const phi = (lat * Math.PI) / 180;
  const d = solarDeclination(dayOfYear(date));
  const cosW = (Math.sin((-0.833 * Math.PI) / 180) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d));
  const noon = solarNoonClock({ lon, date, offsetSeconds });
  if (cosW >= 1) return { rise: null, set: null, noon, polar: 'night' };
  if (cosW <= -1) return { rise: null, set: null, noon, polar: 'day' };
  const half = (Math.acos(cosW) * 12) / Math.PI;
  return { rise: noon - half, set: noon + half, noon, polar: null };
}

// Share of the day's evaporation already done at this clock hour (0 to 1).
// Drying follows the sun: none before sunrise, all of it by sunset, fastest
// around solar noon.
export function dayFraction(hour, { lat = 40, lon = 0, date, offsetSeconds = 0 }) {
  const N = date ? dayLengthHours(lat, date) : 12;
  const noon = clamp(solarNoonClock({ lon, date, offsetSeconds }), 9, 15);
  if (N < 0.5) return hour < noon ? 0 : 1; // polar night
  const rise = noon - N / 2;
  const set = noon + N / 2;
  if (hour <= rise) return 0;
  if (hour >= set) return 1;
  return (1 - Math.cos((Math.PI * (hour - rise)) / N)) / 2;
}
