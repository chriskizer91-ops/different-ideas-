// The numbers behind every bed and pot. Sources: FAO-56 (Allen et al. 1998)
// tables 12, 19 and 22; WUCOLS plant factors; NRCS soil water and intake rates.

// Plants in the ground.
//   kc            share of ET₀ the planting uses when fully grown and active
//   rootMm        depth of the root zone that the watering plan fills
//   p             share of the root zone's water used before plants start to struggle (FAO-56 table 22)
//   interceptMm   rain caught by leaves and lost before it reaches the soil, per rainy day
//   feedEvery     default feeding interval in days (0 = off)
//   tender        killed or damaged by frost
//   establishDays how long new plantings take to root fully
//   rootStart     root depth on planting day, as a share of the full depth
//   canopyStart   leaf cover on planting day, as a share of full (annuals only)
//   dormant       winter slowdown: kcFrac of kc when the 7-day mean temperature is at
//                 or below tLow, rising to full at tHigh (°C)
//   mulchKc       water use with organic mulch, as a share of bare soil
export const PLANTS = {
  veg: {
    label: 'Vegetables',
    kc: 1.0,
    rootMm: 300,
    p: 0.4,
    interceptMm: 1,
    feedEvery: 28,
    tender: true,
    establishDays: 49,
    rootStart: 0.4,
    canopyStart: 0.55,
    mulchKc: 0.88,
  },
  flowers: {
    label: 'Flowers and annuals',
    kc: 0.8,
    rootMm: 250,
    p: 0.4,
    interceptMm: 1,
    feedEvery: 28,
    tender: true,
    establishDays: 42,
    rootStart: 0.4,
    canopyStart: 0.6,
    mulchKc: 0.88,
  },
  lawn: {
    label: 'Lawn, cool-season grass',
    note: 'Fescue, bluegrass or ryegrass',
    kc: 0.8,
    rootMm: 150,
    p: 0.5,
    interceptMm: 0.5,
    feedEvery: 56,
    establishDays: 42,
    rootStart: 0.3,
    dormant: { kcFrac: 0.35, tLow: 4, tHigh: 10 },
  },
  lawnWarm: {
    label: 'Lawn, warm-season grass',
    note: 'Bermuda, zoysia, St. Augustine or centipede',
    kc: 0.6,
    rootMm: 200,
    p: 0.5,
    interceptMm: 0.5,
    feedEvery: 56,
    establishDays: 42,
    rootStart: 0.3,
    dormant: { kcFrac: 0.25, tLow: 10, tHigh: 18 },
  },
  shrubs: {
    label: 'Shrubs and perennials',
    kc: 0.5,
    rootMm: 450,
    p: 0.5,
    interceptMm: 1.5,
    feedEvery: 90,
    establishDays: 365,
    rootStart: 0.35,
    dormant: { kcFrac: 0.5, tLow: 4, tHigh: 10 },
    mulchKc: 0.93,
  },
  trees: {
    label: 'Trees',
    kc: 0.5,
    rootMm: 600,
    p: 0.5,
    interceptMm: 2,
    feedEvery: 0,
    establishDays: 730,
    rootStart: 0.4,
    dormant: { kcFrac: 0.4, tLow: 4, tHigh: 10 },
    mulchKc: 0.95,
  },
  natives: {
    label: 'Drought-tolerant plants',
    kc: 0.3,
    rootMm: 450,
    p: 0.6,
    interceptMm: 1,
    feedEvery: 0,
    establishDays: 365,
    rootStart: 0.35,
    dormant: { kcFrac: 0.6, tLow: 4, tHigh: 10 },
    mulchKc: 0.93,
  },
};

// Soil texture classes.
//   awc    plant-available water, mm per mm of soil (field capacity minus wilting point)
//   infil  basic intake rate once wet, mm per hour
export const SOILS = {
  sand: {
    label: 'Sand',
    awc: 0.07,
    infil: 30,
    feel: 'Gritty, and falls apart in your hand even when wet.',
    tip: 'Sand holds little water and drains fast, so it needs smaller, more frequent waterings.',
  },
  sandyLoam: {
    label: 'Sandy loam',
    awc: 0.12,
    infil: 20,
    feel: 'Gritty, but a moist handful holds a loose ball.',
    tip: 'Sandy loam drains well and dries a little faster than loam.',
  },
  loam: {
    label: 'Loam',
    awc: 0.15,
    infil: 13,
    feel: 'A moist handful holds a ball that crumbles when you poke it.',
    tip: 'Loam holds water well, so water deeply and less often.',
  },
  siltLoam: {
    label: 'Silt loam',
    awc: 0.18,
    infil: 10,
    feel: 'Smooth and floury, and squeezes into a weak ribbon.',
    tip: 'Silt loam holds the most water of any soil but can crust over. Water slowly.',
  },
  clayLoam: {
    label: 'Clay loam',
    awc: 0.17,
    infil: 7,
    feel: 'Sticky, and squeezes into a short ribbon that breaks.',
    tip: 'Clay loam holds plenty of water but takes it in slowly.',
  },
  clay: {
    label: 'Clay',
    awc: 0.15,
    infil: 4,
    feel: 'Very sticky, and squeezes into a long, smooth ribbon.',
    tip: 'Clay soaks water up slowly and heavy rain runs off it.',
  },
  amended: {
    label: 'Raised bed or compost-rich mix',
    awc: 0.2,
    infil: 25,
    feel: 'Dark, loose and spongy.',
    tip: 'Compost-rich soil holds a lot of water and takes it in quickly.',
  },
};

// How much sun and heat a spot gets, as a multiplier on water use (WUCOLS microclimate).
export const SUN = {
  full: { label: 'Full sun', f: 1 },
  hot: { label: 'Full sun with reflected heat', note: 'Against a sunny wall or paving', f: 1.2 },
  part: { label: 'Part sun', f: 0.8 },
  shade: { label: 'Mostly shade', f: 0.6 },
};

// Slope changes how much heavy rain soaks in before it runs off.
//   storeMm  water held in dips and puddles before runoff starts
//   infilF   multiplier on the soil's intake rate
export const SLOPES = {
  flat: { label: 'Flat', storeMm: 5, infilF: 1 },
  gentle: { label: 'Gentle slope', storeMm: 2.5, infilF: 0.85 },
  steep: { label: 'Steep slope', storeMm: 1, infilF: 0.6 },
};

export const SITES = { ground: { label: 'In the ground' }, pot: { label: 'In a pot' } };

// ---- Pots and containers ----------------------------------------------------
// A pot is its own small water bank: its size and mix set how much it holds.
// Water leaves through the whole plant but rain only enters through the rim,
// so the plant factor grows with how far the plant spreads past the pot,
// porous walls add loss, and rain is cut for shelter and for leaves that shed it.

// kc: thirst per unit of leaf spread. p: share of the pot's water to use before watering.
export const POT_PLANTS = {
  veg: { label: 'Vegetables and herbs', kc: 1, p: 0.4, feedEvery: 14, tender: true },
  flowers: { label: 'Flowers and annuals', kc: 0.9, p: 0.4, feedEvery: 14, tender: true },
  shrubs: {
    label: 'Shrubs and perennials',
    kc: 0.8,
    p: 0.5,
    feedEvery: 45,
    dormant: { kcFrac: 0.5, tLow: 4, tHigh: 10 },
  },
  trees: {
    label: 'Trees and bonsai',
    kc: 0.8,
    p: 0.5,
    feedEvery: 30,
    dormant: { kcFrac: 0.4, tLow: 4, tHigh: 10 },
  },
  natives: {
    label: 'Succulents and drought-tolerant plants',
    kc: 0.35,
    p: 0.65,
    feedEvery: 60,
    dormant: { kcFrac: 0.6, tLow: 4, tHigh: 10 },
  },
};

// liters of mix, top opening in m², how much the walls matter, extra wind exposure
export const POT_SIZES = {
  xs: { liters: 1.1, areaM2: 0.0127, wall: 1, exposure: 1, imperial: 'Small, 4 to 6 in across', metric: 'Small, 10 to 15 cm across', short: { imperial: 'a small', metric: 'a small' } },
  s: { liters: 3.2, areaM2: 0.0227, wall: 1, exposure: 1, imperial: '1 gallon, about 7 in across', metric: 'About 4 liters, 17 cm across', short: { imperial: 'a 1‑gallon', metric: 'a 4‑liter' } },
  m: { liters: 11.4, areaM2: 0.0508, wall: 1, exposure: 1, imperial: '3 gallons, about 10 in across', metric: 'About 11 liters, 25 cm across', short: { imperial: 'a 3‑gallon', metric: 'an 11‑liter' } },
  l: { liters: 18, areaM2: 0.0731, wall: 1, exposure: 1, imperial: '5 gallons, about 12 in across', metric: 'About 19 liters, 30 cm across', short: { imperial: 'a 5‑gallon', metric: 'a 19‑liter' } },
  xl: { liters: 45, areaM2: 0.1295, wall: 1, exposure: 1, imperial: '10 to 15 gallons', metric: '40 to 55 liters', short: { imperial: 'a 10 to 15‑gallon', metric: 'a 40 to 55‑liter' } },
  tub: { liters: 95, areaM2: 0.283, wall: 1, exposure: 1, imperial: '20 gallons or more, tub or half barrel', metric: '75 liters or more, tub or half barrel', short: { imperial: 'a large', metric: 'a large' }, noun: 'tub' },
  bonsai: { liters: 2, areaM2: 0.035, wall: 0.4, exposure: 1, imperial: 'Bonsai pot, shallow', metric: 'Bonsai pot, shallow', short: { imperial: 'a', metric: 'a' }, noun: 'bonsai pot' },
  basket: { liters: 7, areaM2: 0.0707, wall: 1, exposure: 1.25, imperial: 'Hanging basket', metric: 'Hanging basket', short: { imperial: 'a', metric: 'a' }, noun: 'hanging basket' },
};

export const POT_MIXES = {
  potting: {
    label: 'Potting mix',
    awc: 0.32,
    tip: 'Potting mix is hard to rewet once it dries out completely. If water runs straight through, stand the pot in a tray of water for 20 minutes.',
  },
  gritty: {
    label: 'Gritty, bonsai or cactus mix',
    awc: 0.2,
    tip: 'Gritty mix drains fast and holds less, so it dries sooner. Water until it runs from the bottom, wait a minute, then water again.',
  },
};

// excess: extra loss through the walls, as a share of the day's evaporation
export const POT_MATERIALS = {
  plastic: { label: 'Plastic, glazed or metal', excess: 0, word: '' },
  wood: { label: 'Wood or concrete', excess: 0.15, word: 'wooden' },
  clay: { label: 'Terracotta or unglazed clay', excess: 0.45, word: 'terracotta' },
  fabric: { label: 'Fabric grow bag', excess: 0.55, word: 'fabric' },
};

export const POT_RAIN = {
  open: { label: 'Open to rain', f: 1, note: '' },
  part: { label: 'Partly sheltered', f: 0.5, note: 'partly sheltered' },
  covered: { label: 'Under cover', f: 0, note: 'under cover' },
};

// mult: leaf spread relative to the pot's opening. shed: share of rain that lands in the pot.
export const POT_SPREAD = {
  small: { label: 'Smaller than the pot', mult: 1, shed: 1 },
  same: { label: 'About as wide as the pot', mult: 1.6, shed: 0.85 },
  past: { label: 'Spills past the rim', mult: 2.6, shed: 0.65 },
  big: { label: 'Twice as wide or more', mult: 4.5, shed: 0.45 },
};

// New pot plants: roots fill the pot over about four weeks, starting at half.
export const POT_ESTABLISH = { days: 28, rootStart: 0.5 };

export const isPot = (bed) => !!bed && bed.site === 'pot';
export const plantTable = (bed) => (isPot(bed) ? POT_PLANTS : PLANTS);
export const plantOf = (bed) => plantTable(bed)[bed.plant] || plantTable(bed).veg;
export const potCount = (bed) => Math.max(1, Math.round(Number(bed.count) || 1));
