import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FIRESTORE_SAFE_DOCUMENT_LIMIT_BYTES,
  FREE_PROJECT_LIMIT,
  PREMIUM_STORAGE_LIMIT_BYTES,
  applyStorageMutation,
  assertProjectDocumentSize,
  assertProjectQuota,
  createProjectStorageDocuments,
  parseStoredSheetData,
  resolveProjectDocuments,
  summarizeAggregate,
  toProjectSummary,
} from './projectStorage.js';
import { encodeCustomCellToken } from './customKeyboard.js';

const project = (overrides = {}) => ({
  name: 'เพลงทดสอบ',
  songName: 'เพลงทดสอบ',
  currentInstrument: 'ranat-ek',
  sheetData: [[['ด', 'ร']]],
  rowTypes: ['single'],
  symbols: [{ rowIndex: 0, measureIndex: 0 }],
  layoutConfig: { bpm: 120, tempoTrack: [{ bpm: 120 }] },
  ...overrides,
});

const findNestedArrayPaths = (value, path = '$', result = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (Array.isArray(item)) result.push(`${path}[${index}]`);
      findNestedArrayPaths(item, `${path}[${index}]`, result);
    });
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      findNestedArrayPaths(item, `${path}.${key}`, result);
    });
  }
  return result;
};

test('Home summary contains metadata only', () => {
  const stored = createProjectStorageDocuments(project(), 'user-1');
  const summary = toProjectSummary('project-1', stored.metadata);
  assert.equal(summary.id, 'project-1');
  assert.equal(Object.hasOwn(summary, 'sheetData'), false);
});

test('MyProjects summary never exposes sheetData from a legacy document', () => {
  const summary = toProjectSummary('legacy-1', project());
  assert.equal(Object.hasOwn(summary, 'sheetData'), false);
  assert.equal(summary.isLegacy, true);
});

test('project content is separate and can be loaded on demand', () => {
  const stored = createProjectStorageDocuments(project(), 'user-1');
  assert.equal(Object.hasOwn(stored.metadata, 'rowTypes'), false);
  assert.deepEqual(stored.content.rowTypes, ['single']);
});

test('legacy full project remains readable', () => {
  const legacy = project({ sheetData: JSON.stringify([[['ฟ']]]) });
  assert.equal(resolveProjectDocuments('legacy-1', legacy).id, 'legacy-1');
});

test('saving legacy data creates a split representation without changing its content', () => {
  const original = project();
  const stored = createProjectStorageDocuments(original, 'user-1');
  const reopened = resolveProjectDocuments('legacy-1', stored.metadata, stored.content);
  assert.deepEqual(parseStoredSheetData(reopened.sheetData), original.sheetData);
});

test('partially migrated project prefers committed content', () => {
  const legacy = project({ sheetData: JSON.stringify([[['legacy']]]), contentDocument: 'content/current' });
  const content = { sheetData: JSON.stringify([[['new']]]), rowTypes: ['single'] };
  const reopened = resolveProjectDocuments('project-1', legacy, content);
  assert.deepEqual(parseStoredSheetData(reopened.sheetData), [[['new']]]);
});

test('partially migrated project falls back to legacy payload when content is missing', () => {
  const legacy = project({ contentDocument: 'content/current' });
  assert.deepEqual(resolveProjectDocuments('project-1', legacy).sheetData, legacy.sheetData);
});

test('create increments aggregate count and bytes', () => {
  const next = applyStorageMutation({ projectCount: 2, storageUsedBytes: 100 }, {
    nextSizeBytes: 40,
    existedBefore: false,
    existsAfter: true,
  });
  assert.deepEqual([next.projectCount, next.storageUsedBytes], [3, 140]);
});

test('update applies a positive byte delta without changing count', () => {
  const next = applyStorageMutation({ projectCount: 2, storageUsedBytes: 100 }, {
    previousSizeBytes: 20,
    nextSizeBytes: 45,
    existedBefore: true,
    existsAfter: true,
  });
  assert.deepEqual([next.projectCount, next.storageUsedBytes], [2, 125]);
});

test('update applies a negative byte delta without changing count', () => {
  const next = applyStorageMutation({ projectCount: 2, storageUsedBytes: 100 }, {
    previousSizeBytes: 45,
    nextSizeBytes: 20,
    existedBefore: true,
    existsAfter: true,
  });
  assert.deepEqual([next.projectCount, next.storageUsedBytes], [2, 75]);
});

test('delete decrements aggregate count and bytes', () => {
  const next = applyStorageMutation({ projectCount: 2, storageUsedBytes: 100 }, {
    previousSizeBytes: 40,
    nextSizeBytes: 0,
    existedBefore: true,
    existsAfter: false,
  });
  assert.deepEqual([next.projectCount, next.storageUsedBytes], [1, 60]);
});

test('transaction retry semantics use the latest size and do not skew concurrent updates', () => {
  const afterFirst = applyStorageMutation({ projectCount: 1, storageUsedBytes: 10 }, {
    previousSizeBytes: 10, nextSizeBytes: 20, existedBefore: true, existsAfter: true,
  });
  const afterRetriedSecond = applyStorageMutation(afterFirst, {
    previousSizeBytes: 20, nextSizeBytes: 15, existedBefore: true, existsAfter: true,
  });
  assert.equal(afterRetriedSecond.storageUsedBytes, 15);
});

test('a failed mutation cannot change the previous immutable aggregate', () => {
  const current = Object.freeze({ projectCount: 1, storageUsedBytes: 10 });
  applyStorageMutation(current, {
    previousSizeBytes: 10, nextSizeBytes: 99, existedBefore: true, existsAfter: true,
  });
  assert.deepEqual(current, { projectCount: 1, storageUsedBytes: 10 });
});

test('free quota rejects only a count over the limit', () => {
  assert.doesNotThrow(() => assertProjectQuota({ role: 'user', projectCount: FREE_PROJECT_LIMIT, storageUsedBytes: 99999999 }));
  assert.throws(() => assertProjectQuota({ role: 'user', projectCount: FREE_PROJECT_LIMIT + 1, storageUsedBytes: 0 }), /STORAGE_LIMIT_EXCEEDED/);
});

test('premium quota rejects bytes over the limit', () => {
  assert.doesNotThrow(() => assertProjectQuota({ role: 'premium', projectCount: 999, storageUsedBytes: PREMIUM_STORAGE_LIMIT_BYTES }));
  assert.throws(() => assertProjectQuota({ role: 'premium', projectCount: 1, storageUsedBytes: PREMIUM_STORAGE_LIMIT_BYTES + 1 }), /STORAGE_LIMIT_EXCEEDED/);
});

test('a single project document keeps a safety margin below the Firestore hard limit', () => {
  assert.doesNotThrow(() => assertProjectDocumentSize(FIRESTORE_SAFE_DOCUMENT_LIMIT_BYTES));
  assert.throws(
    () => assertProjectDocumentSize(FIRESTORE_SAFE_DOCUMENT_LIMIT_BYTES + 1),
    /PROJECT_TOO_LARGE/,
  );
});

test('.tme editor payload survives a storage round trip unchanged', () => {
  const original = project({
    sectionLabels: { 0: [{ text: 'ท่อน 1' }] },
    sheetData: [[[encodeCustomCellToken('ทิง')]]],
    layoutConfig: {
      bpm: 120,
      tempoTrack: [{ bpm: 120 }],
      customKeyboardKeys: [{ id: 'custom-1', label: 'ทิง' }],
    },
  });
  const stored = createProjectStorageDocuments(original, 'user-1');
  const reopened = resolveProjectDocuments('project-1', stored.metadata, stored.content);
  const restored = { ...reopened, sheetData: parseStoredSheetData(reopened.sheetData) };
  for (const key of Object.keys(original)) assert.deepEqual(restored[key], original[key]);
});

test('canonical content/current is Firestore-safe and restores the original editor payload', () => {
  const original = project({
    sheetData: [[['ด', 'ร'], ['ม', 'ฟ']]],
    playbackSequence: [{ rowIndex: 0, measureIndex: 0 }],
    sectionLabels: { 0: [{ text: 'ท่อนทดสอบ' }] },
  });
  const stored = createProjectStorageDocuments(original, 'user-1');

  assert.equal(typeof stored.content.sheetData, 'string');
  assert.deepEqual(findNestedArrayPaths(stored.content), []);

  const reopened = resolveProjectDocuments('project-1', stored.metadata, stored.content);
  const restored = { ...reopened, sheetData: parseStoredSheetData(reopened.sheetData) };
  for (const key of Object.keys(original)) assert.deepEqual(restored[key], original[key], key);
});

test('migration keeps the original project id', () => {
  const stored = createProjectStorageDocuments(project(), 'user-1');
  assert.equal(resolveProjectDocuments('stable-id', stored.metadata, stored.content).id, 'stable-id');
});

test('mixed legacy and split projects report compatible summaries and aggregate usage', () => {
  const legacySummary = toProjectSummary('legacy', project());
  const split = createProjectStorageDocuments(project({ name: 'new' }), 'user-1');
  const splitSummary = toProjectSummary('new', split.metadata);
  const usage = summarizeAggregate('premium', {
    projectCount: 2,
    storageUsedBytes: legacySummary.storageSizeBytes + splitSummary.storageSizeBytes,
  });
  assert.equal(legacySummary.isLegacy, true);
  assert.equal(splitSummary.isLegacy, false);
  assert.equal(usage.projectCount, 2);
});

test('the real pagination regression fixture survives migrate, export, import and reopen', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('../test/fixtures/pagination-regression.tme', import.meta.url), 'utf8'));
  const stored = createProjectStorageDocuments(fixture, 'user-1');
  const reopened = resolveProjectDocuments(fixture.projectId, stored.metadata, stored.content);
  const roundTrip = JSON.parse(JSON.stringify({ ...reopened, sheetData: parseStoredSheetData(reopened.sheetData) }));
  ['sheetData', 'rowTypes', 'symbols', 'layoutConfig', 'playbackSequence', 'rowMargins', 'sectionLabels']
    .forEach((field) => assert.deepEqual(roundTrip[field], fixture[field], field));
});

test('admin quota policy remains unlimited at every boundary', () => {
  assert.doesNotThrow(() => assertProjectQuota({
    role: 'admin',
    projectCount: FREE_PROJECT_LIMIT + 1000,
    storageUsedBytes: PREMIUM_STORAGE_LIMIT_BYTES * 1000,
  }));
  assert.equal(summarizeAggregate('admin', { projectCount: 500, storageUsedBytes: 999 }).unlimited, true);
});
