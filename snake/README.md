# Neon Snake 🐍

A bite-sized, self-contained arcade game — a glowing take on classic Snake. No build
step, no framework, no backend. Open `index.html` straight from disk or serve the
repo and visit `/snake/`.

## Play

`npm start` (from the repo root) and open <http://localhost:3000/snake/>.

- **Steer** with `↑ ↓ ← →` or `WASD`, by **swiping** (touch), or by **dragging** the board.
- **Pause** / resume with `P` or `Enter`/`Space`.
- **Sound** toggle with `M` or the button.
- **Restart** with `↻`, or `Enter`/`Space` on the game-over screen.

## Rules

- Eat the red orbs. Each bite scores `10 × combo`, where the combo grows every time you
  eat within the combo window (a few seconds).
- The rare **golden star** is worth `50 × combo` but fades fast — its glowing ring is a
  countdown.
- Speed ramps up as you eat. Harder difficulties start faster and accelerate sooner.
- **Walls** can be on (crash to lose) or **wrap** (slide through the edges). You choose
  on the menu.
- Levels are shown in the HUD (every few bites you level up and speed up).
- **High score** and **top combo** persist in `localStorage`, along with your settings.

## Files

```
index.html   the shell: HUD, menu / pause / game-over panels
style.css    neon theme, layout, panels, buttons
game.js      the whole game — state, loop, rendering, input, audio
```

The rest of the repo (StudyHub) is untouched; this lives in its own directory so it is
discoverable at `/snake/` but completely independent.
