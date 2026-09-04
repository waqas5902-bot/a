# StudyHub — a study portal for students

A single-page website built for one purpose: getting through a term without losing track of it.
Planner, weekly timetable, Pomodoro focus timer, notes, GPA calculator and a curated library of
genuinely free learning resources — all in one tab, all stored in your own browser.

**No build step, no framework, no backend.** Plain HTML + CSS + ES modules, served by a tiny
Node static server. Nothing is uploaded anywhere: every task, note and session lives in
`localStorage`.

---

## Run it

```bash
npm install   # only needed for the test runner's jsdom dev dependency
npm start     # serves the site on http://localhost:3000
```

Open <http://localhost:3000>. Set `PORT=8080 npm start` to use another port.
The server binds `0.0.0.0`, so it works behind a proxy or in a container.

## Test it

```bash
npm test
```

76 tests across three layers:

| Layer | Files | What it covers |
| --- | --- | --- |
| Unit | `tests/date.test.mjs`, `gpa`, `tasks`, `timetable`, `pomodoro`, `notes`, `storage` | The pure logic in `assets/js/lib/*.mjs` — date maths, credit-weighted GPA, task sorting, clash detection, the Pomodoro state machine, storage round-trips |
| Integration | `tests/app.integration.test.mjs` | Boots the **real** `index.html` and `assets/js/app.js` inside jsdom, then types into the forms, ticks checkboxes, clicks nav and asserts what was rendered and what hit `localStorage` |
| Game | `tests/snake.test.mjs` | Boots the **real** `snake/index.html` + `snake/game.js` inside jsdom and drives it like a player: start, steer, pause, settings, crashing into a wall, wrap mode |

The app code contains no logic of its own — `app.js` only reads state, draws it and handles
input, so the unit tests cover the rules and the integration test proves they are wired up.

## What each section does

**Dashboard** — greeting by time of day, eight live stat cards (open tasks, due today, overdue,
minutes focused today, classes today, current GPA, weekly class hours, notes), plus "Up next" and
"Classes today". Every card is a button that jumps to that tool.

**Planner** — tasks with subject, due date, priority and notes. The list sorts itself by urgency:
overdue first, then soonest due, then priority. Filter by open/done/all, by subject or by free
text. Bulk-clear completed work.

**Timetable** — a Monday–Sunday grid you build once. Classes are validated (must end after they
start), overlapping classes are outlined and listed in a clash warning, and the weekly hour total
is shown. Today's column is highlighted.

**Focus** — a Pomodoro timer drawn as an SVG ring, with configurable focus/break lengths and rounds
before a long break. Completed focus blocks are logged with a chime and counted into "focused
today"; the tab title shows the countdown while it runs.

**Notes** — save, search, pin, edit and delete. Pinned notes float to the top, the rest sort by
last edited.

**GPA** — credit-weighted 4.0 GPA from your courses, with classification, quality points, an
approximate percentage and a "what do I need next term?" target calculator. Rows without a usable
grade or credit count are ignored rather than poisoning the average.

**Resources** — 28 hand-picked free resources (Khan Academy, MIT OpenCourseWare, freeCodeCamp,
Purdue OWL, Anki, arXiv…), filterable by category or free text.

## Also built in

- **Light and dark themes**, respecting `prefers-color-scheme`, persisted between visits.
- **Export / import** — download all your data as JSON and restore it on another machine.
- **Reset all my data** in the footer, with a confirmation.
- Keyboard-friendly and screen-reader friendly: skip link, `aria-current` navigation, labelled
  controls, `role="status"` toasts, and a `prefers-reduced-motion` override.
- Print stylesheet, and a responsive layout down to phone width.

## Layout

```
index.html                 the whole shell — every section, no template engine
assets/css/styles.css      design tokens, light/dark themes, all components
assets/js/app.js           view layer: render + events + localStorage
assets/js/lib/*.mjs        pure, unit-tested logic (date, tasks, timetable,
                           pomodoro, notes, gpa, resources, storage)
snake/                     Neon Snake — a standalone arcade game (see snake/README.md)
server.mjs                 dependency-free static server (traversal-safe, 404 page)
tests/                     unit + jsdom integration tests
404.html                   served for unknown routes
```

## Neon Snake

The repo also ships a standalone arcade game at [`snake/`](snake/README.md) — run
`npm start` and visit <http://localhost:3000/snake/>. It is deliberately independent of the
StudyHub app (its own `index.html`, `style.css` and `game.js`), with combo scoring, golden
orbs, wrap-or-crash walls, saved high scores and touch/keyboard controls.

## Data and privacy

Everything is written to `localStorage` under `studyhub.*` keys. Clearing browser data or using
private mode wipes it — use **Export** first if the data matters. If storage is unavailable the
app falls back to an in-memory store instead of crashing.
