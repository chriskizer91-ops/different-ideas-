// The tube on each card: water left now, what the rest of today will take,
// and the gold refill line.

const clamp = (x) => Math.max(0, Math.min(100, x));

export function Gauge({ now, tonight, refillAt, pot }) {
  const n = clamp(now);
  const t = clamp(tonight);
  const low = n <= refillAt;
  const used = Math.max(0, n - t);
  const what = pot ? "the pot's" : 'the soil';
  return (
    <div
      class="gauge"
      role="img"
      aria-label={`${Math.round(n)} percent of ${what} water left now, about ${Math.round(t)} percent by tonight. Time to water below ${Math.round(refillAt)} percent.`}
    >
      <div class="gauge-tube">
        <div class={`gauge-glass${low ? ' gauge-low' : ''}`}>
          <div class="gauge-fill rc-anim" style={{ height: `${t}%` }} />
          {used > 0.5 && <div class="gauge-today rc-anim" style={{ bottom: `${t}%`, height: `${used}%` }} />}
          {[25, 50, 75].map((m) => (
            <div key={m} class="gauge-tick" style={{ bottom: `${m}%`, width: m === 50 ? 11 : 6 }} />
          ))}
        </div>
        <div class="gauge-rim" />
        <div class="gauge-line" style={{ bottom: `calc(${refillAt}% - 1px)` }} />
      </div>
      <div class="gauge-pct">{Math.round(n)}%</div>
      <div class="gauge-sub">now</div>
    </div>
  );
}
