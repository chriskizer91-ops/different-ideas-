// The words on each card, built from the model's numbers.

import { fmt } from '../lib/units.js';
import { addDays, clockText, dayWord, onDay, nightWord, monthDay, weekday } from '../lib/dates.js';
import { COLD_WATER_C } from '../model/waterBalance.js';
import { PLANTS, POT_PLANTS, POT_SIZES, POT_MATERIALS, POT_RAIN, SOILS, SUN, isPot, potCount } from '../model/tables.js';

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const listWords = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

// "Vegetables in loam, full sun, mulched"
export function bedLine(bed, units) {
  if (isPot(bed)) {
    const size = POT_SIZES[bed.potSize] || POT_SIZES.l;
    const wall = POT_MATERIALS[bed.material] || POT_MATERIALS.plastic;
    const rain = POT_RAIN[bed.rainIn] || POT_RAIN.open;
    const plant = POT_PLANTS[bed.plant] || POT_PLANTS.veg;
    const n = potCount(bed);
    const where = ['in', size.short[units === 'imperial' ? 'imperial' : 'metric'], wall.word, size.noun || 'pot'].filter(Boolean).join(' ');
    const extra = [(SUN[bed.sun] || SUN.full).label.toLowerCase(), rain.note, n > 1 ? `${n} like this` : ''].filter(Boolean);
    return `${plant.label} ${where}, ${extra.join(', ')}`;
  }
  const plant = PLANTS[bed.plant] || PLANTS.veg;
  const soil = SOILS[bed.soil] || SOILS.loam;
  const bits = [(SUN[bed.sun] || SUN.full).label.toLowerCase()];
  if (bed.mulch && plant.mulchKc) bits.push('mulched');
  return `${plant.label} in ${soil.label.toLowerCase()}, ${bits.join(', ')}`;
}

function amounts(sim, bed, mm, units) {
  if (sim.model.pot) {
    const many = potCount(bed) > 1;
    return { amt: fmt.potVolume(mm * sim.model.areaM2, units), each: many ? 'each pot ' : '', per: many ? ' per pot' : '' };
  }
  return { amt: fmt.depth(mm, units), vol: fmt.bedVolume(mm, sim.model.areaM2, units), each: '', per: '' };
}

// Chip and one-line instruction for a card.
export function statusText(sim, bed, days, T, units) {
  const today = days[T].date;
  const pot = sim.model.pot;
  const { amt, vol, each, per } = amounts(sim, bed, sim.amountMm, units);
  const due = sim.dueIdx != null ? days[sim.dueIdx].date : null;
  // Slow soils take in less than a sprinkler or hose puts down in an hour.
  const passes =
    !pot && sim.model.intake < 10 && sim.amountMm > sim.model.intake
      ? ' Water it in two or three passes, half an hour apart, so it soaks in instead of running off.'
      : '';
  switch (sim.status) {
    case 'water': {
      const chip = sim.veryDry ? 'Water now' : 'Water today';
      if (pot) {
        const line = sim.crossesLater
          ? `It's above the gold line now but drops below it by evening. Give ${each}about ${amt} today, until water runs from the bottom.`
          : `Give ${each}about ${amt}, until water runs from the bottom.`;
        return { tone: 'water', chip, line: (sim.veryDry ? "It's very dry. " : '') + line };
      }
      const line = sim.crossesLater
        ? `It drops below the gold line by this evening. Give about ${amt}, roughly ${vol} for this bed. Morning is best.`
        : `Give about ${amt}, roughly ${vol} for this bed.`;
      return { tone: 'water', chip, line: (sim.veryDry ? "It's very dry. " : '') + line + passes };
    }
    case 'wait':
      return {
        tone: 'wait',
        chip: 'Rain likely, hold off',
        line: pot
          ? `Rain likely by tomorrow should refill it. If it misses, give ${each}about ${amt}.`
          : `About ${fmt.depth(sim.rainSoon, units)} of rain is likely to soak in by tomorrow. If it misses, give about ${amt}.`,
      };
    case 'cold': {
      const t = fmt.tempUnit(COLD_WATER_C, units);
      return {
        tone: 'cold',
        chip: 'Too cold to water',
        line: due
          ? `It's dry, but below ${t} the soil may be frozen and water won't soak in. Water ${onDay(due, today)} around midday, about ${amt}.`
          : `It's dry, but it stays below ${t} all week, so water won't soak in. Water around midday on the next day above ${t}.`,
      };
    }
    case 'later':
      return { tone: 'later', chip: `Water ${dayWord(due, today)}`, line: `Plan on about ${amt}${per}.` };
    case 'done': {
      const at = sim.wateredAt != null ? `Watered at ${clockText(sim.wateredAt)}. ` : '';
      return {
        tone: 'done',
        chip: 'Watered today',
        line: at + (due ? `Next watering ${onDay(due, today)}, about ${amt}${per}.` : 'No more water needed this week.'),
      };
    }
    default:
      return { tone: 'ok', chip: 'Fine this week', line: 'No water needed in the next 7 days.' };
  }
}

export function feedText(f, today) {
  switch (f.status) {
    case 'done':
      return { strong: false, text: 'Fed today.' };
    case 'rest':
      return { strong: false, text: 'Too cool to feed this week. Growth has slowed.' };
    case 'unknown':
      return { strong: false, text: `Feeding every ${f.every} days. Log the last time you fed it to start the schedule.` };
    case 'later':
      return { strong: false, text: f.inDays === 1 ? 'Feed tomorrow.' : f.inDays < 7 ? `Feed on ${weekday(addDays(today, f.inDays))}.` : `Feed in ${f.inDays} days.` };
    case 'hold':
      return {
        strong: true,
        text:
          f.reason === 'heat'
            ? 'Feeding is due. Wait until the heat breaks: fertilizer stresses plants in hot weather.'
            : "Feeding is due. Wait until after the heavy rain so it doesn't wash away.",
      };
    case 'due':
      return {
        strong: true,
        text: f.waterFirst
          ? 'Feeding is due. Water first: fertilizer on dry roots can burn them.'
          : f.overdue > f.every / 2
            ? `Feeding is overdue. Last fed ${monthDay(f.last)}.`
            : 'Feeding is due today.',
      };
    default:
      return null;
  }
}

export function headline(rows) {
  if (!rows.length) return 'Add a bed or pot to get a watering plan.';
  const water = rows.filter((r) => r.sim.status === 'water').map((r) => r.bed.name);
  if (water.length) return `Water today: ${listWords(water)}.`;
  if (rows.some((r) => r.sim.status === 'wait')) return 'Rain is on the way. Hold off on watering.';
  if (rows.some((r) => r.sim.status === 'cold')) return 'Too cold to water today.';
  if (rows.some((r) => r.sim.status === 'done')) return 'Nothing else needs water today.';
  return 'Nothing needs water today.';
}

// "Wednesday night: low 26°F" / "Thursday: high 101°F"
export function alertWhen(a, today, units) {
  if (a.kind === 'cold') return `${cap(nightWord(a.peak.date, today))}: low ${fmt.tempUnit(a.peak.value, units)}`;
  return `${cap(dayWord(a.peak.date, today))}: high ${fmt.tempUnit(a.peak.value, units)}`;
}

export function alertDayLabel(a, d, today) {
  if (a.kind === 'cold') {
    const n = nightWord(d.date, today);
    return n === 'tonight' ? 'Tonight' : `${weekday(d.date).slice(0, 3)} night`;
  }
  const w = dayWord(d.date, today);
  return w === 'today' ? 'Today' : weekday(d.date).slice(0, 3);
}

// Quiet line for warnings that have become routine.
export function routineLine(a, today, units) {
  const lastDay = a.days[a.days.length - 1].date;
  if (a.kind === 'cold') {
    const word = a.level >= 3 ? 'Hard freezes' : a.level === 2 ? 'Freezing nights' : 'Frosty nights';
    return `${word} continue through ${nightWord(lastDay, today)}, as most nights lately, with lows down to ${fmt.tempUnit(a.peak.value, units)}. Keep tender pots inside.`;
  }
  return `The heat continues through ${dayWord(lastDay, today)}, as most days lately, with highs up to ${fmt.tempUnit(a.peak.value, units)}. Keep watering early.`;
}
