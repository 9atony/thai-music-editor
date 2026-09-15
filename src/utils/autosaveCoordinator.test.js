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

test('a temporary save failure is retained and retried until it succeeds', async () => {
  const attempts = [];
  const errors = [];
  const coordinator = createAutosaveCoordinator({
    delayMs: 0,
    retryDelays: [5],
    save: async (value) => {
      attempts.push(value.revision);
      if (attempts.length === 1) throw new Error('NETWORK_UNAVAILABLE');
    },
    onError: (error) => errors.push(error.message),
  });
  coordinator.resetBaseline();
  coordinator.markDirty({ revision: 1 });
  await coordinator.whenIdle();

  assert.deepEqual(attempts, [1, 1]);
  assert.deepEqual(errors, ['NETWORK_UNAVAILABLE']);
  assert.equal(coordinator.hasPending(), false);
});

test('a newer edit replaces an older failed revision before retry', async () => {
  const attempts = [];
  let releaseFailure;
  const firstAttempt = new Promise((resolve, reject) => { releaseFailure = () => reject(new Error('OFFLINE')); });
  const coordinator = createAutosaveCoordinator({
    delayMs: 0,
    retryDelays: [20],
    save: async (value) => {
      attempts.push(value.revision);
      if (attempts.length === 1) await firstAttempt;
    },
  });
  coordinator.resetBaseline();
  coordinator.markDirty({ revision: 1 });
  await wait(5);
  coordinator.markDirty({ revision: 2 });
  releaseFailure();
  await coordinator.whenIdle();

  assert.deepEqual(attempts, [1, 2]);
});

test('a non-retryable failure becomes idle and does not loop', async () => {
  let attempts = 0;
  const coordinator = createAutosaveCoordinator({
    delayMs: 0,
    retryDelays: [5],
    save: async () => {
      attempts += 1;
      throw new Error('STORAGE_LIMIT_EXCEEDED');
    },
    onError: () => false,
  });
  coordinator.resetBaseline();
  const saved = await coordinator.saveNow({ revision: 1 });
  await wait(10);

  assert.equal(attempts, 1);
  assert.equal(saved, false);
  assert.equal(coordinator.hasPending(), false);
});

test('saveNow reports success after its target revision is committed', async () => {
  const coordinator = createAutosaveCoordinator({
    delayMs: 0,
    save: async () => {},
  });

  assert.equal(await coordinator.saveNow({ revision: 1 }), true);
});
