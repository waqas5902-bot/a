# 🎓 StudyHub — Student Companion Website

StudyHub is a free, lightweight web app that helps students stay organised. It runs entirely in the browser with **no build step, no backend and no account** — all data is stored privately in `localStorage`.

## Features

| Page | What it does |
| --- | --- |
| **Dashboard** | Personal greeting, quote of the day, key stats (pending tasks, overdue/due today, focus sessions, GPA), upcoming deadlines and today's classes at a glance. |
| **Assignments** | Add tasks with subject, due date and priority. Filter by all/pending/done, tick off completed work, progress bar, colour-coded due-date warnings (overdue / today / soon). |
| **Timetable** | Weekly class schedule (Mon–Sun) with time, location and subject colours. Highlights today and the class happening right now. |
| **Study Timer** | Pomodoro timer with Focus / Short break / Long break modes, animated progress ring, customisable durations, chime sound, optional browser notifications, daily session counter. Press <kbd>Space</kbd> to start/pause. |
| **Notes** | Quick note-taking with autosave, search, word count and last-edited time. |
| **GPA Calculator** | Add courses with credits and letter grades (4.0 scale) to compute a weighted cumulative GPA. |
| **Flashcards** | Create decks, add question/answer cards, flip with a click, shuffle and navigate with <kbd>←</kbd> <kbd>→</kbd> keys. |
| **Resources** | Evidence-based study techniques plus curated links to free learning platforms and academic tools. |
| **Settings** | Name, light/dark theme, export/import a JSON backup, load sample data, clear all data. |

Other niceties: responsive layout with a slide-out sidebar on mobile, dark mode (follows system preference by default), first-run welcome screen with optional sample data, toast notifications, keyboard accessibility and print styles.

## Running locally

Because it is a static site, any web server works:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>. You can also simply double-click `index.html`.

## Project structure

```
index.html      # markup for every page (single-page app, hash routing)
css/styles.css  # design system, light/dark themes, responsive layout
js/app.js       # state, persistence, routing and all feature logic
```

## Tech

Plain HTML, CSS and JavaScript (ES2020). No frameworks or dependencies. Fonts are loaded from Google Fonts with a system-font fallback.

## Deploying

Upload the three files/folders to any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages, S3…). For GitHub Pages: *Settings → Pages → Deploy from branch → `/ (root)`*.
