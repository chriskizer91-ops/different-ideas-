// The planting calendar: what to plant now and soon, and a year of planting
// windows for each plant, placed by this garden's own frost dates.

import { useState } from 'preact/hooks';
import { mdText } from '../lib/dates.js';
import { doyIndex } from '../model/normals.js';
import { windowsFor, windowsInYear, plantNow } from '../model/calendar.js';

const FOOD = new Set(['vegetable', 'herb', 'fruit']);
const MORE = new Set(['grass', 'groundcover', 'succulent', 'vine', 'lawn']);
const FILTERS = [
  ['mine', 'In my beds', null],
  ['vegetable', 'Vegetables', (p) => p.group === 'vegetable'],
  ['herb', 'Herbs', (p) => p.group === 'herb'],
  ['fruit', 'Fruit', (p) => p.group === 'fruit'],
  ['native', 'Natives', (p) => p.native],
  ['flower', 'Flowers', (p) => p.group === 'flower'],
  ['tree', 'Trees', (p) => p.group === 'tree'],
  ['shrub', 'Shrubs', (p) => p.group === 'shrub'],
  ['perennial', 'Perennials', (p) => p.group === 'perennial'],
  ['more', 'Grasses, vines and more', (p) => MORE.has(p.group)],
];

// How "Plant now" is grouped, so a fall with forty trees and shrubs in season
// still reads at a glance.
const NOW_GROUPS = [
  ['Vegetables and herbs', (p) => p.group === 'vegetable' || p.group === 'herb'],
  ['Fruit', (p) => p.group === 'fruit'],
  ['Flowers and wildflowers', (p) => p.group === 'flower'],
  ['Trees, shrubs and perennials', (p) => !FOOD.has(p.group) && p.group !== 'flower' && p.group !== 'lawn'],
  ['Lawns', (p) => p.group === 'lawn'],
];
const CAP = 8;
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export const HOW_WORDS = {
  seed: 'sow seed',
  transplant: 'set out transplants',
  cloves: 'plant cloves',
  sets: 'plant sets',
  slips: 'plant slips',
  crowns: 'plant crowns',
  'seed pieces': 'plant seed potatoes',
  container: 'plant from containers',
  'bare-root': 'plant bare-root',
  'sod or seed': 'lay sod or sow seed',
};
const PLANTS_OUT = new Set(['transplant', 'slips', 'crowns']);
const howClass = (how) => (PLANTS_OUT.has(how) ? 'tr' : how === 'container' || how === 'bare-root' ? 'ct' : how === 'sod or seed' ? 'sod' : 'sd');
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function FrostEditor({ frost, onSave, onCancel }) {
  const [last, setLast] = useState(frost ? `2026-${frost.last}` : '');
  const [first, setFirst] = useState(frost ? `2026-${frost.first}` : '');
  return (
    <div class="panel cal-edit">
      <p class="xs muted">If you know your own average frost dates (a local extension office or a neighbor's records), set them here. The year doesn't matter.</p>
      <div class="grid2">
        <label class="field">
          <span class="field-label">Last spring freeze</span>
          <input type="date" class="input" value={last} onInput={(e) => setLast(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span class="field-label">First fall freeze</span>
          <input type="date" class="input" value={first} onInput={(e) => setFirst(e.currentTarget.value)} />
        </label>
      </div>
      <div class="row-add">
        <button class="btn-ink" disabled={!last || !first} onClick={() => onSave({ last: last.slice(5), first: first.slice(5) })}>
          Use these dates
        </button>
        <button class="link" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// Plants that share a window ("Sow seed until Oct 22") are listed together.
function Clusters({ items, now, onOpen, mine }) {
  const [opened, setOpened] = useState({});
  const map = new Map();
  for (const { profile: p, win } of items) {
    const date = now ? win.end : win.start;
    const best = win.best && p.windows.length > 1;
    const key = `${win.how}|${date}|${best ? 1 : 0}`;
    if (!map.has(key)) map.set(key, { key, how: win.how, date, best, list: [] });
    map.get(key).list.push(p);
  }
  const clusters = [...map.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return clusters.map((c) => {
    const list = c.list.sort((a, b) => mine.has(b.id) - mine.has(a.id) || b.native - a.native || a.name.localeCompare(b.name));
    const show = opened[c.key] || list.length <= CAP + 2 ? list.length : CAP;
    return (
      <div key={c.key} class="pn-cluster">
        <span class="pn-when xs muted">
          {cap1(HOW_WORDS[c.how] || c.how)} {now ? 'until' : 'from'} {mdText(c.date.slice(5))}
          {c.best ? ', the best time of year' : ''}
        </span>
        <div class="plant-chips">
          {list.slice(0, show).map((p) => (
            <button key={p.id} class={`plant-chip slim${now ? ' is-now' : ''}`} onClick={() => onOpen(p.id)}>
              {p.name}
              {p.native && <span class="badge-native" title="Native to North Central Texas" />}
            </button>
          ))}
          {show < list.length && (
            <button class="plant-chip slim more" onClick={() => setOpened({ ...opened, [c.key]: true })}>
              {list.length - show} more
            </button>
          )}
        </div>
      </div>
    );
  });
}

function Grouped({ items, now, onOpen, mine }) {
  return NOW_GROUPS.map(([title, test]) => {
    const inGroup = items.filter((x) => test(x.profile));
    if (!inGroup.length) return null;
    return (
      <div key={title} class="pn-group">
        <h4 class="pn-title">{title}</h4>
        <Clusters items={inGroup} now={now} onOpen={onOpen} mine={mine} />
      </div>
    );
  });
}

export function Calendar({ frost, today, profiles, bedPlantIds, onOpen, custom, onSetFrost, loading }) {
  const [filter, setFilter] = useState(bedPlantIds.size ? 'mine' : 'vegetable');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);
  const [all, setAll] = useState(false);

  const query = q.trim().toLowerCase();
  const filters = FILTERS.filter(([k, , test]) => k === 'mine' || profiles.some(test));
  const test = filters.find(([k]) => k === filter);
  const shown = profiles.filter((p) =>
    query
      ? p.name.toLowerCase().includes(query) || (p.sci || '').toLowerCase().includes(query)
      : filter === 'mine'
        ? bedPlantIds.has(p.id)
        : test
          ? test[2](p)
          : true,
  );
  const year = +today.slice(0, 4);
  const tk = doyIndex(today);
  const pos = (d) => (doyIndex(d) / 365) * 100;
  const pick = (k) => {
    setFilter(k);
    setQ('');
    setAll(false);
  };

  if (!frost) {
    return (
      <section class="section" aria-label="Planting calendar">
        <h2 class="display h2">Planting calendar</h2>
        <div class="panel cal-panel">
          <p class="small">{loading ? 'Waiting for the weather records that set your frost dates…' : 'No regular freezes in the records here, so there are no frost dates to plan around.'}</p>
          <button class="link small" onClick={() => setEditing(true)}>
            Set frost dates yourself
          </button>
          {editing && <FrostEditor frost={null} onSave={(d) => (onSetFrost(d), setEditing(false))} onCancel={() => setEditing(false)} />}
        </div>
      </section>
    );
  }

  const { now, soon } = plantNow(profiles, frost, today);
  const rows = shown
    .map((p) => {
      const w = windowsFor(p, frost, today);
      const key = w.length ? (w[0].status === 'now' ? `0${w[0].end}` : `1${w[0].start}`) : '2';
      return { p, w, key };
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.p.name.localeCompare(b.p.name)));
  const visible = all ? rows : rows.slice(0, 14);

  return (
    <section class="section" aria-label="Planting calendar">
      <h2 class="display h2">Planting calendar</h2>
      <p class="cal-frost small">
        Average last freeze <strong>{mdText(frost.last)}</strong> · first freeze <strong>{mdText(frost.first)}</strong>{' '}
        <span class="muted">({frost.source})</span>{' '}
        <button class="link" onClick={() => setEditing((v) => !v)}>
          Change
        </button>
        {custom && (
          <>
            {' '}
            <button class="link" onClick={() => onSetFrost(null)}>
              Use the records
            </button>
          </>
        )}
      </p>
      {editing && <FrostEditor frost={frost} onSave={(d) => (onSetFrost(d), setEditing(false))} onCancel={() => setEditing(false)} />}
      <div class="panel cal-panel">
        <h3 class="sub first">Plant now</h3>
        {now.length ? <Grouped items={now} now onOpen={onOpen} mine={bedPlantIds} /> : <p class="small muted">Nothing in the calendar is in season this week.</p>}
        {soon.length > 0 && (
          <>
            <h3 class="sub">Coming up in the next three weeks</h3>
            <Grouped items={soon} onOpen={onOpen} mine={bedPlantIds} />
          </>
        )}
      </div>
      <input class="input cal-search" type="search" placeholder="Find a plant" aria-label="Find a plant in the calendar" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      <div class="cal-filter chip-row" role="group" aria-label="Which plants">
        {filters.map(([k, label]) => (
          <button key={k} class="pick" aria-pressed={!query && filter === k} onClick={() => pick(k)}>
            {label}
          </button>
        ))}
      </div>
      <div class="panel cal-panel">
        {!visible.length ? (
          <p class="small muted">
            {query
              ? `No plant called “${q.trim()}” in the list.`
              : filter === 'mine'
                ? 'No plants in your beds yet. Add them in each bed’s settings, or tap any plant here.'
                : 'Nothing here.'}
          </p>
        ) : (
          <div class="cal">
            <div class="cal-row cal-head" aria-hidden="true">
              <span />
              <span class="cal-track">
                {MONTHS.map((m, i) => (
                  <span key={i} class="cal-month" style={{ left: `${(MONTH_START[i] / 365) * 100}%` }}>
                    {m}
                  </span>
                ))}
              </span>
            </div>
            {visible.map(({ p, w }) => {
              const bars = windowsInYear(p, frost, year);
              const open = w.find((x) => x.status === 'now');
              return (
                <button
                  key={p.id}
                  class={`cal-row${open ? ' is-now' : ''}`}
                  onClick={() => onOpen(p.id)}
                  aria-label={`${p.name}: ${w.map((x) => `${HOW_WORDS[x.how] || x.how} ${mdText(x.start.slice(5))} to ${mdText(x.end.slice(5))}`).join('; ')}`}
                >
                  <span class="cal-name">
                    <span class="truncate">{p.name}</span>
                    {p.native && <span class="badge-native" title="Native to North Central Texas" />}
                  </span>
                  <span class="cal-track">
                    {MONTH_START.slice(1).map((m) => (
                      <span key={m} class="cal-grid" style={{ left: `${(m / 365) * 100}%` }} />
                    ))}
                    {bars.map((b, i) => (
                      <span
                        key={i}
                        class={`cal-bar ${howClass(b.how)}${b.best ? ' best' : ''}`}
                        style={{ left: `${pos(b.start)}%`, width: `${Math.max(1.2, pos(b.end) - pos(b.start) + 100 / 365)}%` }}
                      />
                    ))}
                    <span class="cal-today" style={{ left: `${(tk / 365) * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {rows.length > visible.length && (
          <button class="link small cal-more" onClick={() => setAll(true)}>
            Show all {rows.length}
          </button>
        )}
        <p class="muted xs legend">
          <span class="key cal-key-sd" /> Sow seed, or plant cloves, sets or seed potatoes <span class="key cal-key-tr" /> Set out transplants, slips or crowns{' '}
          <span class="key cal-key-ct" /> Plant trees, shrubs and perennials (darker is the best time) <span class="key cal-key-sod" /> Lay sod or seed a lawn{' '}
          <span class="key cal-key-today" /> Today. <span class="badge-native inline" /> Native to North Central Texas. Timing follows Texas A&M AgriLife and
          North Texas county planting guides, counted from your frost dates.
        </p>
      </div>
    </section>
  );
}
