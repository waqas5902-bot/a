// Notes logic.
import { formatDate, todayISO } from './date.mjs';

export function createNote({ title, body = '', subject = '' } = {}, now = new Date()) {
  const cleanTitle = String(title || '').trim();
  const cleanBody = String(body || '').trim();
  if (!cleanTitle && !cleanBody) return { ok: false, errors: ['Write something first.'] };
  const stamp = now.toISOString();
  return {
    ok: true,
    note: {
      id: `n_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      title: cleanTitle || firstLine(cleanBody),
      body: cleanBody,
      subject: String(subject || '').trim(),
      createdAt: stamp,
      updatedAt: stamp,
      pinned: false
    }
  };
}

function firstLine(text) {
  return text.split('\n')[0].slice(0, 60) || 'Untitled note';
}

export function searchNotes(notes, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((note) =>
    `${note.title} ${note.body} ${note.subject}`.toLowerCase().includes(q)
  );
}

/** Pinned first, then most recently edited. */
export function sortNotes(notes) {
  return [...notes].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
}

/** Very small "2 hours ago" style label for the note cards. */
export function relativeTime(iso, now = new Date()) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const diffSeconds = Math.round((now.getTime() - then) / 1000);
  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} d ago`;
  return formatDate(iso.slice(0, 10) || todayISO());
}
