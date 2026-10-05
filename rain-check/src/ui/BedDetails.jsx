import { useState } from 'preact/hooks';
import { Field, Select, NumberInput, ConfirmButton } from './controls.jsx';
import { Trash2, X } from './icons.js';
import { fmt, M2_PER_SQFT } from '../lib/units.js';
import { addDays, daysBetween, monthDay } from '../lib/dates.js';
import { lastFed } from '../model/feeding.js';
import { checkTune } from '../model/planting.js';
import { WaterMethod } from './WaterMethod.jsx';
import { PlantPicker } from './PlantPicker.jsx';
import { profilesOf } from '../model/profiles.js';
import {
  PLANTS,
  POT_PLANTS,
  POT_SIZES,
  POT_MIXES,
  POT_MATERIALS,
  POT_RAIN,
  POT_SPREAD,
  SOILS,
  SUN,
  SLOPES,
  SITES,
  isPot,
  potCount,
} from '../model/tables.js';

const pick = (table, v, fallback) => (table[v] ? v : fallback);
const pct = (x) => `${Math.round(x * 100)}%`;

function Explain({ bed, sim, days, T, units }) {
  const m = sim.model;
  const today = days[T].date;
  const parts = [];
  if (m.pot) {
    const vol = (mm) => fmt.potVolume(mm * m.areaM2, units);
    parts.push(
      `${potCount(bed) > 1 ? 'Each pot' : 'This pot'} holds about ${vol(sim.taw)} of water the plant can use. ` +
        `It's time to water once about ${vol(sim.raw)} of that is gone, and today it loses about ${vol(sim.etcToday)}. ` +
        m.mix.tip,
    );
  } else {
    parts.push(
      `The top ${fmt.rootDepth(sim.rootMm, units)} of this bed holds about ${fmt.depth(sim.taw, units)} of water plants can use. ` +
        `It's time to water once they've used ${fmt.depth(sim.raw, units)} of it (${pct(sim.p)} today; less on hot days, when plants struggle sooner). ` +
        `Today it loses about ${fmt.depth(sim.etcToday, units)}. ${m.soil.tip}`,
    );
  }
  const profs = profilesOf(bed);
  if (profs.length > 1) {
    const thirsty = profs.reduce((a, p) => (p.kc > a.kc ? p : a));
    const shallow = profs.reduce((a, p) => (p.rootMm < a.rootMm ? p : a));
    parts.push(
      thirsty === shallow
        ? `Watered for the ${thirsty.name.toLowerCase()}, the thirstiest and shallowest-rooted plant here.`
        : `Watered for the ${thirsty.name.toLowerCase()} (the thirstiest plant here) and the ${shallow.name.toLowerCase()} (the shallowest roots).`,
    );
  }
  if (sim.growth < 1 && bed.plantedOn) {
    const total = m.pot ? 28 : m.plant.establishDays;
    const left = Math.max(0, total - daysBetween(bed.plantedOn, today));
    const leftText = left > 60 ? `about ${Math.round(left / 30)} more months` : left > 13 ? `about ${Math.round(left / 7)} more weeks` : `a few more days`;
    parts.push(
      `${m.pot ? 'Potted' : 'Planted'} ${monthDay(bed.plantedOn)}: the roots fill about ${pct(m.rootMm(today) / (m.pot ? m.depthMm : m.plant.rootMm))} of their full ${m.pot ? 'pot' : 'depth'} so far, so it dries out faster than an established plant. Full rooting takes ${leftText}.`,
    );
  }
  if (sim.dormancy < 0.95)
    parts.push(`Growth has slowed with the cool weather, so it's using about ${pct(sim.dormancy)} of its summer water.`);
  if (sim.lastRain) {
    const r = sim.lastRain;
    const ran = r.runoff >= 0.5 ? `, and about ${fmt.depth(r.runoff, units)} ran off` : '';
    parts.push(
      `Of the ${fmt.depth(r.rain, units)} of rain on ${monthDay(r.date)}, about ${fmt.depth(r.soaked, units)} soaked in${ran}.`,
    );
  }
  return (
    <div class="explain">
      {parts.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

// Finger test: tunes how fast this bed or pot dries.
function Check({ bed, today, units, onUpdate }) {
  const log = bed.tuneLog || [];
  const todays = log.find((c) => c.date === today);
  const pot = isPot(bed);
  const pick = (v) => {
    const rest = log.filter((c) => c.date !== today);
    onUpdate({ tuneLog: todays && todays.v === v ? rest : [...rest, { date: today, v }].slice(-60) });
  };
  const t = checkTune(log);
  const diff = Math.round((Math.abs(t - 1) * 100) / 5) * 5;
  const msg = todays
    ? todays.v < 0
      ? 'Logged today: wetter than shown.'
      : todays.v > 0
        ? "Logged today: drier than shown. If it's bone dry, water it now and log it."
        : 'Logged today: about right.'
    : null;
  const rate = diff
    ? `From your checks, it dries about ${diff}% ${t > 1 ? 'faster' : 'slower'} than the starting estimate.`
    : log.length && !todays
      ? 'Your checks so far match the starting estimate.'
      : null;
  return (
    <div>
      <h4 class="sub">{pot ? 'Check the pot' : 'Check the soil'}</h4>
      <p class="muted xs">
        {pot
          ? 'Push a finger into the mix up to the first knuckle. Compared with the gauge, it feels:'
          : `Dig a finger or trowel ${units === 'imperial' ? '2 inches' : '5 cm'} down. Compared with the gauge, it feels:`}
      </p>
      <div class="row3" role="group" aria-label="How the soil feels">
        {[
          [-1, 'Wetter'],
          [0, 'About right'],
          [1, 'Drier'],
        ].map(([v, label]) => (
          <button key={v} class={`pill grow${todays && todays.v === v ? ' pill-ink' : ''}`} aria-pressed={!!todays && todays.v === v} onClick={() => pick(v)}>
            {label}
          </button>
        ))}
      </div>
      {(msg || rate) && (
        <p class="muted xs" aria-live="polite">
          {msg} {rate}{' '}
          {diff !== 0 && (
            <button class="link" onClick={() => onUpdate({ tuneLog: [] })}>
              Reset
            </button>
          )}
        </p>
      )}
    </div>
  );
}

function DateLog({ title, entries, today, onAdd, onRemove, empty, quick, addLabel }) {
  const [d, setD] = useState('');
  const shown = [...new Set(entries.map((e) => e.slice(0, 10)))].sort().reverse().slice(0, 8);
  return (
    <div>
      <h4 class="sub">{title}</h4>
      {shown.length ? (
        <div class="chips">
          {shown.map((x) => (
            <button key={x} class="log-chip" onClick={() => onRemove(x)} aria-label={`Remove ${monthDay(x)}`}>
              {monthDay(x)} <X size={12} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <p class="muted xs">{empty}</p>
      )}
      {!shown.length && quick && (
        <div class="chips quick">
          {quick.map(([label, n]) => (
            <button key={label} class="pill small" onClick={() => onAdd(addDays(today, -n))}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div class="row-add">
        <input type="date" class="input" value={d} max={today} onInput={(e) => setD(e.currentTarget.value)} aria-label={`Date for ${title.toLowerCase()}`} />
        <button class="btn-ink" disabled={!d || d > today} onClick={() => (onAdd(d), setD(''))}>
          {addLabel}
        </button>
      </div>
    </div>
  );
}

export function BedDetails({ bed, sim, days, T, units, onUpdate, onLog, onRemove, onShowChart, onOpenProfile }) {
  const today = days[T].date;
  const pot = isPot(bed);
  const imp = units === 'imperial';
  const plantOpts = pot ? POT_PLANTS : PLANTS;
  const plantVal = pick(plantOpts, bed.plant, pot ? 'flowers' : 'veg');
  const plant = plantOpts[plantVal];
  const soil = SOILS[bed.soil] || SOILS.loam;
  const sizeOpts = Object.fromEntries(Object.entries(POT_SIZES).map(([k, v]) => [k, { label: imp ? v.imperial : v.metric }]));
  const area = imp ? Math.round((bed.areaM2 || 0) / M2_PER_SQFT) : +(bed.areaM2 || 0).toFixed(2);

  const setSite = (site) => {
    if (site === (pot ? 'pot' : 'ground')) return;
    const p = site === 'pot' ? (POT_PLANTS[bed.plant] ? bed.plant : 'flowers') : PLANTS[bed.plant] ? bed.plant : 'veg';
    const table = site === 'pot' ? POT_PLANTS : PLANTS;
    onUpdate(
      site === 'pot'
        ? { site, plant: p, feedEvery: table[p].feedEvery, potSize: bed.potSize || 'l', mix: bed.mix || 'potting', material: bed.material || 'plastic', rainIn: bed.rainIn || 'open', spread: bed.spread || 'same', count: bed.count || 1 }
        : { site, plant: p, feedEvery: table[p].feedEvery, soil: bed.soil || 'loam', slope: bed.slope || 'flat', areaM2: bed.areaM2 || 4.6 },
    );
  };

  const fields = [
    <Field key="name" label="Name" wide>
      <input class="input" value={bed.name} onInput={(e) => onUpdate({ name: e.currentTarget.value })} />
    </Field>,
    <Field key="site" label="Planted">
      <Select value={pot ? 'pot' : 'ground'} options={SITES} onChange={setSite} />
    </Field>,
  ];
  if (pot) {
    fields.push(
      <Field key="count" label="Pots like this">
        <NumberInput value={potCount(bed)} min={1} onCommit={(n) => onUpdate({ count: Math.max(1, Math.round(n)) })} />
      </Field>,
      <Field key="plant" label="Plants" wide>
        <Select value={plantVal} options={plantOpts} onChange={(v) => onUpdate({ plant: v, feedEvery: plantOpts[v].feedEvery })} />
      </Field>,
      <Field key="size" label="Pot size" wide>
        <Select value={pick(POT_SIZES, bed.potSize, 'l')} options={sizeOpts} onChange={(v) => onUpdate({ potSize: v })} />
      </Field>,
      <Field key="mix" label="Mix" wide>
        <Select value={pick(POT_MIXES, bed.mix, 'potting')} options={POT_MIXES} onChange={(v) => onUpdate({ mix: v })} />
      </Field>,
      <Field key="material" label="Pot material" wide>
        <Select value={pick(POT_MATERIALS, bed.material, 'plastic')} options={POT_MATERIALS} onChange={(v) => onUpdate({ material: v })} />
      </Field>,
      <Field key="spread" label="Plant spread" wide>
        <Select value={pick(POT_SPREAD, bed.spread, 'same')} options={POT_SPREAD} onChange={(v) => onUpdate({ spread: v })} />
      </Field>,
      <Field key="sun" label="Sun" wide hint={SUN[bed.sun] && SUN[bed.sun].note}>
        <Select value={pick(SUN, bed.sun, 'full')} options={SUN} onChange={(v) => onUpdate({ sun: v })} />
      </Field>,
      <Field key="rain" label="Rain" wide>
        <Select value={pick(POT_RAIN, bed.rainIn, 'open')} options={POT_RAIN} onChange={(v) => onUpdate({ rainIn: v })} />
      </Field>,
    );
  } else {
    fields.push(
      <Field key="plant" label="Plants" hint={plant.note}>
        <Select value={plantVal} options={plantOpts} onChange={(v) => onUpdate({ plant: v, feedEvery: plantOpts[v].feedEvery })} />
      </Field>,
      <Field key="soil" label="Soil" wide hint={`Squeeze a moist handful. ${soil.label}: ${soil.feel.charAt(0).toLowerCase()}${soil.feel.slice(1)}`}>
        <Select value={pick(SOILS, bed.soil, 'loam')} options={SOILS} onChange={(v) => onUpdate({ soil: v })} />
      </Field>,
      <Field key="sun" label="Sun" wide hint={SUN[bed.sun] && SUN[bed.sun].note}>
        <Select value={pick(SUN, bed.sun, 'full')} options={SUN} onChange={(v) => onUpdate({ sun: v })} />
      </Field>,
      <Field key="slope" label="Ground">
        <Select value={pick(SLOPES, bed.slope, 'flat')} options={SLOPES} onChange={(v) => onUpdate({ slope: v })} />
      </Field>,
      <Field key="area" label={`Area (${imp ? 'sq ft' : 'm²'})`}>
        <NumberInput value={area} min={0.1} onCommit={(n) => onUpdate({ areaM2: imp ? n * M2_PER_SQFT : n })} />
      </Field>,
    );
  }
  fields.push(
    <Field key="planted" label={pot ? 'Potted on (if new)' : 'Planted on (if new)'} hint={pot ? 'New pots dry faster until roots fill the mix.' : 'New plantings dry faster until their roots spread.'}>
      <div class="date-clear">
        <input type="date" class="input" max={today} value={bed.plantedOn || ''} onInput={(e) => onUpdate({ plantedOn: e.currentTarget.value || null })} />
        {bed.plantedOn && (
          <button class="icon-btn" aria-label="Clear planting date" onClick={() => onUpdate({ plantedOn: null })}>
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </Field>,
    <Field key="feed" label="Feed every … days (0 is off)">
      <NumberInput value={bed.feedEvery || 0} onCommit={(n) => onUpdate({ feedEvery: Math.round(n) })} />
    </Field>,
  );
  if (!pot && plant.mulchKc)
    fields.push(
      <label key="mulch" class="check wide">
        <input type="checkbox" checked={!!bed.mulch} onChange={(e) => onUpdate({ mulch: e.currentTarget.checked })} />
        Mulched with bark, straw or compost
      </label>,
    );

  const fedLast = lastFed(bed, today);

  return (
    <div class="details">
      <Explain bed={bed} sim={sim} days={days} T={T} units={units} />
      <button class="link" onClick={onShowChart}>
        {pot ? 'See this pot on the water chart' : 'See this bed on the soil water chart'}
      </button>
      <PlantPicker bed={bed} onUpdate={onUpdate} onOpen={onOpenProfile} />
      <Check bed={bed} today={today} units={units} onUpdate={onUpdate} />
      <h4 class="sub">Settings</h4>
      <div class="grid2">{fields}</div>
      <WaterMethod bed={bed} units={units} onUpdate={onUpdate} />
      <DateLog
        title="Watering log"
        entries={bed.waterLog || []}
        today={today}
        onAdd={(d) => onLog('waterLog', 'add', d)}
        onRemove={(d) => onLog('waterLog', 'remove', d)}
        addLabel="Add watering"
        empty={
          pot
            ? 'Nothing logged yet, so the plan guesses this pot was last watered 3 months ago. When did you last water it?'
            : 'Nothing logged yet, so the plan guesses this bed was soaked 3 months ago and has been drying since. When did you last water it?'
        }
        quick={[
          ['Today', 0],
          ['Yesterday', 1],
          ['2 days ago', 2],
          ['3 days ago', 3],
          ['A week ago', 7],
        ]}
      />
      {bed.feedEvery > 0 && (
        <DateLog
          title="Feeding log"
          entries={bed.feedLog || []}
          today={today}
          onAdd={(d) => onLog('feedLog', 'add', d)}
          onRemove={(d) => onLog('feedLog', 'remove', d)}
          addLabel="Add feeding"
          empty={fedLast ? '' : 'No feedings logged yet.'}
        />
      )}
      <ConfirmButton class="remove" onConfirm={onRemove} confirmText={`Tap again to remove ${bed.name}`} icon={<Trash2 size={14} aria-hidden="true" />}>
        Remove this {pot ? 'pot' : 'bed'}
      </ConfirmButton>
    </div>
  );
}
