// StudyHub — view layer. All the rules live in ./lib/*.mjs (and are unit tested);
// this file is only about reading state, drawing it, and handling input.

import { KEY, load, save, exportAll, importAll, clearAll } from './lib/storage.mjs';
import { calculateGpa, GRADE_SCALE, classificationFor, creditsToReachGpa } from './lib/gpa.mjs';
import { createTask, sortTasks, filterTasks, taskStats, subjectsOf, isOverdue } from './lib/tasks.mjs';
import { DAYS, createEntry, entriesForDay, findClashes, weeklyLoad } from './lib/timetable.mjs';
import { createNote, searchNotes, sortNotes, relativeTime } from './lib/notes.mjs';
import { RESOURCES, RESOURCE_CATEGORIES, filterResources } from './lib/resources.mjs';
import {
  createTimer, tick, skipPhase, clockLabel, progressPercent,
  summarizeSessions, PHASE_FOCUS, PHASE_LABELS
} from './lib/pomodoro.mjs';
import { todayISO, formatDate, dueLabel, formatClock12 } from './lib/date.mjs';

/* ── tiny DOM helpers ─────────────────────────────────────────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(message, tone = '') {
  const root = $('#toast-root');
  const node = document.createElement('div');
  node.className = `toast${tone ? ` is-${tone}` : ''}`;
  node.textContent = message;
  root.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function chime(kind = 'done') {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = kind === 'break' ? 520 : 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.52);
    setTimeout(() => ctx.close(), 700);
  } catch {
    /* audio is a nicety, never a failure */
  }
}

/* ── state ────────────────────────────────────────────────────────── */
const today = () => todayISO();

const state = {
  view: 'dashboard',
  name: '',
  tasks: [],
  entries: [],
  notes: [],
  sessions: [],
  gpaRows: [],
  filters: { status: 'open', subject: '', query: '' },
  noteQuery: '',
  editingNoteId: null,
  resourceCategory: 'all',
  resourceQuery: '',
  timer: createTimer(),
  intervalId: null
};

function hydrate() {
  const profile = load(KEY.profile, {});
  state.name = profile?.name || '';
  state.tasks = load(KEY.tasks, []) || [];
  state.entries = load(KEY.timetable, []) || [];
  state.notes = load(KEY.notes, []) || [];
  state.sessions = load(KEY.focus, []) || [];
  state.gpaRows = load(KEY.gpa, []) || [];
  const theme = load(KEY.theme, null);
  applyTheme(theme || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  state.timer = createTimer(timerConfig());
}

function persist(key, value) { save(key, value); }

function timerConfig() {
  return {
    focusMinutes: Number($('#set-focus')?.value) || 25,
    shortMinutes: Number($('#set-short')?.value) || 5,
    longMinutes: Number($('#set-long')?.value) || 15,
    roundsBeforeLong: Number($('#set-rounds')?.value) || 4
  };
}

/* ── theming ──────────────────────────────────────────────────────── */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  persist(KEY.theme, theme);
  const btn = $('#theme-toggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  }
}

/* ── navigation ───────────────────────────────────────────────────── */
function setView(view) {
  state.view = view;
  $$('.view').forEach((section) => {
    const active = section.dataset.view === view;
    section.classList.toggle('is-active', active);
    section.hidden = !active;
  });
  $$('.nav-link').forEach((link) => {
    link.classList.toggle('is-active', link.dataset.view === view);
    if (link.dataset.view === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── dashboard ────────────────────────────────────────────────────── */
function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function statCard({ value, label, view, tone = '' }) {
  return `<button class="stat ${tone}" type="button" data-view="${view}">
      <span class="stat-value">${escapeHtml(value)}</span>
      <span class="stat-label">${escapeHtml(label)}</span>
    </button>`;
}

function renderDashboard() {
  const now = new Date();
  $('#today-label').textContent = formatDate(today(now));
  const name = state.name.trim() || 'Student';
  $('#student-name').textContent = name;
  $('#dashboard-title').firstChild.textContent = `${greeting()}, `;

  const stats = taskStats(state.tasks, today(now));
  const focus = summarizeSessions(state.sessions, today(now));
  const gpa = calculateGpa(state.gpaRows);
  const load = weeklyLoad(state.entries);
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const classesToday = entriesForDay(state.entries, dayName).length;

  $('#stat-grid').innerHTML = [
    statCard({ value: stats.open, label: 'Open tasks', view: 'planner', tone: 'tone-accent' }),
    statCard({ value: stats.dueToday, label: 'Due today', view: 'planner', tone: stats.dueToday ? 'tone-warn' : '' }),
    statCard({ value: stats.overdue, label: 'Overdue', view: 'planner', tone: stats.overdue ? 'tone-bad' : 'tone-good' }),
    statCard({ value: `${focus.todayMinutes}m`, label: 'Focused today', view: 'focus', tone: 'tone-good' }),
    statCard({ value: classesToday, label: `Classes ${dayName}`, view: 'timetable' }),
    statCard({ value: gpa.gpa === null ? '—' : gpa.gpa.toFixed(2), label: 'Current GPA', view: 'gpa' }),
    statCard({ value: `${load.hours}h`, label: 'Class hours / week', view: 'timetable' }),
    statCard({ value: state.notes.length, label: 'Notes saved', view: 'notes' })
  ].join('');

  const upcoming = sortTasks(state.tasks, today(now)).filter((task) => !task.completed).slice(0, 5);
  $('#upcoming-list').innerHTML = upcoming.length
    ? upcoming.map((task) => `
      <li class="mini-item">
        <div class="mini-main">
          <div class="mini-title">${escapeHtml(task.title)}</div>
          <div class="mini-meta">${escapeHtml(task.subject || 'No subject')}</div>
        </div>
        ${duePill(task, today(now))}
      </li>`).join('')
    : '<li class="mini-empty">Nothing due. Enjoy it, or get ahead on next week.</li>';

  const classes = entriesForDay(state.entries, dayName);
  $('#today-classes').innerHTML = classes.length
    ? classes.map((entry) => `
      <li class="mini-item">
        <div class="mini-main">
          <div class="mini-title">${escapeHtml(entry.subject)}</div>
          <div class="mini-meta">${formatClock12(entry.start)} – ${formatClock12(entry.end)}${entry.room ? ` · ${escapeHtml(entry.room)}` : ''}</div>
        </div>
      </li>`).join('')
    : '<li class="mini-empty">No classes scheduled for today.</li>';
}

function duePill(task, todayStr) {
  if (!task.dueDate) return '<span class="pill">No date</span>';
  const overdue = isOverdue(task, todayStr);
  const diff = dueLabel(task.dueDate, todayStr);
  const tone = overdue ? 'tone-bad' : diff === 'Due today' ? 'tone-warn' : 'tone-accent';
  return `<span class="pill ${tone}">${escapeHtml(diff)}</span>`;
}

/* ── planner ──────────────────────────────────────────────────────── */
function renderSubjectOptions() {
  const subjects = subjectsOf(state.tasks);
  $('#subject-options').innerHTML = subjects
    .map((subject) => `<option value="${escapeHtml(subject)}"></option>`).join('');

  const filter = $('#task-subject-filter');
  const current = state.filters.subject;
  filter.innerHTML = `<option value="">All subjects</option>${subjects
    .map((subject) => `<option value="${escapeHtml(subject)}"${subject === current ? ' selected' : ''}>${escapeHtml(subject)}</option>`)
    .join('')}`;
}

function renderTasks() {
  renderSubjectOptions();
  // If the subject we were filtering by has been deleted, drop the filter
  // instead of leaving the list silently empty.
  if (state.filters.subject && !subjectsOf(state.tasks).includes(state.filters.subject)) {
    state.filters.subject = '';
    $('#task-subject-filter').value = '';
  }
  const visible = sortTasks(filterTasks(state.tasks, state.filters), today());
  const list = $('#task-list');
  list.innerHTML = visible.map((task) => `
    <li class="task priority-${escapeHtml(task.priority)}${task.completed ? ' is-done' : ''}" data-id="${escapeHtml(task.id)}">
      <input class="task-check" type="checkbox" data-action="toggle" ${task.completed ? 'checked' : ''}
             aria-label="Mark “${escapeHtml(task.title)}” as ${task.completed ? 'not done' : 'done'}" />
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ''}
        <div class="task-meta">
          ${task.subject ? `<span class="pill tone-accent">${escapeHtml(task.subject)}</span>` : ''}
          ${duePill(task, today())}
          <span class="pill">${escapeHtml(task.priority)} priority</span>
        </div>
      </div>
      <button class="task-remove" type="button" data-action="remove" aria-label="Delete ${escapeHtml(task.title)}">✕</button>
    </li>`).join('');

  $('#task-empty').hidden = visible.length > 0;
  const stats = taskStats(state.tasks, today());
  $('#task-count').textContent = stats.total
    ? `${stats.open} open · ${stats.done} done · ${stats.progress}% complete`
    : 'No tasks yet';
}

function onTaskSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const result = createTask(data);
  if (!result.ok) {
    $('#task-error').textContent = result.errors.join(' ');
    return;
  }
  $('#task-error').textContent = '';
  state.tasks.push(result.task);
  persist(KEY.tasks, state.tasks);
  form.reset();
  form.elements.priority.value = 'medium';
  $('#task-title').focus();
  renderTasks();
  renderDashboard();
  toast(`Added “${result.task.title}”`, 'good');
}

/* ── timetable ────────────────────────────────────────────────────── */
function renderDaySelect() {
  $('#class-day').innerHTML = DAYS
    .map((day) => `<option value="${day}">${day}</option>`).join('');
}

function renderTimetable() {
  const now = new Date();
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const clashIds = new Set(findClashes(state.entries).flat().map((entry) => entry.id));

  $('#week-grid').innerHTML = DAYS.map((day) => {
    const classes = entriesForDay(state.entries, day);
    return `<section class="day-col${day === dayName ? ' is-today' : ''}" aria-label="${day}">
      <div class="day-head">
        <h3>${day}${day === dayName ? ' · today' : ''}</h3>
        <span class="day-count">${classes.length ? `${classes.length} class${classes.length === 1 ? '' : 'es'}` : '—'}</span>
      </div>
      ${classes.length
        ? classes.map((entry) => `
          <article class="class-card${clashIds.has(entry.id) ? ' has-clash' : ''}" data-id="${escapeHtml(entry.id)}">
            <button class="class-remove" type="button" data-action="remove-class" aria-label="Remove ${escapeHtml(entry.subject)}">✕</button>
            <div class="class-time">${formatClock12(entry.start)} – ${formatClock12(entry.end)}</div>
            <div class="class-subject">${escapeHtml(entry.subject)}</div>
            ${entry.room || entry.teacher
              ? `<div class="class-extra">${escapeHtml([entry.room, entry.teacher].filter(Boolean).join(' · '))}</div>`
              : ''}
          </article>`).join('')
        : '<p class="day-empty">Free day</p>'}
    </section>`;
  }).join('');

  const load = weeklyLoad(state.entries);
  $('#weekly-load').textContent = state.entries.length
    ? `${state.entries.length} class${state.entries.length === 1 ? '' : 'es'} a week · ${load.hours} hours in class`
    : 'Add your first class above to build the week.';

  const clashes = findClashes(state.entries);
  const clashNote = $('#clash-note');
  if (clashes.length) {
    clashNote.hidden = false;
    clashNote.textContent = `⚠ ${clashes.length} clash${clashes.length === 1 ? '' : 'es'}: ${clashes
      .map(([a, b]) => `${a.subject} overlaps ${b.subject} on ${a.day}`)
      .join('; ')}.`;
  } else {
    clashNote.hidden = true;
  }
}

function onClassSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const result = createEntry(data);
  if (!result.ok) {
    $('#class-error').textContent = result.errors.join(' ');
    return;
  }
  $('#class-error').textContent = '';
  state.entries.push(result.entry);
  persist(KEY.timetable, state.entries);
  form.reset();
  form.elements.start.value = '09:00';
  form.elements.end.value = '10:00';
  renderTimetable();
  renderDashboard();
  toast(`${result.entry.subject} added to ${result.entry.day}`, 'good');
}

/* ── focus ────────────────────────────────────────────────────────── */
function renderFocus() {
  const { timer } = state;
  $('#phase-chip').textContent = PHASE_LABELS[timer.phase];
  $('#focus-clock').textContent = clockLabel(timer.remaining);
  $('#focus-round').textContent = timer.phase === PHASE_FOCUS
    ? `Round ${timer.completedFocusSessions + 1}`
    : 'Back to work after this';
  $('#focus-start').textContent = timer.running ? 'Pause' : 'Start';

  const ring = $('#focus-ring');
  ring.classList.toggle('is-break', timer.phase !== PHASE_FOCUS);
  const circumference = 2 * Math.PI * 88;
  const progress = $('#ring-progress');
  progress.style.strokeDasharray = `${circumference}`;
  progress.style.strokeDashoffset = `${circumference * (1 - progressPercent(timer) / 100)}`;
  document.title = timer.running
    ? `${clockLabel(timer.remaining)} · ${PHASE_LABELS[timer.phase]} — StudyHub`
    : 'StudyHub — planner, timetable, focus timer and notes for students';

  const summary = summarizeSessions(state.sessions, today());
  const hours = Math.floor(summary.todayMinutes / 60);
  const minutes = summary.todayMinutes % 60;
  $('#focus-summary').textContent = summary.todayMinutes
    ? `${hours ? `${hours}h ` : ''}${minutes}m focused today across ${summary.sessionCount} session${summary.sessionCount === 1 ? '' : 's'} in total.`
    : 'No focus sessions logged yet — press Start and go for 25 minutes.';

  const recent = [...state.sessions].slice(-8).reverse();
  $('#session-list').innerHTML = recent.length
    ? recent.map((session) => `
      <li class="mini-item">
        <div class="mini-main">
          <div class="mini-title">${session.minutes} min focus</div>
          <div class="mini-meta">${escapeHtml(session.date)} · ${new Date(session.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </li>`).join('')
    : '<li class="mini-empty">Your sessions will show up here.</li>';
}

function startTimer() {
  state.timer = { ...state.timer, running: true };
  state.intervalId = setInterval(() => {
    const before = state.timer;
    const after = tick(before);
    state.timer = after;
    if (after.phase !== before.phase) {
      if (before.phase === PHASE_FOCUS) {
        logSession(before.config.focusMinutes);
        chime('break');
        toast(`Focus block done — take a ${PHASE_LABELS[after.phase].toLowerCase()}.`, 'good');
      } else {
        chime('done');
        toast('Break over — back to focus.');
      }
    }
    renderFocus();
  }, 1000);
  renderFocus();
}

function pauseTimer() {
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.timer = { ...state.timer, running: false };
  renderFocus();
}

function logSession(minutes) {
  state.sessions.push({ date: today(), minutes, at: new Date().toISOString() });
  persist(KEY.focus, state.sessions);
  renderDashboard();
}

function applyTimerSettings() {
  const running = state.timer.running;
  if (running) pauseTimer();
  state.timer = createTimer(timerConfig());
  renderFocus();
}

/* ── notes ────────────────────────────────────────────────────────── */
function renderNotes() {
  const visible = sortNotes(searchNotes(state.notes, state.noteQuery));
  $('#note-grid').innerHTML = visible.map((note) => `
    <article class="note-card${note.pinned ? ' is-pinned' : ''}" data-id="${escapeHtml(note.id)}">
      <div class="note-head">
        <h3 class="note-title">${escapeHtml(note.title)}</h3>
        ${note.subject ? `<span class="pill tone-accent">${escapeHtml(note.subject)}</span>` : ''}
      </div>
      <p class="note-body">${escapeHtml(note.body)}</p>
      <div class="note-foot">
        <span class="note-time">${escapeHtml(relativeTime(note.updatedAt))}</span>
        <div class="note-actions">
          <button type="button" data-action="pin">${note.pinned ? 'Unpin' : 'Pin'}</button>
          <button type="button" data-action="edit">Edit</button>
          <button type="button" class="remove" data-action="remove">Delete</button>
        </div>
      </div>
    </article>`).join('');
  $('#note-empty').hidden = visible.length > 0;
  $('#note-count').textContent = `${state.notes.length} note${state.notes.length === 1 ? '' : 's'} saved`;
}

function onNoteSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());

  if (state.editingNoteId) {
    const note = state.notes.find((item) => item.id === state.editingNoteId);
    if (note) {
      const title = String(data.title || '').trim();
      const body = String(data.body || '').trim();
      if (!title && !body) {
        $('#note-error').textContent = 'Write something first.';
        return;
      }
      note.title = title || body.split('\n')[0].slice(0, 60);
      note.body = body;
      note.subject = String(data.subject || '').trim();
      note.updatedAt = new Date().toISOString();
      persist(KEY.notes, state.notes);
      state.editingNoteId = null;
      form.reset();
      $('#note-error').textContent = '';
      renderNotes();
      renderDashboard();
      toast('Note updated', 'good');
    }
    return;
  }

  const result = createNote(data);
  if (!result.ok) {
    $('#note-error').textContent = result.errors.join(' ');
    return;
  }
  $('#note-error').textContent = '';
  state.notes.push(result.note);
  persist(KEY.notes, state.notes);
  form.reset();
  $('#note-title').focus();
  renderNotes();
  renderDashboard();
  toast('Note saved', 'good');
}

function editNote(id) {
  const note = state.notes.find((item) => item.id === id);
  if (!note) return;
  state.editingNoteId = id;
  $('#note-title').value = note.title;
  $('#note-subject').value = note.subject || '';
  $('#note-body').value = note.body;
  $('#note-title').focus();
  toast('Editing — Save note to apply your changes.');
}

/* ── GPA ──────────────────────────────────────────────────────────── */
function renderGpaRows() {
  const tbody = $('#gpa-rows');
  tbody.innerHTML = state.gpaRows.map((row, index) => `
    <tr data-index="${index}">
      <td><input type="text" data-field="course" value="${escapeHtml(row.course || '')}" placeholder="Course ${index + 1}" aria-label="Course ${index + 1} name" /></td>
      <td><input type="number" data-field="credits" value="${escapeHtml(row.credits ?? 3)}" min="0.5" max="30" step="0.5" aria-label="Course ${index + 1} credits" /></td>
      <td>
        <select data-field="grade" aria-label="Course ${index + 1} grade">
          <option value="">—</option>
          ${GRADE_SCALE.map(({ grade }) => `<option value="${grade}"${row.grade === grade ? ' selected' : ''}>${grade}</option>`).join('')}
        </select>
      </td>
      <td><button class="gpa-remove" type="button" data-action="remove-row" aria-label="Remove course ${index + 1}">✕</button></td>
    </tr>`).join('');
}

function renderGpaResult() {
  const result = calculateGpa(state.gpaRows);
  const target = $('#gpa-result');
  target.innerHTML = `
    <h2>Your result</h2>
    <span class="gpa-big">${result.gpa === null ? '—' : result.gpa.toFixed(2)}</span>
    <p class="muted">${result.gpa === null
      ? 'Add a course with credits and a grade to see your GPA.'
      : `${classificationFor(result.gpa)} · about ${result.percentage}%`}</p>
    <div class="gpa-rows">
      <div class="gpa-row-stat"><div class="stat-value">${result.totalCredits}</div><div class="stat-label">Credits</div></div>
      <div class="gpa-row-stat"><div class="stat-value">${result.earnedPoints}</div><div class="stat-label">Quality points</div></div>
      <div class="gpa-row-stat"><div class="stat-value">${result.valid}</div><div class="stat-label">Courses counted</div></div>
      ${result.skipped ? `<div class="gpa-row-stat"><div class="stat-value">${result.skipped}</div><div class="stat-label">Rows ignored</div></div>` : ''}
    </div>`;
  renderGoal(result);
}

function renderGoal(current = calculateGpa(state.gpaRows)) {
  const goalGpa = Number($('#goal-gpa').value);
  const credits = Number($('#goal-credits').value);
  const needed = creditsToReachGpa(current, goalGpa, credits);
  const output = $('#goal-output');
  if (needed === null) {
    output.textContent = 'Set a target between 0 and 4.0 and a positive credit count.';
    return;
  }
  const letter = GRADE_SCALE.reduce((best, { grade, points }) =>
    Math.abs(points - needed) < Math.abs(best.points - needed) ? { grade, points } : best,
  { grade: 'A', points: 99 });
  output.innerHTML = `To reach <b>${goalGpa.toFixed(1)}</b> you need to average about
    <b>${needed.toFixed(2)}</b> grade points (roughly a <b>${letter}</b>) over ${credits} credits.`;
}

function renderGpa() {
  renderGpaRows();
  renderGpaResult();
  $('#grade-scale').innerHTML = GRADE_SCALE
    .map(({ grade, points }) => `<li><b>${grade}</b><span>${points.toFixed(1)}</span></li>`)
    .join('');
}

/* ── resources ────────────────────────────────────────────────────── */
function renderResourceChips() {
  const chips = [{ id: 'all', label: 'Everything' }, ...RESOURCE_CATEGORIES];
  $('#resource-chips').innerHTML = chips.map((chip) => `
    <button type="button" class="chip${state.resourceCategory === chip.id ? ' is-active' : ''}"
            data-category="${chip.id}">${escapeHtml(chip.label)}</button>`).join('');
}

function renderResources() {
  renderResourceChips();
  const visible = filterResources({ category: state.resourceCategory, query: state.resourceQuery });
  $('#resource-grid').innerHTML = visible.length
    ? visible.map((resource) => `
      <article class="resource-card">
        <h3><a href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(resource.title)}</a></h3>
        <p class="resource-blurb">${escapeHtml(resource.blurb)}</p>
        <div class="resource-tags">${(resource.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      </article>`).join('')
    : '<div class="empty" style="grid-column:1/-1"><p>No resources match that search.</p></div>';
}

/* ── data plumbing ────────────────────────────────────────────────── */
function downloadBackup() {
  const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `studyhub-backup-${today()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded', 'good');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!importAll(parsed)) throw new Error('bad shape');
      hydrate();
      renderAll();
      toast('Backup restored', 'good');
    } catch {
      toast('That file was not a StudyHub backup.', 'bad');
    }
  };
  reader.onerror = () => toast('Could not read that file.', 'bad');
  reader.readAsText(file);
}

function resetAll() {
  if (!window.confirm('Delete every task, class, note, session and GPA row in this browser?')) return;
  clearAll();
  state.tasks = [];
  state.entries = [];
  state.notes = [];
  state.sessions = [];
  state.gpaRows = [];
  state.name = '';
  state.editingNoteId = null;
  pauseTimer();
  state.timer = createTimer(timerConfig());
  renderAll();
  toast('All local data cleared');
}

/* ── render + events ──────────────────────────────────────────────── */
function renderAll() {
  renderDashboard();
  renderTasks();
  renderTimetable();
  renderNotes();
  renderGpa();
  renderResources();
  renderFocus();
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const navTarget = event.target.closest('[data-view]');
    if (navTarget) setView(navTarget.dataset.view);

    const action = event.target.closest('[data-action]');
    if (!action) return;
    const { action: name } = action.dataset;

    if (name === 'toggle') {
      const id = action.closest('[data-id]').dataset.id;
      const task = state.tasks.find((item) => item.id === id);
      if (task) {
        task.completed = action.checked;
        persist(KEY.tasks, state.tasks);
        renderTasks();
        renderDashboard();
      }
    }

    if (name === 'remove') {
      const card = action.closest('[data-id]');
      const id = card.dataset.id;
      if (card.classList.contains('task')) {
        state.tasks = state.tasks.filter((item) => item.id !== id);
        persist(KEY.tasks, state.tasks);
        renderTasks();
        renderDashboard();
        toast('Task deleted');
      } else {
        state.notes = state.notes.filter((item) => item.id !== id);
        if (state.editingNoteId === id) state.editingNoteId = null;
        persist(KEY.notes, state.notes);
        renderNotes();
        renderDashboard();
        toast('Note deleted');
      }
    }

    if (name === 'remove-class') {
      const id = action.closest('[data-id]').dataset.id;
      state.entries = state.entries.filter((item) => item.id !== id);
      persist(KEY.timetable, state.entries);
      renderTimetable();
      renderDashboard();
      toast('Class removed');
    }

    if (name === 'pin') {
      const id = action.closest('[data-id]').dataset.id;
      const note = state.notes.find((item) => item.id === id);
      if (note) {
        note.pinned = !note.pinned;
        persist(KEY.notes, state.notes);
        renderNotes();
      }
    }

    if (name === 'edit') editNote(action.closest('[data-id]').dataset.id);

    if (name === 'remove-row') {
      const index = Number(action.closest('tr').dataset.index);
      state.gpaRows.splice(index, 1);
      persist(KEY.gpa, state.gpaRows);
      renderGpa();
      renderDashboard();
    }
  });

  $('#task-form').addEventListener('submit', onTaskSubmit);
  $('#class-form').addEventListener('submit', onClassSubmit);
  $('#note-form').addEventListener('submit', onNoteSubmit);

  $('#clear-done-btn').addEventListener('click', () => {
    const count = state.tasks.filter((task) => task.completed).length;
    if (!count) return toast('Nothing completed to clear.');
    state.tasks = state.tasks.filter((task) => !task.completed);
    persist(KEY.tasks, state.tasks);
    renderTasks();
    renderDashboard();
    toast(`Cleared ${count} completed task${count === 1 ? '' : 's'}`);
  });

  $$('.segmented .seg').forEach((button) => {
    button.addEventListener('click', () => {
      state.filters.status = button.dataset.status;
      $$('.segmented .seg').forEach((other) => other.classList.toggle('is-active', other === button));
      renderTasks();
    });
  });
  $('#task-subject-filter').addEventListener('change', (event) => {
    state.filters.subject = event.target.value;
    renderTasks();
  });
  $('#task-search').addEventListener('input', (event) => {
    state.filters.query = event.target.value;
    renderTasks();
  });
  $('#note-search').addEventListener('input', (event) => {
    state.noteQuery = event.target.value;
    renderNotes();
  });
  $('#resource-search').addEventListener('input', (event) => {
    state.resourceQuery = event.target.value;
    renderResources();
  });

  $('#resource-chips').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-category]');
    if (!chip) return;
    state.resourceCategory = chip.dataset.category;
    renderResources();
  });

  $('#theme-toggle').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  $('#rename-btn').addEventListener('click', () => {
    const next = window.prompt('What should StudyHub call you?', state.name || '');
    if (next === null) return;
    state.name = next.trim();
    persist(KEY.profile, { name: state.name });
    renderDashboard();
  });

  $('#export-btn').addEventListener('click', downloadBackup);
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) importBackup(file);
    event.target.value = '';
  });
  $('#reset-all').addEventListener('click', resetAll);

  $('#focus-start').addEventListener('click', () => {
    if (state.timer.running) pauseTimer();
    else startTimer();
  });
  $('#focus-reset').addEventListener('click', () => {
    pauseTimer();
    state.timer = createTimer(timerConfig());
    renderFocus();
  });
  $('#focus-skip').addEventListener('click', () => {
    state.timer = skipPhase(state.timer);
    renderFocus();
  });
  ['#set-focus', '#set-short', '#set-long', '#set-rounds'].forEach((selector) => {
    $(selector).addEventListener('change', applyTimerSettings);
  });

  $('#gpa-add-row').addEventListener('click', () => {
    state.gpaRows.push({ course: '', credits: 3, grade: '' });
    persist(KEY.gpa, state.gpaRows);
    renderGpaRows();
    renderGpaResult();
    renderDashboard();
  });
  $('#gpa-clear').addEventListener('click', () => {
    state.gpaRows = [];
    persist(KEY.gpa, state.gpaRows);
    renderGpa();
    renderDashboard();
    toast('GPA rows cleared');
  });
  $('#gpa-rows').addEventListener('input', (event) => {
    const field = event.target.closest('[data-field]');
    if (!field) return;
    const row = state.gpaRows[Number(field.closest('tr').dataset.index)];
    if (!row) return;
    row[field.dataset.field] = field.value;
    persist(KEY.gpa, state.gpaRows);
    renderGpaResult();
    renderDashboard();
  });
  ['#goal-gpa', '#goal-credits'].forEach((selector) => {
    $(selector).addEventListener('input', () => renderGoal());
  });

  window.addEventListener('beforeunload', () => {
    if (state.intervalId) clearInterval(state.intervalId);
  });
}

/* ── boot ─────────────────────────────────────────────────────────── */
hydrate();
renderDaySelect();
bindEvents();
renderAll();
setView('dashboard');
