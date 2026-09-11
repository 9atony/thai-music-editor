import test from 'node:test';
import assert from 'node:assert/strict';
import { insertMeasureWithLogicalRowSplit } from './sheetRowSplit.js';
import { buildLogicalBlocks, paginateSheet } from './sheetPagination.js';
import { getPlayableMeasures } from './tempoTrack.js';

const measure = (id) => [id, '-', '-', '-'];
const singleRow = (count, prefix = 's') => Array.from({ length: count }, (_, index) => measure(`${prefix}${index}`));
const handRow = (label, count, prefix) => [[label], ...singleRow(count, prefix)];
const margins = (count) => Array.from({ length: count }, () => ({ top: 0, bottom: 0, left: 0 }));

const insert = (state, targetCell) => insertMeasureWithLogicalRowSplit({
  sectionLabels: {},
  symbols: [],
  rowMargins: margins(state.sheetData.length),
  ...state,
  targetCell
});

const noteIds = (rows, types) => rows.flatMap((row, rowIndex) => {
  if (types[rowIndex] !== 'single' && types[rowIndex] !== 'double-right') return [];
  const offset = types[rowIndex] === 'double-right' ? 1 : 0;
  return row.slice(offset).map((entry) => entry[0]);
});

test('measure below capacity stays in the same logical row', () => {
  const result = insert({
    sheetData: [singleRow(3)],
    rowTypes: ['single']
  }, [0, 0, 0]);

  assert.equal(result.insertedVisualRows, 0);
  assert.deepEqual(result.rowTypes, ['single']);
  assert.deepEqual(result.sheetData[0].map((entry) => entry[0]), ['s0', '-', 's1', 's2']);
  assert.deepEqual(result.selectedCell, [0, 1, 0]);
});

test('the first measure beyond capacity creates a real following source row', () => {
  const result = insert({
    sheetData: [singleRow(8), singleRow(2, 'next')],
    rowTypes: ['single', 'single'],
    sectionLabels: { 0: [{ text: 'current' }], 1: [{ text: 'next' }] }
  }, [0, 7, 0]);

  assert.deepEqual(result.rowTypes, ['single', 'single', 'single']);
  assert.equal(result.sheetData[0].length, 8);
  assert.equal(result.sheetData[1].length, 1);
  assert.equal(result.sheetData[1][0][0], '-');
  assert.deepEqual(result.selectedCell, [1, 0, 0]);
  assert.deepEqual(Object.keys(result.sectionLabels), ['0', '2']);
});

test('continuous additions fill each logical row and create further rows deterministically', () => {
  let state = {
    sheetData: [singleRow(8)],
    rowTypes: ['single'],
    rowMargins: margins(1),
    sectionLabels: {},
    symbols: []
  };
  let targetCell = [0, 7, 0];

  for (let index = 0; index < 17; index += 1) {
    const result = insert(state, targetCell);
    state = result;
    targetCell = result.selectedCell;
  }

  assert.deepEqual(state.sheetData.map((row) => row.length), [8, 8, 8, 1]);
  assert.ok(state.sheetData.every((row) => row.length <= 8));
  assert.deepEqual(state.selectedCell, [3, 0, 0]);
});

test('double hands split together and nathap follows the new logical pair', () => {
  const source = {
    sheetData: [
      handRow('มือขวา', 8, 'r'),
      handRow('มือซ้าย', 8, 'l'),
      [["@TEXT_SPAN_8", 'คำอธิบาย'], ...Array.from({ length: 7 }, () => ['@HIDDEN'])],
      handRow('', 8, 'n'),
      singleRow(2, 'next')
    ],
    rowTypes: ['double-right', 'double-left', 'annotation', 'nathap', 'single'],
    rowMargins: [
      { top: 3, bottom: 4, left: 5 },
      { top: 0, bottom: 6, left: 5 },
      { top: 0, bottom: 0, left: 0 },
      { top: 0, bottom: 7, left: 5 },
      { top: 0, bottom: 0, left: 0 }
    ],
    sectionLabels: {
      0: [
        { text: 'A', position: 'top-left' },
        { text: 'A-end', position: 'bottom-right' }
      ],
      1: [{ text: 'B', position: 'top-left' }]
    },
    symbols: [{ id: 1, type: 'kro', start: [0, 8, 0], end: [1, 8, 1] }]
  };
  const originalSource = structuredClone(source);
  const result = insert(source, [0, 4, 0]);

  assert.deepEqual(result.rowTypes, [
    'double-right', 'double-left', 'annotation', 'nathap',
    'double-right', 'double-left', 'nathap', 'single'
  ]);
  assert.deepEqual(result.sheetData.map((row) => row.length), [9, 9, 8, 9, 2, 2, 2, 2]);
  assert.equal(result.sheetData[2][0][1], 'คำอธิบาย');
  assert.deepEqual(result.rowMargins[0], { top: 3, bottom: 0, left: 5 });
  assert.deepEqual(result.rowMargins[4], { top: 0, bottom: 4, left: 5 });
  assert.deepEqual(result.rowMargins[5], { top: 0, bottom: 6, left: 5 });
  assert.deepEqual(result.rowMargins[6], { top: 0, bottom: 7, left: 5 });
  assert.deepEqual(result.symbols[0].start, [4, 1, 0]);
  assert.deepEqual(result.symbols[0].end, [5, 1, 1]);
  assert.deepEqual(result.mapPosition({ row: 3, measure: 8, cell: 2 }), { row: 6, measure: 1, cell: 2 });
  assert.deepEqual(Object.keys(result.sectionLabels), ['0', '1', '2']);
  assert.equal(result.sectionLabels[0][0].text, 'A');
  assert.equal(result.sectionLabels[1][0].text, 'A-end');
  assert.equal(result.sectionLabels[2][0].text, 'B');
  assert.deepEqual(source, originalSource);
});

test('splitting preserves every existing measure exactly once in playback order', () => {
  const source = {
    sheetData: [singleRow(8)],
    rowTypes: ['single']
  };
  const result = insert(source, [0, 3, 0]);
  const ids = noteIds(result.sheetData, result.rowTypes);

  assert.deepEqual(ids, ['s0', 's1', 's2', 's3', '-', 's4', 's5', 's6', 's7']);
  assert.equal(new Set(ids.filter((id) => id !== '-')).size, 8);
  assert.deepEqual(
    getPlayableMeasures(result.sheetData, result.rowTypes).map(({ row, measure: measureIndex }) => [row, measureIndex]),
    [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [1, 0]]
  );
});

test('pagination consumes the new source rows as separate logical blocks', () => {
  const result = insert({
    sheetData: [singleRow(8)],
    rowTypes: ['single']
  }, [0, 7, 0]);
  const blocks = buildLogicalBlocks(result);
  const pages = paginateSheet({
    ...result,
    layoutConfig: { measureHeight: 48, rowGap: 20, marginTop: 48, marginBottom: 48 }
  });

  assert.deepEqual(blocks.map((block) => block.rowIndices), [[0], [1]]);
  assert.deepEqual(pages.flatMap((page) => page.rowIndices), [0, 1]);
});

test('JSON save and reload preserves the split source structure without schema changes', () => {
  const result = insert({
    sheetData: [singleRow(8)],
    rowTypes: ['single'],
    sectionLabels: { 0: [{ text: 'เพลง' }] }
  }, [0, 7, 0]);
  const savedProjectShape = {
    sheetData: result.sheetData,
    rowTypes: result.rowTypes,
    rowMargins: result.rowMargins,
    sectionLabels: result.sectionLabels,
    symbols: result.symbols
  };

  assert.deepEqual(JSON.parse(JSON.stringify(savedProjectShape)), savedProjectShape);
});

test('legacy multi-chunk rows are normalized only when that row receives a new measure', () => {
  const untouchedLegacyRow = singleRow(10, 'legacy-other');
  const state = {
    sheetData: [singleRow(10, 'legacy-target'), untouchedLegacyRow],
    rowTypes: ['single', 'single']
  };
  assert.equal(state.sheetData[1].length, 10);

  const result = insert(state, [0, 9, 0]);
  assert.deepEqual(result.sheetData.slice(0, 2).map((row) => row.length), [8, 3]);
  assert.equal(result.sheetData[2].length, 10);
  assert.deepEqual(result.sheetData[2], untouchedLegacyRow);
});
