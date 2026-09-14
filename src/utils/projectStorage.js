export const PROJECT_CONTENT_VERSION = 1;
export const PROJECT_CONTENT_DOCUMENT = 'current';
export const STORAGE_AGGREGATE_VERSION = 1;
export const FREE_PROJECT_LIMIT = 10;
export const PREMIUM_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

const TRANSIENT_FIELDS = new Set([
  'id',
  'projectId',
  'createdAt',
  'updatedAt',
  'ownerId',
  'contentVersion',
  'contentDocument',
  'storageSizeBytes',
  'migrationToken',
]);
const METADATA_FIELDS = new Set(['name', 'songName', 'currentInstrument']);

const utf8Bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

export const normalizeStoredSheetData = (sheetData) => {
  if (typeof sheetData === 'string') return sheetData;
  return JSON.stringify(Array.isArray(sheetData) ? sheetData : []);
};

export const parseStoredSheetData = (sheetData) => {
  if (typeof sheetData !== 'string') return sheetData;
  return JSON.parse(sheetData);
};

export const createProjectStorageDocuments = (projectData, ownerId) => {
  const metadata = {
    name: projectData?.name || projectData?.songName || 'โปรเจกต์ไม่มีชื่อ',
    songName: projectData?.songName || projectData?.name || 'โปรเจกต์ไม่มีชื่อ',
    currentInstrument: projectData?.currentInstrument || null,
    ownerId,
    contentVersion: PROJECT_CONTENT_VERSION,
    contentDocument: `content/${PROJECT_CONTENT_DOCUMENT}`,
  };
  const content = { contentVersion: PROJECT_CONTENT_VERSION };

  Object.entries(projectData || {}).forEach(([key, value]) => {
    if (TRANSIENT_FIELDS.has(key) || METADATA_FIELDS.has(key) || value === undefined) return;
    content[key] = key === 'sheetData' ? normalizeStoredSheetData(value) : value;
  });
  if (!Object.hasOwn(content, 'sheetData')) content.sheetData = normalizeStoredSheetData([]);

  const storageSizeBytes = utf8Bytes({ metadata, content });
  return {
    metadata: { ...metadata, storageSizeBytes },
    content,
    storageSizeBytes,
  };
};

export const estimateLegacyProjectBytes = (projectData) => utf8Bytes(projectData || {});

export const toProjectSummary = (projectId, projectData = {}) => ({
  id: projectId,
  name: projectData.name || projectData.songName || 'โปรเจกต์ไม่มีชื่อ',
  songName: projectData.songName || projectData.name || 'โปรเจกต์ไม่มีชื่อ',
  currentInstrument: projectData.currentInstrument || null,
  ownerId: projectData.ownerId || null,
  createdAt: projectData.createdAt || null,
  updatedAt: projectData.updatedAt || null,
  contentVersion: projectData.contentVersion || 0,
  contentDocument: projectData.contentDocument || null,
  storageSizeBytes: Number.isFinite(projectData.storageSizeBytes)
    ? projectData.storageSizeBytes
    : estimateLegacyProjectBytes(projectData),
  isLegacy: !projectData.contentDocument,
});

export const resolveProjectDocuments = (projectId, metadata, content = null) => {
  if (!metadata) return null;
  if (content) {
    return {
      ...content,
      id: projectId,
      name: metadata.name || metadata.songName,
      songName: metadata.songName || metadata.name,
      currentInstrument: metadata.currentInstrument || content.currentInstrument || null,
      createdAt: metadata.createdAt || null,
      updatedAt: metadata.updatedAt || null,
    };
  }
  if (Object.hasOwn(metadata, 'sheetData')) {
    return { ...metadata, id: projectId };
  }
  const error = new Error('PROJECT_CONTENT_MISSING');
  error.code = 'PROJECT_CONTENT_MISSING';
  throw error;
};

export const applyStorageMutation = (
  aggregate,
  { previousSizeBytes = 0, nextSizeBytes = 0, existedBefore = false, existsAfter = true },
) => {
  const projectDelta = Number(existsAfter) - Number(existedBefore);
  const byteDelta = nextSizeBytes - previousSizeBytes;
  return {
    schemaVersion: STORAGE_AGGREGATE_VERSION,
    projectCount: Math.max(0, (aggregate?.projectCount || 0) + projectDelta),
    storageUsedBytes: Math.max(0, (aggregate?.storageUsedBytes || 0) + byteDelta),
    projectDelta,
    byteDelta,
  };
};

export const assertProjectQuota = ({ role = 'user', projectCount, storageUsedBytes }) => {
  if (role === 'admin') return;
  if (role === 'premium') {
    if (storageUsedBytes > PREMIUM_STORAGE_LIMIT_BYTES) throw new Error('STORAGE_LIMIT_EXCEEDED');
    return;
  }
  if (projectCount > FREE_PROJECT_LIMIT) throw new Error('STORAGE_LIMIT_EXCEEDED');
};

export const summarizeAggregate = (role, aggregate = {}) => {
  const usedBytes = aggregate.storageUsedBytes || 0;
  const projectCount = aggregate.projectCount || 0;
  if (role === 'admin') return { role, usedBytes, projectCount, unlimited: true };
  if (role === 'premium') {
    return {
      role,
      usedBytes,
      projectCount,
      maxBytes: PREMIUM_STORAGE_LIMIT_BYTES,
      remainingBytes: Math.max(PREMIUM_STORAGE_LIMIT_BYTES - usedBytes, 0),
    };
  }
  return {
    role,
    usedBytes,
    projectCount,
    maxProjects: FREE_PROJECT_LIMIT,
    remainingProjects: Math.max(FREE_PROJECT_LIMIT - projectCount, 0),
  };
};
