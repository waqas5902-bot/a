// Tiny localStorage wrapper. Falls back to an in-memory map when storage is
// unavailable (private mode, sandboxed iframe, SSR) so the app never throws.

const memory = new Map();

function backend() {
  try {
    const probe = '__studyhub_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const store = typeof window === 'undefined' ? null : backend();

export const KEY = {
  tasks: 'studyhub.tasks',
  timetable: 'studyhub.timetable',
  notes: 'studyhub.notes',
  focus: 'studyhub.focus',
  gpa: 'studyhub.gpa',
  profile: 'studyhub.profile',
  theme: 'studyhub.theme'
};

export function load(key, fallback) {
  try {
    const raw = store ? store.getItem(key) : memory.get(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  const raw = JSON.stringify(value);
  try {
    if (store) store.setItem(key, raw);
    else memory.set(key, raw);
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    if (store) store.removeItem(key);
    else memory.delete(key);
  } catch {
    /* nothing to clean up */
  }
}

export function clearAll() {
  Object.values(KEY).forEach(remove);
}

export function exportAll() {
  const data = {};
  for (const [name, key] of Object.entries(KEY)) data[name] = load(key, null);
  return data;
}

export function importAll(data) {
  if (!data || typeof data !== 'object') return false;
  for (const [name, key] of Object.entries(KEY)) {
    if (name in data) save(key, data[name]);
  }
  return true;
}
