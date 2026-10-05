// Real plants in a bed or pot: their water use sets the bed's numbers, and
// their own cold and heat limits shape the warnings.

import { PLANT_LIBRARY } from '../data/plants.js';

const BY_ID = new Map(PLANT_LIBRARY.map((p) => [p.id, p]));

export const profileById = (id) => BY_ID.get(id) || null;
export const profilesOf = (bed) => (Array.isArray(bed && bed.plants) ? bed.plants.map(profileById).filter(Boolean) : []);
export const allProfiles = () => PLANT_LIBRARY;

export const GROUPS = {
  vegetable: 'Vegetables',
  herb: 'Herbs',
  fruit: 'Fruit',
  flower: 'Flowers',
  perennial: 'Perennials and wildflowers',
  grass: 'Grasses',
  groundcover: 'Groundcovers',
  succulent: 'Succulents',
  shrub: 'Shrubs',
  tree: 'Trees',
  vine: 'Vines',
  lawn: 'Lawn grasses',
};

export const GROUP_ONE = {
  vegetable: 'Vegetable',
  herb: 'Herb',
  fruit: 'Fruit',
  flower: 'Annual flower',
  perennial: 'Perennial',
  grass: 'Ornamental grass',
  groundcover: 'Groundcover',
  succulent: 'Succulent',
  shrub: 'Shrub',
  tree: 'Tree',
  vine: 'Vine',
  lawn: 'Lawn grass',
};

// The thirstiest plant and the shallowest roots decide when a mixed bed needs
// water, so a bed of tomatoes and rosemary is watered for the tomatoes.
export function waterTraits(profiles) {
  if (!profiles.length) return null;
  return {
    kc: Math.max(...profiles.map((p) => p.kc)),
    rootMm: Math.min(...profiles.map((p) => p.rootMm)),
    p: Math.min(...profiles.map((p) => p.p)),
  };
}

// Temperatures inside notes are written as {{t:-2.2}} and shown in the
// gardener's units by the interface.
const T = (c) => `{{t:${c}}}`;
const names = (list) => {
  const n = list.map((p) => p.name);
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
};
const plural = (list, one, many) => (list.length > 1 ? many : one);
const EDIBLE = new Set(['vegetable', 'herb', 'fruit']);

/**
 * How a night's low touches each plant:
 *   kill     dies (tender annuals well below freezing, or woody plants past their limit)
 *   dieback  freezes to the ground but regrows from the roots
 *   damage   leaves, flowers or fruit are hurt; cover it
 *   fine     hardy enough
 */
export function coldOutcome(p, low) {
  const tender = p.frost === 'tender';
  if (tender && p.damageC != null) {
    if (low <= p.damageC - 2) return 'kill';
    if (low <= p.damageC + 2) return 'damage';
    return 'fine';
  }
  if (p.killC != null && low <= p.killC) return p.dieback ? 'dieback' : 'kill';
  if (p.damageC != null && low <= p.damageC) return 'damage';
  return 'fine';
}

// One or two sentences for a bed or pot with named plants, or null if none are at risk.
export function coldNote(bed, profiles, low, pot) {
  const by = { kill: [], dieback: [], damage: [], fine: [] };
  for (const p of profiles) by[coldOutcome(p, low)].push(p);
  const out = [];
  if (by.kill.length) {
    const annual = by.kill.every((p) => p.frost === 'tender' || p.life === 'annual');
    const food = by.kill.some((p) => EDIBLE.has(p.group));
    if (pot) out.push(`${names(by.kill)} can die in this cold: bring the pot inside.`);
    else if (annual)
      out.push(`${names(by.kill)} ${plural(by.kill, 'dies', 'die')} at these temperatures${food ? ": pick what's ripe; covers" : '. Covers'} only buy a degree or two.`);
    else
      out.push(
        `${names(by.kill)} can be killed below about ${T(Math.max(...by.kill.map((p) => p.killC)))}: mulch the roots and wrap ${plural(by.kill, 'it', 'them')} with frost cloth.`,
      );
  }
  if (by.dieback.length)
    out.push(`${names(by.dieback)} will freeze back to the ground but usually ${plural(by.dieback, 'regrows', 'regrow')} from the roots in spring. Mulch the base.`);
  if (by.damage.length) {
    const at = Math.max(...by.damage.map((p) => (p.damageC != null ? p.damageC : 0)));
    out.push(pot ? `${names(by.damage)} ${plural(by.damage, 'is', 'are')} hurt below about ${T(at)}: move the pot against the house or inside.` : `${names(by.damage)}: cover overnight (hurt below about ${T(at)}).`);
  }
  if (!out.length) return null;
  if (by.fine.length) {
    const hardy = by.fine.filter((p) => p.damageC != null);
    if (hardy.length) out.push(`${names(hardy)} ${plural(hardy, 'is', 'are')} fine to about ${T(Math.min(...hardy.map((p) => p.damageC)))}.`);
  }
  return out.join(' ');
}

export function heatNote(bed, profiles, high) {
  const hit = profiles.filter((p) => p.heatC != null && high >= p.heatC && p.heatShort);
  if (!hit.length) return null;
  // Group plants that share the same effect: "Tomato and pepper set little fruit".
  // heatShort is [singular, plural] verb phrases: ['sets little fruit', 'set little fruit'].
  const groups = new Map();
  for (const p of hit) {
    const key = [].concat(p.heatShort).join('|');
    if (!groups.has(key)) groups.set(key, { forms: [].concat(p.heatShort), list: [] });
    groups.get(key).list.push(p);
  }
  return [...groups.values()]
    .map(({ forms, list }) => `${names(list)} ${list.length > 1 ? forms[forms.length - 1] : forms[0]} in this heat.`)
    .join(' ');
}

// The change to a bed when its plant list changes. The first plant also sets
// the bed's broad type, which governs winter dormancy and rooting time.
export function plantsPatch(bed, ids) {
  const patch = { plants: ids };
  const had = (bed.plants || []).filter((id) => BY_ID.has(id)).length;
  if (!had && ids.length) {
    const p = BY_ID.get(ids[0]);
    const base = p && (bed.site === 'pot' ? p.potBase : p.base);
    if (base) patch.plant = base;
    if (p && p.feedEvery != null) patch.feedEvery = p.feedEvery;
  }
  return patch;
}

// Plants that can live in a pot.
export const suitsPot = (p) => !!p.potBase;
