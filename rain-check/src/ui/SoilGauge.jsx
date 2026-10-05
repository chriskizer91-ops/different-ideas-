// The gauge on each card: a slice through the bed or pot. Soil is drawn by
// texture, roots reach their real depth (a young tree's stop short), water
// fills from the bottom up to what's left now, the hatched band is what the
// rest of today will dry out, and the gold line is when to water.

import { useMemo } from 'preact/hooks';
import { seeded } from './hooks.js';

const TOP = 26; // ground surface
const BOT = 114; // bottom of the slice
const X0 = 5;
const X1 = 59;
const CX = 32;
const clamp = (x) => Math.max(0, Math.min(100, x));
const f1 = (n) => n.toFixed(1);

// Soil and mix looks: a base color and a few marks repeated.
const LOOKS = {
  sand: { base: '#e0cc9f', w: 6, h: 6, marks: [['c', 1.2, 1.2, 0.7, '#b89c69'], ['c', 4.2, 3.4, 0.6, '#c7ad7a'], ['c', 2.2, 5, 0.5, '#a88d5c']] },
  sandyLoam: { base: '#c9ab7f', w: 7, h: 7, marks: [['c', 2, 2, 0.7, '#9c7f56'], ['c', 5.2, 5, 0.6, '#a88a5f'], ['r', 4, 1, 1.6, 1, '#b39467']] },
  loam: { base: '#a6815a', w: 8, h: 8, marks: [['r', 1.5, 1.5, 2, 1.2, '#7c5c3d'], ['r', 5.5, 4.8, 1.6, 1.2, '#86653f'], ['c', 3, 6.3, 0.6, '#c09a6c']] },
  siltLoam: { base: '#b29877', w: 4, h: 4, marks: [['c', 1, 1, 0.45, '#937759'], ['c', 3, 3, 0.45, '#9a7f60']] },
  clayLoam: { base: '#a37859', w: 8, h: 6, marks: [['l', 1, 2, 4, 2, '#7a5442'], ['l', 5, 5, 7.5, 5, '#86604a']] },
  clay: { base: '#9a6a54', w: 10, h: 5, marks: [['l', 0, 2.5, 10, 2.5, '#7c4f3e'], ['l', 3, 4.6, 8, 4.6, '#8a5c48']] },
  amended: { base: '#68503a', w: 8, h: 8, marks: [['c', 2, 2, 1.1, '#463324'], ['c', 6, 5.4, 1, '#4c3727'], ['r', 4.4, 0.6, 1.5, 0.8, '#9a7650']] },
  potting: { base: '#56432f', w: 7, h: 7, marks: [['c', 2, 3, 0.9, '#7a5f45'], ['c', 5.2, 5.4, 0.8, '#ece6d9'], ['c', 1, 6.2, 0.5, '#ece6d9']] },
  gritty: { base: '#8a8274', w: 7, h: 7, marks: [['c', 2, 2, 1.2, '#b8b0a2'], ['c', 5.2, 5.2, 1.1, '#6a6459'], ['c', 5.6, 1.4, 0.6, '#d2ccc0']] },
};

function Marks({ marks }) {
  return marks.map((m, i) =>
    m[0] === 'c' ? (
      <circle key={i} cx={m[1]} cy={m[2]} r={m[3]} fill={m[4]} />
    ) : m[0] === 'r' ? (
      <rect key={i} x={m[1]} y={m[2]} width={m[3]} height={m[4]} rx="0.5" fill={m[5]} />
    ) : (
      <line key={i} x1={m[1]} y1={m[2]} x2={m[3]} y2={m[4]} stroke={m[5]} stroke-width="0.9" stroke-linecap="round" />
    ),
  );
}

// Patterns every gauge shares, drawn once on the page.
export function SoilDefs() {
  return (
    <svg width="0" height="0" class="defs" aria-hidden="true" focusable="false">
      <defs>
        {Object.entries(LOOKS).map(([k, s]) => (
          <pattern key={k} id={`soil-${k}`} width={s.w} height={s.h} patternUnits="userSpaceOnUse">
            <rect width={s.w} height={s.h} fill={s.base} />
            <Marks marks={s.marks} />
          </pattern>
        ))}
        <pattern id="soil-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="1" y1="0" x2="1" y2="5" stroke="#ffffff" stroke-width="1.6" opacity="0.8" />
        </pattern>
        <pattern id="pot-weave" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#5a5b53" />
          <path d="M0 1h4M0 3h4" stroke="#6c6d64" stroke-width="0.6" />
          <path d="M1 0v4M3 0v4" stroke="#4a4b44" stroke-width="0.4" />
        </pattern>
        <pattern id="pot-wood" width="8" height="6" patternUnits="userSpaceOnUse">
          <rect width="8" height="6" fill="#9b6b43" />
          <path d="M0 5.6h8" stroke="#7a5233" stroke-width="0.8" />
          <path d="M1 2.5c2 -0.6 4 0.6 6 0" stroke="#86603d" stroke-width="0.4" fill="none" />
        </pattern>
      </defs>
    </svg>
  );
}

// Roots, drawn the same way every time for a given bed.
function rootPaths(kind, rnd, top, depth, xL, xR) {
  const out = [];
  const cx = (xL + xR) / 2;
  const down = (x, y0, len, sway, w) => {
    let d = `M${f1(x)},${f1(y0)}`;
    let px = x;
    let py = y0;
    for (let s = 1; s <= 4; s++) {
      const ny = y0 + (len * s) / 4;
      const nx = Math.max(xL + 1, Math.min(xR - 1, px + (rnd() - 0.5) * sway));
      d += ` Q${f1(px + (rnd() - 0.5) * sway)},${f1((py + ny) / 2)} ${f1(nx)},${f1(ny)}`;
      px = nx;
      py = ny;
    }
    out.push({ d, w });
    return [px, py];
  };
  const side = (x, y, dir, reach, w) => {
    const ex = Math.max(xL + 1, Math.min(xR - 1, x + dir * reach));
    out.push({ d: `M${f1(x)},${f1(y)} Q${f1(x + dir * reach * 0.5)},${f1(y + 1)} ${f1(ex)},${f1(y + 4 + rnd() * 6)}`, w });
  };
  if (kind === 'lawn' || kind === 'lawnWarm') {
    for (let k = 0; k < 14; k++) down(xL + 2 + ((xR - xL - 4) * k) / 13, top, depth * (0.6 + rnd() * 0.4), 3, 0.7);
  } else if (kind === 'trees') {
    down(cx, top, depth * 0.97, 3, 2.2);
    for (let k = 0; k < 5; k++) side(cx, top + depth * (0.08 + 0.17 * k), k % 2 ? 1 : -1, 12 + rnd() * 10, 1.2);
    for (let k = 0; k < 4; k++) down(cx + (k - 1.5) * 9, top + depth * 0.2, depth * 0.5, 4, 0.6);
  } else if (kind === 'shrubs') {
    for (let k = 0; k < 5; k++) {
      const [x, y] = down(cx + (k - 2) * 3, top, depth * (0.7 + rnd() * 0.3), 10, 1.3);
      side(x, y - depth * 0.3, k < 2 ? -1 : 1, 6, 0.7);
    }
  } else if (kind === 'natives') {
    for (let k = 0; k < 3; k++) down(cx + (k - 1) * 4, top, depth * (0.85 + rnd() * 0.15), 5, 1);
    side(cx, top + depth * 0.15, -1, 14, 0.7);
    side(cx, top + depth * 0.25, 1, 14, 0.7);
  } else {
    // vegetables, flowers and pot plants: a fibrous fan
    for (let k = 0; k < 8; k++) {
      const [x, y] = down(cx + (k - 3.5) * 1.5, top, depth * (0.55 + rnd() * 0.45), 9, 0.9);
      if (rnd() < 0.6) side(x, y - depth * 0.25, rnd() < 0.5 ? -1 : 1, 5, 0.5);
    }
  }
  return out;
}

function Roots({ paths }) {
  return (
    <g class="g-roots">
      {paths.map((p, i) => (
        <path key={i} d={p.d} stroke-width={p.w} />
      ))}
    </g>
  );
}

// What shows above ground.
function Top({ kind, young, y }) {
  if (kind === 'lawn' || kind === 'lawnWarm') {
    const blades = [];
    for (let x = X0 + 1; x <= X1 - 1; x += 2.6) blades.push(`M${f1(x)},${y} l${f1(((x * 7) % 3) - 1.5)},-${f1(5 + ((x * 13) % 5))}`);
    return <path d={blades.join(' ')} class="g-grass" />;
  }
  if (kind === 'trees') {
    const r = young ? 7 : 10;
    return (
      <g>
        <rect x={CX - (young ? 1.2 : 2)} y={y - 16} width={young ? 2.4 : 4} height="16" fill="#7a5232" />
        <circle cx={CX} cy={y - 17 - r * 0.4} r={r} class="g-leaf" />
        <circle cx={CX - r * 0.7} cy={y - 14} r={r * 0.6} class="g-leaf" />
        <circle cx={CX + r * 0.7} cy={y - 14} r={r * 0.6} class="g-leaf" />
      </g>
    );
  }
  if (kind === 'shrubs')
    return (
      <g>
        <circle cx={CX - 9} cy={y - 6} r="7" class="g-leaf" />
        <circle cx={CX + 9} cy={y - 6} r="7" class="g-leaf" />
        <circle cx={CX} cy={y - 10} r="9" class="g-leaf" />
      </g>
    );
  if (kind === 'natives')
    return (
      <path
        d={`M${CX},${y} L${CX - 13},${y - 8} L${CX - 3},${y - 2} L${CX - 6},${y - 16} L${CX},${y - 3} L${CX + 6},${y - 16} L${CX + 3},${y - 2} L${CX + 13},${y - 8} Z`}
        fill="#6f9b7b"
      />
    );
  // vegetables and flowers
  return (
    <g>
      <path d={`M${CX},${y} V${y - 15}`} stroke="#3d7a4f" stroke-width="1.6" />
      <ellipse cx={CX - 6} cy={y - 7} rx="6" ry="2.6" transform={`rotate(-20 ${CX - 6} ${y - 7})`} class="g-leaf" />
      <ellipse cx={CX + 6} cy={y - 10} rx="6" ry="2.6" transform={`rotate(20 ${CX + 6} ${y - 10})`} class="g-leaf" />
      {kind === 'flowers' ? (
        <g>
          <circle cx={CX} cy={y - 17} r="4" fill="#e7739c" />
          <circle cx={CX} cy={y - 17} r="1.6" fill="#f6d04d" />
        </g>
      ) : (
        <g>
          <ellipse cx={CX - 3} cy={y - 15} rx="5" ry="2.4" transform={`rotate(-35 ${CX - 3} ${y - 15})`} class="g-leaf" />
          <circle cx={CX + 4} cy={y - 4} r="2.6" fill="#d9483b" />
        </g>
      )}
    </g>
  );
}

function Ground({ bed, sim, now, tonight, refillAt, id }) {
  const m = sim.model;
  const kind = bed.plant;
  const rz = Math.max(0.15, Math.min(1, sim.rootMm / m.plant.rootMm));
  const zoneH = (BOT - TOP) * rz;
  const yOf = (pct) => TOP + zoneH * (1 - clamp(pct) / 100);
  const look = LOOKS[bed.soil] ? bed.soil : 'loam';
  const roots = useMemo(() => rootPaths(kind, seeded(`${bed.id}${kind}`), TOP, zoneH, X0, X1), [bed.id, kind, Math.round(zoneH)]);
  const shape = `M${X0},${TOP} V${BOT - 6} Q${X0},${BOT} ${X0 + 6},${BOT} H${X1 - 6} Q${X1},${BOT} ${X1},${BOT - 6} V${TOP}`;
  const nowY = yOf(now);
  const tonightY = yOf(tonight);
  return (
    <g>
      <defs>
        <clipPath id={`zone-${id}`}>
          <rect x={X0} y={TOP} width={X1 - X0} height={zoneH} />
        </clipPath>
        <clipPath id={`slice-${id}`}>
          <path d={`${shape} Z`} />
        </clipPath>
      </defs>
      <g clip-path={`url(#slice-${id})`}>
        <rect x={X0} y={TOP} width={X1 - X0} height={BOT - TOP} fill={`url(#soil-${look})`} />
        {rz < 1 && <rect x={X0} y={TOP + zoneH} width={X1 - X0} height={BOT - TOP - zoneH} class="g-unreached" />}
        <g clip-path={`url(#zone-${id})`}>
          <rect x={X0} y={TOP} width={X1 - X0} height={zoneH} class="g-water rc-move" style={{ transform: `translateY(${f1(nowY - TOP)}px)` }} />
          {tonightY > nowY + 0.6 && <rect x={X0} y={nowY} width={X1 - X0} height={tonightY - nowY} fill="url(#soil-hatch)" />}
          <Roots paths={roots} />
        </g>
      </g>
      {rz < 1 && <line x1={X0} x2={X1} y1={TOP + zoneH} y2={TOP + zoneH} class="g-rootline" />}
      {bed.mulch && m.mulched && <rect x={X0} y={TOP - 3} width={X1 - X0} height="3" rx="1" fill="#7b5233" />}
      <line x1={X0 - 3} x2={X1 + 3} y1={yOf(refillAt)} y2={yOf(refillAt)} class="g-refill" />
      <path d={shape} class="g-frame" />
      <line x1={X0 - 2} x2={X1 + 2} y1={TOP} y2={TOP} class="g-surface" />
      <Top kind={kind} young={sim.growth < 1} y={bed.mulch && m.mulched ? TOP - 3 : TOP} />
    </g>
  );
}

// Pot outlines: top width, bottom width, height.
const POTS = {
  xs: [30, 22, 32],
  s: [36, 26, 40],
  m: [42, 30, 50],
  l: [48, 34, 60],
  xl: [54, 38, 72],
  tub: [58, 48, 52],
  bonsai: [58, 50, 18],
  basket: [52, 26, 36],
};
const WALLS = { plastic: '#4b5751', wood: 'url(#pot-wood)', clay: '#c2693e', fabric: 'url(#pot-weave)' };
const RIMS = { plastic: '#5d6a63', wood: '#a7774c', clay: '#cf7a4f', fabric: '#66675e' };
const SPREAD = { small: 0.75, same: 1, past: 1.45, big: 1.9 };

function Pot({ bed, sim, now, tonight, refillAt, id }) {
  const [wt, wb, h] = POTS[bed.potSize] || POTS.l;
  const basket = bed.potSize === 'basket';
  const bottom = BOT;
  const top = bottom - h;
  const wall = 3;
  const rimH = 5;
  const outer = basket
    ? `M${CX - wt / 2},${top} L${CX + wt / 2},${top} Q${CX + wt / 2},${bottom} ${CX},${bottom} Q${CX - wt / 2},${bottom} ${CX - wt / 2},${top} Z`
    : `M${CX - wt / 2},${top} L${CX + wt / 2},${top} L${CX + wb / 2},${bottom} L${CX - wb / 2},${bottom} Z`;
  const iTop = top + rimH;
  const iBot = bottom - wall;
  const widthAt = (y) => wt + ((wb - wt) * (y - top)) / h;
  const inner = basket
    ? `M${CX - wt / 2 + wall},${iTop} L${CX + wt / 2 - wall},${iTop} Q${CX + wt / 2 - wall},${iBot} ${CX},${iBot} Q${CX - wt / 2 + wall},${iBot} ${CX - wt / 2 + wall},${iTop} Z`
    : `M${f1(CX - widthAt(iTop) / 2 + wall)},${iTop} L${f1(CX + widthAt(iTop) / 2 - wall)},${iTop} L${f1(CX + widthAt(iBot) / 2 - wall)},${iBot} L${f1(CX - widthAt(iBot) / 2 + wall)},${iBot} Z`;
  const ih = iBot - iTop;
  const yOf = (pct) => iTop + ih * (1 - clamp(pct) / 100);
  const rootFrac = Math.max(0.3, Math.min(1, sim.rootMm / sim.model.depthMm));
  const mix = bed.mix === 'gritty' ? 'gritty' : 'potting';
  const roots = useMemo(
    () => rootPaths('pot', seeded(`${bed.id}pot`), iTop, ih * rootFrac, CX - wt / 2 + wall + 1, CX + wt / 2 - wall - 1),
    [bed.id, bed.potSize, Math.round(ih * rootFrac)],
  );
  const material = bed.material in WALLS ? bed.material : 'plastic';
  const leafW = Math.min(62, wt * (SPREAD[bed.spread] || 1));
  const nowY = yOf(now);
  const tonightY = yOf(tonight);
  const trailing = bed.spread === 'past' || bed.spread === 'big' || basket;
  return (
    <g>
      <defs>
        <clipPath id={`pot-${id}`}>
          <path d={inner} />
        </clipPath>
      </defs>
      {basket && <path d={`M${CX - wt / 2 + 2},${top} L${CX},${top - 30} L${CX + wt / 2 - 2},${top}`} class="g-chain" />}
      <path d={outer} fill={WALLS[material]} />
      <g clip-path={`url(#pot-${id})`}>
        <rect x={CX - wt / 2} y={iTop} width={wt} height={ih} fill={`url(#soil-${mix})`} />
        <rect x={CX - wt / 2} y={iTop} width={wt} height={ih} class="g-water rc-move" style={{ transform: `translateY(${f1(nowY - iTop)}px)` }} />
        {tonightY > nowY + 0.6 && <rect x={CX - wt / 2} y={nowY} width={wt} height={tonightY - nowY} fill="url(#soil-hatch)" />}
        <Roots paths={roots} />
      </g>
      <line x1={CX - wt / 2 - 3} x2={CX + wt / 2 + 3} y1={yOf(refillAt)} y2={yOf(refillAt)} class="g-refill" />
      <rect x={CX - wt / 2 - 2} y={top} width={wt + 4} height={rimH} rx="1.5" fill={RIMS[material]} />
      <PotTop kind={bed.plant} w={leafW} y={top} trailing={trailing} rimW={wt} />
    </g>
  );
}

function PotTop({ kind, w, y, trailing, rimW }) {
  const leaves = [];
  if (kind === 'natives') {
    for (let k = -2; k <= 2; k++)
      leaves.push(<path key={k} d={`M${CX},${y} L${f1(CX + k * (w / 6) - 2)},${y - 9 + Math.abs(k) * 2} L${f1(CX + k * (w / 6) + 2)},${y - 8 + Math.abs(k) * 2} Z`} fill="#7aa58a" />);
    return <g>{leaves}</g>;
  }
  if (kind === 'trees') {
    return (
      <g>
        <rect x={CX - 1.5} y={y - 10} width="3" height="10" fill="#7a5232" />
        <ellipse cx={CX} cy={y - 14} rx={w / 2} ry="7" class="g-leaf" />
      </g>
    );
  }
  const n = Math.max(3, Math.round(w / 8));
  for (let k = 0; k < n; k++) {
    const x = CX - w / 2 + (w * (k + 0.5)) / n;
    leaves.push(<ellipse key={k} cx={f1(x)} cy={f1(y - 5 - (k % 2) * 3)} rx={f1(w / n / 1.4 + 2)} ry="4.2" class="g-leaf" />);
  }
  if (trailing) {
    for (const dir of [-1, 1]) {
      const x0 = CX + (dir * rimW) / 2;
      leaves.push(<path key={`v${dir}`} d={`M${x0},${y} q${dir * 5},8 ${dir * 2},${18}`} class="g-vine" />);
      leaves.push(<ellipse key={`l${dir}`} cx={x0 + dir * 4} cy={y + 9} rx="2.6" ry="1.6" class="g-leaf" />);
      leaves.push(<ellipse key={`m${dir}`} cx={x0 + dir * 2.5} cy={y + 17} rx="2.4" ry="1.5" class="g-leaf" />);
    }
  }
  if (kind === 'flowers') for (let k = 0; k < n; k += 2) leaves.push(<circle key={`f${k}`} cx={f1(CX - w / 2 + (w * (k + 0.5)) / n)} cy={y - 9} r="2.2" fill="#e7739c" />);
  if (kind === 'veg') leaves.push(<circle key="t" cx={CX + w / 5} cy={y - 3} r="2.6" fill="#d9483b" />);
  return <g>{leaves}</g>;
}

export function SoilGauge({ bed, sim }) {
  const now = clamp(sim.moistureNow);
  const tonight = clamp(sim.moistureTonight);
  const pot = sim.model.pot;
  const rz = pot ? 1 : sim.rootMm / sim.model.plant.rootMm;
  const label =
    `${Math.round(now)} percent of the ${pot ? "pot's" : 'root zone’s'} water left now, about ${Math.round(tonight)} percent by tonight. ` +
    `Time to water below ${Math.round(sim.refillAt)} percent.` +
    (!pot && rz < 0.98 ? ` Roots reach ${Math.round(rz * 100)} percent of their full depth so far.` : '');
  const low = now <= sim.refillAt;
  return (
    <div class="gauge" role="img" aria-label={label}>
      <svg viewBox="0 0 64 118" width="64" height="118" class="soil" aria-hidden="true">
        {pot ? (
          <Pot bed={bed} sim={sim} now={now} tonight={tonight} refillAt={sim.refillAt} id={bed.id} />
        ) : (
          <Ground bed={bed} sim={sim} now={now} tonight={tonight} refillAt={sim.refillAt} id={bed.id} />
        )}
      </svg>
      <div class={`gauge-pct${low ? ' low' : ''}`}>{Math.round(now)}%</div>
      <div class="gauge-sub">now</div>
    </div>
  );
}
