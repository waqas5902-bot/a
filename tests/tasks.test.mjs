import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTask, sortTasks, isOverdue, filterTasks, taskStats, subjectsOf
} from '../assets/js/lib/tasks.mjs';

const TODAY = '2026-09-03';

function task(overrides = {}) {
  const { completed = false, ...fields } = overrides;
  const result = createTask({ title: 'Untitled', ...fields });
  assert.equal(result.ok, true, result.errors?.join('; '));
  result.task.completed = completed;
  return result.task;
}

test('createTask trims input and defaults sensibly', () => {
  const result = createTask({ title: '  Finish lab report  ', subject: ' Chemistry ' });
  assert.equal(result.ok, true);
  assert.equal(result.task.title, 'Finish lab report');
  assert.equal(result.task.subject, 'Chemistry');
  assert.equal(result.task.priority, 'medium');
  assert.equal(result.task.completed, false);
  assert.match(result.task.id, /^t_/);
});

test('createTask always starts a task incomplete, even if asked otherwise', () => {
  assert.equal(createTask({ title: 'ok', completed: true }).task.completed, false);
});

test('createTask rejects blank titles, bad priorities and malformed dates', () => {
  assert.equal(createTask({ title: '   ' }).ok, false);
  assert.equal(createTask({ title: 'ok', priority: 'urgent' }).ok, false);
  assert.equal(createTask({ title: 'ok', dueDate: '09/10/2026' }).ok, false);
  assert.equal(createTask({ title: 'ok', dueDate: '2026-09-10' }).ok, true);
});

test('sortTasks puts open overdue work first, completed last', () => {
  const tasks = [
    task({ title: 'No date', priority: 'high' }),
    task({ title: 'Late essay', dueDate: '2026-08-20' }),
    task({ title: 'Due in a week', dueDate: '2026-09-10' }),
    task({ title: 'Due today', dueDate: TODAY }),
    task({ title: 'Already done', dueDate: '2026-08-01', completed: true })
  ];
  const titles = sortTasks(tasks, TODAY).map((t) => t.title);
  assert.deepEqual(titles, ['Late essay', 'Due today', 'Due in a week', 'No date', 'Already done']);
});

test('sortTasks breaks due-date ties by priority', () => {
  const tasks = [
    task({ title: 'low', dueDate: TODAY, priority: 'low' }),
    task({ title: 'high', dueDate: TODAY, priority: 'high' }),
    task({ title: 'medium', dueDate: TODAY, priority: 'medium' })
  ];
  assert.deepEqual(sortTasks(tasks, TODAY).map((t) => t.title), ['high', 'medium', 'low']);
});

test('isOverdue only flags open tasks in the past', () => {
  assert.equal(isOverdue(task({ dueDate: '2026-09-02' }), TODAY), true);
  assert.equal(isOverdue(task({ dueDate: TODAY }), TODAY), false);
  assert.equal(isOverdue(task({ dueDate: '2026-09-02', completed: true }), TODAY), false);
  assert.equal(isOverdue(task({}), TODAY), false);
});

test('filterTasks combines status, subject and text search', () => {
  const tasks = [
    task({ title: 'Read chapter 4', subject: 'Biology', notes: 'mitosis' }),
    task({ title: 'Problem set 3', subject: 'Maths' }),
    task({ title: 'Draft intro', subject: 'Biology', completed: true })
  ];
  assert.equal(filterTasks(tasks, { status: 'open' }).length, 2);
  assert.equal(filterTasks(tasks, { status: 'done' }).length, 1);
  assert.equal(filterTasks(tasks, { subject: 'biology' }).length, 2);
  assert.equal(filterTasks(tasks, { query: 'mitosis' }).length, 1);
  assert.equal(filterTasks(tasks, { subject: 'Biology', status: 'open', query: 'read' }).length, 1);
  assert.equal(filterTasks(tasks, { query: 'nothing matches' }).length, 0);
});

test('taskStats counts overdue, today and soon separately', () => {
  const tasks = [
    task({ dueDate: '2026-08-30' }),
    task({ dueDate: TODAY }),
    task({ dueDate: '2026-09-05' }),
    task({ dueDate: '2026-10-01' }),
    task({}),
    task({ dueDate: '2026-08-01', completed: true })
  ];
  const stats = taskStats(tasks, TODAY);
  assert.equal(stats.total, 6);
  assert.equal(stats.done, 1);
  assert.equal(stats.open, 5);
  assert.equal(stats.overdue, 1);
  assert.equal(stats.dueToday, 1);
  assert.equal(stats.dueSoon, 1);
  assert.equal(stats.progress, 17);
});

test('taskStats on an empty list reports 0% progress, not NaN', () => {
  const stats = taskStats([], TODAY);
  assert.equal(stats.total, 0);
  assert.equal(stats.progress, 0);
});

test('subjectsOf returns a unique, sorted list', () => {
  const tasks = [
    task({ subject: 'Maths' }),
    task({ subject: 'Biology' }),
    task({ subject: 'maths' }),
    task({ subject: '' })
  ];
  assert.deepEqual(subjectsOf(tasks), ['Biology', 'Maths', 'maths']);
});
