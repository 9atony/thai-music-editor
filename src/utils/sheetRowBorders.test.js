import test from 'node:test';
import assert from 'node:assert/strict';
import { getSheetRowBorderVisibility } from './sheetRowBorders.js';

test('the first companion row shares the main staff bottom border', () => {
  assert.deepEqual(getSheetRowBorderVisibility({
    rowType: 'nathap',
    previousRowType: 'double-left',
    nextRowType: 'nathap',
  }), { top: false, bottom: false });
});

test('stacked rhythm rows own one visible separator at the start of the lower row', () => {
  assert.deepEqual(getSheetRowBorderVisibility({
    rowType: 'nathap',
    previousRowType: 'nathap',
    nextRowType: 'nathap',
  }), { top: true, bottom: false });

  assert.deepEqual(getSheetRowBorderVisibility({
    rowType: 'nathap',
    previousRowType: 'nathap',
    nextRowType: 'single',
  }), { top: true, bottom: true });
});

test('annotation and nathap rows retain separators when mixed', () => {
  assert.deepEqual(getSheetRowBorderVisibility({
    rowType: 'annotation',
    previousRowType: 'double-left',
    nextRowType: 'nathap',
  }), { top: false, bottom: false });

  assert.deepEqual(getSheetRowBorderVisibility({
    rowType: 'nathap',
    previousRowType: 'annotation',
    nextRowType: undefined,
  }), { top: true, bottom: true });
});

test('normal staff borders keep their existing behavior', () => {
  assert.deepEqual(getSheetRowBorderVisibility({ rowType: 'double-right' }), { top: true, bottom: false });
  assert.deepEqual(getSheetRowBorderVisibility({ rowType: 'double-left' }), { top: true, bottom: true });
  assert.deepEqual(getSheetRowBorderVisibility({ rowType: 'single' }), { top: true, bottom: true });
});
