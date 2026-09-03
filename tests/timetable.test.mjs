import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntry, entriesForDay, findClashes, weeklyLoad, DAYS } from '../assets/js/lib/timetable.mjs';

test('DAYS runs Monday to Sunday', () => {
  assert.deepEqual(DAYS, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
});

test('createEntry validates and pads times', () => {
  const result = createEntry({ day: 'Monday', start: '9:00', end: '10:30', subject: ' Organic Chemistry ' });
  assert.equal(result.ok, true);
  assert.equal(result.entry.start, '09:00');
  assert.equal(result.entry.end, '10:30');
  assert.equal(result.entry.subject, 'Organic Chemistry');
});

test('createEntry collects every validation error', () => {
  const result = createEntry({ day: 'Funday', start: 'noon', end: '09:00', subject: '' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('day of the week')));
  assert.ok(result.errors.some((e) => e.includes('subject name')));
  assert.ok(result.errors.some((e) => e.includes('Start time')));
});

test('createEntry rejects a class that ends before it starts', () => {
  const result = createEntry({ day: 'Tuesday', start: '11:00', end: '10:00', subject: 'Physics' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('end after it starts')));
});

test('entriesForDay filters and orders by start time', () => {
  const entries = [
    createEntry({ day: 'Monday', start: '14:00', end: '15:00', subject: 'Late' }).entry,
    createEntry({ day: 'Monday', start: '09:00', end: '10:00', subject: 'Early' }).entry,
    createEntry({ day: 'Tuesday', start: '08:00', end: '09:00', subject: 'Other day' }).entry
  ];
  assert.deepEqual(entriesForDay(entries, 'Monday').map((e) => e.subject), ['Early', 'Late']);
  assert.deepEqual(entriesForDay(entries, 'Wednesday'), []);
});

test('findClashes reports only genuine overlaps', () => {
  const clash = [
    createEntry({ day: 'Monday', start: '09:00', end: '11:00', subject: 'Maths' }).entry,
    createEntry({ day: 'Monday', start: '10:00', end: '12:00', subject: 'Physics' }).entry
  ];
  const touching = [
    createEntry({ day: 'Monday', start: '09:00', end: '10:00', subject: 'Maths' }).entry,
    createEntry({ day: 'Monday', start: '10:00', end: '11:00', subject: 'Physics' }).entry
  ];
  const differentDays = [
    createEntry({ day: 'Monday', start: '09:00', end: '11:00', subject: 'Maths' }).entry,
    createEntry({ day: 'Friday', start: '10:00', end: '12:00', subject: 'Physics' }).entry
  ];
  assert.equal(findClashes(clash).length, 1);
  assert.deepEqual(findClashes(clash)[0].map((e) => e.subject), ['Maths', 'Physics']);
  assert.equal(findClashes(touching).length, 0);
  assert.equal(findClashes(differentDays).length, 0);
});

test('weeklyLoad totals scheduled hours', () => {
  const entries = [
    createEntry({ day: 'Monday', start: '09:00', end: '10:30', subject: 'A' }).entry,
    createEntry({ day: 'Wednesday', start: '13:00', end: '15:00', subject: 'B' }).entry
  ];
  const load = weeklyLoad(entries);
  assert.equal(load.minutes, 210);
  assert.equal(load.hours, 3.5);
  assert.deepEqual(weeklyLoad([]), { minutes: 0, hours: 0 });
});
