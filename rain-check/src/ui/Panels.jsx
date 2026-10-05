// Smaller sections: location search, sample-weather sliders, the explanation, and the footer.
import { useRef, useState } from 'preact/hooks';
import { ChevronDown, Download, LoaderCircle, Navigation, Search, Upload } from './icons.js';
import { Slider, Select, ConfirmButton } from './controls.jsx';
import { fmt, cToF, fToC } from '../lib/units.js';
import { searchPlaces } from '../data/openMeteo.js';
import { COLD_SNAPS } from '../data/sample.js';

export function PlacePicker({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const search = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await searchPlaces(q);
      setResults(r);
      if (!r.length) setMsg('No places matched. Try a nearby town, or add the state or country.');
    } catch {
      setMsg("Couldn't reach the location search. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  const locate = () => {
    const fail = () => {
      setBusy(false);
      setMsg("Your location isn't available here. Search for your town instead.");
    };
    if (!navigator.geolocation) return fail();
    setBusy(true);
    setMsg('');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false);
        onPick({ name: 'My location', lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) });
      },
      fail,
      { timeout: 8000 },
    );
  };
  return (
    <div class="panel picker">
      <div class="row-add">
        <input
          class="input big"
          value={q}
          placeholder="Town or city"
          aria-label="Town or city"
          onInput={(e) => setQ(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button class="btn-ink" onClick={search}>
          {busy ? <LoaderCircle size={16} class="spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
          Search
        </button>
      </div>
      {results.map((r) => (
        <button key={`${r.lat},${r.lon}`} class="result" onClick={() => onPick(r)}>
          {r.name}
        </button>
      ))}
      <div class="picker-foot">
        <button class="link" onClick={locate}>
          <Navigation size={13} aria-hidden="true" /> Use my location
        </button>
        <button class="link" onClick={() => onPick(null)}>
          Use sample weather
        </button>
      </div>
      {msg && <p class="warn-ink small">{msg}</p>}
    </div>
  );
}

export function SampleControls({ opts, setOpts, units, et0 }) {
  const imp = units === 'imperial';
  const high = Math.round(imp ? cToF(opts.tHigh) : opts.tHigh);
  return (
    <section class="panel sample">
      <h2 class="display h2">Try different weather</h2>
      <p class="muted small">
        You're looking at sample weather. Move a slider to see how heat, humidity and wind change evaporation, every bed's plan, and the frost and heat warnings.
      </p>
      <Slider
        label="Typical high"
        display={`${high}°`}
        value={high}
        min={imp ? 40 : 5}
        max={imp ? 108 : 42}
        onChange={(v) => setOpts({ ...opts, tHigh: imp ? fToC(v) : v })}
      />
      <Slider label="Humidity" display={`${opts.humidity}%`} value={opts.humidity} min={15} max={90} onChange={(v) => setOpts({ ...opts, humidity: v })} />
      <Slider label="Wind" display={fmt.wind(opts.wind, units)} value={opts.wind} min={0.5} max={6} step={0.5} onChange={(v) => setOpts({ ...opts, wind: v })} />
      <Slider label="Days since a soaking rain" display={opts.dryDays} value={opts.dryDays} min={1} max={20} onChange={(v) => setOpts({ ...opts, dryDays: v })} />
      <label class="check">
        <input type="checkbox" checked={opts.rainSoon} onChange={(e) => setOpts({ ...opts, rainSoon: e.currentTarget.checked })} />
        {imp ? '1 inch' : '25 mm'} of rain likely tomorrow
      </label>
      <label class="field">
        <span class="field-label">Cold snap tomorrow night</span>
        <Select value={opts.coldSnap} options={COLD_SNAPS} onChange={(v) => setOpts({ ...opts, coldSnap: v })} />
      </label>
      <p class="et-today">
        Evaporation today: <strong class="rain-ink">{fmt.depth(et0, units)}</strong>
      </p>
    </section>
  );
}

export function HowItWorks({ open, onToggle, day, units, sample }) {
  const today =
    day.rhMin != null && day.rs != null
      ? `Today: high ${fmt.temp(day.tmax, units)}, low ${fmt.temp(day.tmin, units)}, humidity ${Math.round(day.rhMin)} to ${Math.round(day.rhMax)}%, wind ${fmt.wind(day.u2, units)}, sunlight ${day.rs.toFixed(1)} MJ/m².`
      : `Today: high ${fmt.temp(day.tmax, units)}, low ${fmt.temp(day.tmin, units)}.`;
  const sources = [
    day.et0Api != null ? `${fmt.depth(day.et0Api, units)} from Open-Meteo` : null,
    day.et0Calc != null ? `${fmt.depth(day.et0Calc, units)} from this app's own calculation` : null,
  ].filter(Boolean);
  return (
    <section class="panel how">
      <button class="how-head" onClick={onToggle} aria-expanded={open}>
        <span class="display h2">How the plan is worked out</span>
        <ChevronDown size={20} aria-hidden="true" class={`turn${open ? ' turned' : ''}`} />
      </button>
      {open && (
        <div class="how-body">
          <p>
            Each bed or pot is treated like a bank account of water. Every day the app subtracts what the plants lose to the air and adds the rain that actually soaks in. The methods come from the UN Food and Agriculture Organization's irrigation guide, FAO-56, which farms use to schedule watering.
          </p>
          <ol>
            <li>
              <strong>Evaporation.</strong> The day's reference evaporation (ET₀) uses the FAO-56 Penman-Monteith equation, which combines temperature, humidity, wind and sunlight.
              <span class="inset">
                {today} Evaporation{sample ? ' (sample)' : ''}: {sources.join(' and ')}.
              </span>
            </li>
            <li>
              <strong>Plant use.</strong> Each planting uses a share of that: about all of it for vegetables, 80% for cool-season lawns and annual flowers, 60% for warm-season grass, half for shrubs and trees, and under a third for drought-tolerant plants. Shade lowers it; reflected heat from walls and paving raises it by a fifth; mulch trims it by about a tenth. When the past week's average temperature drops, lawns, shrubs and trees slow down for winter and use less.
            </li>
            <li>
              <strong>Rain.</strong> Showers lighter than a fifth of the day's ET₀ evaporate before they soak in, and leaves catch the first 1 to 2 mm of each rain. Heavy rain that falls faster than the soil can take it in runs off: clay takes about 4 mm an hour, loam 13, sand 30. Slopes shed more, mulch less. Forecast rain counts at its amount times its chance of falling.
            </li>
            <li>
              <strong>Soil.</strong> Soil type and root depth set how much the account holds, from about 7% of the root zone's depth in sand to 18% in silt loam. Plants can use 40 to 60% of it before they start to struggle; on hot days that share drops, because they can't pull water up fast enough, so the gold line rises.
            </li>
            <li>
              <strong>New plantings.</strong> Roots start at a third to two-fifths of their full depth and spread over about seven weeks for vegetables and lawns, a year for shrubs, and two years for trees. Until then the account is smaller and empties faster.
            </li>
            <li>
              <strong>Watering.</strong> When the account would fall below the gold line by the end of today, it's time to water, and the amount shown refills it. Below that line plants close up and use less, so a long dry spell drains the soil more and more slowly instead of hitting empty. Below 40°F (5°C) the plan waits for a warmer day, when water can soak in.
            </li>
          </ol>
          <p>
            Pots use the same account with different numbers. The pot's size and mix set how much it holds. Water leaves through the whole plant but rain only enters through the rim, so the plant factor grows with how far the plant spreads past the pot, up to about 4½ times for a plant twice as wide as its pot. Terracotta and fabric add what escapes through their walls, hanging baskets add a quarter for wind, and rain is cut for shelter and for leaves that shed it.
          </p>
          <p>
            <strong>Frost and heat warnings</strong> follow the US National Weather Service's lines: frost at {fmt.tempUnit(2, units)}, freeze at {fmt.tempUnit(0, units)}, hard freeze at {fmt.tempUnit(-2.2, units)}; hot at {fmt.tempUnit(32.2, units)}, very hot at {fmt.tempUnit(35, units)}, extreme at {fmt.tempUnit(37.8, units)}. Night lows come from the hourly forecast, and clear, calm nights count as frost a little sooner because plants cool below the air. Extreme cold is judged against the local three-year record, and conditions that have become routine are shown quietly.
          </p>
          <p class="muted small">
            It's a guideline, not a sensor. Use the finger check on each card: every check nudges that bed's or pot's drying rate toward what you find. The 12-month and 3-year charts and the frost dates use Open-Meteo's historical weather records.
          </p>
        </div>
      )}
    </section>
  );
}

export function Footer({ onBackup, onRestore, onReset, canSave }) {
  const file = useRef(null);
  const [msg, setMsg] = useState('');
  return (
    <footer class="footer">
      <span>Weather data by Open-Meteo.com (CC BY 4.0)</span>
      <div class="footer-actions">
        <button class="link" onClick={onBackup}>
          <Download size={13} aria-hidden="true" /> Back up
        </button>
        <button class="link" onClick={() => file.current && file.current.click()}>
          <Upload size={13} aria-hidden="true" /> Restore
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.currentTarget.files && e.currentTarget.files[0];
            e.currentTarget.value = '';
            if (!f) return;
            try {
              await onRestore(await f.text());
              setMsg('Restored from backup.');
            } catch (err) {
              setMsg(err.message || "Couldn't read that file.");
            }
          }}
        />
        <ConfirmButton class="link" onConfirm={onReset} confirmText="Tap again to erase everything">
          Reset app
        </ConfirmButton>
      </div>
      {msg && (
        <p class="small" role="status">
          {msg}
        </p>
      )}
      {!canSave && <p class="xs">Saving is blocked in this browser, so back up before you close the page.</p>}
    </footer>
  );
}
