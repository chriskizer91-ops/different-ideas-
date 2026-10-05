// "What's growing" in a bed's settings: the plants in it, and a searchable
// list to add more from the North Texas plant library.

import { useState } from 'preact/hooks';
import { Plus, X } from './icons.js';
import { allProfiles, profileById, plantsPatch, GROUPS, GROUP_ONE } from '../model/profiles.js';
import { isPot } from '../model/tables.js';

const ORDER = Object.keys(GROUPS);

export function PlantPicker({ bed, onUpdate, onOpen }) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const pot = isPot(bed);
  const chosen = (bed.plants || []).map(profileById).filter(Boolean);
  const set = (ids) => onUpdate(plantsPatch(bed, ids));
  const query = q.trim().toLowerCase();
  const list = allProfiles()
    .filter(
      (p) =>
        (!pot || p.potBase) &&
        (group === 'all' || (group === 'native' ? p.native : p.group === group)) &&
        (!query || [p.name, p.sci, p.aka].some((x) => x && x.toLowerCase().includes(query))),
    )
    .sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group) || a.name.localeCompare(b.name));
  const groups = [['all', 'All'], ['native', 'Natives'], ...Object.entries(GROUPS).filter(([k]) => allProfiles().some((p) => p.group === k && (!pot || p.potBase)))];

  return (
    <div class="picker-plants">
      <h4 class="sub">What's growing</h4>
      {chosen.length ? (
        <div class="chips">
          {chosen.map((p) => (
            <span key={p.id} class="plant-tag">
              <button class="plant-tag-name" onClick={() => onOpen(p.id)}>
                {p.name}
              </button>
              <button class="plant-tag-x" aria-label={`Remove ${p.name}`} onClick={() => set((bed.plants || []).filter((x) => x !== p.id))}>
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p class="xs muted">Name what's planted and the plan uses each plant's own water needs and cold limits.</p>
      )}
      <button class="link small" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
        <Plus size={13} aria-hidden="true" /> {adding ? 'Done adding' : 'Add plants'}
      </button>
      {adding && (
        <div class="pp-panel">
          <input class="input" placeholder="Search plants" aria-label="Search plants" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
          <div class="chip-row pp-groups" role="group" aria-label="Kind of plant">
            {groups.map(([k, label]) => (
              <button key={k} class="pick small" aria-pressed={group === k} onClick={() => setGroup(k)}>
                {label}
              </button>
            ))}
          </div>
          <ul class="pp-list">
            {list.map((p) => {
              const on = (bed.plants || []).includes(p.id);
              return (
                <li key={p.id}>
                  <button class={`pp-item${on ? ' on' : ''}`} aria-pressed={on} onClick={() => set(on ? bed.plants.filter((x) => x !== p.id) : [...(bed.plants || []), p.id])}>
                    <span class="pp-name">
                      {p.name}
                      {p.native && <span class="badge-native" title="Native to North Central Texas" />}
                    </span>
                    <span class="pp-meta">
                      {GROUP_ONE[p.group]} · water {p.water}
                    </span>
                  </button>
                </li>
              );
            })}
            {!list.length && <li class="xs muted">No matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
