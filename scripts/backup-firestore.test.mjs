import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore';
import {
  collectFirestore,
  parseArguments,
  serializeFirestoreValue,
} from './backup-firestore.mjs';

const fakeCollection = (path, documents) => ({
  id: path.split('/').at(-1),
  path,
  get: async () => ({ docs: documents }),
});

const fakeDocument = (path, data, subcollections = []) => ({
  id: path.split('/').at(-1),
  data: () => data,
  ref: {
    path,
    listCollections: async () => subcollections,
  },
});

test('backup requires an explicit project and read-only mode before connecting', () => {
  assert.throws(() => parseArguments([]), /--project is required/);
  assert.throws(() => parseArguments(['--project', 'production-id']), /--confirm-readonly/);
  assert.deepEqual(parseArguments(['--project', 'production-id', '--list']), {
    confirmReadonly: false,
    list: true,
    output: null,
    projectId: 'production-id',
  });
});

test('npm config forwarding preserves the documented Windows command', () => {
  assert.deepEqual(parseArguments(['production-id'], {
    npm_config_list: 'true',
    npm_config_project: 'true',
  }), {
    confirmReadonly: false,
    list: true,
    output: null,
    projectId: 'production-id',
  });
  assert.deepEqual(parseArguments(['production-id'], {
    npm_config_confirm_readonly: 'true',
    npm_config_project: 'true',
  }), {
    confirmReadonly: true,
    list: false,
    output: null,
    projectId: 'production-id',
  });
  assert.deepEqual(parseArguments(['production-id', 'backups/custom.json'], {
    npm_config_confirm_readonly: 'true',
    npm_config_output: 'true',
    npm_config_project: 'true',
  }), {
    confirmReadonly: true,
    list: false,
    output: 'backups/custom.json',
    projectId: 'production-id',
  });
});

test('Firestore special values use tagged reversible JSON representations', async () => {
  const app = initializeApp({ projectId: 'serializer-test' }, `serializer-test-${Date.now()}`);
  try {
    const reference = getFirestore(app).doc('users/user-1');
    const serialized = serializeFirestoreValue({
      timestamp: new Timestamp(123, 456),
      point: new GeoPoint(13.7563, 100.5018),
      reference,
      bytes: Buffer.from([0, 1, 255]),
      notANumber: Number.NaN,
    });
    assert.deepEqual(serialized.timestamp, {
      __firestoreType: 'timestamp',
      seconds: 123,
      nanoseconds: 456,
      iso: '1970-01-01T00:02:03.000Z',
    });
    assert.deepEqual(serialized.point, {
      __firestoreType: 'geopoint',
      latitude: 13.7563,
      longitude: 100.5018,
    });
    assert.deepEqual(serialized.reference, {
      __firestoreType: 'document-reference',
      path: 'users/user-1',
    });
    assert.deepEqual(serialized.bytes, {
      __firestoreType: 'bytes',
      encoding: 'base64',
      value: 'AAH/',
    });
    assert.deepEqual(serialized.notANumber, { __firestoreType: 'number', value: 'NaN' });
  } finally {
    await deleteApp(app);
  }
});

test('collection traversal includes every discovered nested subcollection', async () => {
  const content = fakeCollection('users/user-1/projects/project-1/content', [
    fakeDocument('users/user-1/projects/project-1/content/current', { sheetData: '[[]]' }),
  ]);
  const projects = fakeCollection('users/user-1/projects', [
    fakeDocument('users/user-1/projects/project-1', { name: 'Project 1' }, [content]),
  ]);
  const meta = fakeCollection('users/user-1/meta', [
    fakeDocument('users/user-1/meta/storage', { usedBytes: 10 }),
  ]);
  const users = fakeCollection('users', [
    fakeDocument('users/user-1', { role: 'user' }, [projects, meta]),
  ]);
  const activity = fakeCollection('analytics_daily/2026-09-12/activity', [
    fakeDocument('analytics_daily/2026-09-12/activity/user-1', { events: 1 }),
  ]);
  const analytics = fakeCollection('analytics_daily', [
    fakeDocument('analytics_daily/2026-09-12', { visits: 1 }, [activity]),
  ]);
  const database = {
    listCollections: async () => [users, analytics],
  };

  const result = await collectFirestore(database, { includeData: true });

  assert.deepEqual(result.rootCollections, ['analytics_daily', 'users']);
  assert.deepEqual(result.collectionStats, [
    { path: 'analytics_daily', documentCount: 1 },
    { path: 'analytics_daily/2026-09-12/activity', documentCount: 1 },
    { path: 'users', documentCount: 1 },
    { path: 'users/user-1/meta', documentCount: 1 },
    { path: 'users/user-1/projects', documentCount: 1 },
    { path: 'users/user-1/projects/project-1/content', documentCount: 1 },
  ]);
  assert.deepEqual(result.documents.map((document) => document.path), [
    'analytics_daily/2026-09-12',
    'analytics_daily/2026-09-12/activity/user-1',
    'users/user-1',
    'users/user-1/meta/storage',
    'users/user-1/projects/project-1',
    'users/user-1/projects/project-1/content/current',
  ]);
  assert.deepEqual(
    result.documents.find((document) => document.path === 'users/user-1').subcollections,
    ['users/user-1/meta', 'users/user-1/projects'],
  );
});
