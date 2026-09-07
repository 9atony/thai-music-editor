import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampTempoBpm, getPlayableMeasures, getPlaybackMeasures, getPlaybackMeasureOffsetMs, getCellDurationMs, getTempoAtPosition,
  normalizeTempoTrack
} from './tempoTrack.js';

const sheet = [[Array(4).fill('-'), Array(4).fill('-'), Array(4).fill('-')]];
const types = ['single'];

test('click-to-play offsets follow repeated playlist occurrences and per-cell tempo durations', () => {
  const data = [[Array(4).fill('-')], [Array(8).fill('-')]];
  const rowTypes = ['single', 'single'];
  const labels = { 0: [{ text: 'A', position: 'top-left' }], 1: [{ text: 'B', position: 'top-left' }] };
  const playlist = getPlaybackMeasures(data, rowTypes, labels, [{ label: 'B', loops: 2 }, { label: 'A', loops: 1 }]);
  const points = [{ id: 'b', position: { row: 1, measure: 0, cell: 0 }, bpm: 120, transition: 'linear' }];
  const source = getPlayableMeasures(data, rowTypes);
  let expected = 0;
  playlist.forEach((measure, index) => {
    assert.equal(getPlaybackMeasureOffsetMs(playlist, index, points, 80, source), expected);
    for (let cell = 0; cell < measure.cellCount; cell++) {
      expected += getCellDurationMs({ row: measure.row, measure: measure.measure, cell }, points, 80, data, rowTypes);
    }
  });
  assert.equal(getPlaybackMeasureOffsetMs(playlist, 2, points, 80, source), 1000);
});

test('playlist graph follows section order and expands repeats without adding left-hand or annotation measures', () => {
  const data = [[['right'], ['ด', '-', '-', '-']], [['left'], ['ร', '-', '-', '-']], [['text']], [['ม', '-', '-', '-']]];
  const rowTypes = ['double-right', 'double-left', 'annotation', 'single'];
  const labels = { 0: [{ text: 'A', position: 'top-left' }], 1: [{ text: 'B', position: 'top-left' }] };
  const sequence = [{ label: 'B', loops: 2 }, { label: 'A', loops: 1 }, { label: 'B', loops: 1 }];
  const measures = getPlaybackMeasures(data, rowTypes, labels, sequence);
  assert.deepEqual(measures.map(measure => measure.row), [3, 3, 0, 3]);
  assert.deepEqual(measures.map(measure => measure.number), [1, 2, 3, 4]);
  assert.deepEqual(measures.map(measure => [measure.sequenceIndex, measure.loop]), [[0, 1], [0, 2], [1, 1], [2, 1]]);
  assert.deepEqual(measures.map(measure => measure.startBeat), [4, 4, 0, 4]);
  assert.deepEqual(getPlaybackMeasures(data, rowTypes, labels, []), getPlayableMeasures(data, rowTypes));
  assert.deepEqual(getPlaybackMeasures(data, rowTypes, labels, [{ label: 'missing', loops: 1 }]), []);
});

test('playlist sections include following unlabelled lines and support alternate labels', () => {
  const data = Array.from({ length: 3 }, () => [Array(4).fill('-')]);
  const labels = { 0: [{ text: 'A', position: 'top-left' }, { text: 'Alias', position: 'top-left' }], 2: [{ text: 'B', position: 'top-left' }] };
  const measures = getPlaybackMeasures(data, ['single', 'single', 'single'], labels, [{ label: 'Alias', loops: 2 }]);
  assert.deepEqual(measures.map(measure => measure.row), [0, 1, 0, 1]);
  assert.deepEqual(measures.map(measure => measure.startsSection), [true, false, true, false]);
});

test('graph staff numbers group both hands and skip supporting rows and page breaks', () => {
  const row = count => Array.from({ length: count }, () => Array(4).fill('-'));
  const data = [row(10), row(10), row(1), row(1), row(1), row(8)];
  const rowTypes = ['double-right', 'double-left', 'annotation', 'nathap', 'page-break', 'single'];
  const measures = getPlayableMeasures(data, rowTypes);
  assert.deepEqual(measures.slice(0, 8).map(measure => measure.lineNumber), Array(8).fill(1));
  assert.equal(measures[8].lineNumber, 2);
  assert.equal(measures[9].lineNumber, 3);
  assert.equal(measures[9].number, 10);
  assert.equal(measures[9].row, 5);
});

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
