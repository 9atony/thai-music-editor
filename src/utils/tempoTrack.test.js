import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampTempoBpm, getPlayableMeasures, getTempoAtPosition,
  normalizeTempoTrack
} from './tempoTrack.js';

const sheet = [[Array(4).fill('-'), Array(4).fill('-'), Array(4).fill('-')]];
const types = ['single'];

test('uses the project BPM when a song has no tempo points', () => {
  assert.equal(getTempoAtPosition({ row: 0, measure: 1, cell: 2 }, [], 92, sheet, types), 92);
});

test('step tempo starts exactly at its musical position', () => {
  const points = [{ id: 'a', position: { row: 0, measure: 1, cell: 0 }, bpm: 120, transition: 'step' }];
  assert.equal(getTempoAtPosition({ row: 0, measure: 0, cell: 3 }, points, 80, sheet, types), 80);
  assert.equal(getTempoAtPosition({ row: 0, measure: 1, cell: 0 }, points, 80, sheet, types), 120);
});

test('linear tempo interpolates from the previous point to its target', () => {
  const points = [
    { id: 'a', position: { row: 0, measure: 0, cell: 0 }, bpm: 80, transition: 'step' },
    { id: 'b', position: { row: 0, measure: 2, cell: 0 }, bpm: 120, transition: 'linear' }
  ];
  assert.equal(getTempoAtPosition({ row: 0, measure: 1, cell: 0 }, points, 80, sheet, types), 100);
});

test('normalization validates BPM, removes duplicate positions, and sorts points', () => {
  const points = normalizeTempoTrack([
    { id: 'late', position: { row: 0, measure: 2, cell: 0 }, bpm: 500 },
    { id: 'early', position: { row: 0, measure: 0, cell: 0 }, bpm: 10 },
    { id: 'replace', position: { row: 0, measure: 2, cell: 0 }, bpm: 110 }
  ], sheet, types, 80);
  assert.deepEqual(points.map((point) => [point.id, point.bpm]), [['early', 20], ['replace', 110]]);
  assert.equal(clampTempoBpm('bad', 75), 75);
  assert.equal(getPlayableMeasures(sheet, types).length, 3);
});
