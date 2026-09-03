// Integration test: boots the real index.html + assets/js/app.js inside jsdom and
// drives the UI the way a student would (typing, submitting, clicking).
// This is what proves the view layer and the tested lib modules are wired together.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { RESOURCES } from '../assets/js/lib/resources.mjs';
import { DAYS } from '../assets/js/lib/timetable.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const dom = new JSDOM(html, { url: 'http://localhost:3000/', pretendToBeVisual: true });
const { window } = dom;

// jsdom leaves a few browser APIs unimplemented; stub the ones the app touches.
window.scrollTo = () => {};
window.confirm = () => true;
window.prompt = () => 'Amara';
window.URL.createObjectURL = () => 'blob:studyhub-mock';
window.URL.revokeObjectURL = () => {};

for (const key of ['window', 'document', 'FormData', 'FileReader', 'Blob', 'localStorage', 'navigator', 'Event', 'HTMLElement']) {
  // `navigator` is getter-only on the Node global, so go through defineProperty.
  Object.defineProperty(global, key, { value: window[key], configurable: true, writable: true });
}

await import('../assets/js/app.js'); // executes the app boot sequence

const $ = (sel) => window.document.querySelector(sel);
const $$ = (sel) => [...window.document.querySelectorAll(sel)];
const click = (el) => el.click();
const submit = (form) => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

test('boot renders every section of the shell', () => {
  assert.equal($$('.site-nav .nav-link').length, 7);
  assert.equal($$('.view').length, 7);
  assert.equal($('#stat-grid').querySelectorAll('.stat').length, 8);
  assert.equal($$('#week-grid .day-col').length, DAYS.length);
  assert.equal($$('#resource-grid .resource-card').length, RESOURCES.length);
  assert.equal($$('#grade-scale li').length, 13, 'the full A+ … F scale is listed');
  assert.match($('#dashboard-title').textContent, /Student/, 'greets the default name before it is set');
});

test('navigation switches the visible view', () => {
  click($('.nav-link[data-view="notes"]'));
  assert.equal($('.view[data-view="notes"]').hidden, false);
  assert.equal($('.view[data-view="dashboard"]').hidden, true);
  assert.equal($('.nav-link[data-view="notes"]').classList.contains('is-active'), true);
  click($('.nav-link[data-view="dashboard"]'));
  assert.equal($('.view[data-view="dashboard"]').hidden, false);
});

test('the planner rejects an empty task and says why', () => {
  submit($('#task-form'));
  assert.match($('#task-error').textContent, /title/i);
  assert.equal($$('#task-list .task').length, 0);
});

test('adding a task renders it and updates the dashboard', () => {
  $('#task-title').value = 'Finish chemistry lab report';
  $('#task-subject').value = 'Chemistry';
  $('#task-due').value = '2026-09-10';
  $('#task-priority').value = 'high';
  submit($('#task-form'));

  const cards = $$('#task-list .task');
  assert.equal(cards.length, 1);
  assert.match(cards[0].textContent, /Finish chemistry lab report/);
  assert.match(cards[0].textContent, /Chemistry/);
  assert.match(cards[0].textContent, /high priority/);
  assert.equal(cards[0].classList.contains('priority-high'), true);
  assert.equal($('#task-error').textContent, '');
  assert.match($('#task-count').textContent, /1 open/);

  // it was persisted, not just drawn
  const stored = JSON.parse(window.localStorage.getItem('studyhub.tasks'));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].title, 'Finish chemistry lab report');

  // and the dashboard picked it up
  assert.match($('#upcoming-list').textContent, /Finish chemistry lab report/);
  const statValues = $$('#stat-grid .stat-value').map((el) => el.textContent);
  assert.ok(statValues.includes('1'), `expected an open-task stat of 1, saw ${statValues.join(', ')}`);
});

test('the subject filter and datalist are populated from real tasks', () => {
  $('#task-title').value = 'Read chapter 4';
  $('#task-subject').value = 'Biology';
  $('#task-due').value = '2026-09-04';
  submit($('#task-form'));
  assert.equal($$('#task-list .task').length, 2);

  const options = $$('#subject-options option').map((el) => el.value);
  assert.deepEqual(options, ['Biology', 'Chemistry']);

  $('#task-subject-filter').value = 'Biology';
  $('#task-subject-filter').dispatchEvent(new window.Event('change', { bubbles: true }));
  const titles = $$('#task-list .task-title').map((el) => el.textContent);
  assert.deepEqual(titles, ['Read chapter 4']);

  $('#task-subject-filter').value = '';
  $('#task-subject-filter').dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal($$('#task-list .task').length, 2);
});

test('ticking a task moves it to done and updates the count', () => {
  const checkbox = $$('#task-list .task-check')[0];
  click(checkbox);
  assert.match($('#task-count').textContent, /1 done/);
  assert.match($('#task-count').textContent, /50%/);

  click($('.segmented .seg[data-status="done"]'));
  assert.equal($$('#task-list .task').length, 1);
  click($('.segmented .seg[data-status="open"]'));
  assert.equal($$('#task-list .task').length, 1);
});

test('deleting a task removes it from state and storage', () => {
  click($$('#task-list .task-remove')[0]);
  assert.equal($$('#task-list .task').length, 0);
  assert.equal(JSON.parse(window.localStorage.getItem('studyhub.tasks')).length, 1, 'the done task is still stored');
});

test('the timetable flags overlapping classes', () => {
  $('#class-day').value = 'Monday';
  $('#class-start').value = '09:00';
  $('#class-end').value = '11:00';
  $('#class-subject').value = 'Linear Algebra';
  $('#class-room').value = 'B-204';
  submit($('#class-form'));

  $('#class-day').value = 'Monday';
  $('#class-start').value = '10:00';
  $('#class-end').value = '12:00';
  $('#class-subject').value = 'Thermodynamics';
  submit($('#class-form'));

  assert.equal($$('#week-grid .class-card').length, 2);
  assert.equal($('#clash-note').hidden, false);
  assert.match($('#clash-note').textContent, /Linear Algebra overlaps Thermodynamics on Monday/);
  assert.equal($$('#week-grid .class-card.has-clash').length, 2);
  assert.match($('#weekly-load').textContent, /4 hours in class/, '2h + 2h of scheduled class');
});

test('the timetable refuses a class that ends before it starts', () => {
  $('#class-day').value = 'Tuesday';
  $('#class-start').value = '14:00';
  $('#class-end').value = '13:00';
  $('#class-subject').value = 'Impossible';
  submit($('#class-form'));
  assert.match($('#class-error').textContent, /end after it starts/);
  assert.equal($$('#week-grid .class-card').length, 2);
});

test('removing a class clears the clash warning', () => {
  click($$('#week-grid .class-remove')[0]);
  assert.equal($$('#week-grid .class-card').length, 1);
  assert.equal($('#clash-note').hidden, true);
});

test('the GPA calculator computes a credit-weighted result in the DOM', () => {
  click($('#gpa-add-row'));
  click($('#gpa-add-row'));

  const rows = $$('#gpa-rows tr');
  assert.equal(rows.length, 2);

  const setField = (row, field, value) => {
    const input = row.querySelector(`[data-field="${field}"]`);
    input.value = value;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  };

  setField(rows[0], 'course', 'Calculus I');
  setField(rows[0], 'credits', '4');
  setField(rows[0], 'grade', 'A');
  setField(rows[1], 'course', 'World History');
  setField(rows[1], 'credits', '2');
  setField(rows[1], 'grade', 'B');

  // (4*4 + 3*2) / 6 = 22/6 = 3.67
  assert.equal($('.gpa-big').textContent, '3.67');
  assert.match($('#gpa-result').textContent, /Very good/);
  assert.match($('#gpa-result').textContent, /91\.7%/);
  assert.match($('#goal-output').textContent, /grade points/);
  assert.equal(JSON.parse(window.localStorage.getItem('studyhub.gpa')).length, 2);
});

test('notes can be saved, pinned, edited and deleted', () => {
  $('#note-title').value = 'Photosynthesis summary';
  $('#note-subject').value = 'Biology';
  $('#note-body').value = 'Light reactions happen in the thylakoid membrane.';
  submit($('#note-form'));

  assert.equal($$('#note-grid .note-card').length, 1);
  assert.match($('#note-grid').textContent, /Photosynthesis summary/);
  assert.match($('#note-count').textContent, /1 note saved/);

  const card = $('#note-grid .note-card');
  click(card.querySelector('[data-action="pin"]'));
  assert.equal($('#note-grid .note-card').classList.contains('is-pinned'), true);

  click($('#note-grid [data-action="edit"]'));
  assert.equal($('#note-body').value, 'Light reactions happen in the thylakoid membrane.');
  $('#note-body').value = 'Updated: light + dark reactions.';
  submit($('#note-form'));
  assert.equal($$('#note-grid .note-card').length, 1, 'editing must not create a second note');
  assert.match($('#note-grid').textContent, /Updated: light \+ dark reactions/);

  $('#note-search').value = 'zzz-no-match';
  $('#note-search').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal($('#note-empty').hidden, false);
  $('#note-search').value = 'photosynthesis';
  $('#note-search').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal($$('#note-grid .note-card').length, 1);

  click($('#note-grid [data-action="remove"]'));
  assert.equal($$('#note-grid .note-card').length, 0);
});

test('the focus timer starts, pauses and resets', () => {
  assert.equal($('#focus-clock').textContent, '25:00');
  click($('#focus-start'));
  assert.equal($('#focus-start').textContent, 'Pause');
  click($('#focus-start'));
  assert.equal($('#focus-start').textContent, 'Start');

  $('#set-focus').value = '45';
  $('#set-focus').dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal($('#focus-clock').textContent, '45:00');
  assert.match($('#focus-summary').textContent, /No focus sessions logged yet/);

  click($('#focus-skip'));
  assert.equal($('#phase-chip').textContent, 'Short break');
  click($('#focus-reset'));
  assert.equal($('#phase-chip').textContent, 'Focus');
  assert.equal($('#focus-clock').textContent, '45:00');
});

test('resources can be filtered by category and by text', () => {
  click($('#resource-chips [data-category="coding"]'));
  const coding = $$('#resource-grid .resource-card');
  assert.ok(coding.length > 0 && coding.length < RESOURCES.length);
  assert.ok(coding.every((card) => /freeCodeCamp|Odin|MDN|CS50|GitHub/i.test(card.textContent)));

  $('#resource-search').value = 'flashcards';
  $('#resource-search').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal($$('#resource-grid .resource-card').length, 0, 'no coding resource mentions flashcards');

  click($('#resource-chips [data-category="all"]'));
  assert.equal($$('#resource-grid .resource-card').length, 2);

  $('#resource-search').value = '';
  $('#resource-search').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal($$('#resource-grid .resource-card').length, RESOURCES.length);
});

test('renaming greets the student by name and the theme toggles', () => {
  click($('#rename-btn'));
  assert.match($('#dashboard-title').textContent, /Amara/);
  assert.match($('#student-name').textContent, /Amara/);
  assert.equal(JSON.parse(window.localStorage.getItem('studyhub.profile')).name, 'Amara');

  const before = window.document.documentElement.dataset.theme;
  click($('#theme-toggle'));
  assert.notEqual(window.document.documentElement.dataset.theme, before);
  assert.equal(window.localStorage.getItem('studyhub.theme'), `"${window.document.documentElement.dataset.theme}"`);
});

test('resetting clears the data the app is holding', () => {
  click($('#reset-all'));
  assert.equal($$('#task-list .task').length, 0);
  assert.equal($$('#week-grid .class-card').length, 0);
  assert.equal($$('#note-grid .note-card').length, 0);
  assert.equal($$('#gpa-rows tr').length, 0);
  assert.equal($('.gpa-big').textContent, '—');
  assert.equal(window.localStorage.getItem('studyhub.tasks'), null, 'the key is removed, not left as an empty array');
  assert.equal(window.localStorage.getItem('studyhub.timetable'), null);
  assert.equal(window.localStorage.getItem('studyhub.gpa'), null);
});
