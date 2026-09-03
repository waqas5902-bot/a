import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGpa, normalizeGrade, gradePoints, classificationFor, creditsToReachGpa } from '../assets/js/lib/gpa.mjs';

test('normalizeGrade handles case, spaces and junk', () => {
  assert.equal(normalizeGrade('a -'), 'A-');
  assert.equal(normalizeGrade(' b+ '), 'B+');
  assert.equal(normalizeGrade('E'), null);
  assert.equal(normalizeGrade(''), null);
  assert.equal(normalizeGrade(null), null);
});

test('gradePoints maps the scale', () => {
  assert.equal(gradePoints('A'), 4);
  assert.equal(gradePoints('B-'), 2.7);
  assert.equal(gradePoints('F'), 0);
});

test('calculateGpa is credit weighted and rounds to 2dp', () => {
  const result = calculateGpa([
    { grade: 'A', credits: 3 },
    { grade: 'B', credits: 3 },
    { grade: 'C+', credits: 2 }
  ]);
  // (4*3 + 3*3 + 2.3*2) / 8 = 25.6 / 8 = 3.2
  assert.equal(result.gpa, 3.2);
  assert.equal(result.totalCredits, 8);
  assert.equal(result.percentage, 80);
  assert.equal(result.valid, 3);
  assert.equal(result.skipped, 0);
});

test('calculateGpa ignores rows without a usable grade or credits', () => {
  const result = calculateGpa([
    { grade: 'A', credits: 4 },
    { grade: 'Z', credits: 3 },
    { grade: 'B', credits: 0 },
    { grade: 'B', credits: 'x' },
    null
  ]);
  assert.equal(result.gpa, 4);
  assert.equal(result.totalCredits, 4);
  assert.equal(result.skipped, 4);
});

test('calculateGpa with no courses returns null, not NaN', () => {
  const result = calculateGpa([]);
  assert.equal(result.gpa, null);
  assert.equal(result.percentage, null);
  assert.equal(result.totalCredits, 0);
});

test('the percentage comes from the exact ratio, not the rounded GPA', () => {
  const result = calculateGpa([
    { grade: 'A', credits: 4 },
    { grade: 'B', credits: 2 }
  ]);
  assert.equal(result.gpa, 3.67); // 22/6 rounded for display
  assert.equal(result.percentage, 91.7); // 22/6 * 25, not 3.67 * 25 = 91.8
});

test('classificationFor buckets the GPA', () => {
  assert.equal(classificationFor(3.85), 'Excellent');
  assert.equal(classificationFor(3.4), 'Very good');
  assert.equal(classificationFor(2.9), 'Good');
  assert.equal(classificationFor(0.6), 'At risk');
  assert.equal(classificationFor(null), '—');
});

test('creditsToReachGpa reports the average grade needed next term', () => {
  const current = calculateGpa([{ grade: 'B', credits: 30 }]);
  const needed = creditsToReachGpa(current, 3.5, 15);
  // (3.5*45 - 90)/15 = (157.5-90)/15 = 4.5 -> clamped to 4
  assert.equal(needed, 4);
  assert.equal(creditsToReachGpa(current, 3.5, 0), null);
  assert.equal(creditsToReachGpa(current, 9, 15), null);
});
