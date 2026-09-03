// Planner logic: create, sort, filter and summarise study tasks.
import { daysBetween, todayISO } from './date.mjs';

export const PRIORITIES = ['low', 'medium', 'high'];
const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };

export function createTask({ title, subject = '', dueDate = '', priority = 'medium', notes = '' } = {}, now = new Date()) {
  const clean = String(title || '').trim();
  if (!clean) return { ok: false, errors: ['Give the task a title.'] };
  if (!PRIORITIES.includes(priority)) return { ok: false, errors: ['Priority must be low, medium or high.'] };
  if (dueDate && daysBetween(todayISO(now), dueDate) === null) {
    return { ok: false, errors: ['Due date must look like 2026-09-10.'] };
  }
  return {
    ok: true,
    task: {
      id: `t_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      title: clean,
      subject: String(subject || '').trim(),
      dueDate: dueDate || '',
      priority,
      notes: String(notes || '').trim(),
      completed: false,
      createdAt: now.toISOString()
    }
  };
}

/** Open tasks sorted by urgency: overdue first, then soonest due, then priority. */
export function sortTasks(tasks, today = todayISO()) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const da = a.dueDate ? daysBetween(today, a.dueDate) : Infinity;
    const db = b.dueDate ? daysBetween(today, b.dueDate) : Infinity;
    if (da !== db) return da - db;
    const pa = PRIORITY_WEIGHT[a.priority] ?? 1;
    const pb = PRIORITY_WEIGHT[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return String(a.title).localeCompare(String(b.title));
  });
}

export function isOverdue(task, today = todayISO()) {
  if (!task?.dueDate || task.completed) return false;
  const diff = daysBetween(today, task.dueDate);
  return diff !== null && diff < 0;
}

export function filterTasks(tasks, { status = 'all', subject = '', query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const subj = String(subject || '').trim().toLowerCase();
  return tasks.filter((task) => {
    if (status === 'open' && task.completed) return false;
    if (status === 'done' && !task.completed) return false;
    if (subj && String(task.subject || '').toLowerCase() !== subj) return false;
    if (q) {
      const haystack = `${task.title} ${task.subject} ${task.notes}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Numbers for the dashboard stat cards. */
export function taskStats(tasks, today = todayISO()) {
  const stats = { total: tasks.length, open: 0, done: 0, dueToday: 0, overdue: 0, dueSoon: 0 };
  for (const task of tasks) {
    if (task.completed) {
      stats.done += 1;
      continue;
    }
    stats.open += 1;
    if (!task.dueDate) continue;
    const diff = daysBetween(today, task.dueDate);
    if (diff === null) continue;
    if (diff < 0) stats.overdue += 1;
    else if (diff === 0) stats.dueToday += 1;
    else if (diff <= 3) stats.dueSoon += 1;
  }
  stats.progress = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  return stats;
}

/**
 * Distinct, alphabetised subject list for the filter dropdown.
 * Sorting compares lower-cased keys so "maths" and "Maths" stay adjacent,
 * then breaks the tie deterministically instead of relying on locale collation.
 */
export function subjectsOf(tasks) {
  const set = new Set();
  for (const task of tasks) {
    const subject = String(task.subject || '').trim();
    if (subject) set.add(subject);
  }
  return [...set].sort((a, b) => {
    const cmp = a.toLowerCase().localeCompare(b.toLowerCase());
    if (cmp !== 0) return cmp;
    if (a === b) return 0;
    return a < b ? -1 : 1;
  });
}
