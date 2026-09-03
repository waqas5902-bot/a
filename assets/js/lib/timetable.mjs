// Weekly timetable helpers.
import { timeToMinutes } from './date.mjs';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function createEntry({ day, start, end, subject, room = '', teacher = '' } = {}, now = new Date()) {
  const errors = [];
  if (!DAYS.includes(day)) errors.push('Pick a day of the week.');
  const subjectText = String(subject || '').trim();
  if (!subjectText) errors.push('Add a subject name.');
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null) errors.push('Start time must look like 09:00.');
  if (endMinutes === null) errors.push('End time must look like 10:30.');
  if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
    errors.push('The class must end after it starts.');
  }
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    entry: {
      id: `c_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      day,
      start: padTime(startMinutes),
      end: padTime(endMinutes),
      subject: subjectText,
      room: String(room || '').trim(),
      teacher: String(teacher || '').trim()
    }
  };
}

function padTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function entriesForDay(entries, day) {
  return (entries || [])
    .filter((entry) => entry.day === day)
    .sort((a, b) => (timeToMinutes(a.start) ?? 0) - (timeToMinutes(b.start) ?? 0));
}

/** Overlapping classes for the same day, returned as [a, b] pairs. */
export function findClashes(entries) {
  const clashes = [];
  for (const day of DAYS) {
    const dayEntries = entriesForDay(entries, day);
    for (let i = 0; i < dayEntries.length; i += 1) {
      for (let j = i + 1; j < dayEntries.length; j += 1) {
        const a = dayEntries[i];
        const b = dayEntries[j];
        const aStart = timeToMinutes(a.start);
        const aEnd = timeToMinutes(a.end);
        const bStart = timeToMinutes(b.start);
        const bEnd = timeToMinutes(b.end);
        if (aStart < bEnd && bStart < aEnd) clashes.push([a, b]);
      }
    }
  }
  return clashes;
}

/** Total scheduled minutes per week, e.g. `{minutes: 1350, hours: '22.5'}`. */
export function weeklyLoad(entries) {
  const minutes = (entries || []).reduce((total, entry) => {
    const start = timeToMinutes(entry.start);
    const end = timeToMinutes(entry.end);
    if (start === null || end === null || end <= start) return total;
    return total + (end - start);
  }, 0);
  return { minutes, hours: Math.round((minutes / 60) * 10) / 10 };
}
