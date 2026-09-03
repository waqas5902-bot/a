// Pomodoro state machine — pure functions, no timers. The view layer owns setInterval.

export const PHASE_FOCUS = 'focus';
export const PHASE_SHORT = 'shortBreak';
export const PHASE_LONG = 'longBreak';

export const PHASE_LABELS = {
  [PHASE_FOCUS]: 'Focus',
  [PHASE_SHORT]: 'Short break',
  [PHASE_LONG]: 'Long break'
};

export function createTimer({ focusMinutes = 25, shortMinutes = 5, longMinutes = 15, roundsBeforeLong = 4 } = {}) {
  const config = {
    focusMinutes: clamp(focusMinutes, 1, 120),
    shortMinutes: clamp(shortMinutes, 1, 60),
    longMinutes: clamp(longMinutes, 1, 90),
    roundsBeforeLong: clamp(roundsBeforeLong, 1, 12)
  };
  return {
    config,
    phase: PHASE_FOCUS,
    remaining: config.focusMinutes * 60,
    completedFocusSessions: 0,
    running: false
  };
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function phaseLength(state) {
  const { config, phase } = state;
  if (phase === PHASE_SHORT) return config.shortMinutes * 60;
  if (phase === PHASE_LONG) return config.longMinutes * 60;
  return config.focusMinutes * 60;
}

/** Which phase comes next, given how many focus rounds are done. */
export function nextPhase(state) {
  if (state.phase !== PHASE_FOCUS) return PHASE_FOCUS;
  const roundsDone = state.completedFocusSessions + 1;
  return roundsDone % state.config.roundsBeforeLong === 0 ? PHASE_LONG : PHASE_SHORT;
}

/** One second later. Auto-advances the phase when the clock hits zero. */
export function tick(state) {
  if (state.remaining > 1) return { ...state, remaining: state.remaining - 1 };
  const finishedFocus = state.phase === PHASE_FOCUS;
  const phase = nextPhase(state);
  return {
    ...state,
    phase,
    remaining: phaseLength({ ...state, phase }),
    completedFocusSessions: finishedFocus ? state.completedFocusSessions + 1 : state.completedFocusSessions
  };
}

export function clockLabel(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function progressPercent(state) {
  const length = phaseLength(state);
  if (!length) return 0;
  return Math.round(((length - state.remaining) / length) * 100);
}

/** Skip the current phase manually (counts a focus round only if it actually finished). */
export function skipPhase(state) {
  const phase = nextPhase(state);
  return {
    ...state,
    phase,
    remaining: phaseLength({ ...state, phase }),
    completedFocusSessions: state.completedFocusSessions
  };
}

/** Totals for the "focused today" stat card. */
export function summarizeSessions(sessions, todayISO) {
  const rows = Array.isArray(sessions) ? sessions : [];
  let today = 0;
  let all = 0;
  for (const session of rows) {
    const minutes = Number(session.minutes) || 0;
    all += minutes;
    if (session.date === todayISO) today += minutes;
  }
  return { todayMinutes: today, totalMinutes: all, sessionCount: rows.length };
}
