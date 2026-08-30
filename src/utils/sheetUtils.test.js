import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyMeasureRow,
  normalizeCellToken,
  normalizeNathapRowData,
  shiftNoteString,
  splitThaiNoteToken,
} from './sheetUtils.js';

test('creates an eight-measure row with the requested number of beats', () => {
  const row = createEmptyMeasureRow(8, 4);
  assert.equal(row.length, 8);
  assert.deepEqual(row[0], ['-', '-', '-', '-']);
});

test('normalizes empty note input and preserves compact note tokens', () => {
  assert.equal(normalizeCellToken('  '), '-');
  assert.equal(normalizeCellToken(' ด ร '), 'ดร');
  assert.deepEqual(splitThaiNoteToken('ดร'), ['ด', 'ร']);
});

test('normalizes a nathap row beneath a double row with its label', () => {
  const row = normalizeNathapRowData([['ฉิ่ง'], ['ฉิ่ง', 'ฉับ']], true);
  assert.equal(row.length, 9);
  assert.deepEqual(row[0], ['ฉิ่ง']);
  assert.deepEqual(row[1], ['ฉิ่ง', 'ฉับ']);
});

test('transposes Thai notes while retaining octave marks', () => {
  assert.equal(shiftNoteString('ด', 1), 'ร');
  assert.equal(shiftNoteString('ท', 1), 'ดํ');
});
