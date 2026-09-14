import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateLegacyProjectBytes } from '../src/utils/projectStorage.js';

const USAGE = `Usage:
  npm run firebase:reconcile -- --project <project-id> --dry-run
  npm run firebase:reconcile -- --project <project-id> --dry-run --user <uid>
  npm run firebase:reconcile -- --project <project-id> --apply --confirm-write`;

const envFlagEnabled = (value) => value === 'true' || value === '1';

export const parseArguments = (argumentsList, environment = {}) => {
  let npmProjectValuePending = environment.npm_config_project === 'true';
  let npmUserValuePending = environment.npm_config_user === 'true';
  const options = {
    apply: envFlagEnabled(environment.npm_config_apply),
    confirmWrite: envFlagEnabled(environment.npm_config_confirm_write),
    dryRun: envFlagEnabled(environment.npm_config_dry_run),
    projectId: npmProjectValuePending ? null : environment.npm_config_project?.trim() || null,
    userId: npmUserValuePending ? null : environment.npm_config_user?.trim() || null,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--apply') options.apply = true;
    else if (argument === '--confirm-write') options.confirmWrite = true;
    else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--project' || argument === '--user') {
      const value = argumentsList[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}\n${USAGE}`);
      if (argument === '--project') options.projectId = value.trim();
      else options.userId = value.trim();
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      return { ...options, help: true };
    } else if (npmProjectValuePending && !argument.startsWith('--')) {
      options.projectId = argument;
      npmProjectValuePending = false;
    } else if (npmUserValuePending && !argument.startsWith('--')) {
      options.userId = argument;
      npmUserValuePending = false;
    } else {
      throw new Error(`Unknown argument: ${argument}\n${USAGE}`);
    }
  }

  if (!options.projectId) throw new Error(`--project is required. No Firestore connection was opened.\n${USAGE}`);
  if (options.apply === options.dryRun) throw new Error('Choose exactly one of --dry-run or --apply.');
  if (options.apply && !options.confirmWrite) {
    throw new Error('--apply requires --confirm-write. No data was changed.');
  }
  if (options.dryRun && options.confirmWrite) throw new Error('--confirm-write is only valid with --apply.');
  return options;
};

const normalizedStoredSize = (projectData) => (
  Number.isInteger(projectData?.storageSizeBytes) && projectData.storageSizeBytes >= 0
    ? projectData.storageSizeBytes
    : estimateLegacyProjectBytes(projectData)
);

export const summarizeUserStorage = (projectDocuments) => projectDocuments.reduce((summary, project) => ({
  projectCount: summary.projectCount + 1,
  storageUsedBytes: summary.storageUsedBytes + normalizedStoredSize(project),
}), { projectCount: 0, storageUsedBytes: 0 });

export const storageAggregateDrift = (current, expected) => ({
  projectCount: expected.projectCount - (Number.isInteger(current?.projectCount) ? current.projectCount : 0),
  storageUsedBytes: expected.storageUsedBytes
    - (Number.isInteger(current?.storageUsedBytes) ? current.storageUsedBytes : 0),
});

const aggregateMatches = (current, expected) => (
  current?.schemaVersion === 1
  && current.projectCount === expected.projectCount
  && current.storageUsedBytes === expected.storageUsedBytes
);

const readUserState = async (database, userId) => {
  const projectsSnapshot = await database.collection(`users/${userId}/projects`).get();
  const aggregateSnapshot = await database.doc(`users/${userId}/meta/storage`).get();
  const expected = summarizeUserStorage(projectsSnapshot.docs.map((snapshot) => snapshot.data()));
  const current = aggregateSnapshot.exists ? aggregateSnapshot.data() : null;
  return {
    userId,
    current,
    expected,
    drift: storageAggregateDrift(current, expected),
    matches: aggregateMatches(current, expected),
  };
};

const reconcileUser = (database, userId) => database.runTransaction(async (transaction) => {
  const projectsQuery = database.collection(`users/${userId}/projects`);
  const aggregateRef = database.doc(`users/${userId}/meta/storage`);
  const [projectsSnapshot, aggregateSnapshot] = await Promise.all([
    transaction.get(projectsQuery),
    transaction.get(aggregateRef),
  ]);
  const expected = summarizeUserStorage(projectsSnapshot.docs.map((snapshot) => snapshot.data()));
  const current = aggregateSnapshot.exists ? aggregateSnapshot.data() : null;
  if (aggregateMatches(current, expected)) return { changed: false, expected };
  transaction.set(aggregateRef, {
    schemaVersion: 1,
    projectCount: expected.projectCount,
    storageUsedBytes: expected.storageUsedBytes,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { changed: true, expected };
});

export const runReconciliation = async (options, environment = globalThis.process.env) => {
  if (environment.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is set. Refusing to treat emulator data as production.');
  }

  const credential = applicationDefault();
  await credential.getAccessToken();
  const app = initializeApp({
    credential,
    projectId: options.projectId,
  }, `firestore-storage-reconcile-${Date.now()}`);

  try {
    const database = getFirestore(app);
    const userIds = options.userId
      ? [options.userId]
      : (await database.collection('users').get()).docs.map((snapshot) => snapshot.id);
    const results = [];
    const detectedDrift = [];

    for (const userId of userIds) {
      const before = await readUserState(database, userId);
      if (!before.matches) detectedDrift.push(before);
      let changed = false;
      if (options.apply && !before.matches) {
        ({ changed } = await reconcileUser(database, userId));
      }
      const verified = options.apply && changed ? await readUserState(database, userId) : before;
      results.push({ ...verified, changed });
    }

    const residualDrift = results.filter((result) => !result.matches);
    const report = {
      mode: options.apply ? 'apply' : 'dry-run',
      projectId: options.projectId,
      scopedUserId: options.userId,
      usersScanned: results.length,
      usersWithDrift: detectedDrift.length,
      usersChanged: results.filter((result) => result.changed).length,
      usersWithResidualDrift: residualDrift.length,
      drift: detectedDrift,
      residualDrift,
    };
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    await deleteApp(app);
  }
};

const isMainModule = globalThis.process.argv[1]
  && path.resolve(globalThis.process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  try {
    const options = parseArguments(globalThis.process.argv.slice(2), globalThis.process.env);
    if (options.help) console.log(USAGE);
    else await runReconciliation(options);
  } catch (error) {
    console.error(`Reconciliation aborted: ${error.message}`);
    globalThis.process.exitCode = 1;
  }
}
