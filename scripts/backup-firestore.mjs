import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import {
  DocumentReference,
  GeoPoint,
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore';

export const EXPECTED_ROOT_COLLECTIONS = Object.freeze([
  'analytics_daily',
  'analytics_presence',
  'ranat_dictionary',
  'samples',
  'system_rhythms',
  'system_settings',
  'templates',
  'tuning_dataset',
  'updates',
  'users',
]);

const USAGE = `Usage:
  npm run firebase:backup -- --project <project-id> --list
  npm run firebase:backup -- --project <project-id> --confirm-readonly
  npm run firebase:backup -- --project <project-id> --confirm-readonly --output <file.json>`;

const envFlagEnabled = (value) => value === 'true' || value === '1';

export const parseArguments = (argumentsList, environment = {}) => {
  let npmProjectValuePending = environment.npm_config_project === 'true';
  let npmOutputValuePending = environment.npm_config_output === 'true';
  const npmForwardedProjectId = npmProjectValuePending
    ? null
    : environment.npm_config_project?.trim() || null;
  const npmForwardedOutput = npmOutputValuePending
    ? null
    : environment.npm_config_output || null;
  const options = {
    confirmReadonly: envFlagEnabled(environment.npm_config_confirm_readonly),
    list: envFlagEnabled(environment.npm_config_list),
    output: npmForwardedOutput,
    projectId: environment.FIRESTORE_BACKUP_PROJECT_ID?.trim() || npmForwardedProjectId,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--confirm-readonly') options.confirmReadonly = true;
    else if (argument === '--list') options.list = true;
    else if (argument === '--project' || argument === '--output') {
      const value = argumentsList[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}\n${USAGE}`);
      if (argument === '--project') options.projectId = value.trim();
      else options.output = value;
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      return { ...options, help: true };
    } else if (npmProjectValuePending && !argument.startsWith('--')) {
      // npm on Windows consumes --project as config and forwards its value as a bare argument.
      options.projectId = argument;
      npmProjectValuePending = false;
    } else if (npmOutputValuePending && !argument.startsWith('--')) {
      options.output = argument;
      npmOutputValuePending = false;
    } else {
      throw new Error(`Unknown argument: ${argument}\n${USAGE}`);
    }
  }

  if (!options.projectId) throw new Error(`--project is required. No Firestore connection was opened.\n${USAGE}`);
  if (options.list && options.confirmReadonly) {
    throw new Error('--list and --confirm-readonly are mutually exclusive.');
  }
  if (!options.list && !options.confirmReadonly) {
    throw new Error(`Choose --list or explicitly pass --confirm-readonly. No Firestore connection was opened.\n${USAGE}`);
  }
  if (options.list && options.output) throw new Error('--output is only valid with --confirm-readonly.');
  return options;
};

export const serializeFirestoreValue = (value) => {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean') {
    return value ?? null;
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { __firestoreType: 'number', value: 'NaN' };
    if (value === Infinity) return { __firestoreType: 'number', value: 'Infinity' };
    if (value === -Infinity) return { __firestoreType: 'number', value: '-Infinity' };
    return value;
  }
  if (typeof value === 'bigint') return { __firestoreType: 'bigint', value: value.toString() };
  if (value instanceof Timestamp) {
    return {
      __firestoreType: 'timestamp',
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
      iso: value.toDate().toISOString(),
    };
  }
  if (value instanceof GeoPoint) {
    return {
      __firestoreType: 'geopoint',
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }
  if (value instanceof DocumentReference) {
    return { __firestoreType: 'document-reference', path: value.path };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return {
      __firestoreType: 'bytes',
      encoding: 'base64',
      value: Buffer.from(value).toString('base64'),
    };
  }
  if (value instanceof Date) {
    return { __firestoreType: 'date', iso: value.toISOString() };
  }
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeFirestoreValue(item)]),
    );
  }
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
};

const defaultOutputPath = (date = new Date()) => {
  const timestamp = date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return path.resolve('backups', `firestore-backup-${timestamp}.json`);
};

export const collectFirestore = async (database, { includeData }) => {
  const collectionStats = [];
  const documents = [];
  const rootCollections = (await database.listCollections()).sort((left, right) => left.id.localeCompare(right.id));

  const visitCollection = async (collectionReference) => {
    const snapshot = await collectionReference.get();
    const documentSnapshots = [...snapshot.docs].sort((left, right) => left.id.localeCompare(right.id));
    collectionStats.push({ path: collectionReference.path, documentCount: documentSnapshots.length });

    for (const documentSnapshot of documentSnapshots) {
      const subcollectionReferences = (await documentSnapshot.ref.listCollections())
        .sort((left, right) => left.id.localeCompare(right.id));
      if (includeData) {
        documents.push({
          collectionPath: collectionReference.path,
          id: documentSnapshot.id,
          path: documentSnapshot.ref.path,
          data: serializeFirestoreValue(documentSnapshot.data()),
          subcollections: subcollectionReferences.map((reference) => reference.path),
        });
      }
      for (const subcollectionReference of subcollectionReferences) {
        await visitCollection(subcollectionReference);
      }
    }
  };

  for (const collectionReference of rootCollections) await visitCollection(collectionReference);

  collectionStats.sort((left, right) => left.path.localeCompare(right.path));
  documents.sort((left, right) => left.path.localeCompare(right.path));
  return {
    rootCollections: rootCollections.map((reference) => reference.id),
    collectionStats,
    documents,
  };
};

export const runBackup = async (options, environment = globalThis.process.env) => {
  if (environment.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is set. Refusing to label emulator data as a production backup.');
  }

  const startedAt = Date.now();
  const credentialSource = environment.GOOGLE_APPLICATION_CREDENTIALS
    ? 'GOOGLE_APPLICATION_CREDENTIALS'
    : 'Application Default Credentials';
  const credential = applicationDefault();
  await credential.getAccessToken();
  const app = initializeApp({
    credential,
    projectId: options.projectId,
  }, `firestore-readonly-backup-${Date.now()}`);

  try {
    const database = getFirestore(app);
    const collected = await collectFirestore(database, { includeData: !options.list });
    const totalDocuments = collected.collectionStats.reduce(
      (total, collectionInfo) => total + collectionInfo.documentCount,
      0,
    );
    const missingExpectedCollections = EXPECTED_ROOT_COLLECTIONS.filter(
      (collectionId) => !collected.rootCollections.includes(collectionId),
    );

    if (options.list) {
      console.log(JSON.stringify({
        mode: 'list-only',
        projectId: options.projectId,
        authMethod: credentialSource,
        rootCollections: collected.rootCollections,
        missingExpectedCollections,
        collections: collected.collectionStats,
        totalCollections: collected.collectionStats.length,
        totalDocuments,
        elapsedMs: Date.now() - startedAt,
      }, null, 2));
      return { totalCollections: collected.collectionStats.length, totalDocuments, outputBytes: 0, outputPath: null };
    }

    const exportedAt = new Date();
    const output = {
      format: 'thai-music-editor/firestore-backup',
      formatVersion: 1,
      projectId: options.projectId,
      exportedAt: exportedAt.toISOString(),
      authMethod: credentialSource,
      expectedRootCollections: EXPECTED_ROOT_COLLECTIONS,
      missingExpectedCollections,
      rootCollections: collected.rootCollections,
      collections: collected.collectionStats,
      documents: collected.documents,
    };
    const json = `${JSON.stringify(output, null, 2)}\n`;
    const outputPath = path.resolve(options.output || defaultOutputPath(exportedAt));
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, json, { encoding: 'utf8', flag: 'wx' });
    const result = {
      totalCollections: collected.collectionStats.length,
      totalDocuments,
      outputBytes: Buffer.byteLength(json, 'utf8'),
      outputPath,
      elapsedMs: Date.now() - startedAt,
    };
    console.log(JSON.stringify({ mode: 'backup-complete', projectId: options.projectId, ...result }, null, 2));
    return result;
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
    else await runBackup(options);
  } catch (error) {
    console.error(`Backup aborted: ${error.message}`);
    globalThis.process.exitCode = 1;
  }
}
