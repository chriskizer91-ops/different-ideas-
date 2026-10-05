import { fmt } from '../lib/units.js';

// The past week's rain against what the air took, and how long since a soaking rain.
export function Weather({ s, units }) {
  const max = Math.max(s.rain7, s.et7, 0.1);
  const today = s.today;
  const soak = units === 'imperial' ? '0.1 in' : '2.5 mm';
  const last =
    s.daysSinceRain == null
      ? `No rain over ${soak} in the last ${Math.round(s.pastDays / 30)} months.`
      : `Last soaking rain: ${s.daysSinceRain === 1 ? 'yesterday' : `${s.daysSinceRain} days ago`}, ${fmt.depth(s.lastRainMm, units)}.`;
  const hum = today.rhMin != null ? ` Humidity today ${Math.round(today.rhMin)} to ${Math.round(today.rhMax)}%.` : '';
  return (
    <section class="section weather" aria-label="Recent weather">
      <h2 class="display h2">Past 7 days</h2>
      {[
        ['Rain in', s.rain7, 'bar-rain'],
        ['Lost to the air', s.et7, 'bar-et'],
      ].map(([label, v, cls]) => (
        <div class="bar-row" key={label}>
          <span class="bar-label">{label}</span>
          <div class="bar-track">
            <div class={`bar ${cls}`} style={{ width: `${Math.max(1.5, (v / max) * 100)}%` }} />
          </div>
          <span class="bar-value">{fmt.depth(v, units)}</span>
        </div>
      ))}
      <p class="muted small">
        {last} {s.rainNext < 0.5 ? 'Little or no rain' : `About ${fmt.depth(s.rainNext, units)} of rain`} expected over the next 7 days.{hum}
      </p>
    </section>
  );
}
