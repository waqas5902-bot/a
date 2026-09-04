// Neon Snake smoke test: boots the real snake/index.html + snake/game.js inside
// jsdom and drives the game the way a player would (start, steer, pause, settings,
// crash into a wall, restart). Canvas is stubbed because jsdom has no <canvas>;
// requestAnimationFrame is turned into a manual pump so we control every frame.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../snake/index.html', import.meta.url), 'utf8');
const gameSource = readFileSync(new URL('../snake/game.js', import.meta.url), 'utf8');

// A hand-rolled 2D context with just enough to satisfy the game's draw calls.
function makeContextStub() {
  const noop = () => {};
  return {
    canvas: null,
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    arcTo: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    fillText: noop,
    save: noop,
    restore: noop,
    // settable properties — plain fields on the object are fine
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '',
    shadowColor: '', shadowBlur: 0, globalAlpha: 1, font: '', textAlign: '', textBaseline: ''
  };
}

function boot() {
  const dom = new JSDOM(html, { url: 'http://localhost:3000/snake/', pretendToBeVisual: true });
  const { window } = dom;

  // jsdom has no real canvas or timers we want to drive ourselves.
  window.HTMLCanvasElement.prototype.getContext = function () {
    const ctx = makeContextStub();
    ctx.canvas = this;
    return ctx;
  };
  window.HTMLCanvasElement.prototype.focus = () => {};

  // Manual frame pump so the game loop never runs on its own timers.
  const frameQueue = [];
  window.requestAnimationFrame = (cb) => { frameQueue.push(cb); return frameQueue.length; };
  window.cancelAnimationFrame = () => {};
  // Expose for the tests below.
  window.__frames = frameQueue;

  // Not implemented by jsdom; the app path relies on these never being hit.
  window.scrollTo = () => {};

  // Boot the game in the page's realm. jsdom's own eval does not expose `window`
  // as a bare identifier, so we inject the globals the script reads directly.
  const bootFn = new Function(
    'window', 'document', 'localStorage', 'performance',
    'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout',
    gameSource
  );
  bootFn(
    window,
    window.document,
    window.localStorage,
    window.performance,
    window.requestAnimationFrame,
    window.cancelAnimationFrame,
    window.setTimeout.bind(window),
    window.clearTimeout.bind(window)
  );
  return dom;
}

const $ = (win, sel) => win.document.querySelector(sel);
const click = (el) => el.click();
const press = (win, key) => {
  const ev = new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  win.dispatchEvent(ev);
  return ev;
};

// Advance the game loop by `frames` steps of `dt` ms each.
function pump(win, frames, dt = 50) {
  const queue = win.__frames;
  let t = win.performance.now();
  for (let i = 0; i < frames; i++) {
    const cb = queue.shift();
    assert.equal(typeof cb, 'function', 'the loop should always have a pending frame');
    t += dt;
    cb(t);
  }
}

test('boots into the menu with the board visible and panels hidden', () => {
  const dom = boot();
  const win = dom.window;

  assert.equal($(win, '#menu-panel').hidden, false, 'menu is shown on load');
  assert.equal($(win, '#pause-panel').hidden, true);
  assert.equal($(win, '#over-panel').hidden, true);
  assert.equal($(win, '#overlay').hidden, false, 'overlay is visible so the menu panel can sit on it');

  assert.equal($(win, '#score').textContent, '0');
  assert.equal($(win, '#length').textContent, '3', 'the idle snake starts 3 cells long');
  assert.equal($(win, '#level').textContent, '1');
});

test('starting a game hides the overlay and resets the HUD', () => {
  const dom = boot();
  const win = dom.window;

  click($(win, '#start-btn'));

  assert.equal($(win, '#overlay').hidden, true, 'overlay is hidden once playing');
  assert.equal($(win, '#menu-panel').hidden, true);
  assert.equal($(win, '#score').textContent, '0');
  assert.equal($(win, '#length').textContent, '3');
});

test('steering keys prevent page scroll and do not throw', () => {
  const dom = boot();
  const win = dom.window;
  click($(win, '#start-btn'));

  const ev = press(win, 'ArrowUp');
  assert.equal(ev.defaultPrevented, true, 'arrow keys are captured so the page does not scroll');
  // These should never throw regardless of state.
  assert.doesNotThrow(() => {
    pump(win, 5);
  });
});

test('P toggles between playing and the pause panel', () => {
  const dom = boot();
  const win = dom.window;
  click($(win, '#start-btn'));

  press(win, 'p');
  assert.equal($(win, '#pause-panel').hidden, false, 'P opens the pause panel');
  assert.equal($(win, '#overlay').hidden, false);

  press(win, 'p');
  assert.equal($(win, '#pause-panel').hidden, true, 'P resumes');
  assert.equal($(win, '#overlay').hidden, true);
});

test('difficulty buttons and the wrap switch update their settings UI', () => {
  const dom = boot();
  const win = dom.window;

  // Difficulty
  click($(win, '.seg-btn[data-diff="hard"]'));
  assert.equal($(win, '.seg-btn[data-diff="hard"]').classList.contains('is-active'), true);
  assert.equal($(win, '.seg-btn[data-diff="normal"]').classList.contains('is-active'), false);
  assert.equal(win.localStorage.getItem('neonSnake.diff'), 'hard');

  // Wrap toggle
  click($(win, '#wrap-toggle'));
  assert.equal($(win, '#wrap-toggle').getAttribute('aria-checked'), 'true');
  assert.equal($(win, '#wrap-toggle .switch-text').textContent, 'On');
  assert.equal(win.localStorage.getItem('neonSnake.wrap'), 'true');

  click($(win, '#wrap-toggle'));
  assert.equal($(win, '#wrap-toggle').getAttribute('aria-checked'), 'false');
  assert.equal(win.localStorage.getItem('neonSnake.wrap'), 'false');
});

test('the mute button toggles sound and persists it', () => {
  const dom = boot();
  const win = dom.window;

  assert.equal($(win, '#mute-btn').getAttribute('aria-pressed'), 'true');
  click($(win, '#mute-btn'));
  assert.equal($(win, '#mute-btn').getAttribute('aria-pressed'), 'false');
  assert.match($(win, '#mute-btn').textContent, /Sound off/);
  assert.equal(win.localStorage.getItem('neonSnake.sound'), 'false');

  click($(win, '#mute-btn'));
  assert.equal(win.localStorage.getItem('neonSnake.sound'), 'true');
});

test('crashing into a wall ends the game and Play again restarts it', () => {
  const dom = boot();
  const win = dom.window;
  click($(win, '#start-btn'));

  // The snake starts mid-board heading right. Spin many frames and it will
  // reach the right wall (wrap mode is off by default) and crash.
  assert.doesNotThrow(() => pump(win, 60));

  assert.equal($(win, '#over-panel').hidden, false, 'game-over panel appears after a crash');
  assert.equal($(win, '#overlay').hidden, false);
  assert.equal($(win, '#final-score').textContent, $(win, '#score').textContent, 'final score mirrors the live score');

  // Hitting Enter (or clicking Play again) restarts into a fresh game.
  press(win, 'Enter');
  assert.equal($(win, '#overlay').hidden, true, 'restart hides the overlay');
  assert.equal($(win, '#score').textContent, '0');
  assert.equal($(win, '#length').textContent, '3');
});

test('wrap mode on means the snake never dies at the edge', () => {
  const dom = boot();
  const win = dom.window;

  click($(win, '#wrap-toggle')); // turn wrap on
  assert.equal($(win, '#wrap-toggle').getAttribute('aria-checked'), 'true');
  click($(win, '#start-btn'));

  assert.doesNotThrow(() => pump(win, 90));

  assert.equal($(win, '#over-panel').hidden, true, 'with wrap on, the snake survives the edge');
  assert.equal($(win, '#overlay').hidden, true, 'still playing (no overlay)');
});
