// Dates are calendar days at the garden, kept as 'YYYY-MM-DD' strings.
// Arithmetic goes through UTC so daylight saving never shifts a day.

export const DAY_MS = 864e5;

export function parseISO(d) {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd);
}

export const addDays = (d, n) => new Date(parseISO(d) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DAY_MS);
export const dayOfYear = (d) => Math.round((parseISO(d) - Date.UTC(+d.slice(0, 4), 0, 0)) / DAY_MS);
export const monthOf = (d) => +d.slice(5, 7);

// The garden's wall clock: now, shifted by the location's UTC offset.
export function gardenClock(offsetSeconds, now = Date.now()) {
  const t = new Date(now + offsetSeconds * 1000);
  return { date: t.toISOString().slice(0, 10), hour: t.getUTCHours() + t.getUTCMinutes() / 60, offsetSeconds };
}

// The device's own clock, used for sample weather.
export function deviceClock(now = new Date()) {
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
  return { date, hour: now.getHours() + now.getMinutes() / 60, offsetSeconds: -now.getTimezoneOffset() * 60 };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const weekday = (d) => WEEKDAYS[new Date(parseISO(d)).getUTCDay()];
export const weekdayShort = (d) => weekday(d).slice(0, 3);
export const monthName = (d) => MONTHS[monthOf(d) - 1];
export const monthDay = (d) => `${monthName(d)} ${+d.slice(8, 10)}`;
export const monthDayYear = (d) => `${monthDay(d)}, ${d.slice(0, 4)}`;

// "today", "tomorrow", "Thursday", or "Oct 14" for anything further out.
export function dayWord(d, today) {
  const n = daysBetween(today, d);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 1 && n < 7) return weekday(d);
  return monthDay(d);
}

// "on Thursday" / "tomorrow" / "today", for use inside a sentence.
export function onDay(d, today) {
  const w = dayWord(d, today);
  return w === 'today' || w === 'tomorrow' || w === 'yesterday' ? w : `on ${w}`;
}

// The night that starts on date d: "tonight", "tomorrow night", "Thursday night".
export function nightWord(d, today) {
  const n = daysBetween(today, d);
  if (n === 0) return 'tonight';
  if (n === 1) return 'tomorrow night';
  return `${weekday(d)} night`;
}

export function clockText(hour) {
  let h = Math.floor(hour);
  let m = Math.round((hour - h) * 60);
  if (m === 60) (h += 1), (m = 0);
  const ap = h >= 12 && h < 24 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
