import { arrayUnion, doc, increment, serverTimestamp, setDoc } from 'firebase/firestore';

let analyticsDb = null;
let analyticsAuth = null;
let flushTimer = null;
let heartbeatTimer = null;
let currentPage = 'unknown';
let pending = {};
let pendingProjectIds = new Set();

const SESSION_KEY = 'tmeAnalyticsSessionDate';
const HEARTBEAT_MS = 5 * 60 * 1000;
const FLUSH_DELAY_MS = 30 * 1000;

const dateKey = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

export const configureSystemAnalytics = ({ db, auth }) => {
  analyticsDb = db;
  analyticsAuth = auth;
};

const queueCount = (field, amount = 1) => {
  pending[field] = (pending[field] || 0) + amount;
};

export const recordSystemEvent = (event, options = {}) => {
  const { feature, reads = 0, writes = 0, deletes = 0, projectId } = options;
  if (projectId) pendingProjectIds.add(String(projectId));
  queueCount(event, 1);
  if (reads) queueCount('trackedReads', reads);
  if (writes) queueCount('trackedWrites', writes);
  if (deletes) queueCount('trackedDeletes', deletes);
  if (feature && reads) queueCount(`feature_${feature}_reads`, reads);
  if (feature && writes) queueCount(`feature_${feature}_writes`, writes);
  if (feature && deletes) queueCount(`feature_${feature}_deletes`, deletes);

  if (!flushTimer) {
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      flushSystemAnalytics();
    }, FLUSH_DELAY_MS);
  }
};

export const flushSystemAnalytics = async () => {
  const uid = analyticsAuth?.currentUser?.uid;
  if (!analyticsDb || !uid || (Object.keys(pending).length === 0 && pendingProjectIds.size === 0)) return;
  const snapshot = pending;
  const projectIds = [...pendingProjectIds];
  pending = {};
  pendingProjectIds = new Set();
  const day = dateKey();
  const increments = Object.fromEntries(
    Object.entries(snapshot).map(([field, amount]) => [field, increment(amount)]),
  );
  try {
    await setDoc(doc(analyticsDb, 'analytics_daily', day, 'activity', uid), {
      uid,
      date: day,
      lastActiveAt: serverTimestamp(),
      lastPage: currentPage,
      ...(projectIds.length > 0 ? { activeProjectIds: arrayUnion(...projectIds) } : {}),
      ...increments,
    }, { merge: true });
  } catch (error) {
    pending = Object.entries(snapshot).reduce((result, [field, amount]) => ({
      ...result,
      [field]: (result[field] || 0) + amount,
    }), pending);
    projectIds.forEach((projectId) => pendingProjectIds.add(projectId));
    console.warn('บันทึกสถิติการใช้งานไม่สำเร็จ:', error);
  }
};

const updatePresence = async () => {
  const user = analyticsAuth?.currentUser;
  if (!analyticsDb || !user) return;
  try {
    await setDoc(doc(analyticsDb, 'analytics_presence', user.uid), {
      uid: user.uid,
      state: 'online',
      lastSeenAt: serverTimestamp(),
      page: currentPage,
    }, { merge: true });
  } catch (error) {
    console.warn('อัปเดตสถานะออนไลน์ไม่สำเร็จ:', error);
  }
};

export const setAnalyticsPage = (page) => {
  currentPage = page || 'unknown';
};

export const startSystemAnalytics = (uid) => {
  if (!uid || !analyticsDb) return () => {};
  const today = dateKey();
  const sessionMarker = `${uid}:${today}`;
  if (sessionStorage.getItem(SESSION_KEY) !== sessionMarker) {
    sessionStorage.setItem(SESSION_KEY, sessionMarker);
    recordSystemEvent('sessions');
  }
  recordSystemEvent('activeSignals');
  updatePresence();
  window.clearInterval(heartbeatTimer);
  heartbeatTimer = window.setInterval(() => {
    recordSystemEvent('activeSignals');
    updatePresence();
    flushSystemAnalytics();
  }, HEARTBEAT_MS);

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') updatePresence();
    else flushSystemAnalytics();
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => {
    window.clearInterval(heartbeatTimer);
    document.removeEventListener('visibilitychange', handleVisibility);
    flushSystemAnalytics();
  };
};

export const recordLoginResult = (successful) => {
  recordSystemEvent(successful ? 'loginSuccess' : 'loginFailure');
};
