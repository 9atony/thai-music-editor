import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  FREE_PROJECT_LIMIT,
  PREMIUM_STORAGE_LIMIT_BYTES,
  createProjectStorageDocuments,
  normalizeStoredSheetData,
  parseStoredSheetData,
} from '../src/utils/projectStorage.js';

const PROJECT_ID = 'demo-thai-music-editor';
const emulatorAddress = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST || '';
const [emulatorHost, emulatorPortText] = emulatorAddress.split(':');
const emulatorPort = Number(emulatorPortText || 8080);
const hasEmulator = Boolean(emulatorAddress);
const emulatorTest = (name, fn) => test(name, { skip: !hasEmulator }, fn);

let testEnvironment;
let firebaseApi;
let testSequence = 0;
let uid;

const profile = (role = 'user') => ({ role });
const project = (name = 'Project', payload = 'ด') => ({
  name,
  songName: name,
  currentInstrument: 'ranat-ek',
  sheetData: [[[payload]]],
  rowTypes: ['single'],
  symbols: [{ rowIndex: 0, measureIndex: 0, symbol: 'accent' }],
  layoutConfig: { bpm: 120, tempoTrack: [{ bpm: 120 }] },
  playbackSequence: [{ rowIndex: 0, measureIndex: 0 }],
  rowMargins: { 0: 0 },
  sectionLabels: { 0: [{ text: 'ท่อน 1' }] },
});

const legacyFirestoreProject = (projectData) => ({
  ...projectData,
  sheetData: normalizeStoredSheetData(projectData.sheetData),
});

const ownerDatabase = (claims = {}) => testEnvironment
  .authenticatedContext(uid, { clientId: `client-${Math.random()}`, ...claims })
  .firestore();

const seed = async (callback) => testEnvironment.withSecurityRulesDisabled(async (context) => {
  await callback(context.firestore());
});

const seedProfile = async (role = 'user') => seed((database) => setDoc(
  doc(database, `users/${uid}`),
  { role, displayName: uid },
));

const save = (database, projectId, data, role = 'user') => firebaseApi.saveProjectToDB(
  uid,
  projectId,
  data,
  { database, userProfile: profile(role), recordAnalytics: false },
);

const assertAggregateMatchesMetadata = async (database) => {
  const projectsSnapshot = await getDocs(collection(database, `users/${uid}/projects`));
  const expected = projectsSnapshot.docs.reduce((result, snapshot) => ({
    projectCount: result.projectCount + 1,
    storageUsedBytes: result.storageUsedBytes + snapshot.data().storageSizeBytes,
  }), { projectCount: 0, storageUsedBytes: 0 });
  const aggregateSnapshot = await getDoc(doc(database, `users/${uid}/meta/storage`));
  assert.equal(aggregateSnapshot.exists(), true, 'storage aggregate must exist');
  assert.equal(aggregateSnapshot.data().projectCount, expected.projectCount);
  assert.equal(aggregateSnapshot.data().storageUsedBytes, expected.storageUsedBytes);
  assert.equal(aggregateSnapshot.data().schemaVersion, 1);
};

const seedAggregate = async (database, values) => setDoc(
  doc(database, `users/${uid}/meta/storage`),
  {
    schemaVersion: 1,
    projectCount: values.projectCount,
    storageUsedBytes: values.storageUsedBytes,
    updatedAt: Timestamp.now(),
  },
);

before(async () => {
  if (!hasEmulator) return;
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: emulatorHost,
      port: emulatorPort,
      rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
  firebaseApi = await import('../src/utils/firebase.js');
});

beforeEach(async () => {
  if (!testEnvironment) return;
  await testEnvironment.clearFirestore();
  testSequence += 1;
  uid = `phase36-user-${testSequence}`;
  await seedProfile();
});

after(async () => {
  await testEnvironment?.cleanup();
});

emulatorTest('legacy, split, partial and migrated fixtures open and migrate with stable ids', async () => {
  const database = ownerDatabase();
  const legacy = project('Legacy', 'legacy');
  const partial = project('Partial', 'fallback');
  const split = createProjectStorageDocuments(project('Split', 'split'), uid);
  const migrated = createProjectStorageDocuments(project('Migrated', 'migrated'), uid);

  await seed(async (adminDatabase) => {
    await Promise.all([
      setDoc(doc(adminDatabase, `users/${uid}/projects/legacy-id`), {
        ...legacyFirestoreProject(legacy),
        ownerId: uid,
        storageSizeBytes: createProjectStorageDocuments(legacy, uid).storageSizeBytes,
      }),
      setDoc(doc(adminDatabase, `users/${uid}/projects/partial-id`), {
        ...legacyFirestoreProject(partial),
        ownerId: uid,
        contentDocument: 'content/current',
        migrationToken: 'interrupted',
        storageSizeBytes: createProjectStorageDocuments(partial, uid).storageSizeBytes,
      }),
      setDoc(doc(adminDatabase, `users/${uid}/projects/split-id`), split.metadata),
      setDoc(doc(adminDatabase, `users/${uid}/projects/split-id/content/current`), split.content),
      setDoc(doc(adminDatabase, `users/${uid}/projects/migrated-id`), migrated.metadata),
      setDoc(doc(adminDatabase, `users/${uid}/projects/migrated-id/content/current`), migrated.content),
    ]);
  });

  assert.equal((await firebaseApi.fetchProjectById(uid, 'legacy-id', { database })).id, 'legacy-id');
  assert.equal(
    parseStoredSheetData((await firebaseApi.fetchProjectById(uid, 'partial-id', { database })).sheetData)[0][0][0],
    'fallback',
  );
  assert.equal((await firebaseApi.fetchProjectById(uid, 'split-id', { database })).id, 'split-id');
  assert.equal((await firebaseApi.fetchProjectById(uid, 'migrated-id', { database })).id, 'migrated-id');

  assert.equal(await save(database, 'legacy-id', legacy), 'legacy-id');
  assert.equal(await save(database, 'partial-id', partial), 'partial-id');

  for (const projectId of ['legacy-id', 'partial-id']) {
    const parent = await getDoc(doc(database, `users/${uid}/projects/${projectId}`));
    const content = await getDoc(doc(database, `users/${uid}/projects/${projectId}/content/current`));
    assert.equal(parent.id, projectId);
    assert.equal(Object.hasOwn(parent.data(), 'sheetData'), false, `${projectId} legacy payload must be cleaned`);
    assert.equal(content.exists(), true);
  }
  await assertAggregateMatchesMetadata(database);
});

emulatorTest('complete metadata catalogue drains every pagination page without loading content', async () => {
  const database = ownerDatabase();
  await seed(async (adminDatabase) => {
    await Promise.all(['A', 'B', 'C'].map((name, index) => {
      const stored = createProjectStorageDocuments(project(name, name), uid);
      return setDoc(doc(adminDatabase, `users/${uid}/projects/project-${name}`), {
        ...stored.metadata,
        updatedAt: Timestamp.fromMillis(1000 + index),
      });
    }));
  });

  const summaries = await firebaseApi.fetchAllProjectSummaries(uid, {
    database,
    pageSize: 2,
    recordAnalytics: false,
  });
  assert.deepEqual(summaries.map((summary) => summary.name), ['C', 'B', 'A']);
  assert.equal(summaries.every((summary) => !Object.hasOwn(summary, 'sheetData')), true);
});

emulatorTest('create, grow, shrink, rename, duplicate, import overwrite and delete keep aggregate exact', async () => {
  const database = ownerDatabase();
  const firstId = await save(database, null, project('First', 'small'));
  await assertAggregateMatchesMetadata(database);

  await save(database, firstId, project('First', 'x'.repeat(2000)));
  await assertAggregateMatchesMetadata(database);
  await save(database, firstId, project('First', 'x'));
  await assertAggregateMatchesMetadata(database);

  await firebaseApi.renameProjectInDB(uid, firstId, 'Renamed', { database, recordAnalytics: false });
  await assertAggregateMatchesMetadata(database);
  const duplicateId = await firebaseApi.duplicateProjectInDB(uid, firstId, 'Duplicate', {
    database,
    userProfile: profile(),
    recordAnalytics: false,
  });
  await assertAggregateMatchesMetadata(database);

  const importedId = await save(database, null, project('Imported', 'import'));
  await assertAggregateMatchesMetadata(database);
  await save(database, importedId, project('Imported overwrite', 'overwrite'.repeat(50)));
  await assertAggregateMatchesMetadata(database);

  await firebaseApi.deleteProjectFromDB(uid, duplicateId, { database, recordAnalytics: false });
  await assertAggregateMatchesMetadata(database);
});

emulatorTest('concurrent clients update different projects and create two projects without aggregate drift', async () => {
  const databaseA = ownerDatabase({ tab: 'a' });
  const databaseB = ownerDatabase({ tab: 'b' });
  const projectA = await save(databaseA, null, project('A', 'a'));
  const projectB = await save(databaseA, null, project('B', 'b'));

  await Promise.all([
    save(databaseA, projectA, project('A+', 'a'.repeat(400))),
    save(databaseB, projectB, project('B+', 'b'.repeat(800))),
  ]);
  await assertAggregateMatchesMetadata(databaseA);

  await Promise.all([
    save(databaseA, null, project('C', 'c')),
    save(databaseB, null, project('D', 'd')),
  ]);
  await assertAggregateMatchesMetadata(databaseA);
});

emulatorTest('concurrent first creates safely bootstrap a missing aggregate', async () => {
  const databaseA = ownerDatabase({ tab: 'bootstrap-a' });
  const databaseB = ownerDatabase({ tab: 'bootstrap-b' });
  await Promise.all([
    save(databaseA, null, project('First A', 'a')),
    save(databaseB, null, project('First B', 'b')),
  ]);
  await assertAggregateMatchesMetadata(databaseA);
});

emulatorTest('same-project update and delete/save races converge to the committed metadata', async () => {
  const databaseA = ownerDatabase({ tab: 'a' });
  const databaseB = ownerDatabase({ tab: 'b' });
  const projectId = await save(databaseA, null, project('Race', 'initial'));

  await Promise.all([
    save(databaseA, projectId, project('Race A', 'a'.repeat(500))),
    save(databaseB, projectId, project('Race B', 'b'.repeat(1000))),
  ]);
  await assertAggregateMatchesMetadata(databaseA);

  await Promise.all([
    firebaseApi.deleteProjectFromDB(uid, projectId, { database: databaseA, recordAnalytics: false }),
    save(databaseB, projectId, project('Race saved', 'latest')),
  ]);
  await assertAggregateMatchesMetadata(databaseA);
});

emulatorTest('duplicate/create concurrency counts each new project exactly once', async () => {
  const databaseA = ownerDatabase({ tab: 'a' });
  const databaseB = ownerDatabase({ tab: 'b' });
  const sourceId = await save(databaseA, null, project('Source', 'source'));
  await Promise.all([
    firebaseApi.duplicateProjectInDB(uid, sourceId, 'Copy', {
      database: databaseA,
      userProfile: profile(),
      recordAnalytics: false,
    }),
    save(databaseB, null, project('Created', 'created')),
  ]);
  await assertAggregateMatchesMetadata(databaseA);
});

emulatorTest('stale migration cleanup cannot overwrite a newer save token', async () => {
  const database = ownerDatabase();
  const projectRef = doc(database, `users/${uid}/projects/stale-cleanup`);
  const newer = createProjectStorageDocuments(project('Newer', 'newer'), uid);
  await setDoc(projectRef, {
    ...newer.metadata,
    sheetData: normalizeStoredSheetData([[['legacy-copy']]]),
    migrationToken: 'new-token',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  const cleaned = await firebaseApi.cleanupMigratedLegacyProject({
    database,
    projectRef,
    migrationToken: 'old-token',
    metadata: createProjectStorageDocuments(project('Older', 'older'), uid).metadata,
  });
  assert.equal(cleaned, false);
  const current = (await getDoc(projectRef)).data();
  assert.equal(current.migrationToken, 'new-token');
  assert.equal(current.name, 'Newer');
  assert.equal(Object.hasOwn(current, 'sheetData'), true);
});

emulatorTest('failed transactions and denied writes leave project and aggregate unchanged', async () => {
  const database = ownerDatabase();
  const projectId = await save(database, null, project('Safe', 'original'));
  const aggregateRef = doc(database, `users/${uid}/meta/storage`);
  const beforeAggregate = (await getDoc(aggregateRef)).data();

  await assert.rejects(runTransaction(database, async (transaction) => {
    transaction.update(aggregateRef, { projectCount: 99 });
    throw new Error('SIMULATED_TRANSACTION_FAILURE');
  }), /SIMULATED_TRANSACTION_FAILURE/);
  assert.deepEqual((await getDoc(aggregateRef)).data(), beforeAggregate);

  const deniedDatabase = testEnvironment.authenticatedContext('not-the-owner').firestore();
  await assert.rejects(save(deniedDatabase, projectId, project('Denied', 'denied')));
  assert.equal((await firebaseApi.fetchProjectById(uid, projectId, { database })).name, 'Safe');
  assert.deepEqual((await getDoc(aggregateRef)).data(), beforeAggregate);
});

emulatorTest('interrupted migration falls back, then retries without double-counting storage', async () => {
  const database = ownerDatabase();
  const legacy = project('Interrupted', 'legacy-fallback');
  const stored = createProjectStorageDocuments(project('Interrupted', 'committed-content'), uid);
  const projectRef = doc(database, `users/${uid}/projects/interrupted`);
  const contentRef = doc(database, `users/${uid}/projects/interrupted/content/current`);
  const aggregateRef = doc(database, `users/${uid}/meta/storage`);

  await seed(async (adminDatabase) => {
    await setDoc(doc(adminDatabase, projectRef.path), {
      ...legacyFirestoreProject(legacy),
      ownerId: uid,
      storageSizeBytes: createProjectStorageDocuments(legacy, uid).storageSizeBytes,
    });
  });
  assert.equal(
    parseStoredSheetData((await firebaseApi.fetchProjectById(uid, 'interrupted', { database })).sheetData)[0][0][0],
    'legacy-fallback',
  );

  await runTransaction(database, async (transaction) => {
    const existing = await transaction.get(projectRef);
    transaction.set(contentRef, { ...stored.content, migrationToken: 'partial' });
    transaction.set(projectRef, {
      ...existing.data(),
      ...stored.metadata,
      migrationToken: 'partial',
    }, { merge: true });
    transaction.set(aggregateRef, {
      schemaVersion: 1,
      projectCount: 1,
      storageUsedBytes: stored.storageSizeBytes,
      updatedAt: Timestamp.now(),
    });
  });

  assert.equal(
    parseStoredSheetData((await firebaseApi.fetchProjectById(uid, 'interrupted', { database })).sheetData)[0][0][0],
    'committed-content',
  );
  await save(database, 'interrupted', project('Recovered', 'retry'));
  await assertAggregateMatchesMetadata(database);
  assert.equal((await getDoc(aggregateRef)).data().projectCount, 1);
});

emulatorTest('quota boundaries use aggregate state read inside the transaction', async () => {
  const cases = [
    { suffix: 'free-below', role: 'user', count: FREE_PROJECT_LIMIT - 2, succeeds: true },
    { suffix: 'free-equal', role: 'user', count: FREE_PROJECT_LIMIT - 1, succeeds: true },
    { suffix: 'free-over', role: 'user', count: FREE_PROJECT_LIMIT, succeeds: false },
  ];

  for (const quotaCase of cases) {
    uid = `${quotaCase.suffix}-${testSequence}`;
    await seedProfile(quotaCase.role);
    const database = ownerDatabase();
    await seed((adminDatabase) => seedAggregate(adminDatabase, {
      projectCount: quotaCase.count,
      storageUsedBytes: quotaCase.count,
    }));
    const operation = save(database, null, project(quotaCase.suffix), quotaCase.role);
    if (quotaCase.succeeds) await operation;
    else await assert.rejects(operation, /STORAGE_LIMIT_EXCEEDED/);
  }

  const candidate = project('Premium candidate', 'p'.repeat(100));
  const candidateSize = createProjectStorageDocuments(candidate, 'size-probe').storageSizeBytes;
  for (const [suffix, initialBytes, succeeds] of [
    ['premium-below', PREMIUM_STORAGE_LIMIT_BYTES - candidateSize - 1, true],
    ['premium-equal', PREMIUM_STORAGE_LIMIT_BYTES - candidateSize, true],
    ['premium-over', PREMIUM_STORAGE_LIMIT_BYTES - candidateSize + 1, false],
  ]) {
    uid = `${suffix}-${testSequence}`;
    await seedProfile('premium');
    const database = ownerDatabase();
    const actualSize = createProjectStorageDocuments(candidate, uid).storageSizeBytes;
    await seed((adminDatabase) => seedAggregate(adminDatabase, {
      projectCount: 0,
      storageUsedBytes: initialBytes + candidateSize - actualSize,
    }));
    const operation = save(database, null, candidate, 'premium');
    if (succeeds) await operation;
    else await assert.rejects(operation, /STORAGE_LIMIT_EXCEEDED/);
  }

  uid = `premium-shrink-${testSequence}`;
  await seedProfile('premium');
  const premiumDatabase = ownerDatabase();
  const premiumProjectId = await save(
    premiumDatabase,
    null,
    project('Premium shrink', 'large'.repeat(1000)),
    'premium',
  );
  const beforeShrink = (await getDoc(doc(premiumDatabase, `users/${uid}/meta/storage`))).data().storageUsedBytes;
  await save(premiumDatabase, premiumProjectId, project('Premium shrink', 'small'), 'premium');
  const afterShrink = (await getDoc(doc(premiumDatabase, `users/${uid}/meta/storage`))).data().storageUsedBytes;
  assert.ok(afterShrink < beforeShrink);
  await assertAggregateMatchesMetadata(premiumDatabase);

  uid = `admin-unlimited-${testSequence}`;
  await seedProfile('admin');
  const adminDatabase = ownerDatabase();
  await seed((database) => seedAggregate(database, {
    projectCount: FREE_PROJECT_LIMIT + 100,
    storageUsedBytes: PREMIUM_STORAGE_LIMIT_BYTES + 100,
  }));
  await save(adminDatabase, null, project('Admin'), 'admin');
});

emulatorTest('real .tme fixture survives emulator migrate, export, import, save and reopen', async () => {
  const database = ownerDatabase();
  const fixture = JSON.parse(fs.readFileSync(
    new URL('../src/test/fixtures/pagination-regression.tme', import.meta.url),
    'utf8',
  ));
  const legacyId = fixture.projectId || 'pagination-regression';
  const legacyStored = createProjectStorageDocuments(fixture, uid);
  await seed((adminDatabase) => setDoc(doc(adminDatabase, `users/${uid}/projects/${legacyId}`), {
    ...legacyFirestoreProject(fixture),
    ownerId: uid,
    storageSizeBytes: legacyStored.storageSizeBytes,
  }));

  const openedLegacy = await firebaseApi.fetchProjectById(uid, legacyId, { database });
  await save(database, legacyId, openedLegacy);
  const migrated = await firebaseApi.fetchProjectById(uid, legacyId, { database });
  const exported = JSON.stringify({ ...migrated, sheetData: parseStoredSheetData(migrated.sheetData) });
  const imported = JSON.parse(exported);
  const importedId = await save(database, null, imported);
  const reopened = await firebaseApi.fetchProjectById(uid, importedId, { database });

  for (const field of [
    'sheetData',
    'rowTypes',
    'symbols',
    'layoutConfig',
    'tempo',
    'playbackSequence',
    'rowMargins',
    'sectionLabels',
  ]) {
    if (!Object.hasOwn(fixture, field)) continue;
    const actual = field === 'sheetData' ? parseStoredSheetData(reopened[field]) : reopened[field];
    assert.deepEqual(actual, fixture[field], field);
  }
  await assertAggregateMatchesMetadata(database);
});
