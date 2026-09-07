import test from 'node:test';
import assert from 'node:assert/strict';
import { expandFourNoteMeasures } from './expandFourNoteMeasures.js';

test('expands a dragged block across both hands to eight editable slots per measure', () => {
  const data = Array.from({ length: 2 }, () => [['มือ'], ...Array.from({ length: 8 }, () => ['ด', '-', 'ร', '-'])]);
  const types = ['double-right', 'double-left'];
  const range = { start: [0, 4, 0], end: [1, 7, 3] };
  const result = expandFourNoteMeasures(data, types, range);
  for (const row of result) {
    assert.equal(row[0].length, 1);
    for (let m = 1; m < row.length; m++) {
      assert.equal(row[m].length, m >= 4 && m <= 7 ? 8 : 4);
      assert.deepEqual(row[m].slice(0, 4), ['ด', '-', 'ร', '-']);
    }
  }
  assert.equal(data[0][4].length, 4);
  assert.deepEqual(expandFourNoteMeasures(data, types, { start: range.end, end: range.start }), result);
  assert.strictEqual(expandFourNoteMeasures(result, types, range), result);
});

test('ignores missing selections, labels and non-note rows', () => {
  const data = [[['-', '-', '-', '-']], [['a', 'b', 'c', 'd']]];
  const types = ['single', 'annotation'];
  assert.strictEqual(expandFourNoteMeasures(data, types, null), data);
  assert.strictEqual(expandFourNoteMeasures(data, types, { start: [0, 0, 0], end: [1, 0, 3], labelOnly: true }), data);
  const result = expandFourNoteMeasures(data, types, { start: [0, 0, 0], end: [1, 0, 3] });
  assert.equal(result[0][0].length, 8);
  assert.strictEqual(result[1], data[1]);
});
