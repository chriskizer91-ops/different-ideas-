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

// Share of the day's evaporation already done at this clock hour (0 to 1).
// Drying follows the sun: none before sunrise, all of it by sunset, fastest
// around solar noon. Solar noon on the clock comes from the longitude and the
// UTC offset; the equation of time (under 17 minutes) is left out.
export function dayFraction(hour, { lat = 40, lon = 0, date, offsetSeconds = 0 }) {
  const N = date ? dayLengthHours(lat, date) : 12;
  const noon = clamp(12 + offsetSeconds / 3600 - lon / 15, 9, 15);
  if (N < 0.5) return hour < noon ? 0 : 1; // polar night
  const rise = noon - N / 2;
  const set = noon + N / 2;
  if (hour <= rise) return 0;
  if (hour >= set) return 1;
  return (1 - Math.cos((Math.PI * (hour - rise)) / N)) / 2;
}
