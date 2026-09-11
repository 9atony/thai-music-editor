import test from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useSheetEditor } from './useSheetEditor.js';
import { DEFAULT_INSTRUMENT, createDefaultLayoutConfig } from '../utils/sheetUtils.js';

test('the khayi action commits eight slots without optional playback dependencies', () => {
  let result;
  function EditorHarness() {
    // Match the dependencies supplied by MusicProvider: playback is not passed.
    const editor = useSheetEditor({
      isReadOnlyRef: { current: false },
      currentInstrument: DEFAULT_INSTRUMENT,
      intervalModeRef: { current: 'off' },
      isReduceModeRef: { current: false },
      layoutConfigRef: { current: createDefaultLayoutConfig() },
    });
    const [step, setStep] = useState(0);
    if (step === 0) {
      editor.setSelectionRange({ start: [0, 5, 0], end: [1, 8, 3] });
      setStep(1);
    } else if (step === 1) {
      editor.expandSelectedMeasures();
      setStep(2);
    } else {
      result = editor;
    }
    return null;
  }
  renderToStaticMarkup(React.createElement(EditorHarness));
  for (const row of result.sheetData.slice(0, 2)) {
    assert.deepEqual(row.slice(5, 9).map(measure => measure.length), [8, 8, 8, 8]);
    assert.equal(row[4].length, 4);
  }
  assert.equal(result.selectionRange, null);
  assert.equal(result.history.at(-1).sheetData[0][5].length, 8);
});

test('delete and undo after a logical row split keep source rows valid', () => {
  let result;
  let afterDelete;
  function EditorHarness() {
    const editor = useSheetEditor({
      isReadOnlyRef: { current: false },
      currentInstrument: DEFAULT_INSTRUMENT,
      intervalModeRef: { current: 'off' },
      isReduceModeRef: { current: false },
      layoutConfigRef: { current: createDefaultLayoutConfig() },
    });
    const [step, setStep] = useState(0);

    if (step === 0) {
      editor.setSheetData([Array.from({ length: 8 }, (_, index) => [`n${index}`, '-', '-', '-'])]);
      editor.setRowTypes(['single']);
      editor.setRowMargins([{ top: 0, bottom: 0, left: 0 }]);
      editor.setSelectedCell([0, 7, 0]);
      setStep(1);
    } else if (step === 1) {
      editor.addMeasure();
      setStep(2);
    } else if (step === 2) {
      editor.addMeasure();
      setStep(3);
    } else if (step === 3) {
      editor.removeMeasure();
      setStep(4);
    } else if (step === 4) {
      afterDelete = structuredClone(editor.sheetData);
      editor.undo();
      setStep(5);
    } else {
      result = editor;
    }
    return null;
  }

  renderToStaticMarkup(React.createElement(EditorHarness));
  assert.deepEqual(afterDelete.map((row) => row.length), [8, 1]);
  assert.deepEqual(result.rowTypes, ['single', 'single']);
  assert.deepEqual(result.sheetData.map((row) => row.length), [8, 2]);
  assert.deepEqual(result.sheetData[0].map((entry) => entry[0]), Array.from({ length: 8 }, (_, index) => `n${index}`));
  assert.deepEqual(result.selectedCell, [1, 0, 0]);
});
