import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyMeasureRow,
  createDefaultRowTypes,
  createDefaultSheetData,
  getFlattenedCol,
  hasNathapLeadingLabel,
  normalizeCellToken,
  normalizeNathapRowData,
  shiftNoteString,
  splitThaiNoteToken,
} from './sheetUtils.js';

test('creates four default right-hand and left-hand staff pairs', () => {
  const sheetData = createDefaultSheetData();
  const rowTypes = createDefaultRowTypes();

  assert.equal(sheetData.length, 8);
  assert.deepEqual(rowTypes, Array.from({ length: 4 }, () => ['double-right', 'double-left']).flat());
  assert.deepEqual(sheetData[0][0], ['มือขวา']);
  assert.deepEqual(sheetData[1][0], ['มือซ้าย']);
  assert.equal(sheetData[0].length, 9);
  assert.deepEqual(sheetData[0][1], ['-', '-', '-', '-']);
});

test('creates an eight-measure row with the requested number of beats', () => {
  const row = createEmptyMeasureRow(8, 4);
  assert.equal(row.length, 8);
  assert.deepEqual(row[0], ['-', '-', '-', '-']);
});

test('keeps selection columns aligned after a text measure span', () => {
  const normalMeasure = ['-', '-', '-', '-'];
  const rowWithText = [
    ['มือขวา'],
    [...normalMeasure],
    ['@TEXT_SPAN_2', ''],
    ['@HIDDEN'],
    [...normalMeasure]
  ];
  const normalRow = [
    ['มือซ้าย'],
    [...normalMeasure],
    [...normalMeasure],
    [...normalMeasure],
    [...normalMeasure]
  ];

  assert.equal(getFlattenedCol(rowWithText, 'double-right', 4, 0), 12);
  assert.equal(getFlattenedCol(normalRow, 'double-left', 4, 0), 12);
});

test('normalizes empty note input and preserves compact note tokens', () => {
  assert.equal(normalizeCellToken('  '), '-');
  assert.equal(normalizeCellToken(' ด ร '), 'ดร');
  assert.deepEqual(splitThaiNoteToken('ดร'), ['ด', 'ร']);
});

test('normalizes a nathap row beneath a double row with its label', () => {
  const row = normalizeNathapRowData([['ฉิ่ง'], ['ฉิ่ง', 'ฉับ']], true);
  assert.equal(row.length, 2);
  assert.deepEqual(row[0], ['ฉิ่ง']);
  assert.deepEqual(row[1], ['ฉิ่ง', 'ฉับ']);
});

test('keeps a short companion row aligned after its leading label', () => {
  const row = [[''], ['-', '-', '-', '-']];

  assert.equal(hasNathapLeadingLabel(row, 'nathap'), true);
  assert.equal(getFlattenedCol(row, 'nathap', 1, 0), 0);
});

test('transposes Thai notes while retaining octave marks', () => {
  assert.equal(shiftNoteString('ด', 1), 'ร');
  assert.equal(shiftNoteString('ท', 1), 'ดํ');
});
