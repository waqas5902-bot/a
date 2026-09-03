import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTimer, tick, nextPhase, skipPhase, clockLabel, progressPercent,
  phaseLength, summarizeSessions, PHASE_FOCUS, PHASE_SHORT, PHASE_LONG
} from '../assets/js/lib/pomodoro.mjs';

test('createTimer starts on a full focus block', () => {
  const state = createTimer();
  assert.equal(state.phase, PHASE_FOCUS);
  assert.equal(state.remaining, 25 * 60);
  assert.equal(state.completedFocusSessions, 0);
  assert.equal(state.running, false);
});

test('createTimer clamps out-of-range settings', () => {
  const state = createTimer({ focusMinutes: 999, shortMinutes: -5, roundsBeforeLong: 0 });
  assert.equal(state.config.focusMinutes, 120);
  assert.equal(state.config.shortMinutes, 1);
  assert.equal(state.config.roundsBeforeLong, 1);
  assert.equal(state.remaining, 120 * 60);
});

test('tick counts down without touching the phase', () => {
  const state = createTimer({ focusMinutes: 25 });
  const after = tick(state);
  assert.equal(after.remaining, 25 * 60 - 1);
  assert.equal(after.phase, PHASE_FOCUS);
  // original state is not mutated
  assert.equal(state.remaining, 25 * 60);
});

/** Ticks until the phase changes, returning the new state (a phase is one tick per second). */
function runOutPhase(state, maxTicks = 24 * 60) {
  const startPhase = state.phase;
  let current = state;
  for (let i = 0; i < maxTicks; i += 1) {
    current = tick(current);
    if (current.phase !== startPhase) return current;
  }
  throw new Error(`phase never advanced from ${startPhase}`);
}

test('a finished focus block becomes a short break and counts a session', () => {
  const state = createTimer({ focusMinutes: 1 });
  assert.equal(tick(state).remaining, 59, 'the first tick just counts down');
  const after = runOutPhase(state);
  assert.equal(after.phase, PHASE_SHORT);
  assert.equal(after.remaining, 5 * 60);
  assert.equal(after.completedFocusSessions, 1);
});

test('the fourth focus round triggers a long break, then it resets to short', () => {
  let state = createTimer({ focusMinutes: 1, shortMinutes: 1, longMinutes: 15, roundsBeforeLong: 4 });
  const phases = [];
  for (let round = 0; round < 5; round += 1) {
    state = runOutPhase(state); // finish focus -> break
    phases.push(state.phase);
    state = runOutPhase(state); // finish break -> focus
  }
  assert.deepEqual(phases, [PHASE_SHORT, PHASE_SHORT, PHASE_SHORT, PHASE_LONG, PHASE_SHORT]);
  assert.equal(state.completedFocusSessions, 5);
  assert.equal(state.phase, PHASE_FOCUS);
});

test('nextPhase never advances past focus twice', () => {
  const state = createTimer();
  assert.equal(nextPhase(state), PHASE_SHORT);
  assert.equal(nextPhase({ ...state, phase: PHASE_SHORT }), PHASE_FOCUS);
  assert.equal(nextPhase({ ...state, phase: PHASE_LONG }), PHASE_FOCUS);
});

test('skipPhase resets the clock but does not credit a session', () => {
  const state = { ...createTimer(), remaining: 42 };
  const skipped = skipPhase(state);
  assert.equal(skipped.phase, PHASE_SHORT);
  assert.equal(skipped.remaining, phaseLength(skipped));
  assert.equal(skipped.completedFocusSessions, 0);
});

test('clockLabel and progressPercent format the ring', () => {
  assert.equal(clockLabel(0), '00:00');
  assert.equal(clockLabel(65), '01:05');
  assert.equal(clockLabel(1500), '25:00');
  assert.equal(clockLabel(-30), '00:00');
  const state = { ...createTimer({ focusMinutes: 25 }), remaining: 15 * 60 };
  assert.equal(progressPercent(state), 40);
  assert.equal(progressPercent(createTimer()), 0);
});

test('summarizeSessions totals today separately from all time', () => {
  const sessions = [
    { date: '2026-09-03', minutes: 25 },
    { date: '2026-09-03', minutes: 25 },
    { date: '2026-09-02', minutes: 50 },
    { date: '2026-09-03' }
  ];
  const summary = summarizeSessions(sessions, '2026-09-03');
  assert.equal(summary.todayMinutes, 50);
  assert.equal(summary.totalMinutes, 100);
  assert.equal(summary.sessionCount, 4);
  assert.deepEqual(summarizeSessions([], '2026-09-03'), { todayMinutes: 0, totalMinutes: 0, sessionCount: 0 });
});
