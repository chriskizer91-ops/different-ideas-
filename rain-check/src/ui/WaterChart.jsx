import { useEffect, useRef, useState } from 'preact/hooks';
import { LoaderCircle, iconFor } from './icons.js';
import { Segmented } from './controls.jsx';
import { fmt } from '../lib/units.js';
import { monthDay, monthDayYear, monthName } from '../lib/dates.js';
import { RANGES } from '../model/summary.js';
import { COLD_AT, HEAT_AT } from '../model/alerts.js';
import { isPot } from '../model/tables.js';

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(340);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || 340);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setW(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const tickLabel = (d, key) =>
  key === '1m' ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : d.slice(5, 7) === '01' ? `${monthName(d)} ’${d.slice(2, 4)}` : monthName(d);

function ChartSvg({ data, sel, setSel }) {
  const [ref, W] = useWidth();
  const { points, from, end, T, buckets, ticks, R } = data;
  const L = 38;
  const RIGHT = 6;
  const TOP = 8;
  const PH = 150;
  const base = TOP + PH;
  const stripY = base + 4;
  const H = stripY + 7 + 18;
  const plotW = Math.max(60, W - L - RIGHT);
  const span = Math.max(1, end - from);
  const dayW = plotW / span;
  const x = (i) => L + ((i - from) / span) * plotW;
  const y = (m) => TOP + (1 - Math.max(0, Math.min(100, m)) / 100) * PH;
  const path = (pts) => pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.moisture).toFixed(1)}`).join('');
  const area = (pts) => (pts.length ? `${path(pts)}L${x(pts[pts.length - 1].i).toFixed(1)},${base}L${x(pts[0].i).toFixed(1)},${base}Z` : '');
  const past = points.filter((p) => p.i <= T);
  const ahead = points.filter((p) => p.i >= T);
  const refill = points.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.refillAt).toFixed(1)}`).join('');
  const maxRain = Math.max(0.01, ...buckets.map((b) => b.rain));
  const barH = (mm) => (mm / maxRain) * PH * 0.4;

  const pick = (clientX) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const i = Math.round(from + ((clientX - r.left - L) / plotW) * span);
    setSel(Math.max(from, Math.min(end, i)));
  };
  const selPoint = sel != null ? points[sel - from] : null;

  return (
    <div ref={ref} class="chart-box">
      <svg
        width={W}
        height={H}
        class="chart"
        tabIndex={0}
        role="img"
        aria-label="Water chart. Use the left and right arrow keys to read each day."
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && pick(e.clientX)}
        onKeyDown={(e) => {
          const cur = sel != null ? sel : T;
          const step = R.bars === 'day' ? 1 : 7;
          if (e.key === 'ArrowLeft') (setSel(Math.max(from, cur - step)), e.preventDefault());
          if (e.key === 'ArrowRight') (setSel(Math.min(end, cur + step)), e.preventDefault());
        }}
      >
        {[0, 50, 100].map((m) => (
          <g key={m}>
            <line x1={L} x2={L + plotW} y1={y(m)} y2={y(m)} class="grid" />
            <text x={L - 5} y={y(m) + 4} class="axis" text-anchor="end">
              {m === 0 ? '0' : `${m}%`}
            </text>
          </g>
        ))}
        <path d={area(past)} class="area-past" />
        <path d={path(past)} class="line-past" />
        <path d={area(ahead)} class="area-ahead" />
        <path d={path(ahead)} class="line-ahead" />
        {buckets.map((b) => {
          if (b.rain <= 0.05) return null;
          const wide = R.bars !== 'day';
          const w = wide ? Math.max(1.5, (b.to - b.from + 1) * dayW * 0.72) : Math.max(1.2, dayW * 0.6);
          const cx = wide ? (x(b.from) + x(b.to)) / 2 : x(b.from);
          const h = barH(b.rain);
          return <rect key={b.from} x={cx - w / 2} y={base - h} width={w} height={h} class={b.forecast ? 'rainbar ahead' : 'rainbar'} />;
        })}
        <path d={refill} class="refill" />
        <line x1={x(T)} x2={x(T)} y1={TOP} y2={base} class="today" />
        {points.map((p) =>
          p.cold || p.heat ? (
            <rect
              key={p.i}
              x={x(p.i) - Math.max(1, dayW) / 2}
              y={stripY}
              width={Math.max(1, dayW)}
              height={6}
              class={p.cold ? `strip cold-${p.cold}` : `strip heat-${p.heat}`}
            />
          ) : null,
        )}
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={H - 4} class="axis" text-anchor="middle">
            {tickLabel(points[i - from].date, R.key)}
          </text>
        ))}
        {selPoint && (
          <g>
            <line x1={x(sel)} x2={x(sel)} y1={TOP} y2={stripY + 6} class="cursor" />
            <circle cx={x(sel)} cy={y(selPoint.moisture)} r={4} class="cursor-dot" />
          </g>
        )}
      </svg>
    </div>
  );
}

function Readout({ data, sel, units, pot }) {
  const { points, from, T, R } = data;
  const p = points[(sel != null ? sel : T) - from];
  if (!p) return null;
  const b = p.bucket;
  const rainLabel = R.bars === 'week' ? 'that week' : R.bars === 'month' ? 'that month' : p.forecast ? 'forecast' : '';
  return (
    <div class="readout" aria-live="polite">
      <strong>
        {R.bars === 'day' ? monthDay(p.date) : monthDayYear(p.date)}
        {p.i === T ? ' (today)' : p.forecast ? ' (forecast)' : ''}
      </strong>
      <span class="rain-ink">
        {pot ? 'Water left' : 'Soil water'}
        {R.key === '3y' ? ', week avg' : ''}: {Math.round(p.moisture)}%
      </span>
      <span>
        Rain{rainLabel ? ` ${rainLabel}` : ''}: {b && b.rain > 0.05 ? fmt.depth(b.rain, units) : 'none'}
      </span>
      {p.tmax != null && (
        <span>
          {fmt.temp(p.tmax, units)} / {fmt.temp(p.tmin, units)}
        </span>
      )}
    </div>
  );
}

function summaryText(data, units) {
  const { R, stats, rainMm, extremes: ex, firstDate } = data;
  const rain = `Rain totaled ${fmt.depth(rainMm, units)}.`;
  let s;
  if (!stats.below) s = `${R.name}: never below the refill line. ${rain}`;
  else {
    const end = stats.stillGoing ? 'still going' : `ending ${R.bars === 'day' ? monthDay(stats.longestEnd) : monthDayYear(stats.longestEnd)}`;
    s = `${R.name}: below the refill line on ${stats.below} of ${stats.days} days. Longest dry stretch: ${stats.longest} day${stats.longest === 1 ? '' : 's'}, ${end}. ${rain}`;
  }
  const t = (c) => fmt.tempUnit(c, units);
  const bits = [];
  if (ex.hot) bits.push(`${ex.hot} day${ex.hot === 1 ? '' : 's'} at ${t(HEAT_AT.hot)} or hotter${ex.extremeHeat ? ` (${ex.extremeHeat} at ${t(HEAT_AT.extreme)}+)` : ''}`);
  if (ex.freeze) bits.push(`${ex.freeze} freezing night${ex.freeze === 1 ? '' : 's'}${ex.hard ? ` (${ex.hard} hard freeze${ex.hard === 1 ? '' : 's'})` : ''}`);
  else if (ex.frost) bits.push(`${ex.frost} frosty night${ex.frost === 1 ? '' : 's'}`);
  if (bits.length) s += ` ${bits.join(', ')}.`;
  if (ex.coldest && ex.hottest && R.bars !== 'day')
    s += ` Hottest ${t(ex.hottest.value)} on ${monthDayYear(ex.hottest.date)}; coldest ${t(ex.coldest.value)} on ${monthDayYear(ex.coldest.date)}.`;
  return { s, firstDate };
}

function FrostDates({ climate, units }) {
  if (!climate || !climate.freeze) return null;
  const f = climate.freeze;
  const h = climate.hard;
  const n = f.seasons.filter((s) => s.complete).length;
  const range = (x) => (x ? (x.earliest === x.latest ? monthDay(x.earliest) : `${monthDay(x.earliest)} to ${monthDay(x.latest)}`) : 'none');
  return (
    <div class="frost">
      <h3 class="sub">Frost dates here</h3>
      {f.none ? (
        <p class="small">No freezing nights in the last {n} winters on record. Frost is still possible on clear, calm nights near {fmt.tempUnit(COLD_AT.frost, units)}.</p>
      ) : (
        <>
          <table class="frost-table">
            <thead>
              <tr>
                <th />
                <th>Last in spring</th>
                <th>First in fall</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Freeze, {fmt.tempUnit(COLD_AT.freeze, units)}</th>
                <td>{range(f.lastSpring)}</td>
                <td>{range(f.firstFall)}</td>
              </tr>
              <tr>
                <th>Hard freeze, {fmt.tempUnit(COLD_AT.hard, units)}</th>
                <td>{range(h.lastSpring)}</td>
                <td>{range(h.firstFall)}</td>
              </tr>
            </tbody>
          </table>
          <p class="muted xs">
            {f.frostFreeDays != null ? `Frost-free season: about ${f.frostFreeDays} days. ` : ''}
            From {f.lastSpring ? f.lastSpring.count : 0} springs and {f.firstFall ? f.firstFall.count : 0} falls of weather records, by air temperature. Set out tender plants after the latest spring date, with a week or two of margin: a few years is a small sample.
          </p>
        </>
      )}
    </div>
  );
}

export function WaterChart({ rows, row, onSelect, range, onRange, chart, longState, onRetry, place, units, sectionRef, climate }) {
  const [sel, setSel] = useState(null);
  const scroller = useRef(null);
  useEffect(() => setSel(null), [range, row && row.bed.id]);
  useEffect(() => {
    const el = scroller.current;
    const b = el && el.querySelector('button[aria-pressed="true"]');
    if (!b) return;
    const off = b.offsetLeft - el.offsetLeft;
    if (off < el.scrollLeft || off + b.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = Math.max(0, off - 8);
  }, [row && row.bed.id, rows.length]);
  if (!row) return null;
  const pot = isPot(row.bed);
  const firstLog = [...(row.bed.waterLog || [])].sort()[0];
  const sum = chart ? summaryText(chart, units) : null;
  const before = chart && (!firstLog || firstLog > chart.firstDate);

  return (
    <section class="section" ref={sectionRef} aria-label="Water chart">
      <h2 class="display h2">{pot ? 'Water in the pot' : 'Soil water'}</h2>
      <div class="chip-row" ref={scroller} role="group" aria-label="Bed or pot to chart">
        {rows.map(({ bed }) => {
          const Icon = iconFor(bed);
          return (
            <button key={bed.id} class="pick" aria-pressed={bed.id === row.bed.id} onClick={() => onSelect(bed.id)}>
              <Icon size={14} aria-hidden="true" /> {bed.name}
            </button>
          );
        })}
      </div>
      <Segmented label="Time span" value={range} onChange={onRange} options={RANGES.map((r) => [r.key, r.label])} />
      <div class="panel chart-panel">
        {longState === 'loading' && (
          <div class="chart-msg">
            <LoaderCircle size={16} class="spin" aria-hidden="true" /> Loading 3 years of weather{place ? ` for ${place.name}` : ''}
          </div>
        )}
        {longState === 'failed' && (
          <div class="chart-msg warn-ink">
            <p>Couldn't load the weather history. Check your connection and try again.</p>
            <button class="link" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
        {chart && longState === 'ready' && (
          <>
            <Readout data={chart} sel={sel} units={units} pot={pot} />
            <ChartSvg data={chart} sel={sel} setSel={setSel} />
            <p class="small" aria-live="polite">
              {sum.s}
            </p>
            <p class="muted xs legend">
              <span class="key key-water" /> {pot ? 'Water left in the pot' : 'Water left in the soil'}
              {chart.R.key === '3y' ? ', averaged over each week' : ''} (dashed: the forecast if you don't water).{' '}
              <span class="key key-rain" /> Rain{chart.R.bars === 'week' ? ' per week' : chart.R.bars === 'month' ? ' per month' : ''}.{' '}
              <span class="key key-gold" /> Below the gold line it's time to water.{' '}
              <span class="key key-cold" /> <span class="key key-heat" /> Frost and heat days.
              {before ? ' Only waterings you have logged are counted, so the time before your first log may look drier than it was.' : ''}
            </p>
          </>
        )}
        <FrostDates climate={climate} units={units} />
      </div>
    </section>
  );
}
