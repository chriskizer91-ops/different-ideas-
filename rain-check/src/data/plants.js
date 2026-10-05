// Plants for Dallas–Fort Worth gardens: natives of the Blackland Prairie and
// Cross Timbers, and vegetables, herbs, fruit and landscape plants that do well
// in North Central Texas heat and alkaline clay.
//
// Temperatures are written in °F, as the sources give them, and converted.
// Planting windows are in weeks relative to the average last freeze (spring)
// or first freeze (fall), as in Texas A&M AgriLife's planting guides.
// Water use for vegetables comes from FAO-56 (crop coefficient at full growth,
// table 12, and the share of water used before stress, table 22); root zones
// are garden watering depths: shallow 12 in, medium 18 in, deep 24 in.
// Landscape water use follows Texas SmartScape's ratings for North Central
// Texas, turned into plant factors (very low 0.15, low 0.3, medium 0.5, high 0.7).

const F = (f) => (f == null ? null : Math.round((((f - 32) * 5) / 9) * 10) / 10);
const ROOTS = { shallow: 300, medium: 450, deep: 600 };
const WATER = { 'very low': [0.15, 0.65], low: [0.3, 0.6], medium: [0.5, 0.5], high: [0.7, 0.4] };

const win = (anchor, how, from, to, best) => ({ anchor, how, from, to, best: !!best });

// Planting seasons for landscape plants.
const SEASONS = {
  // container trees, shrubs and perennials: fall is best in North Texas, late winter to spring works
  fall: [win('first', 'container', -6, 2, true), win('last', 'container', -8, 4)],
  // bare-root fruit trees and roses while dormant
  bareroot: [win('last', 'bare-root', -10, -3, true), win('first', 'container', -6, 2)],
  // wildflower seed sown in fall to sprout with fall rains and bloom in spring
  wildflower: [win('first', 'seed', -11, -3, true)],
  // warm-season annual flowers after frost
  warmAnnual: [win('last', 'transplant', 2, 10, true)],
  // cool-season annual flowers for fall, winter and spring color
  coolAnnual: [win('first', 'transplant', -7, -2, true), win('last', 'transplant', -8, -4)],
  // warm-season lawns from sod or seed once soil is warm
  warmLawn: [win('last', 'sod or seed', 4, 16, true)],
  // cool-season lawns seeded in early fall
  coolLawn: [win('first', 'seed', -9, -6, true)],
  // succulents and cold-tender perennials: spring, so roots settle before winter
  spring: [win('last', 'container', 2, 12, true)],
};

function edible(e) {
  const windows = [];
  if (e.spring) windows.push(win('last', e.spring[0], e.spring[1], e.spring[2]));
  if (e.fall) windows.push(win('first', e.fall[0], e.fall[1], e.fall[2]));
  if (e.plantRule) windows.push(...SEASONS[e.plantRule]);
  return {
    life: e.season === 'perennial' ? 'perennial' : 'annual',
    base: e.group === 'fruit' && e.season === 'perennial' ? 'trees' : e.season === 'perennial' ? 'shrubs' : 'veg',
    potBase: e.potBase === undefined ? (e.season === 'perennial' ? 'shrubs' : 'veg') : e.potBase,
    feedEvery: e.season === 'perennial' ? 60 : 28,
    native: false,
    water: e.kc >= 1 ? 'high' : e.kc >= 0.6 ? 'medium' : 'low',
    ...e,
    rootMm: ROOTS[e.roots] || e.rootMm || 450,
    damageC: F(e.damageF),
    killC: F(e.killF),
    heatC: F(e.heatF),
    windows,
  };
}

const BASE = { tree: 'trees', shrub: 'shrubs', perennial: 'shrubs', grass: 'shrubs', groundcover: 'shrubs', vine: 'shrubs', succulent: 'natives', annual: 'flowers' };
const POT = { shrub: 'shrubs', perennial: 'shrubs', grass: 'shrubs', groundcover: 'shrubs', vine: 'shrubs', succulent: 'natives', annual: 'flowers' };
const LAND_ROOTS = { tree: 600, shrub: 450, perennial: 300, grass: 450, groundcover: 200, vine: 450, succulent: 300, annual: 250 };

function landscape(l) {
  const [kc, p] = WATER[l.water] || WATER.medium;
  return {
    life: l.type === 'annual' ? 'annual' : 'perennial',
    group: l.type === 'annual' ? 'flower' : l.type,
    base: l.type === 'lawn' ? l.lawnBase : BASE[l.type],
    potBase: l.potBase !== undefined ? l.potBase : POT[l.type] || null,
    kc,
    p,
    rootMm: LAND_ROOTS[l.type] || 300,
    feedEvery: l.type === 'annual' ? 28 : 0,
    frost: l.type === 'annual' && l.season === 'warm' ? 'tender' : null,
    ...l,
    // warm-season annuals are hurt by frost itself
    damageC: F(l.damageF != null ? l.damageF : l.type === 'annual' && l.season === 'warm' ? 32 : null),
    killC: F(l.coldF),
    heatC: F(l.heatF),
    windows: SEASONS[l.plantRule] || SEASONS.fall,
  };
}

export const PLANT_LIBRARY = [
  // ---- vegetables ----
  edible({
    id: 'tomato',
    name: 'Tomato',
    sci: 'Solanum lycopersicum',
    group: 'vegetable',
    season: 'warm',
    kc: 1.15,
    p: 0.4,
    roots: 'deep',
    spring: ['transplant', 1, 6],
    fall: ['transplant', -22, -18],
    frost: 'tender',
    damageF: 32,
    heatF: 92,
    heatShort: ['sets little fruit', 'set little fruit'],
    heat: 'Flowers drop without setting fruit when days stay above about 92°F or nights above 75°F.',
    days: '70–85 days from transplant',
    tips: 'Plant early so fruit sets before the summer heat; a second crop planted in early summer bears in fall.',
  }),
  edible({
    id: 'pepper',
    name: 'Pepper',
    sci: 'Capsicum annuum',
    group: 'vegetable',
    season: 'warm',
    kc: 1.05,
    p: 0.3,
    roots: 'medium',
    spring: ['transplant', 2, 7],
    fall: ['transplant', -20, -16],
    frost: 'tender',
    damageF: 32,
    heatF: 95,
    heatShort: ['drops its blossoms', 'drop their blossoms'],
    heat: 'Blossoms drop in the hottest weeks; plants pick up again as nights cool.',
    days: '65–80 days from transplant',
  }),
  edible({
    id: 'basil',
    name: 'Basil',
    sci: 'Ocimum basilicum',
    group: 'herb',
    season: 'warm',
    kc: 0.95,
    p: 0.4,
    roots: 'shallow',
    spring: ['transplant', 2, 10],
    frost: 'tender',
    damageF: 35,
    days: '60–75 days',
  }),
  edible({
    id: 'kale',
    name: 'Kale',
    sci: 'Brassica oleracea (Acephala)',
    group: 'vegetable',
    season: 'cool',
    kc: 1.05,
    p: 0.45,
    roots: 'medium',
    spring: ['transplant', -6, -2],
    fall: ['transplant', -14, -8],
    frost: 'hardy',
    damageF: 15,
    heatF: 85,
    heatShort: ['turns tough and bitter', 'turn tough and bitter'],
    days: '50–65 days',
  }),
  edible({
    id: 'spinach',
    name: 'Spinach',
    sci: 'Spinacia oleracea',
    group: 'vegetable',
    season: 'cool',
    kc: 1.0,
    p: 0.2,
    roots: 'shallow',
    spring: ['seed', -8, -4],
    fall: ['seed', -12, -6],
    frost: 'hardy',
    damageF: 15,
    heatF: 80,
    heatShort: ['bolts', 'bolt'],
    days: '40–50 days',
  }),
  edible({
    id: 'lettuce',
    name: 'Lettuce',
    sci: 'Lactuca sativa',
    group: 'vegetable',
    season: 'cool',
    kc: 1.0,
    p: 0.3,
    roots: 'shallow',
    spring: ['seed', -6, -2],
    fall: ['seed', -12, -6],
    frost: 'semi-hardy',
    damageF: 28,
    heatF: 80,
    heatShort: ['bolts and turns bitter', 'bolt and turn bitter'],
    days: '45–60 days',
  }),
  edible({
    id: 'garlic',
    name: 'Garlic',
    sci: 'Allium sativum',
    group: 'vegetable',
    season: 'cool',
    kc: 1.0,
    p: 0.3,
    roots: 'shallow',
    fall: ['cloves', -8, -3],
    frost: 'hardy',
    damageF: 10,
    days: 'Harvest in late May or June',
  }),
  // ---- landscape ----
  landscape({
    id: 'live-oak',
    name: 'Live oak',
    sci: 'Quercus virginiana and Q. fusiformis',
    type: 'tree',
    native: true,
    water: 'low',
    sun: 'full',
    coldF: 0,
    potBase: null,
  }),
  landscape({
    id: 'turks-cap',
    name: "Turk's cap",
    sci: 'Malvaviscus arboreus var. drummondii',
    type: 'shrub',
    native: true,
    water: 'low',
    sun: 'part to shade',
    coldF: 25,
    dieback: true,
  }),
  landscape({
    id: 'texas-sage',
    name: 'Texas sage (cenizo)',
    sci: 'Leucophyllum frutescens',
    type: 'shrub',
    native: false,
    water: 'very low',
    sun: 'full',
    coldF: 10,
  }),
  landscape({
    id: 'bermuda',
    name: 'Bermudagrass',
    sci: 'Cynodon dactylon',
    type: 'lawn',
    lawnBase: 'lawnWarm',
    native: false,
    water: 'medium',
    sun: 'full',
    coldF: null,
    plantRule: 'warmLawn',
    potBase: null,
  }),
  landscape({
    id: 'bluebonnet',
    name: 'Texas bluebonnet',
    sci: 'Lupinus texensis',
    type: 'annual',
    native: true,
    water: 'low',
    sun: 'full',
    plantRule: 'wildflower',
  }),
  edible({
    id: 'meyer-lemon',
    name: 'Meyer lemon',
    sci: 'Citrus × meyeri',
    group: 'fruit',
    season: 'perennial',
    kc: 0.7,
    p: 0.5,
    roots: 'medium',
    plantRule: 'spring',
    potBase: 'trees',
    damageF: 28,
    killF: 22,
    frost: 'semi-hardy',
  }),
];
