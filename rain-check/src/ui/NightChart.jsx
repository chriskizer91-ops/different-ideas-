// One night, hour by hour: when it drops to frost, freeze and hard-freeze
// levels, the coldest hour, and when it's warm enough to uncover plants.

import { useWidth } from './hooks.js';
import { fmt } from '../lib/units.js';
import { COLD_AT } from '../model/thresholds.js';

const hourName = (h) => {
  const x = ((h % 24) + 24) % 24;
  return x === 0 ? '12 am' : x === 12 ? 'noon' : x < 12 ? `${x} am` : `${x - 12} pm`;
};
export const nightHour = hourName;

export function NightChart({ detail, units }) {
  const [ref, W] = useWidth(320);
  const temps = detail.temps;
  const vals = temps.filter((t) => t != null);
  const lo = Math.min(...vals, COLD_AT.hard) - 1;
  const hi = Math.max(...vals, COLD_AT.frost) + 1;
  const H = 128;
  const L = 36;
  const R = 8;
  const TOP = 8;
  const plotH = H - TOP - 22;
  const x = (k) => L + (k / 16) * (W - L - R);
  const y = (t) => TOP + ((hi - t) / (hi - lo)) * plotH;
  const pts = temps.map((t, k) => (t == null ? null : [x(k), y(t)])).filter(Boolean);
  const line = pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  // Shade only where the night dips below freezing: between the 32°F line and the curve.
  const y0 = y(COLD_AT.freeze);
  const below = pts.map(([px, py]) => `L${px.toFixed(1)},${Math.max(py, y0).toFixed(1)}`).join('');
  const area = `M${pts[0][0].toFixed(1)},${y0.toFixed(1)}${below}L${pts[pts.length - 1][0].toFixed(1)},${y0.toFixed(1)}Z`;
  const top = Math.max(...vals);
  const refs = [
    [COLD_AT.frost, 'frost'],
    [COLD_AT.freeze, 'freeze'],
    [COLD_AT.hard, 'hard'],
  ];
  const minK = detail.minHour - 18;
  return (
    <div ref={ref} class="night-chart">
      <svg width={W} height={H} role="img" aria-label={`Overnight temperatures, coldest ${fmt.tempUnit(detail.min, units)} around ${hourName(detail.minHour)}`}>
        <path d={area} class="nc-cold" />
        {refs.map(([t, k]) => (
          <line key={k} x1={L} x2={W - R} y1={y(t)} y2={y(t)} class={`nc-ref nc-${k}`} />
        ))}
        <text x={L - 5} y={y(top) + 4} class="axis" text-anchor="end">
          {fmt.temp(top, units)}
        </text>
        <text x={L - 5} y={y(COLD_AT.freeze) + 4} class="axis" text-anchor="end">
          {fmt.temp(COLD_AT.freeze, units)}
        </text>
        <path d={line} class="nc-line" />
        {(W >= 340 ? [0, 3, 6, 9, 12, 15] : [0, 6, 12, 16]).map((k) => (
          <text key={k} x={x(k)} y={H - 5} class="axis" text-anchor={k === 16 ? 'end' : k === 0 ? 'start' : 'middle'}>
            {hourName(18 + k)}
          </text>
        ))}
        <circle cx={x(minK)} cy={y(detail.min)} r="4" class="nc-min" />
        <text x={Math.min(W - R - 16, Math.max(L + 16, x(minK)))} y={y(detail.min) - 8} class="nc-label" text-anchor="middle">
          {fmt.temp(detail.min, units)}
        </text>
      </svg>
    </div>
  );
}
