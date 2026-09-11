let activeUid = null;
let authGeneration = 0;
const cachedProfiles = new Map();
const pendingLoads = new Map();

export const normalizeUserProfile = (profile) => {
  const normalized = profile || { role: 'user' };
  const expiration = normalized.premiumUntil?.toDate?.();
  if (normalized.role === 'premium' && expiration && Date.now() > expiration.getTime()) {
    return { ...normalized, role: 'user' };
  }
  return normalized;
};

export const setProfileAuthUser = (uid) => {
  const nextUid = uid || null;
  if (activeUid === nextUid) return;
  activeUid = nextUid;
  authGeneration += 1;
  cachedProfiles.clear();
  pendingLoads.clear();
};

export const cacheUserProfile = (uid, profile) => {
  if (!uid || (activeUid && activeUid !== uid)) return;
  cachedProfiles.set(uid, normalizeUserProfile(profile));
};

export const loadCachedUserProfile = (uid, loader, { force = false } = {}) => {
  if (!uid) return Promise.resolve(null);
  if (!force && cachedProfiles.has(uid)) return Promise.resolve(cachedProfiles.get(uid));
  if (!force && pendingLoads.has(uid)) return pendingLoads.get(uid);

  const requestGeneration = authGeneration;
  const request = Promise.resolve()
    .then(loader)
    .then((profile) => {
      if (pendingLoads.get(uid) === request) pendingLoads.delete(uid);
      const normalized = normalizeUserProfile(profile);
      if (requestGeneration === authGeneration && (!activeUid || activeUid === uid)) {
        cachedProfiles.set(uid, normalized);
      }
      return normalized;
    }, (error) => {
      if (pendingLoads.get(uid) === request) pendingLoads.delete(uid);
      throw error;
    });
  pendingLoads.set(uid, request);
  return request;
};

export const invalidateUserProfile = (uid) => {
  if (uid) cachedProfiles.delete(uid);
  else cachedProfiles.clear();
};

export const resetProfileCacheForTests = () => {
  activeUid = null;
  authGeneration += 1;
  cachedProfiles.clear();
  pendingLoads.clear();
};
