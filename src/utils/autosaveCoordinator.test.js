import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutosaveCoordinator } from './autosaveCoordinator.js';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test('restored project establishes a baseline without autosaving', async () => {
  const saved = [];
  const coordinator = createAutosaveCoordinator({
    delayMs: 5,
    save: async (value) => saved.push(value)
  });

  coordinator.markDirty({ revision: 'restored' });
  await wait(15);
  assert.deepEqual(saved, []);

  coordinator.markDirty({ revision: 'edited' });
  await coordinator.whenIdle();
  assert.deepEqual(saved, [{ revision: 'edited' }]);
});

test('rapid edits serialize writes and the latest revision wins', async () => {
  const writes = [];
  let releaseFirst;
  const firstWriteGate = new Promise((resolve) => { releaseFirst = resolve; });
  const coordinator = createAutosaveCoordinator({
    delayMs: 0,
    save: async (value) => {
      writes.push(value.revision);
      if (value.revision === 1) await firstWriteGate;
    }
  });
  coordinator.resetBaseline();

  coordinator.markDirty({ revision: 1 });
  await wait(5);
  coordinator.markDirty({ revision: 2 });
  coordinator.markDirty({ revision: 3 });
  releaseFirst();
  await coordinator.whenIdle();

  assert.deepEqual(writes, [1, 3]);
  assert.equal(writes.at(-1), 3);
});

