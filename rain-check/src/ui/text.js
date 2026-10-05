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

// "25 minutes", "1 hr 10 min", "15 seconds"
export function minutesText(min) {
  if (!(min > 0)) return '0 minutes';
  if (min < 1) return `${Math.max(5, Math.round((min * 60) / 5) * 5)} seconds`;
  if (min < 20) {
    const m = Math.round(min);
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  if (min < 57.5) return `${Math.round(min / 5) * 5} minutes`;
  const h = Math.floor(min / 60);
  const m = Math.round((min - h * 60) / 5) * 5;
  return m === 60 ? `${h + 1} hr` : m ? `${h} hr ${m} min` : `${h} hr`;
}

// "1½ cans"
export function cansText(n) {
  const r = Math.max(0.5, Math.ceil(n * 2) / 2);
  const w = Math.floor(r);
  return `${w || ''}${r - w > 0 ? '½' : ''} can${r > 1 ? 's' : ''}`;
}

/**
 * The words for one watering, from howToWater():
 *   act    an instruction: "Run the sprinkler about 25 minutes"
 *   plan   a noun phrase: "about 25 minutes of sprinkler"
 *   depth  what soaks in, for beds: "0.6 in"
 *   extra  cycle-and-soak or go-slow advice, or ''
 */
export function waterWords(how, bed, model, units) {
  const pot = model.pot;
  const many = pot && potCount(bed) > 1;
  const each = many ? 'each pot ' : '';
  const per = many ? ' per pot' : '';
  const min = minutesText(how.minutes);
  const vol = fmt.volume(how.litersAll, units);
  const potVol = fmt.potVolume(how.litersEach, units);
  const depth = pot ? null : fmt.depth(how.netMm, units);
  let act;
  let plan;
  switch (how.method) {
    case 'sprinkler':
      act = `Run the sprinkler about ${min}`;
      plan = `about ${min} of sprinkler`;
      break;
    case 'soaker':
      act = `Run the soaker hose about ${min}`;
      plan = `about ${min} of soaker hose`;
      break;
    case 'drip':
      act = `Run the drip about ${min}`;
      plan = `about ${min} of drip`;
      break;
    case 'hose':
      if (pot) {
        act = `Give ${each}about ${potVol} with the hose (${minutesText(how.litersEach / how.flowLpm)}${many ? ' each' : ''}), until it runs from the bottom`;
        plan = `about ${potVol}${per}`;
      } else {
        act = `Give it about ${vol} with the hose, roughly ${min}`;
        plan = `about ${vol} with the hose (${min})`;
      }
      break;
    default:
      if (pot) {
        act = `Give ${each}about ${potVol}, until water runs from the bottom`;
        plan = `about ${potVol}${per}`;
      } else {
        act = `Give it about ${cansText(how.cans)} (${vol})`;
        plan = `about ${cansText(how.cans)}`;
      }
  }
  let extra = '';
  const c = how.cycles;
  if (c && c.tooMany)
    extra = ` This spot sheds water fast, so run it in ${minutesText(c.maxRunMin)} bursts, half an hour apart. A soaker hose or drip would suit it better.`;
  else if (c) extra = ` Run it as ${c.n} × ${minutesText(c.runMin)}, half an hour apart, so it soaks in instead of running off.`;
  else if (!pot && (how.method === 'hose' || how.method === 'can') && model.intake < 10 && how.netMm > model.intake)
    extra = ' Go slowly or water in two rounds so it soaks in.';
  return { act, plan, depth, extra };
}

// Chip and one-line instruction for a card. `how` is howToWater() for sim.amountMm.
export function statusText(sim, bed, days, T, units, how) {
  const today = days[T].date;
  const pot = sim.model.pot;
  const w = waterWords(how, bed, sim.model, units);
  const due = sim.dueIdx != null ? days[sim.dueIdx].date : null;
  const depth = w.depth ? ` (${w.depth})` : '';
  switch (sim.status) {
    case 'water': {
      const chip = sim.partial ? 'Finish watering' : sim.again ? 'Water again' : sim.veryDry ? 'Water now' : 'Water today';
      if (sim.partial) return { tone: 'water', chip, line: `The last watering was cut short. To finish, ${lower(w.act)}${depth}.${w.extra}` };
      const lead = sim.again
        ? "It's dried out again since the last watering. "
        : sim.veryDry
          ? "It's very dry. "
          : sim.crossesLater
            ? pot
              ? "It's above the gold line now but drops below it by evening. "
              : 'It drops below the gold line by this evening; morning is best. '
            : '';
      return { tone: 'water', chip, line: `${lead}${w.act}${depth}.${w.extra}` };
    }
    case 'wait':
      return {
        tone: 'wait',
        chip: 'Rain likely, hold off',
        line: pot
          ? `Rain likely by tomorrow should refill it. If it misses: ${lower(w.act)}.`
          : `About ${fmt.depth(sim.rainSoon, units)} of rain is likely to soak in by tomorrow. If it misses: ${lower(w.act)}${depth}.`,
      };
    case 'cold': {
      const t = fmt.tempUnit(COLD_WATER_C, units);
      return {
        tone: 'cold',
        chip: 'Too cold to water',
        line: due
          ? `It's dry, but below ${t} the soil may be frozen and water won't soak in. Water ${onDay(due, today)} around midday: ${w.plan}.`
          : `It's dry, but it stays below ${t} all week, so water won't soak in. Water around midday on the next day above ${t}.`,
      };
    }
    case 'later':
      return { tone: 'later', chip: `Water ${dayWord(due, today)}`, line: `Plan on ${w.plan}${depth}.` };
    case 'done': {
      const at = sim.wateredAt != null ? `Watered at ${clockText(sim.wateredAt)}. ` : '';
      const again =
        sim.againAt != null
          ? sim.twice
            ? `On a day this hot it will need water again around ${clockText(sim.againAt)}.`
            : `It will drop below the gold line again around ${clockText(sim.againAt)}.`
          : null;
      return {
        tone: 'done',
        chip: sim.waterings > 1 ? `Watered ${sim.waterings} times today` : 'Watered today',
        line: at + (again || (due ? `Next watering ${onDay(due, today)}: ${w.plan}.` : 'No more water needed this week.')),
      };
    }
    default:
      return { tone: 'ok', chip: 'Fine this week', line: 'No water needed in the next 7 days.' };
  }
}

const lower = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

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
