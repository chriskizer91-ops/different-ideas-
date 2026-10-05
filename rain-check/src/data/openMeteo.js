// Weather from Open-Meteo (free, no key, CC BY 4.0): the forecast API for the
// past three months and the next ten days, and the archive API for the years before.

import { addDays } from '../lib/dates.js';
import { penmanMonteith, hargreaves, windAt2m } from '../model/et0.js';

export const PAST_DAYS = 92;
export const FORECAST_DAYS = 10;

const DAILY = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_hours',
  'precipitation_probability_max',
  'et0_fao_evapotranspiration',
  'shortwave_radiation_sum',
  'sunrise',
  'sunset',
];
const HOURLY = ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'cloud_cover', 'precipitation'];
const RECENT_DAYS = 13; // hour-by-hour detail is kept for the last few days and the forecast
const ARCHIVE_DAILY = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'precipitation_hours', 'et0_fao_evapotranspiration'];

export const forecastUrl = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
  `&daily=${DAILY.join(',')}&hourly=${HOURLY.join(',')}` +
  `&wind_speed_unit=ms&past_days=${PAST_DAYS}&forecast_days=${FORECAST_DAYS}&timezone=auto`;

export const archiveUrl = (lat, lon, start, end) =>
  `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
  `&start_date=${start}&end_date=${end}&daily=${ARCHIVE_DAILY.join(',')}&timezone=auto`;

export const geocodeUrl = (name) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=en&format=json`;

export async function fetchJson(url, timeoutMs = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function searchPlaces(name) {
  const json = await fetchJson(geocodeUrl(name.trim()));
  return (json.results || []).map((m) => ({
    name: [m.name, m.admin1, m.country_code].filter(Boolean).join(', '),
    lat: +m.latitude.toFixed(3),
    lon: +m.longitude.toFixed(3),
  }));
}

const pick = (obj, key, i) => (obj[key] && obj[key][i] != null ? obj[key][i] : null);

const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

// "2026-10-05T07:02" -> 7.03
export const clockHour = (iso) => (typeof iso === 'string' && iso.length >= 16 ? +iso.slice(11, 13) + +iso.slice(14, 16) / 60 : null);

// Hourly readings grouped by day (humidity range, mean wind, and the hours
// themselves) and by night: 6 pm to 10 am, with the low (to 9 am) and whether
// the small hours stay clear and calm, when frost forms.
function hourlyByDay(hourly) {
  const byDay = {};
  const hours = {};
  const byNight = {};
  const times = hourly.time || [];
  times.forEach((t, i) => {
    const date = t.slice(0, 10);
    const h = +t.slice(11, 13);
    const rh = pick(hourly, 'relative_humidity_2m', i);
    const w = pick(hourly, 'wind_speed_10m', i);
    const temp = pick(hourly, 'temperature_2m', i);
    const cloud = pick(hourly, 'cloud_cover', i);
    const precip = pick(hourly, 'precipitation', i);
    const d = (byDay[date] = byDay[date] || { rhMin: null, rhMax: null, wSum: 0, wN: 0 });
    if (rh != null) {
      d.rhMin = d.rhMin == null ? rh : Math.min(d.rhMin, rh);
      d.rhMax = d.rhMax == null ? rh : Math.max(d.rhMax, rh);
    }
    if (w != null) (d.wSum += w), d.wN++;
    const hd = (hours[date] = hours[date] || { t: Array(24).fill(null), p: Array(24).fill(null), c: Array(24).fill(null) });
    hd.t[h] = r1(temp);
    hd.p[h] = r1(precip);
    hd.c[h] = cloud;
    // the night that starts on the evening of `night`: index 0 is 6 pm, 16 is 10 am
    const night = h >= 18 ? date : h <= 10 ? addDays(date, -1) : null;
    if (night && temp != null) {
      const k = h >= 18 ? h - 18 : h + 6;
      const n = (byNight[night] = byNight[night] || { low: null, hours: 0, temps: Array(17).fill(null), cloudSum: 0, cloudN: 0, windSum: 0, windN: 0 });
      n.temps[k] = r1(temp);
      if (k <= 15) {
        n.low = n.low == null ? temp : Math.min(n.low, temp);
        n.hours++;
      }
      if (h >= 21 || h <= 6) {
        if (cloud != null) (n.cloudSum += cloud), n.cloudN++;
        if (w != null) (n.windSum += w), n.windN++;
      }
    }
  });
  const nights = {};
  for (const [date, n] of Object.entries(byNight)) {
    if (n.hours < 12) continue; // the first and last nights are cut off
    const cloud = n.cloudN ? n.cloudSum / n.cloudN : 100;
    const wind = n.windN ? windAt2m(n.windSum / n.windN) : 5;
    nights[date] = { low: n.low, clearCalm: cloud < 30 && wind < 1.5, temps: n.temps };
  }
  return { byDay, nights, hours };
}

export function parseForecast(json, lat) {
  const daily = json.daily || {};
  const elev = json.elevation != null ? json.elevation : 0;
  const { byDay, nights, hours } = hourlyByDay(json.hourly || {});
  const days = (daily.time || []).map((date, i) => {
    const h = byDay[date] || { rhMin: null, rhMax: null, wN: 0 };
    const tmax = pick(daily, 'temperature_2m_max', i);
    const tmin = pick(daily, 'temperature_2m_min', i);
    const rs = pick(daily, 'shortwave_radiation_sum', i);
    const u2 = h.wN ? windAt2m(h.wSum / h.wN) : 2;
    let et0Calc = null;
    if (tmax != null && tmin != null)
      et0Calc =
        h.rhMin != null && rs != null
          ? penmanMonteith({ tmax, tmin, rhMax: h.rhMax, rhMin: h.rhMin, u2, rs, lat, elev, date })
          : hargreaves({ tmax, tmin, lat, date });
    const et0Api = pick(daily, 'et0_fao_evapotranspiration', i);
    return {
      date,
      tmax,
      tmin,
      rain: pick(daily, 'precipitation_sum', i) || 0,
      rainHours: pick(daily, 'precipitation_hours', i),
      prob: pick(daily, 'precipitation_probability_max', i),
      et0: et0Api != null ? et0Api : et0Calc != null ? et0Calc : 0,
      et0Api,
      et0Calc,
      rs,
      u2,
      rhMin: h.rhMin,
      rhMax: h.rhMax,
      sunrise: clockHour(pick(daily, 'sunrise', i)),
      sunset: clockHour(pick(daily, 'sunset', i)),
    };
  });
  // Keep hour-by-hour detail only for recent days and the forecast, to keep the saved copy small.
  const recent = new Set(days.slice(-RECENT_DAYS).map((d) => d.date));
  const keptHours = {};
  for (const d of Object.keys(hours)) if (recent.has(d)) keptHours[d] = hours[d];
  for (const [d, n] of Object.entries(nights)) if (!recent.has(d)) delete n.temps;
  return { days, nights, hours: keptHours, offsetSeconds: json.utc_offset_seconds || 0, elevation: elev, timezone: json.timezone || null };
}

// The archive, packed small for saving: one array per field, one decimal.
export function packArchive(json, lat, key, fetchedOn) {
  const d = json.daily || {};
  const time = d.time || [];
  if (!time.length) return null;
  const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
  const col = (k) => time.map((_, i) => r1(pick(d, k, i)));
  const tmax = col('temperature_2m_max');
  const tmin = col('temperature_2m_min');
  let et0 = col('et0_fao_evapotranspiration');
  et0 = et0.map((v, i) =>
    v != null ? v : tmax[i] != null && tmin[i] != null ? r1(hargreaves({ tmax: tmax[i], tmin: tmin[i], lat, date: time[i] })) : null,
  );
  return {
    key,
    fetchedOn,
    start: time[0],
    end: time[time.length - 1],
    rain: col('precipitation_sum'),
    rainHours: col('precipitation_hours'),
    et0,
    tmax,
    tmin,
  };
}

export function unpackArchive(p) {
  return p.rain.map((rain, i) => ({
    date: addDays(p.start, i),
    rain: rain || 0,
    rainHours: p.rainHours ? p.rainHours[i] : null,
    et0: p.et0[i] || 0,
    et0Api: p.et0[i],
    et0Calc: null,
    tmax: p.tmax[i],
    tmin: p.tmin[i],
    prob: null,
  }));
}

// Joins the archive onto the front of the forecast's days, if they meet.
export function joinHistory(history, forecastDays) {
  if (!history || !history.length || !forecastDays.length) return null;
  const first = forecastDays[0].date;
  const before = history.filter((d) => d.date < first);
  if (!before.length || addDays(before[before.length - 1].date, 1) !== first) return null;
  return before.concat(forecastDays);
}

// ---- 30 years of daily highs and lows, for climate normals ----
export const normalsUrl = (lat, lon, start, end) =>
  `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
  `&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;

export function packNormals(json, key, fetchedOn) {
  const d = json.daily || {};
  const time = d.time || [];
  if (!time.length) return null;
  const col = (k) => time.map((_, i) => r1(pick(d, k, i)));
  return { key, fetchedOn, start: time[0], end: time[time.length - 1], tmax: col('temperature_2m_max'), tmin: col('temperature_2m_min') };
}

export function unpackNormals(p) {
  return p.tmax.map((tmax, i) => ({ date: addDays(p.start, i), tmax, tmin: p.tmin[i] }));
}
