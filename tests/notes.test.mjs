import test from 'node:test';
import assert from 'node:assert/strict';
import { createNote, searchNotes, sortNotes, relativeTime } from '../assets/js/lib/notes.mjs';
import { filterResources, RESOURCES, RESOURCE_CATEGORIES } from '../assets/js/lib/resources.mjs';

test('createNote trims and derives a title from the first line', () => {
  const result = createNote({ body: '  Mitosis has four phases\nThen cytokinesis  ' });
  assert.equal(result.ok, true);
  assert.equal(result.note.title, 'Mitosis has four phases');
  assert.equal(result.note.body.startsWith('Mitosis has four phases'), true);
  assert.equal(result.note.pinned, false);
});

test('createNote refuses a completely empty note', () => {
  assert.equal(createNote({ title: '   ', body: '  ' }).ok, false);
  assert.equal(createNote({}).ok, false);
});

test('searchNotes matches title, body and subject, case-insensitively', () => {
  const notes = [
    createNote({ title: 'Essay plan', body: 'intro, body, conclusion', subject: 'History' }).note,
    createNote({ title: 'Formulas', body: 'E=mc2 and friends', subject: 'Physics' }).note
  ];
  assert.equal(searchNotes(notes, '').length, 2);
  assert.equal(searchNotes(notes, 'essay').length, 1);
  assert.equal(searchNotes(notes, 'PHYSICS').length, 1);
  assert.equal(searchNotes(notes, 'E=mc2').length, 1);
  assert.equal(searchNotes(notes, 'zzz').length, 0);
});

test('sortNotes keeps pinned notes on top and newest first', () => {
  const old = createNote({ title: 'Old' }, new Date('2026-01-01T10:00:00Z')).note;
  const mid = createNote({ title: 'Mid' }, new Date('2026-02-01T10:00:00Z')).note;
  const pinned = createNote({ title: 'Pinned' }, new Date('2025-12-01T10:00:00Z')).note;
  pinned.pinned = true;
  assert.deepEqual(sortNotes([old, pinned, mid]).map((n) => n.title), ['Pinned', 'Mid', 'Old']);
});

test('relativeTime degrades from minutes to days to a date', () => {
  const now = new Date('2026-09-03T12:00:00Z');
  assert.equal(relativeTime('2026-09-03T11:59:30Z', now), 'just now');
  assert.equal(relativeTime('2026-09-03T11:30:00Z', now), '30 min ago');
  assert.equal(relativeTime('2026-09-03T07:00:00Z', now), '5 h ago');
  assert.equal(relativeTime('2026-09-01T12:00:00Z', now), '2 d ago');
  assert.equal(relativeTime('2026-08-01T12:00:00Z', now), 'Sat, 1 Aug 2026');
  assert.equal(relativeTime('garbage', now), '—');
});

test('every resource belongs to a known category and has a real-looking URL', () => {
  const ids = new Set(RESOURCE_CATEGORIES.map((c) => c.id));
  for (const resource of RESOURCES) {
    assert.ok(ids.has(resource.category), `${resource.title} has unknown category ${resource.category}`);
    assert.match(resource.url, /^https:\/\/.+\..+/);
    assert.ok(resource.blurb.length > 20, `${resource.title} needs a proper description`);
  }
  assert.ok(RESOURCES.length >= 20);
});

test('filterResources narrows by category and free text', () => {
  assert.equal(filterResources({}).length, RESOURCES.length);
  const coding = filterResources({ category: 'coding' });
  assert.ok(coding.length > 0);
  assert.ok(coding.every((r) => r.category === 'coding'));
  assert.ok(filterResources({ query: 'flashcards' }).length >= 2);
  assert.equal(filterResources({ category: 'coding', query: 'citation' }).length, 0);
});
