/* =====================================================================
   StudyHub — application logic
   A dependency-free student companion. All data lives in localStorage.
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Helpers
  ------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const escapeHtml = (str) => String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const pad = (n) => String(n).padStart(2, '0');
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // JS getDay(): 0 = Sunday … 6 = Saturday → index into DAYS (Mon-first)
  const todayIndex = () => (new Date().getDay() + 6) % 7;

  const SUBJECT_COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#dc2626', '#0d9488', '#ca8a04', '#2563eb'];
  function subjectColor(name) {
    if (!name) return SUBJECT_COLORS[0];
    let h = 0;
    for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
  }

  function formatDate(iso, opts = { month: 'short', day: 'numeric' }) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
  }
  function daysUntil(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const due = new Date(y, m - 1, d);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((due - now) / 86400000);
  }
  function dueInfo(iso) {
    const n = daysUntil(iso);
    if (n < 0) return { cls: 'overdue', text: n === -1 ? 'Overdue by 1 day' : `Overdue by ${-n} days` };
    if (n === 0) return { cls: 'today', text: 'Due today' };
    if (n === 1) return { cls: 'soon', text: 'Due tomorrow' };
    if (n <= 7) return { cls: 'soon', text: `Due in ${n} days` };
    return { cls: '', text: `Due ${formatDate(iso)}` };
  }
  function fmtTime(hhmm) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  function relativeTime(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /* ------------------------------------------------------------------
     Toasts
  ------------------------------------------------------------------ */
  function toast(message, type = '') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    $('#toasts').appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 2600);
  }

  /* ------------------------------------------------------------------
     State & persistence
  ------------------------------------------------------------------ */
  const STORAGE_KEY = 'studyhub:v1';
  const defaultState = () => ({
    version: 1,
    profile: { name: '', theme: null, onboarded: false },
    tasks: [],
    classes: [],
    notes: [],
    courses: [],
    decks: [],
    timer: { focus: 25, short: 5, long: 15, sound: true, notify: false, sessions: {} }
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return mergeState(parsed);
    } catch {
      return defaultState();
    }
  }
  function mergeState(data) {
    const base = defaultState();
    const out = { ...base, ...data };
    out.profile = { ...base.profile, ...(data.profile || {}) };
    out.timer = { ...base.timer, ...(data.timer || {}) };
    out.timer.sessions = out.timer.sessions || {};
    for (const k of ['tasks', 'classes', 'notes', 'courses', 'decks']) {
      if (!Array.isArray(out[k])) out[k] = [];
    }
    return out;
  }
  let saveTimer = null;
  function save(immediate = false) {
    const write = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        toast('Could not save — storage may be full.', 'error');
      }
    };
    clearTimeout(saveTimer);
    if (immediate) write(); else saveTimer = setTimeout(write, 150);
  }

  /* ------------------------------------------------------------------
     Theme
  ------------------------------------------------------------------ */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const dark = theme === 'dark';
    $('#themeIconMoon').hidden = dark;
    $('#themeIconSun').hidden = !dark;
    $('#themeLabel').textContent = dark ? 'Light mode' : 'Dark mode';
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#0f1120' : '#4f46e5');
  }
  function currentTheme() {
    if (state.profile.theme) return state.profile.theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function toggleTheme() {
    state.profile.theme = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(state.profile.theme);
    save();
  }

  /* ------------------------------------------------------------------
     Router
  ------------------------------------------------------------------ */
  const PAGES = {
    dashboard: 'Dashboard', tasks: 'Assignments', timetable: 'Timetable', timer: 'Study Timer',
    notes: 'Notes', gpa: 'GPA Calculator', flashcards: 'Flashcards', resources: 'Resources', settings: 'Settings'
  };
  let currentPage = null;

  function navigate() {
    const hash = location.hash.replace('#', '') || 'dashboard';
    const page = PAGES[hash] ? hash : 'dashboard';
    currentPage = page;
    $$('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
    $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    $('#pageTitle').textContent = PAGES[page];
    document.title = `${PAGES[page]} · StudyHub`;
    closeSidebar();
    window.scrollTo({ top: 0 });
    if (page === 'dashboard') renderDashboard();
    if (page === 'timetable') renderTimetable();
  }
  function openSidebar() { $('#app').classList.add('sidebar-open'); }
  function closeSidebar() { $('#app').classList.remove('sidebar-open'); }

  /* ------------------------------------------------------------------
     Dashboard
  ------------------------------------------------------------------ */
  const QUOTES = [
    ['The secret of getting ahead is getting started.', 'Mark Twain'],
    ['It always seems impossible until it\'s done.', 'Nelson Mandela'],
    ['Success is the sum of small efforts, repeated day in and day out.', 'Robert Collier'],
    ['The expert in anything was once a beginner.', 'Helen Hayes'],
    ['Don\'t watch the clock; do what it does. Keep going.', 'Sam Levenson'],
    ['Education is the most powerful weapon which you can use to change the world.', 'Nelson Mandela'],
    ['The beautiful thing about learning is that no one can take it away from you.', 'B.B. King'],
    ['You don\'t have to be great to start, but you have to start to be great.', 'Zig Ziglar'],
    ['Live as if you were to die tomorrow. Learn as if you were to live forever.', 'Mahatma Gandhi'],
    ['Strive for progress, not perfection.', 'Unknown'],
    ['The mind is not a vessel to be filled, but a fire to be kindled.', 'Plutarch'],
    ['Focus on being productive instead of busy.', 'Tim Ferriss'],
    ['Little by little, one travels far.', 'J.R.R. Tolkien'],
    ['An investment in knowledge pays the best interest.', 'Benjamin Franklin']
  ];

  function renderDashboard() {
    const now = new Date();
    const hour = now.getHours();
    const name = state.profile.name ? `, ${state.profile.name}` : '';
    const greet = hour < 5 ? 'Burning the midnight oil' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';
    $('#greeting').textContent = `${greet}${name}!`;
    $('#heroDate').textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const pending = state.tasks.filter(t => !t.done);
    const dueToday = pending.filter(t => daysUntil(t.due) === 0);
    const overdue = pending.filter(t => daysUntil(t.due) < 0);
    const classesToday = state.classes.filter(c => c.day === todayIndex()).sort((a, b) => a.start.localeCompare(b.start));

    let sub;
    if (overdue.length) sub = `You have ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} — let's catch up.`;
    else if (dueToday.length) sub = `${dueToday.length} task${dueToday.length > 1 ? 's are' : ' is'} due today. You've got this.`;
    else if (pending.length) sub = `${pending.length} pending task${pending.length > 1 ? 's' : ''} and ${classesToday.length} class${classesToday.length === 1 ? '' : 'es'} today.`;
    else sub = 'Nothing pending — a perfect time to get ahead or take a break.';
    $('#heroSub').textContent = sub;

    // Quote of the day (stable per day)
    const dayNum = Math.floor(now.getTime() / 86400000);
    const [q, a] = QUOTES[dayNum % QUOTES.length];
    $('#quoteText').textContent = `“${q}”`;
    $('#quoteAuthor').textContent = `— ${a}`;

    // Stats
    $('#statPending').textContent = pending.length;
    if (overdue.length) {
      $('#statToday').textContent = overdue.length;
      $('#statTodayLabel').textContent = 'Overdue';
    } else {
      $('#statToday').textContent = dueToday.length;
      $('#statTodayLabel').textContent = 'Due today';
    }
    $('#statSessions').textContent = sessionsToday();
    const gpa = computeGPA();
    $('#statGPA').textContent = gpa.credits ? gpa.gpa.toFixed(2) : '—';

    // Upcoming deadlines
    const upcoming = [...pending].sort((x, y) => x.due.localeCompare(y.due)).slice(0, 6);
    $('#dashTasks').innerHTML = upcoming.length ? upcoming.map(t => {
      const d = dueInfo(t.due);
      return `<li class="list-item">
        <span class="subject-dot" style="background:${subjectColor(t.subject)}"></span>
        <div class="li-main"><div class="li-title">${escapeHtml(t.title)}</div><div class="li-sub">${escapeHtml(t.subject || 'General')}</div></div>
        <span class="due ${d.cls}">${d.text}</span>
      </li>`;
    }).join('') : `<li class="empty">No upcoming deadlines. 🎉</li>`;

    // Today's classes
    const nowMin = now.getHours() * 60 + now.getMinutes();
    $('#dashClasses').innerHTML = classesToday.length ? classesToday.map(c => {
      const [sh, sm] = c.start.split(':').map(Number);
      const [eh, em] = c.end.split(':').map(Number);
      const s = sh * 60 + sm, e = eh * 60 + em;
      const status = nowMin >= s && nowMin < e ? 'Now' : nowMin >= e ? 'Done' : '';
      return `<li class="list-item">
        <span class="li-time" style="color:${subjectColor(c.subject)}">${fmtTime(c.start)}</span>
        <div class="li-main"><div class="li-title">${escapeHtml(c.subject)}</div><div class="li-sub">${escapeHtml(c.location || '')}${c.location ? ' · ' : ''}until ${fmtTime(c.end)}</div></div>
        ${status ? `<span class="chip">${status}</span>` : ''}
      </li>`;
    }).join('') : `<li class="empty">No classes scheduled for today.</li>`;
  }

  /* ------------------------------------------------------------------
     Assignments
  ------------------------------------------------------------------ */
  let taskFilter = 'all';

  function updateSubjectList() {
    const subjects = new Set();
    state.tasks.forEach(t => t.subject && subjects.add(t.subject));
    state.classes.forEach(c => c.subject && subjects.add(c.subject));
    state.courses.forEach(c => c.name && subjects.add(c.name));
    $('#subjectList').innerHTML = [...subjects].sort().map(s => `<option value="${escapeHtml(s)}">`).join('');
  }

  function renderTasks() {
    const order = { high: 0, medium: 1, low: 2 };
    const list = state.tasks
      .filter(t => taskFilter === 'all' ? true : taskFilter === 'done' ? t.done : !t.done)
      .sort((a, b) => (a.done - b.done) || a.due.localeCompare(b.due) || (order[a.priority] - order[b.priority]));

    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.done).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    $('#taskProgress').style.width = `${pct}%`;
    $('#taskSummary').textContent = total ? `${done} of ${total} completed (${pct}%)` : 'No assignments yet — add your first one.';

    const pendingCount = total - done;
    const badge = $('#navTaskCount');
    badge.hidden = pendingCount === 0;
    badge.textContent = pendingCount;

    $('#taskList').innerHTML = list.length ? list.map(t => {
      const d = t.done ? null : dueInfo(t.due);
      return `<li class="task ${t.done ? 'done' : ''}" data-id="${t.id}">
        <input type="checkbox" class="task-check" ${t.done ? 'checked' : ''} aria-label="Mark ${escapeHtml(t.title)} as ${t.done ? 'pending' : 'done'}">
        <div class="task-main">
          <div class="task-title">${escapeHtml(t.title)}</div>
          <div class="task-meta">
            <span class="chip"><span class="subject-dot" style="background:${subjectColor(t.subject)};margin-right:6px"></span>${escapeHtml(t.subject || 'General')}</span>
            <span class="badge ${t.priority}">${t.priority}</span>
            ${d ? `<span class="due ${d.cls}">${d.text}</span>` : `<span class="due">Completed</span>`}
          </div>
        </div>
        <button class="icon-btn small danger task-delete" type="button" aria-label="Delete ${escapeHtml(t.title)}">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </li>`;
    }).join('') : `<li class="empty">${taskFilter === 'done' ? 'Nothing completed yet.' : taskFilter === 'pending' ? 'All caught up! 🎉' : 'No assignments yet.'}</li>`;
    updateSubjectList();
  }

  function initTasks() {
    const form = $('#taskForm');
    const f = form.elements;
    f.due.value = todayISO();
    f.due.min = '2000-01-01';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = f.title.value.trim();
      if (!title) return;
      state.tasks.unshift({
        id: uid(), title, subject: f.subject.value.trim(), due: f.due.value,
        priority: f.priority.value, done: false, created: Date.now()
      });
      save(); renderTasks();
      form.reset(); f.due.value = todayISO(); f.title.focus();
      toast('Assignment added', 'success');
    });

    $('#taskList').addEventListener('click', (e) => {
      const li = e.target.closest('.task'); if (!li) return;
      const task = state.tasks.find(t => t.id === li.dataset.id); if (!task) return;
      if (e.target.closest('.task-delete')) {
        state.tasks = state.tasks.filter(t => t.id !== task.id);
        save(); renderTasks(); toast('Assignment deleted');
      }
    });
    $('#taskList').addEventListener('change', (e) => {
      if (!e.target.classList.contains('task-check')) return;
      const li = e.target.closest('.task');
      const task = state.tasks.find(t => t.id === li.dataset.id); if (!task) return;
      task.done = e.target.checked;
      task.completed = task.done ? Date.now() : null;
      save();
      if (task.done) toast('Nice work! Task completed ✅', 'success');
      setTimeout(renderTasks, 180);
    });

    $('#taskFilter').addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      taskFilter = btn.dataset.filter;
      $$('#taskFilter button').forEach(b => b.classList.toggle('active', b === btn));
      renderTasks();
    });
  }

  /* ------------------------------------------------------------------
     Timetable
  ------------------------------------------------------------------ */
  function renderTimetable() {
    const today = todayIndex();
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    $('#timetable').innerHTML = DAYS.map((day, i) => {
      const items = state.classes.filter(c => c.day === i).sort((a, b) => a.start.localeCompare(b.start));
      return `<div class="tt-day ${i === today ? 'today' : ''}">
        <div class="tt-day-name">${DAYS_SHORT[i]}</div>
        ${items.length ? items.map(c => {
          const isNow = i === today && nowMin >= toMin(c.start) && nowMin < toMin(c.end);
          return `<div class="tt-class ${isNow ? 'now' : ''}" style="--c:${subjectColor(c.subject)}" data-id="${c.id}">
            <div class="tt-time">${fmtTime(c.start)} – ${fmtTime(c.end)}</div>
            <div class="tt-subject">${escapeHtml(c.subject)}</div>
            ${c.location ? `<div class="tt-location">📍 ${escapeHtml(c.location)}</div>` : ''}
            <button class="tt-remove" type="button" aria-label="Remove ${escapeHtml(c.subject)}"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>`;
        }).join('') : `<div class="tt-empty">Free</div>`}
      </div>`;
    }).join('');
  }

  function initTimetable() {
    const form = $('#classForm');
    const f = form.elements;
    f.day.innerHTML = DAYS.map((d, i) => `<option value="${i}" ${i === todayIndex() ? 'selected' : ''}>${d}</option>`).join('');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const subject = f.subject.value.trim();
      const start = f.start.value, end = f.end.value;
      if (!subject || !start || !end) return;
      if (end <= start) { toast('End time must be after start time.', 'error'); return; }
      state.classes.push({ id: uid(), subject, day: Number(f.day.value), start, end, location: f.location.value.trim() });
      save(); renderTimetable(); updateSubjectList();
      f.subject.value = ''; f.location.value = ''; f.subject.focus();
      toast('Class added to timetable', 'success');
    });
    $('#timetable').addEventListener('click', (e) => {
      const btn = e.target.closest('.tt-remove'); if (!btn) return;
      const id = btn.closest('.tt-class').dataset.id;
      state.classes = state.classes.filter(c => c.id !== id);
      save(); renderTimetable(); toast('Class removed');
    });
  }

  /* ------------------------------------------------------------------
     Pomodoro timer
  ------------------------------------------------------------------ */
  const timer = { mode: 'focus', remaining: 25 * 60, total: 25 * 60, running: false, endAt: null, tick: null, cycle: 0 };
  const RING_LEN = 2 * Math.PI * 118;
  const MODE_LABEL = { focus: 'Time to focus', short: 'Short break', long: 'Long break' };

  function sessionsToday() { return state.timer.sessions[todayISO()] || 0; }
  function modeMinutes(mode) { return Number(state.timer[mode]) || (mode === 'focus' ? 25 : mode === 'short' ? 5 : 15); }

  function renderTimer() {
    const m = Math.floor(timer.remaining / 60), s = timer.remaining % 60;
    const str = `${pad(m)}:${pad(s)}`;
    $('#timerTime').textContent = str;
    $('#timerLabel').textContent = timer.running ? MODE_LABEL[timer.mode] : (timer.remaining === timer.total ? MODE_LABEL[timer.mode] : 'Paused');
    $('#ringFg').style.strokeDashoffset = RING_LEN * (1 - timer.remaining / timer.total);
    $('#timerStart').textContent = timer.running ? 'Pause' : (timer.remaining === timer.total ? 'Start' : 'Resume');
    $('#timerSessions').textContent = sessionsToday();
    $('.timer-card').dataset.mode = timer.mode;
    $$('#timerModes button').forEach(b => b.classList.toggle('active', b.dataset.mode === timer.mode));
    if (timer.running || timer.remaining !== timer.total) document.title = `${str} · ${MODE_LABEL[timer.mode]} · StudyHub`;
    else if (currentPage) document.title = `${PAGES[currentPage]} · StudyHub`;
  }

  function setMode(mode, { silent = false } = {}) {
    stopTimer();
    timer.mode = mode;
    timer.total = timer.remaining = modeMinutes(mode) * 60;
    renderTimer();
    if (!silent && mode !== 'focus') toast(mode === 'short' ? 'Take a short break ☕' : 'Enjoy a long break 🌿');
  }
  function startTimer() {
    if (timer.running) return;
    timer.running = true;
    timer.endAt = Date.now() + timer.remaining * 1000;
    timer.tick = setInterval(() => {
      timer.remaining = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
      renderTimer();
      if (timer.remaining <= 0) finishTimer();
    }, 250);
    renderTimer();
  }
  function stopTimer() {
    timer.running = false;
    clearInterval(timer.tick); timer.tick = null;
    renderTimer();
  }
  function resetTimer() {
    stopTimer();
    timer.remaining = timer.total = modeMinutes(timer.mode) * 60;
    renderTimer();
  }
  function finishTimer() {
    stopTimer();
    if (state.timer.sound) playChime();
    if (timer.mode === 'focus') {
      const key = todayISO();
      state.timer.sessions[key] = (state.timer.sessions[key] || 0) + 1;
      timer.cycle += 1;
      save();
      notify('Focus session complete! 🎉', 'Great work. Time for a break.');
      toast('Focus session complete! Take a break.', 'success');
      setMode(timer.cycle % 4 === 0 ? 'long' : 'short');
    } else {
      notify('Break is over', 'Ready for another focus session?');
      toast('Break over — ready to focus again?');
      setMode('focus');
    }
  }
  function playChime() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      const ctx = new Ctx();
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        const t = ctx.currentTime + i * 0.18;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 0.65);
      });
      setTimeout(() => ctx.close(), 2000);
    } catch { /* audio not available */ }
  }
  function notify(title, body) {
    if (!state.timer.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎓</text></svg>' }); } catch { /* ignore */ }
  }

  function initTimer() {
    $('#setFocus').value = state.timer.focus;
    $('#setShort').value = state.timer.short;
    $('#setLong').value = state.timer.long;
    $('#setSound').checked = !!state.timer.sound;
    $('#setNotify').checked = !!state.timer.notify && ('Notification' in window) && Notification.permission === 'granted';
    setMode('focus', { silent: true });

    $('#timerStart').addEventListener('click', () => timer.running ? stopTimer() : startTimer());
    $('#timerReset').addEventListener('click', resetTimer);
    $('#timerModes').addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      setMode(btn.dataset.mode, { silent: true });
    });
    for (const [id, key, min, max] of [['#setFocus', 'focus', 1, 180], ['#setShort', 'short', 1, 60], ['#setLong', 'long', 1, 90]]) {
      $(id).addEventListener('change', (e) => {
        let v = Math.round(Number(e.target.value));
        if (!v || v < min) v = min; if (v > max) v = max;
        e.target.value = v; state.timer[key] = v; save();
        if (!timer.running && timer.mode === key) resetTimer();
      });
    }
    $('#setSound').addEventListener('change', (e) => { state.timer.sound = e.target.checked; save(); if (e.target.checked) playChime(); });
    $('#setNotify').addEventListener('change', async (e) => {
      if (!e.target.checked) { state.timer.notify = false; save(); return; }
      if (!('Notification' in window)) { toast('Notifications are not supported in this browser.', 'error'); e.target.checked = false; return; }
      let perm = Notification.permission;
      if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; } }
      if (perm === 'granted') { state.timer.notify = true; save(); toast('Notifications enabled', 'success'); }
      else { e.target.checked = false; toast('Notification permission was not granted.', 'error'); }
    });
    document.addEventListener('keydown', (e) => {
      if (currentPage !== 'timer' || e.code !== 'Space') return;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;
      e.preventDefault(); timer.running ? stopTimer() : startTimer();
    });
  }

  /* ------------------------------------------------------------------
     Notes
  ------------------------------------------------------------------ */
  let activeNoteId = null;
  let noteQuery = '';

  function renderNotesList() {
    const q = noteQuery.trim().toLowerCase();
    const notes = [...state.notes]
      .filter(n => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .sort((a, b) => b.updated - a.updated);
    $('#notesList').innerHTML = notes.length ? notes.map(n => `
      <li class="note-item ${n.id === activeNoteId ? 'active' : ''}" data-id="${n.id}">
        <div class="note-item-title">${escapeHtml(n.title) || '<em>Untitled</em>'}</div>
        <div class="note-item-preview">${escapeHtml(n.body.slice(0, 80)) || 'No content'}</div>
        <div class="note-item-date">${relativeTime(n.updated)}</div>
      </li>`).join('') : `<li class="empty">${q ? 'No notes match your search.' : 'No notes yet.'}</li>`;
  }
  function openNote(id) {
    activeNoteId = id;
    const n = state.notes.find(x => x.id === id);
    const has = !!n;
    $('#notesEmpty').hidden = has;
    $('#noteEditorInner').hidden = !has;
    if (has) {
      $('#noteTitle').value = n.title;
      $('#noteBody').value = n.body;
      updateNoteMeta(n);
    }
    renderNotesList();
  }
  function updateNoteMeta(n) {
    const words = n.body.trim() ? n.body.trim().split(/\s+/).length : 0;
    $('#noteMeta').textContent = `${words} word${words === 1 ? '' : 's'} · edited ${relativeTime(n.updated)}`;
  }
  function initNotes() {
    $('#noteNew').addEventListener('click', () => {
      const n = { id: uid(), title: '', body: '', created: Date.now(), updated: Date.now() };
      state.notes.unshift(n); save();
      noteQuery = ''; $('#noteSearch').value = '';
      openNote(n.id); $('#noteTitle').focus();
    });
    $('#notesList').addEventListener('click', (e) => {
      const li = e.target.closest('.note-item'); if (li) openNote(li.dataset.id);
    });
    $('#noteSearch').addEventListener('input', (e) => { noteQuery = e.target.value; renderNotesList(); });
    const onEdit = () => {
      const n = state.notes.find(x => x.id === activeNoteId); if (!n) return;
      n.title = $('#noteTitle').value; n.body = $('#noteBody').value; n.updated = Date.now();
      save(); updateNoteMeta(n); renderNotesList();
    };
    $('#noteTitle').addEventListener('input', onEdit);
    $('#noteBody').addEventListener('input', onEdit);
    $('#noteTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#noteBody').focus(); } });
    $('#noteDelete').addEventListener('click', () => {
      const n = state.notes.find(x => x.id === activeNoteId); if (!n) return;
      if ((n.title || n.body) && !confirm(`Delete "${n.title || 'Untitled'}"?`)) return;
      state.notes = state.notes.filter(x => x.id !== n.id); save();
      openNote(null); toast('Note deleted');
    });
    renderNotesList();
  }

  /* ------------------------------------------------------------------
     GPA calculator
  ------------------------------------------------------------------ */
  const GRADES = [['A+', 4.0], ['A', 4.0], ['A-', 3.7], ['B+', 3.3], ['B', 3.0], ['B-', 2.7], ['C+', 2.3], ['C', 2.0], ['C-', 1.7], ['D+', 1.3], ['D', 1.0], ['F', 0.0]];
  const GRADE_POINTS = Object.fromEntries(GRADES);

  function computeGPA() {
    let pts = 0, credits = 0;
    for (const c of state.courses) {
      const cr = Number(c.credits) || 0;
      pts += (GRADE_POINTS[c.grade] ?? 0) * cr; credits += cr;
    }
    return { gpa: credits ? pts / credits : 0, credits, points: pts };
  }
  function gpaLabel(g) {
    if (g >= 3.9) return 'Outstanding — summa cum laude territory! 🌟';
    if (g >= 3.7) return 'Excellent work — keep it up! 🎉';
    if (g >= 3.3) return 'Very good — you\'re doing great.';
    if (g >= 3.0) return 'Good standing. Solid effort!';
    if (g >= 2.5) return 'On track — a little push can go a long way.';
    if (g >= 2.0) return 'Satisfactory — consider extra study sessions.';
    return 'Below 2.0 — reach out to tutors or advisors for support.';
  }
  function renderGPA() {
    const r = computeGPA();
    $('#gpaValue').textContent = r.credits ? r.gpa.toFixed(2) : '—';
    $('#gpaCredits').textContent = r.credits;
    $('#gpaLabel').textContent = r.credits ? gpaLabel(r.gpa) : 'Add your courses to calculate your GPA.';
    $('#courseRows').innerHTML = state.courses.length ? state.courses.map(c => `
      <tr data-id="${c.id}">
        <td class="td-strong">${escapeHtml(c.name)}</td>
        <td>${c.credits}</td>
        <td><span class="chip">${escapeHtml(c.grade)}</span></td>
        <td>${(GRADE_POINTS[c.grade] * c.credits).toFixed(1)}</td>
        <td><button class="icon-btn small danger course-delete" type="button" aria-label="Remove ${escapeHtml(c.name)}"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
      </tr>`).join('') : `<tr><td colspan="5" class="empty">No courses added yet.</td></tr>`;
    updateSubjectList();
  }
  function initGPA() {
    const form = $('#courseForm');
    const f = form.elements;
    f.grade.innerHTML = GRADES.map(([g]) => `<option value="${g}">${g}</option>`).join('');
    $('#gradeScale').innerHTML = GRADES.map(([g, p]) => `<div class="scale-item"><span>${g}</span><span>${p.toFixed(1)}</span></div>`).join('');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = f.name.value.trim(); const credits = Number(f.credits.value);
      if (!name || !credits) return;
      state.courses.push({ id: uid(), name, credits, grade: f.grade.value });
      save(); renderGPA(); f.name.value = ''; f.name.focus();
    });
    $('#courseRows').addEventListener('click', (e) => {
      const btn = e.target.closest('.course-delete'); if (!btn) return;
      const id = btn.closest('tr').dataset.id;
      state.courses = state.courses.filter(c => c.id !== id); save(); renderGPA();
    });
    renderGPA();
  }

  /* ------------------------------------------------------------------
     Flashcards
  ------------------------------------------------------------------ */
  const fc = { deckId: null, index: 0, flipped: false, order: [] };

  function activeDeck() { return state.decks.find(d => d.id === fc.deckId) || null; }

  function renderDecks() {
    $('#deckList').innerHTML = state.decks.length ? state.decks.map(d => `
      <li class="deck-item ${d.id === fc.deckId ? 'active' : ''}" data-id="${d.id}">
        <span>${escapeHtml(d.name)}</span><span class="chip">${d.cards.length} card${d.cards.length === 1 ? '' : 's'}</span>
      </li>`).join('') : `<li class="empty">No decks yet. Create one above.</li>`;
  }
  function openDeck(id) {
    fc.deckId = id; fc.index = 0; fc.flipped = false;
    const d = activeDeck();
    fc.order = d ? d.cards.map((_, i) => i) : [];
    $('#deckEmpty').hidden = !!d;
    $('#deckInner').hidden = !d;
    if (d) { $('#deckTitle').textContent = d.name; $('#addCardDetails').open = d.cards.length === 0; }
    renderDecks(); renderCard();
  }
  function renderCard() {
    const d = activeDeck(); if (!d) return;
    const has = d.cards.length > 0;
    const card = has ? d.cards[fc.order[fc.index]] : null;
    $('#flashcard').classList.toggle('flipped', fc.flipped);
    $('#fcFront').textContent = card ? card.front : 'This deck is empty';
    $('#fcBack').textContent = card ? card.back : 'Add a card below to get started';
    $('#fcCounter').textContent = has ? `${fc.index + 1} / ${d.cards.length}` : '0 / 0';
    $('#fcPrev').disabled = !has || fc.index === 0;
    $('#fcNext').disabled = !has || fc.index >= d.cards.length - 1;
    $('#cardList').innerHTML = d.cards.map((c, i) => `
      <li class="card-list-item ${has && fc.order[fc.index] === i ? 'current' : ''}" data-index="${i}">
        <span class="cli-front">${escapeHtml(c.front)}</span><span class="cli-back">${escapeHtml(c.back)}</span>
        <button class="icon-btn small danger card-delete" type="button" aria-label="Delete card"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </li>`).join('');
  }
  function flipCard() { if (activeDeck()?.cards.length) { fc.flipped = !fc.flipped; renderCard(); } }
  function moveCard(delta) {
    const d = activeDeck(); if (!d || !d.cards.length) return;
    const next = fc.index + delta; if (next < 0 || next >= d.cards.length) return;
    const wasFlipped = fc.flipped;
    fc.index = next; fc.flipped = false;
    if (!wasFlipped) { renderCard(); return; }
    // The answer side is showing: flip back to the question first and keep the old
    // answer text on the rotating face, then swap it once that face is hidden.
    const prevBack = $('#fcBack').textContent;
    renderCard();
    $('#fcBack').textContent = prevBack;
    setTimeout(() => {
      const c = activeDeck()?.cards[fc.order[fc.index]];
      if (c) $('#fcBack').textContent = c.back;
    }, 300);
  }
  function initFlashcards() {
    $('#deckForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = e.target.elements.name.value.trim(); if (!name) return;
      const d = { id: uid(), name, cards: [], created: Date.now() };
      state.decks.push(d); save(); e.target.reset(); openDeck(d.id);
      toast('Deck created', 'success');
    });
    $('#deckList').addEventListener('click', (e) => { const li = e.target.closest('.deck-item'); if (li) openDeck(li.dataset.id); });
    $('#deckDelete').addEventListener('click', () => {
      const d = activeDeck(); if (!d) return;
      if (!confirm(`Delete deck "${d.name}" and its ${d.cards.length} cards?`)) return;
      state.decks = state.decks.filter(x => x.id !== d.id); save(); openDeck(null); toast('Deck deleted');
    });
    $('#deckShuffle').addEventListener('click', () => {
      const d = activeDeck(); if (!d || d.cards.length < 2) return;
      for (let i = fc.order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fc.order[i], fc.order[j]] = [fc.order[j], fc.order[i]]; }
      fc.index = 0; fc.flipped = false; renderCard(); toast('Deck shuffled');
    });
    $('#cardForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const d = activeDeck(); if (!d) return;
      const f = e.target.elements;
      const front = f.front.value.trim(), back = f.back.value.trim();
      if (!front || !back) return;
      d.cards.push({ id: uid(), front, back });
      fc.order.push(d.cards.length - 1);
      save(); e.target.reset(); f.front.focus(); renderDecks(); renderCard();
    });
    $('#cardList').addEventListener('click', (e) => {
      const li = e.target.closest('.card-list-item'); if (!li) return;
      const d = activeDeck(); if (!d) return;
      const i = Number(li.dataset.index);
      if (e.target.closest('.card-delete')) {
        d.cards.splice(i, 1); save();
        fc.order = d.cards.map((_, k) => k); fc.index = Math.min(fc.index, Math.max(0, d.cards.length - 1)); fc.flipped = false;
        renderDecks(); renderCard();
      } else {
        fc.index = fc.order.indexOf(i); fc.flipped = false; renderCard();
        $('#flashcard').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    $('#flashcard').addEventListener('click', flipCard);
    $('#flashcard').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipCard(); } });
    $('#fcPrev').addEventListener('click', () => moveCard(-1));
    $('#fcNext').addEventListener('click', () => moveCard(1));
    document.addEventListener('keydown', (e) => {
      if (currentPage !== 'flashcards' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') moveCard(-1);
      else if (e.key === 'ArrowRight') moveCard(1);
      else if (e.key === ' ' && e.target.id !== 'flashcard') { e.preventDefault(); flipCard(); }
    });
    renderDecks();
    if (state.decks.length) openDeck(state.decks[0].id);
  }

  /* ------------------------------------------------------------------
     Sample data
  ------------------------------------------------------------------ */
  function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function sampleData() {
    const now = Date.now();
    return {
      tasks: [
        { id: uid(), title: 'Physics lab report — pendulum experiment', subject: 'Physics', due: addDays(1), priority: 'high', done: false, created: now },
        { id: uid(), title: 'Read chapters 4–5 and summarise key arguments', subject: 'History', due: addDays(3), priority: 'medium', done: false, created: now },
        { id: uid(), title: 'Problem set 6: integration by parts', subject: 'Calculus', due: addDays(0), priority: 'high', done: false, created: now },
        { id: uid(), title: 'Group project slides — first draft', subject: 'Economics', due: addDays(6), priority: 'medium', done: false, created: now },
        { id: uid(), title: 'Vocabulary quiz prep (unit 7)', subject: 'Spanish', due: addDays(2), priority: 'low', done: false, created: now },
        { id: uid(), title: 'Essay outline: causes of the Industrial Revolution', subject: 'History', due: addDays(-2), priority: 'medium', done: true, completed: now - 86400000, created: now - 3 * 86400000 }
      ],
      classes: [
        { id: uid(), subject: 'Calculus', day: 0, start: '09:00', end: '10:30', location: 'Room 204' },
        { id: uid(), subject: 'Physics', day: 0, start: '11:00', end: '12:30', location: 'Lab B' },
        { id: uid(), subject: 'History', day: 1, start: '10:00', end: '11:30', location: 'Hall 3' },
        { id: uid(), subject: 'Spanish', day: 1, start: '14:00', end: '15:00', location: 'Room 118' },
        { id: uid(), subject: 'Economics', day: 2, start: '09:00', end: '10:30', location: 'Room 301' },
        { id: uid(), subject: 'Calculus', day: 2, start: '13:00', end: '14:30', location: 'Room 204' },
        { id: uid(), subject: 'Physics', day: 3, start: '11:00', end: '12:30', location: 'Lab B' },
        { id: uid(), subject: 'Study group', day: 3, start: '16:00', end: '17:30', location: 'Library' },
        { id: uid(), subject: 'History', day: 4, start: '10:00', end: '11:30', location: 'Hall 3' },
        { id: uid(), subject: 'Spanish', day: 4, start: '13:00', end: '14:00', location: 'Online' }
      ],
      notes: [
        { id: uid(), title: 'Integration by parts', body: 'Formula: ∫u dv = uv − ∫v du\n\nChoose u using LIATE:\n  L – Logarithmic\n  I – Inverse trig\n  A – Algebraic\n  T – Trigonometric\n  E – Exponential\n\nExample: ∫x·eˣ dx → u = x, dv = eˣ dx → x·eˣ − eˣ + C', created: now - 2 * 86400000, updated: now - 3600000 },
        { id: uid(), title: 'Lecture 7 — Industrial Revolution', body: 'Key causes:\n- Agricultural revolution freed up labour\n- Access to coal and iron\n- Colonial markets and capital\n- Political stability in Britain\n\nRemember to check the reading list for Hobsbawm.', created: now - 5 * 86400000, updated: now - 86400000 },
        { id: uid(), title: 'Exam checklist', body: '☐ Student ID\n☐ Two pens + pencil\n☐ Approved calculator\n☐ Water bottle\n☐ Arrive 20 minutes early', created: now - 86400000, updated: now - 7200000 }
      ],
      courses: [
        { id: uid(), name: 'Calculus I', credits: 4, grade: 'A-' },
        { id: uid(), name: 'Intro to Physics', credits: 4, grade: 'B+' },
        { id: uid(), name: 'World History', credits: 3, grade: 'A' },
        { id: uid(), name: 'Microeconomics', credits: 3, grade: 'B' },
        { id: uid(), name: 'Spanish II', credits: 2, grade: 'A' }
      ],
      decks: [
        { id: uid(), name: 'Calculus essentials', created: now, cards: [
          { id: uid(), front: 'Derivative of sin(x)?', back: 'cos(x)' },
          { id: uid(), front: 'Derivative of ln(x)?', back: '1 / x' },
          { id: uid(), front: '∫ 1/x dx = ?', back: 'ln|x| + C' },
          { id: uid(), front: 'What does the Fundamental Theorem of Calculus link?', back: 'Differentiation and integration — the integral of a rate of change gives the net change.' },
          { id: uid(), front: 'Chain rule', back: 'd/dx f(g(x)) = f′(g(x)) · g′(x)' }
        ] },
        { id: uid(), name: 'Spanish vocab — unit 7', created: now, cards: [
          { id: uid(), front: 'la biblioteca', back: 'the library' },
          { id: uid(), front: 'aprobar', back: 'to pass (an exam)' },
          { id: uid(), front: 'el horario', back: 'the timetable / schedule' },
          { id: uid(), front: 'la beca', back: 'the scholarship' }
        ] }
      ]
    };
  }
  function loadSample() {
    const s = sampleData();
    state.tasks = [...s.tasks, ...state.tasks];
    state.classes = [...state.classes, ...s.classes];
    state.notes = [...s.notes, ...state.notes];
    state.courses = [...state.courses, ...s.courses];
    state.decks = [...state.decks, ...s.decks];
    save(true);
    renderAll();
  }

  /* ------------------------------------------------------------------
     Settings: export / import / clear
  ------------------------------------------------------------------ */
  function updateStorageInfo() {
    const bytes = new Blob([JSON.stringify(state)]).size;
    const kb = (bytes / 1024).toFixed(1);
    const counts = `${state.tasks.length} tasks · ${state.classes.length} classes · ${state.notes.length} notes · ${state.courses.length} courses · ${state.decks.length} decks`;
    $('#storageInfo').textContent = `Permanently deletes everything (${counts}, ${kb} KB).`;
  }
  function initSettings() {
    $('#settingName').value = state.profile.name;
    $('#settingName').addEventListener('input', (e) => { state.profile.name = e.target.value.trim(); save(); });
    $('#themeToggle2').addEventListener('click', toggleTheme);

    $('#exportBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `studyhub-backup-${todayISO()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Backup downloaded', 'success');
    });
    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== 'object' || !('tasks' in data || 'notes' in data || 'decks' in data)) throw new Error('bad');
          if (!confirm('Importing will replace your current data. Continue?')) return;
          state = mergeState(data); state.profile.onboarded = true; save(true);
          applyTheme(currentTheme()); $('#settingName').value = state.profile.name;
          renderAll(); toast('Backup imported', 'success');
        } catch {
          toast('That file doesn\'t look like a StudyHub backup.', 'error');
        } finally { e.target.value = ''; }
      };
      reader.readAsText(file);
    });
    $('#loadSampleBtn').addEventListener('click', () => { loadSample(); toast('Sample data loaded', 'success'); });
    $('#clearBtn').addEventListener('click', () => {
      if (!confirm('Delete ALL StudyHub data from this browser? This cannot be undone.')) return;
      const theme = state.profile.theme;
      state = defaultState(); state.profile.onboarded = true; state.profile.theme = theme;
      save(true); $('#settingName').value = ''; renderAll(); toast('All data cleared');
    });
  }

  /* ------------------------------------------------------------------
     Welcome
  ------------------------------------------------------------------ */
  function initWelcome() {
    const modal = $('#welcomeModal');
    if (state.profile.onboarded) return;
    modal.classList.add('open');
    setTimeout(() => $('#welcomeName').focus(), 50);
    const finish = (withSample) => {
      state.profile.name = $('#welcomeName').value.trim();
      state.profile.onboarded = true;
      $('#settingName').value = state.profile.name;
      if (withSample) loadSample(); else { save(true); renderAll(); }
      modal.classList.remove('open');
      toast(state.profile.name ? `Welcome aboard, ${state.profile.name}! 🎓` : 'Welcome to StudyHub! 🎓', 'success');
    };
    $('#welcomeForm').addEventListener('submit', (e) => { e.preventDefault(); finish($('#welcomeSample').checked); });
    $('#welcomeSkip').addEventListener('click', () => finish(false));
  }

  /* ------------------------------------------------------------------
     Boot
  ------------------------------------------------------------------ */
  function renderAll() {
    renderTasks(); renderTimetable(); renderNotesList(); renderGPA(); renderDecks();
    if (activeNoteId && !state.notes.find(n => n.id === activeNoteId)) openNote(null);
    if (fc.deckId && !state.decks.find(d => d.id === fc.deckId)) openDeck(null);
    else if (!fc.deckId && state.decks.length) openDeck(state.decks[0].id);
    else if (fc.deckId) openDeck(fc.deckId);
    renderDashboard(); updateStorageInfo();
  }

  function init() {
    applyTheme(currentTheme());
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#menuBtn').addEventListener('click', openSidebar);
    $('#backdrop').addEventListener('click', closeSidebar);
    $('#todayChip').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

    initTasks(); initTimetable(); initTimer(); initNotes(); initGPA(); initFlashcards(); initSettings();
    renderAll();

    window.addEventListener('hashchange', navigate);
    navigate();
    initWelcome();

    // keep "now" indicators fresh
    setInterval(() => { if (currentPage === 'dashboard') renderDashboard(); if (currentPage === 'timetable') renderTimetable(); }, 60000);
    // refresh storage info when the settings page is visited
    window.addEventListener('hashchange', () => { if (currentPage === 'settings') updateStorageInfo(); });
    // flush pending saves
    window.addEventListener('beforeunload', () => save(true));
    // sync theme with system if user hasn't chosen one
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (!state.profile.theme) applyTheme(currentTheme()); });
  }

  let booted = false;
  const boot = () => { if (booted) return; booted = true; init(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
