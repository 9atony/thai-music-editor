import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeCustomCellToken,
  encodeCustomCellToken,
  getCellDisplayText,
  isCustomCellToken,
  normalizeCustomKeyboardKeys,
  normalizeCustomText,
} from './customKeyboard.js';

test('custom cell tokens preserve readable text without looking like note data', () => {
  const token = encodeCustomCellToken('  ทิง   โจ๊ะ  ');

  assert.equal(isCustomCellToken(token), true);
  assert.equal(decodeCustomCellToken(token), 'ทิง โจ๊ะ');
  assert.equal(getCellDisplayText(token), 'ทิง โจ๊ะ');
  assert.equal(isCustomCellToken('ดร'), false);
});

test('custom keyboard input is bounded and empty values become rests', () => {
  assert.equal(normalizeCustomText(' ก   ข '), 'ก ข');
  assert.equal(encodeCustomCellToken('   '), '-');
  assert.equal(normalizeCustomText('x'.repeat(40)).length, 24);
});

test('custom key definitions discard invalid entries and repair duplicate ids', () => {
  assert.deepEqual(normalizeCustomKeyboardKeys([
    { id: 'one', label: 'ทิง' },
    { id: 'one', label: 'โจ๊ะ' },
    { id: 'empty', label: ' ' },
  ]), [
    { id: 'one', label: 'ทิง' },
    { id: 'custom-2', label: 'โจ๊ะ' },
  ]);
});
