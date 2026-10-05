// "How you water" in a bed's settings: the method, its rate, and quick tests
// to measure your own sprinkler or hose.

import { useState } from 'preact/hooks';
import { Field, Select, NumberInput } from './controls.jsx';
import { METHODS, methodOf, waterSettings, sprinklerRateFromCatch, hoseFlowFromFill } from '../model/watering.js';
import { isPot } from '../model/tables.js';

const GAL = 3.785;
const FT = 0.3048;
const r2 = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;

export function WaterMethod({ bed, units, onUpdate }) {
  const [test, setTest] = useState(false);
  const [testVal, setTestVal] = useState('');
  const imp = units === 'imperial';
  const pot = isPot(bed);
  const method = methodOf(bed);
  const w = waterSettings(bed);
  const set = (patch) => onUpdate({ water: { ...(bed.water || {}), ...patch } });
  const options = Object.fromEntries(Object.entries(METHODS).filter(([, m]) => !(pot && m.ground)).map(([k, m]) => [k, { label: m.label }]));
  const lost = Math.round((1 - METHODS[method].eff) * 100);

  let fields = null;
  let tip = null;
  if (method === 'sprinkler') {
    fields = (
      <Field label={`Sprinkler rate (${imp ? 'inches' : 'mm'} an hour)`}>
        <NumberInput value={imp ? r2(w.sprinklerMmH / 25.4) : r1(w.sprinklerMmH)} min={0.01} onCommit={(n) => set({ sprinklerMmH: imp ? n * 25.4 : n })} />
      </Field>
    );
    tip = {
      title: 'Measure your sprinkler',
      body: `Set three or four straight-sided cans (tuna cans work) around the area, run the sprinkler 15 minutes, then measure the water in each and enter the average depth.`,
      label: `Average depth caught in 15 minutes (${imp ? 'inches' : 'mm'})`,
      apply: (v) => set({ sprinklerMmH: sprinklerRateFromCatch(imp ? v * 25.4 : v) }),
    };
  } else if (method === 'hose') {
    fields = (
      <Field label={`Hose flow (${imp ? 'gallons' : 'liters'} a minute)`}>
        <NumberInput value={imp ? r1(w.hoseLpm / GAL) : r1(w.hoseLpm)} min={0.1} onCommit={(n) => set({ hoseLpm: imp ? n * GAL : n })} />
      </Field>
    );
    tip = {
      title: 'Measure your hose',
      body: `With the nozzle set the way you water, time how long it takes to fill a ${imp ? '1-gallon jug' : '5-liter bucket'}.`,
      label: 'Seconds to fill it',
      apply: (v) => set({ hoseLpm: hoseFlowFromFill(imp ? GAL : 5, v) }),
    };
  } else if (method === 'soaker') {
    fields = (
      <Field label={`Soaker hose length (${imp ? 'feet' : 'meters'})`}>
        <NumberInput value={imp ? Math.round(w.soakerM / FT) : r1(w.soakerM)} min={1} onCommit={(n) => set({ soakerM: imp ? n * FT : n })} />
      </Field>
    );
  } else if (method === 'drip') {
    const rates = imp
      ? { 1.9: { label: '½ gallon an hour' }, 3.8: { label: '1 gallon an hour' }, 7.6: { label: '2 gallons an hour' } }
      : { 2: { label: '2 liters an hour' }, 4: { label: '4 liters an hour' }, 8: { label: '8 liters an hour' } };
    const keys = Object.keys(rates).map(Number);
    const nearest = keys.reduce((a, k) => (Math.abs(k - w.dripLph) < Math.abs(a - w.dripLph) ? k : a), keys[0]);
    fields = (
      <>
        <Field label={pot ? 'Emitters per pot' : 'Emitters'}>
          <NumberInput value={w.dripCount} min={1} onCommit={(n) => set({ dripCount: Math.max(1, Math.round(n)) })} />
        </Field>
        <Field label="Each emitter">
          <Select value={String(nearest)} options={rates} onChange={(v) => set({ dripLph: Number(v) })} />
        </Field>
      </>
    );
  } else {
    const cans = imp
      ? { 3.8: { label: '1 gallon' }, 7.6: { label: '2 gallons' }, 11.4: { label: '3 gallons' } }
      : { 5: { label: '5 liters' }, 10: { label: '10 liters' }, 12: { label: '12 liters' } };
    const keys = Object.keys(cans).map(Number);
    const nearest = keys.reduce((a, k) => (Math.abs(k - w.canL) < Math.abs(a - w.canL) ? k : a), keys[0]);
    fields = (
      <Field label="Can size">
        <Select value={String(nearest)} options={cans} onChange={(v) => set({ canL: Number(v) })} />
      </Field>
    );
  }

  return (
    <div class="method">
      <h4 class="sub">How you water</h4>
      <div class="grid2">
        <Field label="Method" wide>
          <Select value={method} options={options} onChange={(v) => set({ method: v })} />
        </Field>
        {fields}
      </div>
      <p class="muted xs">
        {lost
          ? `About ${lost}% of what comes out never reaches the roots (wind, evaporation, overspray), so the times and amounts include it.`
          : ''}
      </p>
      {tip && (
        <div class="measure">
          <button class="link small" aria-expanded={test} onClick={() => setTest((v) => !v)}>
            {tip.title}
          </button>
          {test && (
            <div class="measure-body">
              <p class="xs">{tip.body}</p>
              <div class="row-add">
                <input class="input" inputMode="decimal" aria-label={tip.label} placeholder={tip.label} value={testVal} onInput={(e) => setTestVal(e.currentTarget.value)} />
                <button
                  class="btn-ink"
                  disabled={!(parseFloat(testVal) > 0)}
                  onClick={() => {
                    tip.apply(parseFloat(testVal));
                    setTestVal('');
                    setTest(false);
                  }}
                >
                  Use it
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
