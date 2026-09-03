// Small date helpers. Every function takes/returns ISO `YYYY-MM-DD` strings so the
// same code can run in the browser and under `node --test`.

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/** `2026-09-03T21:40:00.000Z` -> `2026-09-03` (local date, not UTC). */
export function toISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(now = new Date()) {
  return toISODate(now);
}

/** Whole-day difference between two ISO dates (b - a). Positive means b is later. */
export function daysBetween(aISO, bISO) {
  const a = Date.parse(`${aISO}T00:00:00`);
  const b = Date.parse(`${bISO}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/** `2026-09-03` -> `Thu, 3 Sep 2026` */
export function formatDate(iso) {
  const parts = String(iso || '').split('-');
  if (parts.length !== 3) return '—';
  const [y, m, d] = parts;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return '—';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  return `${weekday}, ${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Human "due" label relative to today: Overdue · Today · Tomorrow · In 5 days */
export function dueLabel(iso, today = todayISO()) {
  if (!iso) return 'No date';
  const diff = daysBetween(today, iso);
  if (diff === null) return '—';
  if (diff < 0) return `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff < 7) return `Due in ${diff} days`;
  if (diff < 14) return 'Due next week';
  return formatDate(iso);
}

/** Add whole days to an ISO date. */
export function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** `14:05` -> `845` minutes since midnight (handy for sorting a timetable). */
export function timeToMinutes(hhmm) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** `845` -> `2:05 PM` */
export function formatClock12(hhmm) {
  const minutes = timeToMinutes(hhmm);
  if (minutes === null) return String(hhmm || '—');
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}
