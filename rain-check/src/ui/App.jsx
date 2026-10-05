import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Droplets, MapPin, Plus, RotateCw, LoaderCircle } from './icons.js';
import { Segmented } from './controls.jsx';
import { Alerts } from './Alerts.jsx';
import { Weather } from './Weather.jsx';
import { WaterChart } from './WaterChart.jsx';
import { BedCard } from './BedCard.jsx';
import { PlacePicker, SampleControls, HowItWorks, Footer } from './Panels.jsx';
import { headline, cap } from './text.js';
import { defaultUnits } from '../lib/units.js';
import { addDays, clockText, dayWord, daysBetween, deviceClock, gardenClock } from '../lib/dates.js';
import { dayFraction } from '../model/solar.js';
import { simulate } from '../model/waterBalance.js';
import { feedingPlan } from '../model/feeding.js';
import { buildAlerts } from '../model/alerts.js';
import { climateStats, historyStart } from '../model/climate.js';
import { recentWeather, chartData, needsHistory, RANGES } from '../model/summary.js';
import { isPot } from '../model/tables.js';
import { fetchJson, forecastUrl, archiveUrl, parseForecast, packArchive, unpackArchive, joinHistory } from '../data/openMeteo.js';
import { SAMPLE_DEFAULTS, SAMPLE_LAT, sampleForecast, sampleHistory } from '../data/sample.js';
import {
  env,
  loadState,
  saveState,
  loadForecast,
  saveForecast,
  loadHistory,
  saveHistory,
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
  const chartRef = useRef(null);

  useEffect(() => {
    const s = loadState(deviceClock().date);
    if (s) {
      if (s.units) setUnits(s.units);
      if (s.place) setPlace(s.place);
      setBeds(s.beds);
      if (RANGES.some((r) => r.key === s.chartRange)) setChartRange(s.chartRange);
      if (s.chartBedId) setChartBedId(s.chartBedId);
      if (s.migratedFrom)
        setNotice('Your beds and pots moved over from the previous version. There are more soil types now, so check each bed’s soil in its settings.');
    }
    if (!env.preview && (!s || !s.place)) setShowPicker(true);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => saveState({ units, place, beds, chartRange, chartBedId }), 400);
    return () => clearTimeout(t);
  }, [ready, units, place, beds, chartRange, chartBedId]);

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
    const f = sampleForecast(sampleOpts, devClock.date);
    return { ...f, T: f.todayIdx, lat: SAMPLE_LAT, lon: devClock.offsetSeconds / 240, offsetSeconds: devClock.offsetSeconds, sample: true };
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

  // ---- the plan ----
  const sims = useMemo(() => beds.map((bed) => ({ bed, sim: simulate(bed, days, T, { hour, fracOf }) })), [beds, days, T, hour, fracOf]);
  const warn = useMemo(
    () => buildAlerts({ days, todayIdx: T, nights: wx.nights, hour, climate, rows: sims, lat: wx.lat }),
    [sims, days, T, wx.nights, hour, climate, wx.lat],
  );
  const rows = useMemo(() => sims.map((r) => ({ ...r, feed: feedingPlan(r.bed, days, T, r.sim, warn.heatByDate) })), [sims, warn, days, T]);
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
        else if (action === 'again') next = [...list.filter((e) => !on(today)(e)), stamp];
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
            <Alerts alerts={warn.alerts} today={today} units={units} onPick={openBed} />
            <h1 class="display h1" aria-live="polite">
              {headline(rows)}
            </h1>
            <Weather s={recent} units={units} levels={warn.levels} T={T} nights={wx.nights} />
            {wx.sample && <SampleControls opts={sampleOpts} setOpts={setSampleOpts} units={units} et0={days[T].et0} />}
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
              climate={climate}
            />
            <h2 class="display h2 beds-title">
              {rows.some((r) => isPot(r.bed)) ? (rows.every((r) => isPot(r.bed)) ? 'Your pots' : 'Your beds and pots') : 'Your beds'}
            </h2>
            <div class="cards">
              {rows.map((row) => (
                <div id={`bed-${row.bed.id}`} key={row.bed.id}>
                  <BedCard
                    row={row}
                    days={days}
                    T={T}
                    units={units}
                    hour={hour}
                    alerts={warn.alerts}
                    open={openId === row.bed.id}
                    onToggle={() => {
                      if (openId !== row.bed.id) setChartBedId(row.bed.id);
                      setOpenId((o) => (o === row.bed.id ? null : row.bed.id));
                    }}
                    onShowChart={() => showChart(row.bed.id)}
                    onUpdate={(patch) => update(row.bed.id, patch)}
                    onLog={(field, action, date) => log(row.bed.id, field, action, date)}
                    onRemove={() => setBeds((bs) => bs.filter((b) => b.id !== row.bed.id))}
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
            <HowItWorks open={showHow} onToggle={() => setShowHow((v) => !v)} day={days[T]} units={units} sample={wx.sample} />
          </>
        )}
        <Footer onBackup={backup} onRestore={restore} onReset={reset} canSave={env.canSave} />
      </main>
    </div>
  );
}

