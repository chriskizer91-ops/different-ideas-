import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Droplets, MapPin, Plus, RotateCw, LoaderCircle } from './icons.js';
import { Segmented } from './controls.jsx';
import { Alerts } from './Alerts.jsx';
import { Weather } from './Weather.jsx';
import { WaterChart } from './WaterChart.jsx';
import { BedCard } from './BedCard.jsx';
import { SoilDefs } from './SoilGauge.jsx';
import { Sky } from './Sky.jsx';
import { WeekPlanner } from './WeekPlanner.jsx';
import { Climate } from './Climate.jsx';
import { Calendar } from './Calendar.jsx';
import { PlantProfile } from './PlantProfile.jsx';
import { TimerBar, timerState, totalRun } from './Timer.jsx';
import { unlockSound, chime, keepAwake } from './sound.js';
import { PlacePicker, SampleControls, HowItWorks, Footer } from './Panels.jsx';
import { headline, cap } from './text.js';
import { defaultUnits } from '../lib/units.js';
import { addDays, clockText, dayWord, daysBetween, deviceClock, gardenClock } from '../lib/dates.js';
import { dayFraction } from '../model/solar.js';
import { simulate, planAhead } from '../model/waterBalance.js';
import { feedingPlan } from '../model/feeding.js';
import { buildAlerts } from '../model/alerts.js';
import { climateStats, historyStart } from '../model/climate.js';
import { climateNormals, normalsStart, doyIndex } from '../model/normals.js';
import { howToWater, timerPhases } from '../model/watering.js';
import { frostDatesFrom } from '../model/calendar.js';
import { allProfiles, profileById, plantsPatch, canonicalId } from '../model/profiles.js';
import { recentWeather, chartData, needsHistory, RANGES } from '../model/summary.js';
import { isPot } from '../model/tables.js';
import {
  fetchJson,
  forecastUrl,
  archiveUrl,
  normalsUrl,
  parseForecast,
  packArchive,
  unpackArchive,
  packNormals,
  unpackNormals,
  joinHistory,
} from '../data/openMeteo.js';
import { SAMPLE_DEFAULTS, SAMPLE_LAT, sampleForecast, sampleHistory, sampleNormals } from '../data/sample.js';
import {
  env,
  loadState,
  saveState,
  loadForecast,
  saveForecast,
  loadHistory,
  saveHistory,
  loadNormals,
  saveNormals,
  placeKey,
  clearAll,
  newBed,
  starterBeds,
  makeBackup,
  readBackup,
} from '../data/store.js';

const REFRESH_AFTER_MS = 3 * 3600e3; // refetch a forecast older than this
const RETRY_AFTER_MS = 15 * 60e3; // wait this long between retries while offline

// Ticks every minute, and at once when the app comes back into view.
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 60e3);
    const vis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('focus', tick);
    };
  }, []);
  return now;
}

// The forecast for a place: the saved copy at once, then a fresh one, and
// again whenever it's a new day at the garden or a few hours old.
function useForecast(place, ready, now) {
  const key = placeKey(place);
  const [st, setSt] = useState({ key: null, status: 'idle', data: null, fetchedAt: null, tried: 0 });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!ready || !place) {
      setSt({ key: null, status: 'idle', data: null, fetchedAt: null, tried: 0 });
      return;
    }
    let live = true;
    const cached = loadForecast(place);
    setSt((s) => {
      const keep = s.key === key && s.data ? s : cached ? { data: cached, fetchedAt: cached.fetchedAt } : { data: null, fetchedAt: null };
      return { ...keep, key, status: 'loading', tried: Date.now() };
    });
    fetchJson(forecastUrl(place.lat, place.lon))
      .then((json) => {
        const data = parseForecast(json, place.lat);
        if (data.days.length < 20) throw new Error('Not enough weather data');
        const fetchedAt = Date.now();
        saveForecast(place, data, fetchedAt);
        if (live) setSt({ key, status: 'live', data, fetchedAt, tried: fetchedAt });
      })
      .catch(() => {
        if (live) setSt((s) => ({ ...s, status: s.data ? 'offline' : 'failed' }));
      });
    return () => {
      live = false;
    };
  }, [ready, key, nonce]);

  useEffect(() => {
    if (!place || st.status === 'loading' || st.status === 'idle') return;
    const off = st.data ? st.data.offsetSeconds : 0;
    const stale = !st.fetchedAt || now - st.fetchedAt > REFRESH_AFTER_MS || gardenClock(off, now).date !== gardenClock(off, st.fetchedAt).date;
    if (stale && (st.status === 'live' || now - st.tried > RETRY_AFTER_MS)) setNonce((n) => n + 1);
  }, [now]);

  return { ...st, refresh: () => setNonce((n) => n + 1) };
}

// Three-plus years of daily weather from the archive, saved for 30 days.
function useHistory(place, wx) {
  const key = placeKey(place);
  const anchor = wx && !wx.sample ? wx.days[0].date : null;
  const today = wx && !wx.sample ? wx.days[wx.T].date : null;
  const [st, setSt] = useState({ status: 'idle', days: null });
  const [nonce, setNonce] = useState(0);
  const force = useRef(false);
  useEffect(() => {
    if (!place || !anchor) {
      setSt({ status: 'idle', days: null });
      return;
    }
    let live = true;
    const start = historyStart(today, place.lat);
    const end = addDays(today, -7);
    const cached = force.current ? null : loadHistory(place);
    force.current = false;
    if (cached && cached.start <= start && cached.end >= addDays(anchor, -1) && daysBetween(cached.fetchedOn, today) <= 30) {
      setSt({ status: 'ready', days: unpackArchive(cached) });
      return;
    }
    setSt({ status: 'loading', days: null });
    fetchJson(archiveUrl(place.lat, place.lon, start, end), 25000)
      .then((json) => {
        const packed = packArchive(json, place.lat, key, today);
        if (!packed) throw new Error('No history returned');
        saveHistory(packed);
        if (live) setSt({ status: 'ready', days: unpackArchive(packed) });
      })
      .catch(() => live && setSt({ status: 'failed', days: null }));
    return () => {
      live = false;
    };
  }, [key, anchor, nonce]);
  return {
    ...st,
    retry: () => {
      force.current = true;
      setNonce((n) => n + 1);
    },
  };
}

// Thirty years of daily highs and lows, saved for six months.
function useNormals(place, wx) {
  const key = placeKey(place);
  const today = wx && !wx.sample ? wx.days[wx.T].date : null;
  const month = today ? today.slice(0, 7) : null;
  const [st, setSt] = useState({ status: 'idle', days: null });
  const [nonce, setNonce] = useState(0);
  const force = useRef(false);
  useEffect(() => {
    if (!place || !today) {
      setSt({ status: 'idle', days: null });
      return;
    }
    let live = true;
    const start = normalsStart(today, place.lat);
    const cached = force.current ? null : loadNormals(place);
    force.current = false;
    if (cached && cached.start <= start && daysBetween(cached.fetchedOn, today) <= 180) {
      setSt({ status: 'ready', days: unpackNormals(cached) });
      return;
    }
    setSt({ status: 'loading', days: null });
    fetchJson(normalsUrl(place.lat, place.lon, start, addDays(today, -7)), 30000)
      .then((json) => {
        const packed = packNormals(json, key, today);
        if (!packed) throw new Error('No records returned');
        saveNormals(packed);
        if (live) setSt({ status: 'ready', days: unpackNormals(packed) });
      })
      .catch(() => live && setSt({ status: 'failed', days: null }));
    return () => {
      live = false;
    };
  }, [key, month, nonce]);
  return {
    ...st,
    retry: () => {
      force.current = true;
      setNonce((n) => n + 1);
    },
  };
}

const hhmm = (hour) => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;

export function App() {
  const now = useNow();
  const [ready, setReady] = useState(false);
  const [units, setUnits] = useState(defaultUnits);
  const [place, setPlace] = useState(null);
  const [beds, setBeds] = useState(() => starterBeds(deviceClock().date));
  const [sampleOpts, setSampleOpts] = useState(SAMPLE_DEFAULTS);
  const [chartRange, setChartRange] = useState('1m');
  const [chartBedId, setChartBedId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [notice, setNotice] = useState(null);
  const [timers, setTimers] = useState([]);
  const [toast, setToast] = useState(null);
  const [customFrost, setCustomFrost] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const s = loadState(deviceClock().date);
    if (s) {
      if (s.units) setUnits(s.units);
      if (s.place) setPlace(s.place);
      setBeds(s.beds);
      if (RANGES.some((r) => r.key === s.chartRange)) setChartRange(s.chartRange);
      if (s.chartBedId) setChartBedId(s.chartBedId);
      if (Array.isArray(s.timers)) setTimers(s.timers.filter((t) => t && t.bedId && Array.isArray(t.phases)));
      if (s.customFrost && /^\d\d-\d\d$/.test(s.customFrost.last) && /^\d\d-\d\d$/.test(s.customFrost.first)) setCustomFrost(s.customFrost);
      if (s.migratedFrom)
        setNotice('Your beds and pots moved over from the previous version. There are more soil types now, so check each bed’s soil in its settings.');
    }
    if (!env.preview && (!s || !s.place)) setShowPicker(true);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => saveState({ units, place, beds, chartRange, chartBedId, timers, customFrost }), 400);
    return () => clearTimeout(t);
  }, [ready, units, place, beds, chartRange, chartBedId, timers, customFrost]);

  // ---- weather: live or saved forecast for the place, otherwise sample ----
  const fc = useForecast(place, ready, now);
  const liveWx = useMemo(() => {
    if (!place || !fc.data) return null;
    const clock = gardenClock(fc.data.offsetSeconds, now);
    const T = fc.data.days.findIndex((d) => d.date === clock.date);
    if (T < 1 || T > fc.data.days.length - 3) return null; // saved forecast too old to use
    return { ...fc.data, T, clock, lat: place.lat, lon: place.lon, sample: false };
  }, [place, fc.data, now]);
  const devClock = deviceClock(new Date(now));
  const sampleWx = useMemo(() => {
    if (liveWx) return null;
    // Place the sample garden on its time zone's meridian, so the sun keeps clock time (with daylight saving).
    const y = +devClock.date.slice(0, 4);
    const stdOffset = -Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset()) * 60;
    const lon = stdOffset / 240;
    const f = sampleForecast(sampleOpts, devClock.date, { lon, offsetSeconds: devClock.offsetSeconds });
    return { ...f, T: f.todayIdx, lat: SAMPLE_LAT, lon, offsetSeconds: devClock.offsetSeconds, sample: true };
  }, [!!liveWx, sampleOpts, devClock.date]);
  const wx = liveWx || { ...sampleWx, clock: devClock };
  const { days, T } = wx;
  const today = days[T].date;
  const hour = wx.clock.hour;
  const fracOf = useMemo(
    () => (date, h) => dayFraction(h, { lat: wx.lat, lon: wx.lon, date, offsetSeconds: wx.offsetSeconds }),
    [wx.lat, wx.lon, wx.offsetSeconds],
  );

  // ---- the long record, for frost dates, extreme cold, and the long charts ----
  const hist = useHistory(place, liveWx);
  const sampleHist = useMemo(() => (wx.sample ? sampleHistory(sampleOpts, today) : null), [wx.sample, sampleOpts, today]);
  const merged = useMemo(() => {
    const h = wx.sample ? sampleHist : hist.status === 'ready' ? hist.days : null;
    const all = h ? joinHistory(h, days) : null;
    return all ? { days: all, T: all.length - (days.length - T) } : null;
  }, [wx.sample, sampleHist, hist.status, hist.days, days, T]);
  const climate = useMemo(() => (merged ? climateStats(merged.days.slice(0, merged.T), wx.lat) : null), [merged, wx.lat]);

  // ---- thirty years of highs and lows: frost odds, zone, what's normal ----
  const norm = useNormals(place, liveWx);
  const sampleNormalDays = useMemo(() => (wx.sample ? sampleNormals(SAMPLE_DEFAULTS, today) : null), [wx.sample, today]);
  const normals = useMemo(() => {
    const d = wx.sample ? sampleNormalDays : norm.status === 'ready' ? norm.days : null;
    return d ? climateNormals(d, wx.lat) : null;
  }, [wx.sample, sampleNormalDays, norm.status, norm.days, wx.lat]);
  const thisYear = useMemo(() => {
    const src = merged ? merged.days : days;
    const y = today.slice(0, 4);
    return src.filter((d) => d.date.slice(0, 4) === y).map((d) => ({ k: doyIndex(d.date), tmax: d.tmax, tmin: d.tmin, forecast: d.date > today }));
  }, [merged, days, today]);

  // ---- the plan ----
  // average frost dates: the gardener's own, else 30 years of records, else the recent record
  const frost = useMemo(() => frostDatesFrom({ custom: customFrost, normals, climate }), [customFrost, normals, climate]);
  const sims = useMemo(() => beds.map((bed) => ({ bed, sim: simulate(bed, days, T, { hour, fracOf }) })), [beds, days, T, hour, fracOf]);
  const warn = useMemo(
    () =>
      buildAlerts({
        days,
        todayIdx: T,
        nights: wx.nights,
        hour,
        climate: normals ? { p02Low: normals.p02Low } : climate,
        rows: sims,
        lat: wx.lat,
        normals,
        frost,
      }),
    [sims, days, T, wx.nights, hour, climate, normals, wx.lat, frost],
  );
  const rows = useMemo(
    () =>
      sims.map((r) => ({
        ...r,
        feed: feedingPlan(r.bed, days, T, r.sim, warn.heatByDate),
        how: howToWater(r.bed, r.sim.model, r.sim.amountMm),
      })),
    [sims, warn, days, T],
  );
  const plans = useMemo(() => Object.fromEntries(rows.map((r) => [r.bed.id, planAhead(r.sim, days, T)])), [rows, days, T]);
  const sunsets = useMemo(() => Object.fromEntries(days.map((d) => [d.date, d.sunset])), [days]);

  // ---- planting calendar ----
  const bedPlantIds = useMemo(() => new Set(beds.flatMap((b) => (b.plants || []).map(canonicalId))), [beds]);
  const addPlant = (plantId, target) => {
    const p = profileById(plantId);
    if (!p) return;
    if (target === 'new-bed' || target === 'new-pot') {
      const pot = target === 'new-pot';
      const b = newBed({ site: pot ? 'pot' : 'ground', name: p.name });
      const patched = { ...b, ...plantsPatch(b, [plantId]) };
      setBeds((bs) => [...bs, patched]);
      setOpenId(patched.id);
      say(`Added a ${pot ? 'pot' : 'bed'} for ${p.name}.`);
      setTimeout(() => jumpTo(patched.id), 80);
      return;
    }
    const bed = beds.find((b) => b.id === target);
    if (!bed) return;
    update(target, plantsPatch(bed, [...(bed.plants || []), plantId]));
    say(`Added ${p.name} to ${bed.name}.`);
  };
  const recent = useMemo(() => recentWeather(days, T), [days, T]);

  const selected = rows.find((r) => r.bed.id === chartBedId) || rows.find((r) => r.sim.status === 'water') || rows[0] || null;
  const long = needsHistory(chartRange);
  const longState = !long || merged ? 'ready' : hist.status === 'failed' ? 'failed' : 'loading';
  const chart = useMemo(() => {
    if (!selected) return null;
    if (!long) return chartData(selected.sim.series, days, T, chartRange);
    if (!merged) return null;
    const s = simulate(selected.bed, merged.days, merged.T, { hour, fracOf }).series;
    return chartData(s, merged.days, merged.T, chartRange);
  }, [selected && selected.sim, long, merged, chartRange, days, T]);

  // ---- actions ----
  const update = (id, patch) => setBeds((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const log = (id, field, action, date) =>
    setBeds((bs) =>
      bs.map((b) => {
        if (b.id !== id) return b;
        const list = b[field] || [];
        const stamp = field === 'waterLog' ? `${today}T${hhmm(hour)}` : today;
        const on = (d) => (e) => e.slice(0, 10) === d;
        let next = list;
        if (action === 'toggle') next = list.some(on(today)) ? list.filter((e) => !on(today)(e)) : [...list, stamp];
        else if (action === 'add-now') next = [...list, stamp];
        else if (action === 'add') next = list.some(on(date)) ? list : [...list, date];
        else if (action === 'remove') next = list.filter((e) => !on(date)(e));
        return { ...b, [field]: [...next].sort().slice(-500) };
      }),
    );
  const showChart = (id) => {
    setChartBedId(id);
    const el = chartRef.current;
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openBed = (id) => {
    setOpenId(id);
    setTimeout(() => {
      const el = document.getElementById(`bed-${id}`);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };
  const addBed = (kind) => {
    const n = beds.filter((b) => isPot(b) === (kind === 'pot')).length + 1;
    const b = kind === 'pot' ? newBed({ site: 'pot', name: `Pot ${n}` }) : newBed({ name: `Bed ${n}` });
    setBeds((bs) => [...bs, b]);
    setOpenId(b.id);
    setChartBedId(b.id);
  };
  const reset = () => {
    clearAll();
    setBeds(starterBeds(deviceClock().date));
    setPlace(null);
    setUnits(defaultUnits());
    setSampleOpts(SAMPLE_DEFAULTS);
    setOpenId(null);
    setChartRange('1m');
    setChartBedId(null);
    setNotice(null);
    setTimers([]);
    setCustomFrost(null);
    setShowPicker(true);
  };
  const backup = () => {
    const text = makeBackup({ units, place, beds, chartRange });
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rain-check-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const restore = async (text) => {
    const s = readBackup(text);
    setBeds(s.beds);
    if (s.units) setUnits(s.units);
    setPlace(s.place);
    if (RANGES.some((r) => r.key === s.chartRange)) setChartRange(s.chartRange);
    setChartBedId(null);
    setOpenId(null);
  };

  // ---- watering timers ----
  const [tick, setTick] = useState(Date.now());
  const phaseSeen = useRef({});
  useEffect(() => {
    if (!timers.length) {
      keepAwake(false);
      return;
    }
    keepAwake(true);
    setTick(Date.now());
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timers.length]);
  const clockAt = (ms) => (liveWx ? gardenClock(liveWx.offsetSeconds, ms) : deviceClock(new Date(ms)));
  const say = (text) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 5000);
  };
  // Ends a timer: 'done' logs a full watering, 'stop' logs what ran so far.
  const finishTimer = (t, mode) => {
    const st = timerState(t, Date.now());
    const at = clockAt(t.startedAt);
    const stamp = `${at.date}T${hhmm(at.hour)}`;
    const bed = beds.find((b) => b.id === t.bedId);
    let entry = null;
    if (mode === 'done') entry = stamp;
    else if (st.ran >= 60e3) entry = `${stamp}|${(t.netMm * Math.min(1, st.ran / totalRun(t))).toFixed(1)}`;
    setTimers((ts) => ts.filter((x) => x.bedId !== t.bedId));
    delete phaseSeen.current[t.bedId];
    if (entry && bed) {
      setBeds((bs) => bs.map((b) => (b.id === t.bedId ? { ...b, waterLog: [...(b.waterLog || []), entry].sort().slice(-500) } : b)));
      say(mode === 'done' ? `${bed.name}: watering logged.` : `${bed.name}: logged the part that ran.`);
    } else if (bed) say(`${bed.name}: timer stopped, nothing logged.`);
  };
  useEffect(() => {
    if (!timers.length) return;
    const nowMs = Date.now();
    for (const t of timers) {
      const st = timerState(t, nowMs);
      const seen = phaseSeen.current[t.bedId];
      if (st.done) {
        chime(3);
        finishTimer(t, 'done');
        continue;
      }
      if (seen != null && seen !== st.k) chime(st.phase.kind === 'run' ? 2 : 1);
      phaseSeen.current[t.bedId] = st.k;
    }
  }, [tick]);
  const startTimer = (row) => {
    unlockSound();
    const phases = timerPhases(row.how);
    if (!phases.length) return;
    phaseSeen.current[row.bed.id] = 0;
    setTimers((ts) => [...ts.filter((x) => x.bedId !== row.bed.id), { bedId: row.bed.id, startedAt: Date.now(), phases, netMm: row.how.netMm, method: row.how.method }]);
  };
  const jumpTo = (id) => {
    const el = document.getElementById(`bed-${id}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ---- status line under the place name ----
  let fresh = null;
  if (place && fc.fetchedAt && fc.data) {
    const at = gardenClock(fc.data.offsetSeconds, fc.fetchedAt);
    const when = at.date === wx.clock.date ? clockText(at.hour) : `${cap(dayWord(at.date, wx.clock.date))} ${clockText(at.hour)}`;
    fresh = fc.status === 'offline' ? `Offline. Forecast from ${when}.` : `Updated ${when}`;
  }
  const loadingFirst = place && !fc.data && fc.status === 'loading';
  const failed = place && !liveWx && (fc.status === 'failed' || fc.status === 'offline');

  return (
    <div class="rc">
      <main class="wrap">
        <header class="top">
          <span class="brand display">
            <Droplets size={20} aria-hidden="true" class="rain-ink" /> Rain Check
          </span>
          <Segmented
            small
            label="Units"
            value={units}
            onChange={setUnits}
            options={[
              ['imperial', '°F, in'],
              ['metric', '°C, mm'],
            ]}
          />
        </header>
        <div class="placebar">
          <MapPin size={15} aria-hidden="true" class="muted" />
          <span>{place ? place.name : 'Sample weather'}</span>
          <button class="link" aria-expanded={showPicker} onClick={() => setShowPicker((v) => !v)}>
            {place ? 'Change' : 'Set location'}
          </button>
          {place && (
            <button class="icon-btn push" aria-label="Refresh weather" onClick={fc.refresh}>
              <RotateCw size={15} aria-hidden="true" class={fc.status === 'loading' ? 'spin' : ''} />
            </button>
          )}
        </div>
        {fresh && <p class={`fresh${fc.status === 'offline' ? ' warn-ink' : ''}`}>{fresh}</p>}
        {env.preview && (
          <p class="notice">This is a preview, and previews can't load live weather or save anything. Download the file and open it in your browser to use it for real.</p>
        )}
        {!env.preview && !env.canSave && <p class="notice">This browser is blocking saved data, so your beds won't be kept after you close the page. Use Back up at the bottom to keep a copy.</p>}
        {notice && (
          <p class="notice">
            {notice}{' '}
            <button class="link" onClick={() => setNotice(null)}>
              OK
            </button>
          </p>
        )}
        {showPicker && (
          <PlacePicker
            onPick={(p) => {
              setPlace(p);
              setShowPicker(false);
            }}
          />
        )}
        {failed && (
          <p class="notice">
            {fc.status === 'offline' && fc.data
              ? `The saved forecast for ${place.name} is too old to use and live weather won't load, so this is sample weather for now. `
              : `Couldn't load live weather for ${place.name}, so this is sample weather for now. `}
            Check your connection and{' '}
            <button class="link" onClick={fc.refresh}>
              try again
            </button>
            .
          </p>
        )}
        {loadingFirst ? (
          <p class="loading">
            <LoaderCircle size={18} class="spin" aria-hidden="true" /> Loading weather for {place.name}
          </p>
        ) : (
          <>
            <Sky
              wx={{ ...wx, fracNow: fracOf(today, hour) }}
              units={units}
              normals={normals}
              heatLevel={warn.levels.heat[T] || 0}
              coldTonight={warn.levels.cold[T] || 0}
              nowMs={now}
            />
            <Alerts alerts={warn.alerts} today={today} units={units} onPick={openBed} normals={normals} sunsets={sunsets} />
            <h1 class="display h1" aria-live="polite">
              {headline(rows)}
            </h1>
            <WeekPlanner rows={rows} plans={plans} days={days} T={T} units={units} levels={warn.levels} nights={wx.nights} frost={frost} onOpen={openBed} />
            {wx.sample && <SampleControls opts={sampleOpts} setOpts={setSampleOpts} units={units} et0={days[T].et0} />}
            <h2 class="display h2 beds-title">
              {rows.some((r) => isPot(r.bed)) ? (rows.every((r) => isPot(r.bed)) ? 'Your pots' : 'Your beds and pots') : 'Your beds'}
            </h2>
            <div class="cards">
              {rows.map((row) => (
                <div id={`bed-${row.bed.id}`} key={row.bed.id} class="card-wrap">
                  <BedCard
                    row={row}
                    days={days}
                    T={T}
                    units={units}
                    alerts={warn.alerts}
                    open={openId === row.bed.id}
                    timer={timers.find((t) => t.bedId === row.bed.id && !timerState(t, tick).done) || null}
                    now={tick}
                    onStartTimer={() => startTimer(row)}
                    onTimerDone={() => {
                      const t = timers.find((x) => x.bedId === row.bed.id);
                      if (t) finishTimer(t, 'done');
                    }}
                    onTimerStop={() => {
                      const t = timers.find((x) => x.bedId === row.bed.id);
                      if (t) finishTimer(t, 'stop');
                    }}
                    onToggle={() => {
                      if (openId !== row.bed.id) setChartBedId(row.bed.id);
                      setOpenId((o) => (o === row.bed.id ? null : row.bed.id));
                    }}
                    onShowChart={() => showChart(row.bed.id)}
                    onOpenProfile={setProfileId}
                    onUpdate={(patch) => update(row.bed.id, patch)}
                    onLog={(field, action, date) => log(row.bed.id, field, action, date)}
                    onRemove={() => {
                      setTimers((ts) => ts.filter((t) => t.bedId !== row.bed.id));
                      setBeds((bs) => bs.filter((b) => b.id !== row.bed.id));
                    }}
                  />
                </div>
              ))}
            </div>
            <div class="add-row">
              {[
                ['bed', 'Add a bed'],
                ['pot', 'Add a pot'],
              ].map(([k, label]) => (
                <button key={k} class="add" onClick={() => addBed(k)}>
                  <Plus size={18} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
            <Calendar
              frost={frost}
              today={today}
              profiles={allProfiles()}
              bedPlantIds={bedPlantIds}
              onOpen={setProfileId}
              custom={!!customFrost}
              onSetFrost={setCustomFrost}
              loading={!wx.sample && norm.status === 'loading'}
            />
            <Weather s={recent} units={units} />
            <WaterChart
              rows={rows}
              row={selected}
              onSelect={setChartBedId}
              range={chartRange}
              onRange={setChartRange}
              chart={chart}
              longState={longState}
              onRetry={hist.retry}
              place={place}
              units={units}
              sectionRef={chartRef}
              climate={normals ? null : climate}
            />
            <Climate
              normals={normals}
              state={wx.sample ? 'ready' : norm.status}
              onRetry={norm.retry}
              thisYear={thisYear}
              today={today}
              units={units}
              place={place}
            />
            <HowItWorks open={showHow} onToggle={() => setShowHow((v) => !v)} day={days[T]} units={units} sample={wx.sample} />
          </>
        )}
        <Footer onBackup={backup} onRestore={restore} onReset={reset} canSave={env.canSave} />
      </main>
      <TimerBar timers={timers} beds={beds} now={tick} onJump={jumpTo} onStop={(id) => {
        const t = timers.find((x) => x.bedId === id);
        if (t) finishTimer(t, 'stop');
      }} />
      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}
      {profileId && profileById(profileId) && (
        <PlantProfile
          profile={profileById(profileId)}
          frost={frost}
          today={today}
          units={units}
          normals={normals}
          beds={beds}
          onAdd={addPlant}
          onClose={() => setProfileId(null)}
        />
      )}
      <SoilDefs />
    </div>
  );
}

