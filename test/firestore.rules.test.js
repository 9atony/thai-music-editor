import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { createProjectStorageDocuments } from '../src/utils/projectStorage.js';

const PROJECT_ID = 'demo-thai-music-editor';
const OWNER_ID = 'owner-user';
const OTHER_ID = 'other-user';
const ADMIN_ID = 'admin-user';
const emulatorAddress = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST || '';
const [emulatorHost, emulatorPortText] = emulatorAddress.split(':');
const emulatorPort = Number(emulatorPortText || 8080);
const hasEmulator = Boolean(emulatorAddress);
const emulatorTest = (name, fn) => test(name, { skip: !hasEmulator }, fn);

let testEnvironment;

const validAggregate = (overrides = {}) => ({
  schemaVersion: 1,
  projectCount: 1,
  storageUsedBytes: 100,
  updatedAt: Timestamp.now(),
  ...overrides,
});

const canonicalProjectDocuments = (note = 'ด') => createProjectStorageDocuments({
  name: 'Project',
  songName: 'Project',
  currentInstrument: 'ranat-ek',
  sheetData: [[[note]]],
  rowTypes: ['single'],
  symbols: [{ rowIndex: 0, measureIndex: 0, symbol: 'accent' }],
}, OWNER_ID);

const seedBaseData = async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const stored = canonicalProjectDocuments();
    await Promise.all([
      setDoc(doc(database, `users/${OWNER_ID}`), { role: 'user', displayName: 'Owner' }),
      setDoc(doc(database, `users/${OTHER_ID}`), { role: 'user', displayName: 'Other' }),
      setDoc(doc(database, `users/${ADMIN_ID}`), { role: 'admin', displayName: 'Admin' }),
      setDoc(doc(database, `users/${OWNER_ID}/projects/project-1`), stored.metadata),
      setDoc(doc(database, `users/${OWNER_ID}/projects/project-1/content/current`), stored.content),
      setDoc(doc(database, `users/${OWNER_ID}/meta/storage`), validAggregate({
        storageUsedBytes: stored.storageSizeBytes,
      })),
    ]);
  });
};

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
});

beforeEach(async () => {
  if (!testEnvironment) return;
  await testEnvironment.clearFirestore();
  await seedBaseData();
});

after(async () => {
  await testEnvironment?.cleanup();
});

emulatorTest('owner can read and write project metadata', async () => {
  const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();
  const projectRef = doc(database, `users/${OWNER_ID}/projects/project-1`);
  await assertSucceeds(getDoc(projectRef));
  await assertSucceeds(updateDoc(projectRef, { name: 'Renamed' }));
});

emulatorTest('owner can read and write content/current', async () => {
  const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();
  const contentRef = doc(database, `users/${OWNER_ID}/projects/project-1/content/current`);
  await assertSucceeds(getDoc(contentRef));
  await assertSucceeds(setDoc(contentRef, canonicalProjectDocuments('ร').content));
});

emulatorTest('owner can read and update a valid storage aggregate', async () => {
  const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();
  const aggregateRef = doc(database, `users/${OWNER_ID}/meta/storage`);
  await assertSucceeds(getDoc(aggregateRef));
  await assertSucceeds(setDoc(aggregateRef, validAggregate({ storageUsedBytes: 120 })));
});

emulatorTest('other user cannot read owner project or content', async () => {
  const database = testEnvironment.authenticatedContext(OTHER_ID).firestore();
  await assertFails(getDoc(doc(database, `users/${OWNER_ID}/projects/project-1`)));
  await assertFails(getDoc(doc(database, `users/${OWNER_ID}/projects/project-1/content/current`)));
});

emulatorTest('other user cannot update owner aggregate', async () => {
  const database = testEnvironment.authenticatedContext(OTHER_ID).firestore();
  await assertFails(setDoc(doc(database, `users/${OWNER_ID}/meta/storage`), validAggregate()));
});

emulatorTest('admin retains project, content and aggregate access', async () => {
  const database = testEnvironment.authenticatedContext(ADMIN_ID).firestore();
  await assertSucceeds(getDoc(doc(database, `users/${OWNER_ID}/projects/project-1`)));
  await assertSucceeds(getDoc(doc(database, `users/${OWNER_ID}/projects/project-1/content/current`)));
  await assertSucceeds(setDoc(
    doc(database, `users/${OWNER_ID}/meta/storage`),
    validAggregate({ projectCount: 2 }),
  ));
});

emulatorTest('only admins can change tool maintenance while signed-in users can read it', async () => {
  const adminDatabase = testEnvironment.authenticatedContext(ADMIN_ID).firestore();
  const ownerDatabase = testEnvironment.authenticatedContext(OWNER_ID).firestore();
  const adminSettingsRef = doc(adminDatabase, 'system_settings/feature_access');
  const ownerSettingsRef = doc(ownerDatabase, 'system_settings/feature_access');

  await assertSucceeds(setDoc(adminSettingsRef, {
    maintenance: { metronome: false },
    updatedAt: Timestamp.now(),
  }, { merge: true }));
  await assertSucceeds(setDoc(adminSettingsRef, {
    maintenance: { arranger: true },
    updatedAt: Timestamp.now(),
  }, { merge: true }));
  const snapshot = await assertSucceeds(getDoc(ownerSettingsRef));
  assert.equal(snapshot.data().maintenance.arranger, true);
  assert.equal(snapshot.data().maintenance.metronome, false);
  await assertFails(setDoc(ownerSettingsRef, {
    maintenance: { arranger: false },
    updatedAt: Timestamp.now(),
  }, { merge: true }));
});

emulatorTest('site maintenance is public but only admins can write a valid schedule', async () => {
  const adminDatabase = testEnvironment.authenticatedContext(ADMIN_ID).firestore();
  const ownerDatabase = testEnvironment.authenticatedContext(OWNER_ID).firestore();
  const publicDatabase = testEnvironment.unauthenticatedContext().firestore();
  const validSchedule = {
    enabled: true,
    endsAt: Timestamp.fromDate(new Date('2099-01-01T00:00:00.000Z')),
    message: 'Scheduled maintenance',
    updatedAt: Timestamp.now(),
    updatedBy: ADMIN_ID,
  };

  await assertSucceeds(setDoc(doc(adminDatabase, 'system_settings/site_maintenance'), validSchedule));
  const publicSnapshot = await assertSucceeds(getDoc(doc(publicDatabase, 'system_settings/site_maintenance')));
  assert.equal(publicSnapshot.data().enabled, true);
  await assertFails(setDoc(doc(ownerDatabase, 'system_settings/site_maintenance'), {
    ...validSchedule,
    updatedBy: OWNER_ID,
  }));
  await assertFails(setDoc(doc(adminDatabase, 'system_settings/site_maintenance'), {
    ...validSchedule,
    unexpected: true,
  }));
  await assertFails(getDoc(doc(publicDatabase, 'system_settings/feature_access')));
});

emulatorTest('invalid storage aggregate values are rejected', async () => {
  const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();
  const aggregateRef = doc(database, `users/${OWNER_ID}/meta/storage`);
  const invalidAggregates = [
    validAggregate({ projectCount: -1 }),
    validAggregate({ storageUsedBytes: -1 }),
    validAggregate({ schemaVersion: 2 }),
    validAggregate({ updatedAt: 'not-a-timestamp' }),
    { ...validAggregate(), unexpected: true },
  ];
  for (const aggregate of invalidAggregates) {
    await assertFails(setDoc(aggregateRef, aggregate));
  }
});

emulatorTest('content documents other than current are rejected', async () => {
  const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();
  await assertFails(setDoc(
    doc(database, `users/${OWNER_ID}/projects/project-1/content/archive`),
    canonicalProjectDocuments().content,
  ));
});

emulatorTest('legacy full parent documents remain owner-readable and writable', async () => {
  const database = testEnvironment.authenticatedContext(OWNER_ID).firestore();
  const legacyRef = doc(database, `users/${OWNER_ID}/projects/legacy-project`);
  await assertSucceeds(setDoc(legacyRef, {
    ownerId: OWNER_ID,
    name: 'Legacy',
    sheetData: JSON.stringify([[['ด']]]),
  }));
  const snapshot = await assertSucceeds(getDoc(legacyRef));
  assert.deepEqual(JSON.parse(snapshot.data().sheetData), [[['ด']]]);
});
