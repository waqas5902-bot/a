// GPA logic. Supports letter grades on a 4.0 scale plus +/- modifiers.

export const GRADE_POINTS = {
  'A+': 4, 'A': 4, 'A-': 3.7,
  'B+': 3.3, 'B': 3, 'B-': 2.7,
  'C+': 2.3, 'C': 2, 'C-': 1.7,
  'D+': 1.3, 'D': 1, 'D-': 0.7,
  'F': 0
};

export const GRADE_SCALE = Object.entries(GRADE_POINTS).map(([grade, points]) => ({
  grade,
  points
}));

/** Normalises user input: `"a -"` -> `"A-"`, `"b+"` -> `"B+"`, unknown -> null. */
export function normalizeGrade(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!trimmed) return null;
  if (!(trimmed in GRADE_POINTS)) return null;
  return trimmed;
}

export function gradePoints(raw) {
  const grade = normalizeGrade(raw);
  return grade === null ? null : GRADE_POINTS[grade];
}

/**
 * @param {Array<{grade: string, credits: number|string}>} courses
 * @returns {{totalCredits:number, earnedPoints:number, gpa:number|null, percentage:number|null, valid:number, skipped:number}}
 */
export function calculateGpa(courses) {
  const rows = Array.isArray(courses) ? courses : [];
  let totalCredits = 0;
  let earnedPoints = 0;
  let valid = 0;
  let skipped = 0;

  for (const course of rows) {
    const points = gradePoints(course?.grade);
    const credits = Number(course?.credits);
    if (points === null || !Number.isFinite(credits) || credits <= 0) {
      skipped += 1;
      continue;
    }
    totalCredits += credits;
    earnedPoints += points * credits;
    valid += 1;
  }

  // Keep the exact ratio for the percentage; rounding the GPA first and then
  // multiplying by 25 would drift (22/6 = 3.6667 → 91.7%, not 3.67 → 91.8%).
  const exact = totalCredits > 0 ? earnedPoints / totalCredits : null;
  return {
    totalCredits: Math.round(totalCredits * 100) / 100,
    earnedPoints: Math.round(earnedPoints * 100) / 100,
    gpa: exact === null ? null : Math.round(exact * 100) / 100,
    percentage: exact === null ? null : Math.round(exact * 25 * 10) / 10,
    valid,
    skipped
  };
}

/** Rough degree classification used in the results card (not a formal transcript). */
export function classificationFor(gpa) {
  if (gpa === null || Number.isNaN(gpa)) return '—';
  if (gpa >= 3.7) return 'Excellent';
  if (gpa >= 3.3) return 'Very good';
  if (gpa >= 2.7) return 'Good';
  if (gpa >= 2) return 'Satisfactory';
  if (gpa >= 1) return 'Passing';
  return 'At risk';
}

/** Credit target needed in the next term to reach a goal GPA. */
export function creditsToReachGpa(current, goalGpa, availableCredits) {
  const earned = current.earnedPoints;
  const credits = current.totalCredits;
  if (!Number.isFinite(goalGpa) || goalGpa <= 0 || goalGpa > 4) return null;
  if (!Number.isFinite(availableCredits) || availableCredits <= 0) return null;
  const required = (goalGpa * (credits + availableCredits) - earned) / availableCredits;
  return Math.round(Math.min(4, Math.max(0, required)) * 100) / 100;
}
