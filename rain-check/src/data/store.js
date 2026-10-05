// Saving to this browser (localStorage), the last good forecast for offline
// use, the weather archive, backups, and moving data over from version 1.

import { addDays } from '../lib/dates.js';
import { PLANTS, POT_PLANTS, SOILS, isPot } from '../model/tables.js';

const KEY = 'raincheck-v2';
const FORECAST_KEY = 'raincheck-forecast-v2';
const HISTORY_KEY = 'raincheck-history-v2';
const NORMALS_KEY = 'raincheck-normals-v1';
const V1_KEY = 'raincheck-v1';
const V1_HISTORY_KEY = 'raincheck-history-v1';

export const env = (() => {
  let framed = false;
  let canSave = false;
  try {
    framed = window.self !== window.top;
  } catch {
    framed = true;
  }
  try {
    window.localStorage.setItem('__rc_probe', '1');
    window.localStorage.removeItem('__rc_probe');
    canSave = true;
  } catch {}
  return { framed, canSave, preview: framed && !canSave };
})();

function read(key) {
  if (!env.canSave) return null;
  try {
    const t = window.localStorage.getItem(key);
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  if (!env.canSave) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Could not save', e);
    return false;
  }
}

function remove(key) {
  if (!env.canSave) return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

const newId = () => Math.random().toString(36).slice(2, 10);

export function newBed(over = {}) {
  const pot = isPot(over);
  const plant = over.plant || (pot ? 'flowers' : 'veg');
  const base = {
    id: newId(),
    name: pot ? 'New pot' : 'New bed',
    site: pot ? 'pot' : 'ground',
    plant,
    sun: 'full',
    plantedOn: null,
    feedEvery: (pot ? POT_PLANTS : PLANTS)[plant].feedEvery,
    waterLog: [],
    feedLog: [],
    tuneLog: [],
    water: {},
    plants: [],
  };
  const ground = { soil: 'loam', slope: 'flat', mulch: false, areaM2: 4.6 };
  const potBits = { potSize: 'l', mix: 'potting', material: 'plastic', rainIn: 'open', spread: 'same', count: 1 };
  return { ...base, ...(pot ? potBits : ground), ...over };
}

// A starting garden for North Texas: blackland clay, Bermuda lawn, natives.
export function starterBeds(today) {
  return [
    newBed({ name: 'Vegetable bed', plant: 'veg', soil: 'amended', mulch: true, areaM2: 4.6, plants: ['tomato', 'pepper', 'basil'] }),
    newBed({ name: 'Front lawn', plant: 'lawnWarm', soil: 'clay', areaM2: 46, plants: ['bermuda'], feedEvery: 56 }),
    newBed({ name: 'Native border', plant: 'shrubs', soil: 'clay', sun: 'part', mulch: true, areaM2: 6, plants: ['turks-cap', 'texas-sage'], feedEvery: 0 }),
    newBed({ name: 'Young live oak', plant: 'trees', soil: 'clay', mulch: true, areaM2: 1.2, plantedOn: addDays(today, -150), plants: ['live-oak'], feedEvery: 0 }),
    newBed({ name: 'Meyer lemon', site: 'pot', plant: 'trees', potSize: 'xl', spread: 'same', plants: ['meyer-lemon'], feedEvery: 30 }),
  ];
}

// Fills in anything missing so older or hand-edited data can't break the app.
export function cleanBed(b) {
  const pot = isPot(b);
  const table = pot ? POT_PLANTS : PLANTS;
  const bed = newBed({ site: pot ? 'pot' : 'ground', plant: table[b.plant] ? b.plant : pot ? 'flowers' : 'veg' });
  const out = { ...bed, ...b, plant: bed.plant };
  for (const k of ['waterLog', 'feedLog', 'tuneLog']) out[k] = Array.isArray(b[k]) ? b[k] : [];
  out.water = b.water && typeof b.water === 'object' ? cleanWater(b.water) : {};
  out.plants = Array.isArray(b.plants) ? b.plants.filter((x) => typeof x === 'string') : [];
  if (!pot && !SOILS[out.soil]) out.soil = 'loam';
  if (typeof out.name !== 'string') out.name = bed.name;
  if (!out.id) out.id = newId();
  return out;
}

// Only known watering settings, and only positive numbers.
function cleanWater(w) {
  const out = {};
  if (typeof w.method === 'string') out.method = w.method;
  for (const k of ['sprinklerMmH', 'hoseLpm', 'soakerM', 'dripCount', 'dripLph', 'canL']) if (Number.isFinite(w[k]) && w[k] > 0) out[k] = w[k];
  return out;
}

// Version 1 had three soils and a "newly planted" checkbox.
function migrateV1(old, today) {
  const soil = { sandy: 'sand', loam: 'loam', clay: 'clay' };
  const beds = (old.beds || []).map((b) => {
    const { newlyPlanted, ...rest } = b;
    const out = { ...rest };
    if (!isPot(b)) out.soil = soil[b.soil] || 'loam';
    if (newlyPlanted) out.plantedOn = addDays(today, -14);
    return cleanBed(out);
  });
  return {
    units: old.units,
    place: old.place || null,
    beds,
    chartRange: old.chartRange,
    chartBedId: old.chartBedId,
    migratedFrom: 1,
  };
}

export function loadState(today) {
  const s = read(KEY);
  if (s && Array.isArray(s.beds)) return { ...s, beds: s.beds.map(cleanBed) };
  const v1 = read(V1_KEY);
  if (v1 && Array.isArray(v1.beds)) return migrateV1(v1, today);
  return null;
}

export const saveState = (state) => write(KEY, { version: 2, ...state });

const placeKey = (place) => (place ? `${place.lat},${place.lon}` : null);

// The last forecast that loaded, so the plan still works offline.
export function loadForecast(place) {
  const f = read(FORECAST_KEY);
  return f && f.key === placeKey(place) ? f : null;
}
export const saveForecast = (place, data, fetchedAt) => write(FORECAST_KEY, { key: placeKey(place), fetchedAt, ...data });

// Thirty years of highs and lows change slowly, so they are kept for months.
export function loadNormals(place) {
  const n = read(NORMALS_KEY);
  return n && n.key === placeKey(place) ? n : null;
}
export const saveNormals = (packed) => write(NORMALS_KEY, packed);

export function loadHistory(place) {
  const h = read(HISTORY_KEY);
  return h && h.key === placeKey(place) ? h : null;
}
export const saveHistory = (packed) => write(HISTORY_KEY, packed);
export { placeKey };

export function clearAll() {
  [KEY, FORECAST_KEY, HISTORY_KEY, NORMALS_KEY, V1_KEY, V1_HISTORY_KEY].forEach(remove);
}

// ---- backups ----
export function makeBackup(state) {
  return JSON.stringify(
    {
      app: 'rain-check',
      version: 2,
      exportedAt: new Date().toISOString(),
      units: state.units,
      place: state.place,
      beds: state.beds,
      chartRange: state.chartRange,
    },
    null,
    1,
  );
}

export function readBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Rain Check backup.");
  }
  if (!data || data.app !== 'rain-check' || !Array.isArray(data.beds)) throw new Error("That file isn't a Rain Check backup.");
  const place =
    data.place && Number.isFinite(data.place.lat) && Number.isFinite(data.place.lon)
      ? { name: String(data.place.name || 'Saved place'), lat: data.place.lat, lon: data.place.lon }
      : null;
  return {
    units: data.units === 'imperial' || data.units === 'metric' ? data.units : undefined,
    place,
    beds: data.beds.map(cleanBed),
    chartRange: data.chartRange,
  };
}
