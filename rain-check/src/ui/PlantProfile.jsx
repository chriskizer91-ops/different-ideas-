// One plant's profile: when to plant it here, how much water it needs, its
// cold and heat limits, and how it does in North Texas.

import { useEffect, useRef, useState } from 'preact/hooks';
import { X } from './icons.js';
import { fmt } from '../lib/units.js';
import { mdText } from '../lib/dates.js';
import { GROUP_ONE } from '../model/profiles.js';
import { windowsFor, heatSeason, rangeText } from '../model/calendar.js';
import { HOW_WORDS } from './Calendar.jsx';

const SUN_WORDS = {
  full: 'Full sun',
  'full to part': 'Full sun to part shade',
  part: 'Part shade',
  'part to shade': 'Part shade to shade',
  shade: 'Shade',
};

const WATER_WORDS = {
  'very low': 'Very low: rain is enough most years once established',
  low: 'Low: a deep soak every two to four weeks in summer once established',
  medium: 'Medium: weekly in summer',
  high: 'High: steady moisture',
};

// How a fruit's chill-hour rating compares with this garden's winters.
function chillText(p, normals) {
  const nums = (p.chill.match(/\d[\d,]*/g) || []).map((x) => +x.replace(/,/g, ''));
  const local = normals && normals.chill;
  if (!nums.length || !local) return `${p.chill} chill hours`;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const fit =
    local.typical > hi * 1.5
      ? 'far more than it needs, so it may bloom early and lose its flowers to a late freeze'
      : local.low >= hi
      ? 'plenty here'
      : local.typical >= lo
        ? local.low < lo
          ? 'enough most winters here'
          : 'a good match here'
        : 'more than most winters here give, so it may fruit poorly';
  return `Needs ${p.chill} chill hours; winters here give about ${local.typical.toLocaleString()}, ${fit}.`;
}

function coldText(p, units) {
  const t = (c) => fmt.tempUnit(c, units);
  const zone = p.zone ? ` (USDA zones ${p.zone.replace(/-/g, '–')})` : '';
  if (p.frost === 'tender') return `Killed or badly hurt by frost (${t(p.damageC != null ? p.damageC : 0)}).`;
  const bits = [];
  if (p.damageC != null) bits.push(`${p.frost === 'hardy' ? 'Takes frost; damaged' : 'Light frost is fine; damaged'} below about ${t(p.damageC)}`);
  if (p.killC != null)
    bits.push(
      p.dieback
        ? `freezes to the ground below about ${t(p.killC)} and usually regrows from the roots`
        : p.damageC != null
          ? `can be killed below about ${t(p.killC)}`
          : `hardy to about ${t(p.killC)}`,
    );
  if (!bits.length) return p.native ? `Hardy through North Texas winters${zone}.` : zone ? `USDA zones ${p.zone.replace(/-/g, '–')}.` : null;
  const s = bits.join('; ');
  return s.charAt(0).toUpperCase() + s.slice(1) + zone + '.';
}

export function PlantProfile({ profile: p, frost, today, units, normals, beds, onAdd, onClose }) {
  const close = useRef(null);
  const [target, setTarget] = useState('');
  useEffect(() => {
    if (close.current) close.current.focus();
    const key = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  const windows = frost ? windowsFor(p, frost, today) : [];
  const heat = p.heatC != null && normals ? heatSeason(normals.daily, p.heatC) : null;
  const t = (c) => fmt.tempUnit(c, units);
  const fits = beds.filter((b) => (b.site === 'pot' ? !!p.potBase : true) && !(b.plants || []).includes(p.id));
  const rows = [
    ['Water', WATER_WORDS[p.water] || p.water],
    ['Sun', SUN_WORDS[p.sun] || p.sun],
    ['Cold', coldText(p, units)],
    ['Heat', p.heat ? `${p.heat}${heat ? ` Here, normal highs top ${t(p.heatC)} from about ${mdText(heat.from)} to ${mdText(heat.to)}.` : ''}` : null],
    ['Ready', p.days],
    ['Chill', p.chill ? chillText(p, normals) : null],
    ['Size', p.size],
    ['Bloom', p.bloom],
    ['Wildlife', p.wildlife],
    ['Deer', p.deer == null ? null : p.deer ? 'Deer usually leave it alone' : 'Deer browse it'],
    ['Soil', p.soil],
    ['Settling in', p.establish],
  ].filter(([, v]) => v);

  return (
    <div class="sheet-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={p.name}>
        <div class="sheet-head">
          <div>
            <h2 class="display h2">{p.name}</h2>
            {p.sci && <p class="sci">{p.sci}</p>}
          </div>
          <button ref={close} class="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div class="tags">
          <span class={`tag ${p.native ? 'tag-native' : ''}`}>{p.native ? 'Native to North Texas' : 'Grows well in North Texas'}</span>
          <span class="tag">{GROUP_ONE[p.group] || p.group}</span>
          {p.water && <span class="tag">Water: {p.water}</span>}
        </div>
        {p.nativeTo && <p class="xs muted sheet-line">{p.nativeTo}</p>}

        <h3 class="sub">When to plant here</h3>
        {frost ? (
          windows.length ? (
            <ul class="win-list">
              {windows.map((w, i) => (
                <li key={i} class={w.status === 'now' ? 'is-now' : ''}>
                  <strong>{rangeText(w)}</strong> · {HOW_WORDS[w.how] || w.how}
                  {w.best ? ' (best)' : ''}
                  {w.status === 'now' ? <span class="now-pill">now</span> : w.status === 'soon' ? <span class="soon-pill">soon</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p class="small">{p.plantWhen || 'Any time the ground can be worked.'}</p>
          )
        ) : (
          <p class="small muted">Frost dates load with the weather records.</p>
        )}
        {p.plantWhen && windows.length > 0 && <p class="xs muted">{p.plantWhen}</p>}
        {frost && frost.lastLate && p.frost === 'tender' && windows.some((w) => w.anchor === 'last') && (
          <p class="xs muted">A late freeze is still possible until about {mdText(frost.lastLate)} in 1 year out of 10; keep a frost cloth handy for early plantings.</p>
        )}

        <dl class="facts">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {p.varieties && p.varieties.length > 0 && (
          <>
            <h3 class="sub">Varieties for North Texas</h3>
            <p class="small">{p.varieties.join(', ')}</p>
          </>
        )}
        {p.tips && (
          <>
            <h3 class="sub">Tips</h3>
            <p class="small">{p.tips}</p>
          </>
        )}

        {onAdd && (
          <div class="sheet-add">
            <h3 class="sub">Add to your garden</h3>
            <div class="row-add">
              <select class="input" value={target} onChange={(e) => setTarget(e.currentTarget.value)} aria-label="Bed or pot">
                <option value="">Choose a bed or pot…</option>
                {fits.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                <option value="new-bed">A new bed</option>
                {p.potBase && <option value="new-pot">A new pot</option>}
              </select>
              <button class="btn-ink" disabled={!target} onClick={() => (onAdd(p.id, target), onClose())}>
                Add
              </button>
            </div>
          </div>
        )}
        {p.sources && p.sources.length > 0 && (
          <p class="xs muted sources">
            Sources:{' '}
            {p.sources.map((u, i) => (
              <span key={u}>
                {i ? ', ' : ''}
                <a href={u} target="_blank" rel="noopener">
                  {u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
