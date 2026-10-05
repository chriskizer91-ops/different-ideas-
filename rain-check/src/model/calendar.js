// The planting calendar. Planting windows are kept relative to frost dates,
// the way Texas A&M AgriLife's planting guides give them ("1 to 4 weeks after
// the average last freeze", "10 to 8 weeks before the average first freeze"),
// then turned into dates for wherever the garden is.

import { addDays, daysBetween, mdText } from '../lib/dates.js';

export const SOON_DAYS = 21;

/**
 * The frost dates the calendar works from, best source first:
 * the gardener's own dates, 30-year odds, or the 3-year record.
 * Returns { last, first, lastLate, firstEarly, source } with 'MM-DD' dates,
 * or null when there are no regular freezes to plan around.
 */
export function frostDatesFrom({ custom, normals, climate }) {
  const odds = normals && normals.freeze;
  const base =
    odds && odds.last.p50 && odds.first.p50
      ? { last: odds.last.p50, first: odds.first.p50, lastLate: odds.last.p90, firstEarly: odds.first.p10, source: '30 years of records' }
      : climate && climate.freeze && climate.freeze.lastSpring && climate.freeze.firstFall
        ? {
            last: climate.freeze.lastSpring.middle.slice(5),
            first: climate.freeze.firstFall.middle.slice(5),
            lastLate: climate.freeze.lastSpring.latest.slice(5),
            firstEarly: climate.freeze.firstFall.earliest.slice(5),
            source: 'the last few years of records',
          }
        : null;
  if (custom && custom.last && custom.first) return { ...(base || {}), last: custom.last, first: custom.first, source: 'your dates', custom: true };
  return base;
}

// One occurrence of a window, anchored on a given year's frost date.
export function windowIn(win, frost, year) {
  const md = win.anchor === 'last' ? frost.last : frost.first;
  const anchor = `${year}-${md}`;
  return { ...win, start: addDays(anchor, Math.round(win.from * 7)), end: addDays(anchor, Math.round(win.to * 7)) };
}

/**
 * Where each of a plant's windows stands today: 'now' (open), 'soon' (opens
 * within three weeks), or 'later', with the occurrence to show.
 */
export function windowsFor(profile, frost, today) {
  if (!frost) return [];
  const y = +today.slice(0, 4);
  const out = [];
  for (const win of profile.windows || []) {
    const occ = [y - 1, y, y + 1].map((yy) => windowIn(win, frost, yy));
    const open = occ.find((o) => o.start <= today && today <= o.end);
    if (open) {
      out.push({ ...open, status: 'now', daysLeft: daysBetween(today, open.end) });
      continue;
    }
    const next = occ.filter((o) => o.start > today).sort((a, b) => (a.start < b.start ? -1 : 1))[0];
    if (next) {
      const days = daysBetween(today, next.start);
      out.push({ ...next, status: days <= SOON_DAYS ? 'soon' : 'later', daysUntil: days });
    }
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : 1));
}

// The windows that fall in a calendar year, cut at the year's ends, for the timeline.
export function windowsInYear(profile, frost, year) {
  if (!frost) return [];
  const out = [];
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  for (const win of profile.windows || []) {
    for (const yy of [year - 1, year, year + 1]) {
      const o = windowIn(win, frost, yy);
      if (o.end < from || o.start > to) continue;
      out.push({ ...o, start: o.start < from ? from : o.start, end: o.end > to ? to : o.end });
    }
  }
  return out;
}

// What to plant now and in the next three weeks, from a list of profiles.
export function plantNow(profiles, frost, today) {
  const now = [];
  const soon = [];
  for (const p of profiles) {
    const w = windowsFor(p, frost, today);
    const open = w.find((x) => x.status === 'now');
    const next = w.find((x) => x.status === 'soon');
    if (open) now.push({ profile: p, win: open });
    else if (next) soon.push({ profile: p, win: next });
  }
  now.sort((a, b) => a.win.daysLeft - b.win.daysLeft);
  soon.sort((a, b) => a.win.daysUntil - b.win.daysUntil);
  return { now, soon };
}

/**
 * When normal highs climb past a temperature in spring and fall back below
 * it in fall, from 30-year normals: { from, to } as 'MM-DD', or null if they
 * never reach it.
 */
export function heatSeason(daily, c) {
  if (!daily) return null;
  let first = null;
  let last = null;
  for (let k = 0; k < 365; k++) {
    const d = daily[k];
    if (d && d.hi && d.hi[50] >= c) {
      if (first == null) first = k;
      last = k;
    }
  }
  if (first == null) return null;
  const md = (k) => addDays('2001-01-01', k).slice(5);
  return { from: md(first), to: md(last) };
}

// "Mar 19 – Apr 16"
export const rangeText = (o) => `${mdText(o.start.slice(5))} – ${mdText(o.end.slice(5))}`;
