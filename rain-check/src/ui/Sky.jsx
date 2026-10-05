// The sky over the garden right now: the sun's path from sunrise to sunset
// with today's drying so far, the moon and stars at night, clouds and rain
// from the hourly forecast, and frost along the ground on freezing nights.

import { useMemo } from 'preact/hooks';
import { useWidth, seeded } from './hooks.js';
import { fmt } from '../lib/units.js';
import { clockText } from '../lib/dates.js';
import { sunTimes } from '../model/solar.js';
import { normalFor } from '../model/normals.js';

const H = 100;
const HORIZON = 78;

function phaseOf(h, rise, set) {
  if (rise == null || set == null) return 'day';
  if (h < rise - 0.6 || h > set + 0.6) return 'night';
  if (h < rise + 0.8) return 'dawn';
  if (h > set - 0.8) return 'dusk';
  return 'day';
}

const SKIES = {
  night: ['#0b1630', '#22355c'],
  dawn: ['#2f4373', '#f3b68b'],
  day: ['#4f98da', '#cde5f7'],
  overcast: ['#8a9cab', '#d5dce2'],
  hot: ['#5f9fd9', '#f7dcae'],
  dusk: ['#3a3f7a', '#ef9a6c'],
};

// Moon phase, 0 new to 0.5 full and back, from a known new moon.
export function moonPhase(ms) {
  const days = (ms - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
  const p = (days / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}

// The lit part of the moon: outer limb on the lit side, terminator back.
function moonPath(cx, cy, r, p) {
  const waxing = p < 0.5;
  const c = Math.cos(2 * Math.PI * p);
  const rx = Math.abs(c) * r;
  const outer = waxing ? 1 : 0;
  const term = (waxing ? c > 0 : c < 0) ? 0 : 1;
  return `M${cx},${cy - r} A${r},${r} 0 0 ${outer} ${cx},${cy + r} A${rx.toFixed(2)},${r} 0 0 ${term} ${cx},${cy - r} Z`;
}

function Cloud({ x, y, s, night }) {
  return (
    <g class="sky-cloud" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})`} opacity={night ? 0.35 : 0.9}>
      <ellipse cx="0" cy="6" rx="18" ry="7" fill="#fff" />
      <circle cx="-7" cy="1" r="8" fill="#fff" />
      <circle cx="6" cy="-1" r="10" fill="#fff" />
    </g>
  );
}

export function Sky({ wx, units, normals, heatLevel, coldTonight, nowMs }) {
  const [ref, W] = useWidth(360);
  const day = wx.days[wx.T];
  const date = day.date;
  const h = wx.clock.hour;
  let rise = day.sunrise;
  let set = day.sunset;
  if (rise == null || set == null) {
    const s = sunTimes({ lat: wx.lat, lon: wx.lon, date, offsetSeconds: wx.offsetSeconds });
    rise = s.rise;
    set = s.set;
  }
  const hours = wx.hours && wx.hours[date];
  const hi = Math.floor(h);
  const tempNow = hours && hours.t[hi] != null ? hours.t[hi] + ((hours.t[Math.min(23, hi + 1)] ?? hours.t[hi]) - hours.t[hi]) * (h - hi) : null;
  const cloud = hours && hours.c[hi] != null ? hours.c[hi] : day.rain > 2 ? 80 : 20;
  const raining = hours ? (hours.p[hi] || 0) >= 0.1 : false;
  const night = wx.nights && wx.nights[date];
  const low = night && night.low != null ? night.low : wx.days[wx.T + 1] ? wx.days[wx.T + 1].tmin : day.tmin;

  let phase = phaseOf(h, rise, set);
  let sky = SKIES[phase];
  if (phase === 'day' && cloud >= 75) sky = SKIES.overcast;
  else if (phase === 'day' && heatLevel >= 2) sky = SKIES.hot;
  const dark = phase !== 'day';

  const pad = 22;
  const peak = 56;
  const s = rise != null && set != null ? Math.max(0, Math.min(1, (h - rise) / (set - rise))) : 0.5;
  const at = (t) => [pad + t * (W - 2 * pad), HORIZON - peak * Math.sin(Math.PI * t)];
  const arc = (a, b) => {
    let d = '';
    for (let k = 0; k <= 40; k++) {
      const [x, y] = at(a + ((b - a) * k) / 40);
      d += `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  };
  const [sx, sy] = at(s);
  const stars = useMemo(() => {
    const rnd = seeded('stars');
    return Array.from({ length: 22 }, () => [rnd(), rnd() * 0.7, 0.4 + rnd() * 0.9]);
  }, []);
  const clouds = useMemo(() => {
    const rnd = seeded(`clouds${date}`);
    return Array.from({ length: 3 }, () => [0.1 + rnd() * 0.8, 14 + rnd() * 26, 0.7 + rnd() * 0.5]);
  }, [date]);
  const nClouds = cloud >= 75 ? 3 : cloud >= 55 ? 2 : cloud >= 35 ? 1 : 0;
  const moon = moonPhase(nowMs);
  const frosty = (phase === 'night' || phase === 'dusk') && coldTonight >= 1;

  const norm = normals ? normalFor(normals.daily, date) : null;
  const dev = norm && day.tmax != null ? day.tmax - norm.high : null;
  const devText =
    dev != null && Math.abs(dev) >= 3
      ? `Today's high is ${Math.round(Math.abs(units === 'imperial' ? (dev * 9) / 5 : dev))}° ${dev > 0 ? 'above' : 'below'} normal for the date.`
      : null;

  const frac = wx.fracNow;
  const caption =
    rise == null
      ? null
      : h < rise
        ? 'Before sunrise: plants aren’t drying yet.'
        : h > set
          ? 'After sunset: drying has stopped for the day.'
          : `${Math.round(frac * 100)}% of today’s drying done.`;

  return (
    <section class={`sky ${dark ? 'sky-dark' : 'sky-light'}`} aria-label="The sky now">
      <div class="sky-box" ref={ref}>
        <svg width={W} height={H} class="sky-svg" aria-hidden="true">
          <defs>
            <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color={sky[0]} />
              <stop offset="1" stop-color={sky[1]} />
            </linearGradient>
            <radialGradient id="sun-glow">
              <stop offset="0" stop-color={heatLevel >= 2 ? '#ffb347' : '#fff3b0'} stop-opacity="0.9" />
              <stop offset="1" stop-color={heatLevel >= 2 ? '#ff6a3d' : '#fff3b0'} stop-opacity="0" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#sky-grad)" />
          {phase === 'night' && stars.map(([x, y, r], i) => <circle key={i} cx={x * W} cy={y * HORIZON} r={r} fill="#fff" opacity={0.35 + r * 0.4} />)}
          <path d={arc(0, 1)} class="sky-arc-rest" />
          {phase !== 'night' && s > 0 && <path d={arc(0, s)} class="sky-arc-done" />}
          {phase !== 'night' && h >= rise && h <= set && (
            <g>
              <circle cx={sx} cy={sy} r={heatLevel >= 2 ? 22 : 17} fill="url(#sun-glow)" />
              <circle cx={sx} cy={sy} r="8" fill={heatLevel >= 2 ? '#ffb238' : '#ffd84d'} />
            </g>
          )}
          {phase === 'night' && (
            <g>
              <circle cx={W - 54} cy={30} r="10" fill="#33406a" />
              <path d={moonPath(W - 54, 30, 10, moon)} fill="#f4efd6" />
            </g>
          )}
          {clouds.slice(0, nClouds).map(([x, y, sc], i) => (
            <Cloud key={i} x={x * W} y={y} s={sc} night={dark} />
          ))}
          {raining && (
            <g class="sky-rain">
              {Array.from({ length: Math.round(W / 14) }, (_, i) => (
                <line key={i} x1={i * 14 + 6} y1={(i * 37) % 60} x2={i * 14 + 2} y2={((i * 37) % 60) + 9} />
              ))}
            </g>
          )}
          <path
            d={`M0,${HORIZON + 2} C${W * 0.25},${HORIZON - 6} ${W * 0.45},${HORIZON + 6} ${W * 0.7},${HORIZON} S${W},${HORIZON - 4} ${W},${HORIZON - 2} V${H} H0 Z`}
            class="sky-ground"
          />
          <path
            d={Array.from({ length: Math.round(W / 9) }, (_, i) => `M${i * 9 + 4},${H - 3} l-1.5,-${4 + (i % 3) * 2} M${i * 9 + 6},${H - 3} l1.5,-${3 + ((i + 1) % 3) * 2}`).join(' ')}
            class="sky-grass"
          />
          {frosty &&
            Array.from({ length: Math.round(W / 26) }, (_, i) => {
              const x = 13 + i * 26;
              const y = HORIZON + 10;
              return <path key={i} d={`M${x - 4},${y}h8M${x},${y - 4}v8M${x - 3},${y - 3}l6,6M${x + 3},${y - 3}l-6,6`} class="sky-frost" />;
            })}
        </svg>
        <div class="sky-text">
          <div class="sky-now">
            {tempNow != null && <span class="sky-temp display">{fmt.temp(tempNow, units)}</span>}
            <span class="sky-hilo">
              {tempNow != null ? 'Now · ' : ''}High {fmt.temp(day.tmax, units)} · Low {fmt.temp(low, units)}
            </span>
          </div>
          {rise != null && (
            <div class="sky-sun">
              <span>Sunrise {clockText(rise)}</span>
              <span>Sunset {clockText(set)}</span>
            </div>
          )}
        </div>
        {frosty && <span class="sky-badge">Frost tonight</span>}
      </div>
      {(caption || devText) && (
        <p class="sky-caption">
          {caption} {devText}
        </p>
      )}
    </section>
  );
}
