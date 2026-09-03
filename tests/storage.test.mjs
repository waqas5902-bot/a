import test from 'node:test';
import assert from 'node:assert/strict';
import { load, save, remove, exportAll, importAll, clearAll, KEY } from '../assets/js/lib/storage.mjs';

test('save/load round-trips JSON through the fallback store', () => {
  save(KEY.tasks, [{ id: 't_1', title: 'Read' }]);
  assert.deepEqual(load(KEY.tasks, []), [{ id: 't_1', title: 'Read' }]);
});

test('load returns the fallback when nothing is stored', () => {
  remove(KEY.timetable);
  assert.deepEqual(load(KEY.timetable, []), []);
  assert.equal(load(KEY.notes, null), null);
});

test('save/load preserve plain strings and numbers', () => {
  save(KEY.theme, 'dark');
  save(KEY.profile, 42);
  assert.equal(load(KEY.theme, 'light'), 'dark');
  assert.equal(load(KEY.profile, 0), 42);
});

test('load never throws for an unknown key', () => {
  assert.doesNotThrow(() => load('studyhub.does-not-exist', null));
  assert.equal(load('studyhub.does-not-exist', 'fallback'), 'fallback');
});

test('exportAll / importAll round-trips every namespace', () => {
  clearAll();
  save(KEY.tasks, [{ id: 't_1' }]);
  save(KEY.gpa, [{ grade: 'A', credits: 3 }]);
  const snapshot = exportAll();
  assert.deepEqual(snapshot.tasks, [{ id: 't_1' }]);
  assert.deepEqual(snapshot.gpa, [{ grade: 'A', credits: 3 }]);

  clearAll();
  assert.deepEqual(load(KEY.tasks, []), []);
  assert.equal(importAll(snapshot), true);
  assert.deepEqual(load(KEY.tasks, []), [{ id: 't_1' }]);
  assert.equal(importAll(null), false);
});
