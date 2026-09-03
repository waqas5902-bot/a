import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toISODate, daysBetween, formatDate, dueLabel, addDays, timeToMinutes, formatClock12
} from '../assets/js/lib/date.mjs';

const TODAY = '2026-09-03'; // a Thursday

test('toISODate uses the local calendar day', () => {
  assert.equal(toISODate(new Date(2026, 8, 3, 0, 0, 0)), '2026-09-03');
  assert.equal(toISODate(new Date(2026, 8, 3, 23, 59, 59)), '2026-09-03');
  assert.equal(toISODate(new Date(2026, 0, 5)), '2026-01-05');
});

test('daysBetween counts whole days in either direction', () => {
  assert.equal(daysBetween(TODAY, '2026-09-03'), 0);
  assert.equal(daysBetween(TODAY, '2026-09-05'), 2);
  assert.equal(daysBetween(TODAY, '2026-09-01'), -2);
  assert.equal(daysBetween(TODAY, 'not-a-date'), null);
});

test('formatDate renders a readable day', () => {
  assert.equal(formatDate(TODAY), 'Thu, 3 Sep 2026');
  assert.equal(formatDate('2026-12-25'), 'Fri, 25 Dec 2026');
  assert.equal(formatDate(''), '—');
});

test('dueLabel covers overdue, today, tomorrow and soon', () => {
  assert.equal(dueLabel('2026-09-01', TODAY), 'Overdue by 2 days');
  assert.equal(dueLabel('2026-09-03', TODAY), 'Due today');
  assert.equal(dueLabel('2026-09-04', TODAY), 'Due tomorrow');
  assert.equal(dueLabel('2026-09-07', TODAY), 'Due in 4 days');
  assert.equal(dueLabel('2026-09-12', TODAY), 'Due next week');
  assert.equal(dueLabel('2026-12-25', TODAY), 'Fri, 25 Dec 2026');
  assert.equal(dueLabel('', TODAY), 'No date');
});

test('addDays rolls across month boundaries', () => {
  assert.equal(addDays('2026-09-30', 3), '2026-10-03');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('nonsense', 1), null);
});

test('timeToMinutes and formatClock12 agree', () => {
  assert.equal(timeToMinutes('09:00'), 540);
  assert.equal(timeToMinutes('14:05'), 845);
  assert.equal(timeToMinutes('25:00'), null);
  assert.equal(timeToMinutes('9am'), null);
  assert.equal(formatClock12('09:00'), '9:00 AM');
  assert.equal(formatClock12('14:05'), '2:05 PM');
  assert.equal(formatClock12('00:30'), '12:30 AM');
  assert.equal(formatClock12('12:00'), '12:00 PM');
});
