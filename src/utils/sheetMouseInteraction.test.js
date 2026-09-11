import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSheetMouseUpHandler,
  registerSheetMouseUpListeners
} from './sheetMouseInteraction.js';

const makeEditorTarget = (rowIndex, measureIndex) => ({
  closest: () => ({
    dataset: {
      rowIndex: String(rowIndex),
      measureIndex: String(measureIndex)
    }
  })
});

const makeHarness = (initialPending = null) => {
  let pending = initialPending;
  let clearCount = 0;
  let endCount = 0;
  const handler = createSheetMouseUpHandler({
    getPendingInteraction: () => pending,
    clearPendingInteraction: () => {
      clearCount += 1;
      pending = null;
    },
    endSelection: () => {
      endCount += 1;
    }
  });

  return {
    handler,
    clearSelection: () => { pending = null; },
    counts: () => ({ clearCount, endCount })
  };
};

test('mouseup without an active text selection does not throw and ends any global drag', () => {
  const harness = makeHarness();
  assert.doesNotThrow(() => harness.handler({ target: null }));
  assert.deepEqual(harness.counts(), { clearCount: 0, endCount: 1 });
});

test('normal click mouseup in the originating editor is deferred to its local handler', () => {
  const harness = makeHarness({ rowIndex: 4, measureIndex: 2, activated: false });
  assert.equal(harness.handler({ target: makeEditorTarget(4, 2) }), false);
  assert.deepEqual(harness.counts(), { clearCount: 0, endCount: 0 });
});

test('drag selection mouseup in the originating editor preserves existing local finish behavior', () => {
  const harness = makeHarness({ rowIndex: 4, measureIndex: 2, activated: true });
  assert.equal(harness.handler({ target: makeEditorTarget(4, 2) }), false);
  assert.deepEqual(harness.counts(), { clearCount: 0, endCount: 0 });
});

test('selection cleared before mouseup does not access a missing row index', () => {
  const harness = makeHarness({ rowIndex: 4, measureIndex: 2, activated: true });
  harness.clearSelection();
  assert.doesNotThrow(() => harness.handler({ target: makeEditorTarget(4, 2) }));
  assert.deepEqual(harness.counts(), { clearCount: 0, endCount: 1 });
});

test('a replacement editor after pagination rerender still matches by source row and measure index', () => {
  const harness = makeHarness({ rowIndex: 8, measureIndex: 3, activated: true });
  const replacementDomTarget = makeEditorTarget(8, 3);
  assert.equal(harness.handler({ target: replacementDomTarget }), false);
  assert.deepEqual(harness.counts(), { clearCount: 0, endCount: 0 });
});

test('mouseup outside Sheet clears the pending text interaction and ends selection', () => {
  const harness = makeHarness({ rowIndex: 8, measureIndex: 3, activated: true });
  assert.equal(harness.handler({ target: { closest: () => null } }), true);
  assert.deepEqual(harness.counts(), { clearCount: 1, endCount: 1 });
});

test('repeated mouseup remains safe after the first event clears the interaction', () => {
  const harness = makeHarness({ rowIndex: 8, measureIndex: 3, activated: true });
  assert.doesNotThrow(() => {
    harness.handler({ target: null });
    harness.handler({ target: null });
  });
  assert.deepEqual(harness.counts(), { clearCount: 1, endCount: 2 });
});

test('listener cleanup on unmount removes every global handler and is idempotent', () => {
  const registrations = new Map();
  const eventTarget = {
    addEventListener: (name, handler, capture = false) => {
      registrations.set(`${name}:${capture}`, handler);
    },
    removeEventListener: (name, handler, capture = false) => {
      const key = `${name}:${capture}`;
      if (registrations.get(key) === handler) registrations.delete(key);
    }
  };
  const cleanup = registerSheetMouseUpListeners(eventTarget, () => {});

  assert.deepEqual([...registrations.keys()].sort(), [
    'blur:false',
    'mouseup:true',
    'pointercancel:true',
    'pointerup:true'
  ]);
  cleanup();
  cleanup();
  assert.equal(registrations.size, 0);
});
