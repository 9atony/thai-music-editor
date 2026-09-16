import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { 
  getFirestore, collection, query, orderBy, limit, getDocs, 
  addDoc, doc, updateDoc, deleteDoc, serverTimestamp,
  setDoc, getDoc, Timestamp, startAfter, runTransaction, connectFirestoreEmulator
} from 'firebase/firestore'; 
import { configureSystemAnalytics, recordSystemEvent } from './systemAnalytics.js';
import { loadCachedUserProfile, normalizeUserProfile } from './profileCache.js';
import { countDevEvent, recordFirestoreBytes, recordFirestoreRead, startDevTiming } from './devPerformance.js';
import {
  FREE_PROJECT_LIMIT,
  PREMIUM_STORAGE_LIMIT_BYTES,
  PROJECT_CONTENT_DOCUMENT,
  applyStorageMutation,
  assertProjectDocumentSize,
  assertProjectQuota,
  createProjectStorageDocuments,
  estimateLegacyProjectBytes,
  resolveProjectDocuments,
  summarizeAggregate,
  toProjectSummary,
} from './projectStorage.js';

// 1. Firebase Config. Emulator mode is opt-in and uses a synthetic project so
// a local QA run cannot accidentally address the production Firestore project.
const productionFirebaseConfig = {
  apiKey: "AIzaSyBMW-AKd2p41qin2KmHi7skooNsKI2v_kI",
  authDomain: "thai-music-editor.firebaseapp.com",
  projectId: "thai-music-editor",
  storageBucket: "thai-music-editor.firebasestorage.app",
  messagingSenderId: "481298501401",
  appId: "1:481298501401:web:1ff4986d75e31816a0ff88",
  measurementId: "G-V1WXV1KMN0"
};

const viteEnv = import.meta.env || {};
const nodeEnv = globalThis.process?.env || {};
const explicitViteEmulator = Boolean(viteEnv.DEV) && viteEnv.VITE_USE_FIREBASE_EMULATOR === 'true';
const emulatorHostFromNode = nodeEnv.FIRESTORE_EMULATOR_HOST || '';
const useFirebaseEmulator = explicitViteEmulator || Boolean(emulatorHostFromNode);
const emulatorProjectId = viteEnv.VITE_FIREBASE_EMULATOR_PROJECT_ID || 'demo-thai-music-editor';
const firebaseConfig = useFirebaseEmulator
  ? {
      apiKey: 'demo-api-key',
      authDomain: `${emulatorProjectId}.localhost`,
      projectId: emulatorProjectId,
      storageBucket: `${emulatorProjectId}.appspot.com`,
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:emulator',
    }
  : productionFirebaseConfig;

const parseEmulatorAddress = (address, fallbackHost, fallbackPort) => {
  if (!address) return { host: fallbackHost, port: fallbackPort };
  const separator = address.lastIndexOf(':');
  if (separator < 0) return { host: address, port: fallbackPort };
  return {
    host: address.slice(0, separator),
    port: Number(address.slice(separator + 1)) || fallbackPort,
  };
};

// 2. Initialize
const app = initializeApp(firebaseConfig);

// 3. Export Auth และ DB
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);
export const db = getFirestore(app);

if (useFirebaseEmulator) {
  const firestoreAddress = parseEmulatorAddress(
    emulatorHostFromNode,
    viteEnv.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1',
    Number(viteEnv.VITE_FIRESTORE_EMULATOR_PORT) || 8080,
  );
  const authAddress = parseEmulatorAddress(
    nodeEnv.FIREBASE_AUTH_EMULATOR_HOST,
    viteEnv.VITE_FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1',
    Number(viteEnv.VITE_FIREBASE_AUTH_EMULATOR_PORT) || 9099,
  );
  connectFirestoreEmulator(db, firestoreAddress.host, firestoreAddress.port);
  connectAuthEmulator(auth, `http://${authAddress.host}:${authAddress.port}`, { disableWarnings: true });
} else if (typeof window !== 'undefined') {
  const initializeAnalytics = () => {
    import('firebase/analytics')
      .then(({ getAnalytics }) => getAnalytics(app))
      .catch((error) => console.warn('Firebase Analytics is unavailable:', error));
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(initializeAnalytics, { timeout: 5000 });
  else window.setTimeout(initializeAnalytics, 2000);
}
configureSystemAnalytics({ db, auth });

// Firestore rejects `undefined` anywhere in nested objects/arrays. Timeline
// clips may omit optional preview/source metadata, so strip only those values
// while preserving Dates, Timestamps and Firestore FieldValue sentinels.
const stripUndefined = (value) => {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined).map(stripUndefined);
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefined(item)]),
  );
};

// ==========================================
// 🌟 ระบบสมัครสมาชิกและจัดการยศ
// ==========================================

export const registerUser = async (email, password, displayName = "") => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: displayName,
      role: "user", 
      createdAt: serverTimestamp()
    });

    return user;
  } catch (error) {
    console.error("สมัครสมาชิกไม่สำเร็จ:", error);
    throw error;
  }
};

// ⭐ อัปเดตฟังก์ชันดึงโปรไฟล์ ให้เช็กวันหมดอายุและลดระดับอัตโนมัติ
export const getUserProfile = async (uid, { force = false } = {}) => {
  try {
    return await loadCachedUserProfile(uid, async () => {
      const finishTiming = startDevTiming('profile.load', { uid, source: 'getDoc' });
      const docSnap = await getDoc(doc(db, "users", uid));
      recordFirestoreRead('profile', 1);
      finishTiming({ found: docSnap.exists() });
      return normalizeUserProfile(docSnap.exists() ? docSnap.data() : { role: 'user' });
    }, { force });
  } catch (error) {
    console.error("ดึงข้อมูลประวัติไม่สำเร็จ:", error);
    return null;
  }
};

// ==========================================
// 🌟 ระบบจัดการ Premium โดย Admin
// ==========================================

export const upgradeUserToPremium = async (uid, months = 1) => {
  try {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);
    
    let currentExpiration = new Date(); 
    
    if (docSnap.exists()) {
       const userData = docSnap.data();
       if (userData.role === 'premium' && userData.premiumUntil) {
           const existingExpiration = userData.premiumUntil.toDate();
           if (existingExpiration > new Date()) {
               currentExpiration = existingExpiration;
           }
       }
    }

    currentExpiration.setDate(currentExpiration.getDate() + (months * 30));

    await updateDoc(userRef, {
      role: 'premium',
      premiumUntil: Timestamp.fromDate(currentExpiration)
    });
    
    console.log(`อัปเกรด UID: ${uid} เป็น Premium สำเร็จ ถึงวันที่ ${currentExpiration.toLocaleDateString()}`);
    return true;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการอัปเกรด Premium:", error);
    throw error;
  }
};

// ==========================================
// ส่วนจัดการโปรเจกต์
// ==========================================

let storageAggregateInitializers = new WeakMap();
const projectCollection = (uid, database = db) => collection(database, `users/${uid}/projects`);
const projectDocument = (uid, projectId, database = db) => doc(database, `users/${uid}/projects`, projectId);
const projectContentDocument = (uid, projectId, database = db) => doc(database, `users/${uid}/projects/${projectId}/content`, PROJECT_CONTENT_DOCUMENT);
const storageAggregateDocument = (uid, database = db) => doc(database, `users/${uid}/meta`, 'storage');

const aggregateInitializerMap = (database) => {
  let initializers = storageAggregateInitializers.get(database);
  if (!initializers) {
    initializers = new Map();
    storageAggregateInitializers.set(database, initializers);
  }
  return initializers;
};

const mapSummarySnapshot = (snapshot) => {
  const summaries = snapshot.docs.map((projectSnapshot) => toProjectSummary(projectSnapshot.id, projectSnapshot.data()));
  recordFirestoreBytes('project.metadataLoad', snapshot.docs.map((projectSnapshot) => projectSnapshot.data()));
  return summaries;
};

export const fetchProjectSummaries = async (
  uid,
  { pageSize = 20, cursor = null, database = db, recordAnalytics = true } = {},
) => {
  if (!uid) return { projects: [], cursor: null, hasMore: false };
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new RangeError('PROJECT_PAGE_SIZE_INVALID');
  }
  const finishTiming = startDevTiming('project.metadataLoad', { uid, pageSize });
  const clauses = [orderBy('updatedAt', 'desc'), limit(pageSize + 1)];
  if (cursor) clauses.splice(1, 0, startAfter(cursor));
  const snapshot = await getDocs(query(projectCollection(uid, database), ...clauses));
  recordFirestoreRead('project.metadataLoad', snapshot.size);
  const hasMore = snapshot.docs.length > pageSize;
  const pageDocs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
  const projects = mapSummarySnapshot({ docs: pageDocs });
  finishTiming({ documentCount: snapshot.size, returnedCount: projects.length, hasMore });
  if (recordAnalytics) {
    recordSystemEvent('projectListLoads', { feature: 'projectList', reads: snapshot.size });
  }
  return { projects, cursor: pageDocs.at(-1) || null, hasMore };
};

// Consumers such as the Arranger import picker need the complete catalogue,
// but not every project's large editor payload. Drain the metadata pages so
// those screens do not silently omit projects beyond their first page.
export const fetchAllProjectSummaries = async (
  uid,
  { pageSize = 100, database = db, recordAnalytics = true } = {},
) => {
  const projects = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchProjectSummaries(uid, {
      pageSize,
      cursor,
      database,
      recordAnalytics,
    });
    projects.push(...page.projects);
    cursor = page.cursor;
    hasMore = page.hasMore;
  }

  return projects;
};

export const fetchRecentProjects = async (uid) => {
  try {
    const finishTiming = startDevTiming('projects.recent', { uid });
    const snapshot = await getDocs(query(projectCollection(uid), orderBy('updatedAt', 'desc'), limit(5)));
    recordFirestoreRead('recentProjects.metadata', snapshot.size);
    const projects = mapSummarySnapshot(snapshot);
    finishTiming({ documentCount: snapshot.size });
    recordSystemEvent('projectListLoads', { feature: 'projectList', reads: snapshot.size });
    return projects;
  } catch (error) {
    console.error("ดึงข้อมูลไม่สำเร็จ:", error);
    return [];
  }
};

const loadProjectFromSnapshot = async (uid, projectSnapshot, database = db) => {
  const metadata = projectSnapshot.data();
  let content = null;
  if (metadata.contentDocument) {
    const contentSnapshot = await getDoc(projectContentDocument(uid, projectSnapshot.id, database));
    recordFirestoreRead('project.contentLoad', 1);
    if (contentSnapshot.exists()) {
      content = contentSnapshot.data();
      recordFirestoreBytes('project.contentLoad', content);
    }
  }
  return resolveProjectDocuments(projectSnapshot.id, metadata, content);
};

export const fetchProjectById = async (uid, projectId, { summary = null, database = db } = {}) => {
  if (!uid || !projectId) throw new Error('PROJECT_ID_REQUIRED');
  const finishTiming = startDevTiming('project.contentLoad', { uid, projectId });
  let cachedContentMissing = false;
  if (summary && !summary.isLegacy) {
    const contentSnapshot = await getDoc(projectContentDocument(uid, projectId, database));
    recordFirestoreRead('project.contentLoad', 1);
    if (contentSnapshot.exists()) {
      recordFirestoreBytes('project.contentLoad', contentSnapshot.data());
      finishTiming({ found: true, documentCount: 1, source: 'split-cached-metadata' });
      return resolveProjectDocuments(projectId, summary, contentSnapshot.data());
    }
    cachedContentMissing = true;
  }

  const projectSnapshot = await getDoc(projectDocument(uid, projectId, database));
  recordFirestoreRead('project.metadataLoad', 1);
  if (!projectSnapshot.exists()) {
    finishTiming({ found: false, documentCount: 1 });
    return null;
  }
  recordFirestoreBytes('project.metadataLoad', projectSnapshot.data());
  const project = cachedContentMissing
    ? resolveProjectDocuments(projectId, projectSnapshot.data())
    : await loadProjectFromSnapshot(uid, projectSnapshot, database);
  finishTiming({
    found: true,
    documentCount: projectSnapshot.data().contentDocument ? 2 : 1,
    source: projectSnapshot.data().contentDocument ? 'split' : 'legacy',
  });
  return project;
};

// Explicit full-content API for backup/export and arranger import only.
export const fetchAllProjects = async (uid) => {
  const finishTiming = startDevTiming('projects.all', { uid, purpose: 'full-content' });
  const snapshot = await getDocs(query(projectCollection(uid), orderBy('updatedAt', 'desc')));
  recordFirestoreRead('allProjects.metadata', snapshot.size);
  const projects = await Promise.all(snapshot.docs.map((projectSnapshot) => loadProjectFromSnapshot(uid, projectSnapshot)));
  recordFirestoreBytes('projects.all', projects);
  finishTiming({ documentCount: snapshot.size, projectCount: projects.length });
  recordSystemEvent('projectListLoads', { feature: 'projectList', reads: snapshot.size });
  return projects;
};

export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logoutUser = async () => {
  storageAggregateInitializers = new WeakMap();
  if (Capacitor.isNativePlatform()) {
    await FirebaseAuthentication.signOut().catch((error) => {
      console.warn('Native Firebase sign-out did not complete:', error);
    });
  }
  return signOut(auth);
};

export { FREE_PROJECT_LIMIT, PREMIUM_STORAGE_LIMIT_BYTES };

const ensureStorageAggregate = async (uid, database = db) => {
  const initializers = aggregateInitializerMap(database);
  if (initializers.has(uid)) return initializers.get(uid);
  const initialize = (async () => {
    const aggregateRef = storageAggregateDocument(uid, database);
    const aggregateSnapshot = await getDoc(aggregateRef);
    recordFirestoreRead('storage.aggregate', 1);
    if (aggregateSnapshot.exists()) return aggregateSnapshot.data();

    const projectsSnapshot = await getDocs(projectCollection(uid, database));
    recordFirestoreRead('storage.bootstrap', projectsSnapshot.size);
    const baseline = projectsSnapshot.docs.reduce((result, projectSnapshot) => {
      const data = projectSnapshot.data();
      result.projectCount += 1;
      result.storageUsedBytes += Number.isFinite(data.storageSizeBytes)
        ? data.storageSizeBytes
        : estimateLegacyProjectBytes(data);
      return result;
    }, { schemaVersion: 1, projectCount: 0, storageUsedBytes: 0 });

    return runTransaction(database, async (transaction) => {
      const current = await transaction.get(aggregateRef);
      recordFirestoreRead('storage.bootstrapTransaction', 1);
      if (current.exists()) return current.data();
      transaction.set(aggregateRef, { ...baseline, updatedAt: serverTimestamp() });
      return baseline;
    });
  })().catch((error) => {
    initializers.delete(uid);
    throw error;
  });
  initializers.set(uid, initialize);
  return initialize;
};

export const getUserStorageUsage = async (uid, profileOverride = null, { database = db } = {}) => {
  if (!uid) throw new Error('USER_ID_REQUIRED');
  await ensureStorageAggregate(uid, database);
  const [userProfile, aggregateSnapshot] = await Promise.all([
    profileOverride ? Promise.resolve(profileOverride) : getUserProfile(uid),
    getDoc(storageAggregateDocument(uid, database)),
  ]);
  recordFirestoreRead('storageUsage.aggregate', 1);
  const role = userProfile?.role || 'user';
  return summarizeAggregate(role, aggregateSnapshot.exists() ? aggregateSnapshot.data() : {});
};

export const saveProjectToDB = async (
  uid,
  projectId,
  projectData,
  { userProfile: profileOverride = null, database = db, recordAnalytics = true } = {},
) => {
  try {
    const userProfile = profileOverride || await getUserProfile(uid);
    const role = userProfile?.role || 'user';
    await ensureStorageAggregate(uid, database);

    const projectRef = projectId ? projectDocument(uid, projectId, database) : doc(projectCollection(uid, database));
    const contentRef = projectContentDocument(uid, projectRef.id, database);
    const aggregateRef = storageAggregateDocument(uid, database);
    const migrationToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const stored = createProjectStorageDocuments(projectData, uid);
    assertProjectDocumentSize(stored.contentSizeBytes);
    let migratedLegacy = false;
    let originalCreatedAt = null;
    const finishTiming = startDevTiming('quota.transaction', {
      uid,
      projectId: projectRef.id,
      operation: projectId ? 'update' : 'create',
    });

    await runTransaction(database, async (transaction) => {
      const [aggregateSnapshot, existingProjectSnapshot] = await Promise.all([
        transaction.get(aggregateRef),
        transaction.get(projectRef),
      ]);
      recordFirestoreRead('quota.transaction', 2);
      const aggregate = aggregateSnapshot.exists()
        ? aggregateSnapshot.data()
        : { schemaVersion: 1, projectCount: 0, storageUsedBytes: 0 };
      const existedBefore = existingProjectSnapshot.exists();
      const existing = existedBefore ? existingProjectSnapshot.data() : null;
      originalCreatedAt = existing?.createdAt || null;
      const previousSizeBytes = existing
        ? (Number.isFinite(existing.storageSizeBytes) ? existing.storageSizeBytes : estimateLegacyProjectBytes(existing))
        : 0;
      const nextAggregate = applyStorageMutation(aggregate, {
        previousSizeBytes,
        nextSizeBytes: stored.storageSizeBytes,
        existedBefore,
        existsAfter: true,
      });
      assertProjectQuota({ role, ...nextAggregate });
      migratedLegacy = Boolean(existing && !existing.contentDocument && Object.hasOwn(existing, 'sheetData'));

      transaction.set(contentRef, { ...stored.content, migrationToken, updatedAt: serverTimestamp() });
      const metadataWrite = {
        ...stored.metadata,
        migrationToken,
        createdAt: originalCreatedAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (migratedLegacy) transaction.set(projectRef, metadataWrite, { merge: true });
      else transaction.set(projectRef, metadataWrite);
      transaction.set(aggregateRef, {
        schemaVersion: nextAggregate.schemaVersion,
        projectCount: nextAggregate.projectCount,
        storageUsedBytes: nextAggregate.storageUsedBytes,
        updatedAt: serverTimestamp(),
      });
    });

    // Remove the legacy payload only after its replacement committed. The
    // token prevents a stale cleanup from overwriting a newer tab/device save.
    if (migratedLegacy) {
      await cleanupMigratedLegacyProject({
        database,
        projectRef,
        migrationToken,
        metadata: stored.metadata,
        originalCreatedAt,
      });
    }

    finishTiming({ success: true, migratedLegacy, storageSizeBytes: stored.storageSizeBytes });
    countDevEvent('quota.transaction', 1, { operation: projectId ? 'update' : 'create' });
    if (recordAnalytics) {
      if (projectId) {
        recordSystemEvent('projectSaves', { feature: 'autosave', writes: 3, projectId: projectRef.id });
      } else {
        recordSystemEvent('projectsCreated', { feature: 'createProject', writes: 3, projectId: projectRef.id });
        recordSystemEvent('projectSaves');
      }
    }
    return projectRef.id;
  } catch (error) {
    if (error.message !== "STORAGE_LIMIT_EXCEEDED") {
      console.error("บันทึกไม่สำเร็จ:", error);
    }
    throw error;
  }
};

export const cleanupMigratedLegacyProject = async ({
  database = db,
  projectRef,
  migrationToken,
  metadata,
  originalCreatedAt = null,
}) => runTransaction(database, async (transaction) => {
  const current = await transaction.get(projectRef);
  recordFirestoreRead('project.migrationCleanup', 1);
  if (!current.exists() || current.data().migrationToken !== migrationToken) return false;
  transaction.set(projectRef, {
    ...metadata,
    migrationToken,
    createdAt: originalCreatedAt || serverTimestamp(),
    updatedAt: current.data().updatedAt || serverTimestamp(),
  });
  return true;
});

export const renameProjectInDB = async (
  uid,
  projectId,
  name,
  { database = db, recordAnalytics = true } = {},
) => {
  if (!uid || !projectId) throw new Error('PROJECT_ID_REQUIRED');
  await ensureStorageAggregate(uid, database);
  const projectRef = projectDocument(uid, projectId, database);
  const contentRef = projectContentDocument(uid, projectId, database);
  const aggregateRef = storageAggregateDocument(uid, database);

  await runTransaction(database, async (transaction) => {
    const [aggregateSnapshot, projectSnapshot] = await Promise.all([
      transaction.get(aggregateRef),
      transaction.get(projectRef),
    ]);
    if (!projectSnapshot.exists()) throw new Error('PROJECT_NOT_FOUND');
    const existing = projectSnapshot.data();
    const contentSnapshot = existing.contentDocument ? await transaction.get(contentRef) : null;
    recordFirestoreRead('project.renameTransaction', existing.contentDocument ? 3 : 2);
    const aggregate = aggregateSnapshot.exists() ? aggregateSnapshot.data() : {};
    const oldSize = Number.isFinite(existing.storageSizeBytes)
      ? existing.storageSizeBytes
      : estimateLegacyProjectBytes(existing);

    if (existing.contentDocument && contentSnapshot?.exists()) {
      const completeProject = resolveProjectDocuments(projectId, existing, contentSnapshot.data());
      const stored = createProjectStorageDocuments({ ...completeProject, name }, uid);
      const nextAggregate = applyStorageMutation(aggregate, {
        previousSizeBytes: oldSize,
        nextSizeBytes: stored.storageSizeBytes,
        existedBefore: true,
        existsAfter: true,
      });
      transaction.update(projectRef, {
        name,
        storageSizeBytes: stored.storageSizeBytes,
        updatedAt: serverTimestamp(),
      });
      transaction.set(aggregateRef, {
        schemaVersion: nextAggregate.schemaVersion,
        projectCount: nextAggregate.projectCount,
        storageUsedBytes: nextAggregate.storageUsedBytes,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const renamedLegacy = { ...existing, name };
    const nextSize = estimateLegacyProjectBytes(renamedLegacy);
    const nextAggregate = applyStorageMutation(aggregate, {
      previousSizeBytes: oldSize,
      nextSizeBytes: nextSize,
      existedBefore: true,
      existsAfter: true,
    });
    transaction.update(projectRef, { name, storageSizeBytes: nextSize, updatedAt: serverTimestamp() });
    transaction.set(aggregateRef, {
      schemaVersion: nextAggregate.schemaVersion,
      projectCount: nextAggregate.projectCount,
      storageUsedBytes: nextAggregate.storageUsedBytes,
      updatedAt: serverTimestamp(),
    });
  });
  if (recordAnalytics) recordSystemEvent('projectRenames', { feature: 'renameProject', writes: 2, projectId });
};

export const deleteProjectFromDB = async (
  uid,
  projectId,
  { database = db, recordAnalytics = true } = {},
) => {
  if (!uid || !projectId) throw new Error('PROJECT_ID_REQUIRED');
  await ensureStorageAggregate(uid, database);
  const projectRef = projectDocument(uid, projectId, database);
  const contentRef = projectContentDocument(uid, projectId, database);
  const aggregateRef = storageAggregateDocument(uid, database);
  const finishTiming = startDevTiming('quota.transaction', { uid, projectId, operation: 'delete' });

  await runTransaction(database, async (transaction) => {
    const [aggregateSnapshot, projectSnapshot] = await Promise.all([
      transaction.get(aggregateRef),
      transaction.get(projectRef),
    ]);
    recordFirestoreRead('quota.transaction', 2);
    if (!projectSnapshot.exists()) return;
    const existing = projectSnapshot.data();
    const oldSize = Number.isFinite(existing.storageSizeBytes)
      ? existing.storageSizeBytes
      : estimateLegacyProjectBytes(existing);
    const nextAggregate = applyStorageMutation(aggregateSnapshot.exists() ? aggregateSnapshot.data() : {}, {
      previousSizeBytes: oldSize,
      nextSizeBytes: 0,
      existedBefore: true,
      existsAfter: false,
    });
    transaction.delete(contentRef);
    transaction.delete(projectRef);
    transaction.set(aggregateRef, {
      schemaVersion: nextAggregate.schemaVersion,
      projectCount: nextAggregate.projectCount,
      storageUsedBytes: nextAggregate.storageUsedBytes,
      updatedAt: serverTimestamp(),
    });
  });
  finishTiming({ success: true });
  countDevEvent('quota.transaction', 1, { operation: 'delete' });
  if (recordAnalytics) recordSystemEvent('projectsDeleted', { feature: 'deleteProject', deletes: 2 });
};

export const duplicateProjectInDB = async (uid, projectId, name, options = {}) => {
  const { summary = null, database = db, ...saveOptions } = options;
  const source = await fetchProjectById(uid, projectId, { summary, database });
  if (!source) throw new Error('PROJECT_NOT_FOUND');
  return saveProjectToDB(uid, null, { ...source, id: null, projectId: null, name }, { ...saveOptions, database });
};

export const saveSampleToDB = async (sampleId, projectData) => {
  if (!sampleId) throw new Error('SAMPLE_ID_REQUIRED');

  await updateDoc(doc(db, 'samples', sampleId), {
    name: projectData.name || projectData.songName || 'เพลงไม่มีชื่อ',
    fileContent: JSON.stringify(projectData),
    updatedAt: serverTimestamp()
  });
};

// Arranger projects live in their own collection so timeline/mixer data never
// mixes with the sheet projects used by the notation editor.
export const fetchArrangerProjects = async (uid) => {
  if (!uid) return [];
  const projectsRef = collection(db, `users/${uid}/arrangerProjects`);
  const snapshot = await getDocs(query(projectsRef, orderBy('updatedAt', 'desc')));
  recordSystemEvent('projectListLoads', { feature: 'projectList', reads: snapshot.size });
  return snapshot.docs.map((projectDoc) => ({ id: projectDoc.id, ...projectDoc.data() }));
};

export const getArrangerProject = async (uid, projectId) => {
  if (!uid || !projectId) return null;
  const snapshot = await getDoc(doc(db, `users/${uid}/arrangerProjects`, projectId));
  recordSystemEvent('projectOpens', { feature: 'openProject', reads: 1, projectId });
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
};

export const createArrangerProject = async (uid, name = 'โปรเจกต์จัดวงใหม่') => {
  if (!uid) throw new Error('USER_ID_REQUIRED');
  const data = {
    name,
    bpm: 120,
    snapGrid: 1,
    zoomLevel: 100,
    trackLaneHeight: 100,
    masterVolume: 100,
    tracks: [],
    projectType: 'arranger',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const projectRef = await addDoc(collection(db, `users/${uid}/arrangerProjects`), data);
  recordSystemEvent('projectsCreated', { feature: 'createProject', writes: 1, projectId: projectRef.id });
  return { id: projectRef.id, ...data };
};

export const saveArrangerProject = async (uid, projectId, workspace) => {
  if (!uid || !projectId) throw new Error('ARRANGER_PROJECT_REQUIRED');
  const data = stripUndefined({
    ...workspace,
    projectType: 'arranger',
    trackCount: Array.isArray(workspace.tracks) ? workspace.tracks.length : 0,
  });
  assertProjectDocumentSize(new TextEncoder().encode(JSON.stringify(data)).byteLength);
  await updateDoc(doc(db, `users/${uid}/arrangerProjects`, projectId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  recordSystemEvent('projectSaves', { feature: 'autosave', writes: 1, projectId });
};

export const renameArrangerProject = async (uid, projectId, name) => {
  if (!uid || !projectId) throw new Error('ARRANGER_PROJECT_REQUIRED');
  await updateDoc(doc(db, `users/${uid}/arrangerProjects`, projectId), { name, updatedAt: serverTimestamp() });
};

export const deleteArrangerProject = async (uid, projectId) => {
  if (!uid || !projectId) throw new Error('ARRANGER_PROJECT_REQUIRED');
  await deleteDoc(doc(db, `users/${uid}/arrangerProjects`, projectId));
  recordSystemEvent('projectsDeleted', { feature: 'deleteProject', deletes: 1 });
};
