import { fmt } from '../lib/units.js';
import { weekdayShort } from '../lib/dates.js';
import { CloudRain } from './icons.js';

export function Weather({ s, units, levels, T, nights }) {
  const max = Math.max(s.rain7, s.et7, 0.1);
  const today = s.today;
  const soak = units === 'imperial' ? '0.1 in' : '2.5 mm';
  const last =
    s.daysSinceRain == null
      ? `No rain over ${soak} in the last ${Math.round(s.pastDays / 30)} months.`
      : `Last soaking rain: ${s.daysSinceRain === 1 ? 'yesterday' : `${s.daysSinceRain} days ago`}, ${fmt.depth(s.lastRainMm, units)}.`;
  const hum = today.rhMin != null ? ` Humidity ${Math.round(today.rhMin)} to ${Math.round(today.rhMax)}%.` : '';
  return (
    <section class="weather" aria-label="Recent and coming weather">
      <h2 class="sub">Past 7 days</h2>
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
      <h2 class="sub">Next 7 days</h2>
      <div class="outlook" role="list">
        {s.outlook.map((d, k) => {
          const i = T + k;
          const night = nights && nights[d.date];
          const low = night && night.low != null ? night.low : d.tmin;
          const cold = levels.cold[i] || 0;
          const heat = levels.heat[i] || 0;
          const label = k === 0 ? 'Today' : weekdayShort(d.date);
          return (
            <div class="day" role="listitem" key={d.date} aria-label={`${label}: high ${fmt.temp(d.tmax, units)}, low ${fmt.temp(low, units)}${d.prob != null ? `, ${Math.round(d.prob)}% chance of rain` : ''}`}>
              <span class="day-name">{label}</span>
              <span class={`day-hi${heat ? ` heat-${heat}` : ''}`}>{fmt.temp(d.tmax, units)}</span>
              <span class={`day-lo${cold ? ` cold-${cold}` : ''}`}>{fmt.temp(low, units)}</span>
              <span class="day-rain">
                {d.prob != null && d.prob >= 20 ? (
                  <>
                    <CloudRain size={13} aria-hidden="true" />
                    {Math.round(d.prob)}%
                  </>
                ) : (
                  <span class="muted">·</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <p class="muted xs">Lows are for the night that follows each day.</p>
    </section>
  );
}
