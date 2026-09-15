/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { DEFAULT_FEATURE_ACCESS, DEFAULT_TOOL_MAINTENANCE } from '../data/featureCatalog';
import { isSiteMaintenanceActiveAt, siteMaintenanceEndsAtMs } from '../utils/siteMaintenance';
import { useAuthProfile } from './AuthProfileContext';

const FEATURE_ACCESS_DOCUMENT = 'feature_access';
const SITE_MAINTENANCE_DOCUMENT = 'site_maintenance';
const SITE_MAINTENANCE_LOAD_TIMEOUT_MS = 6000;
const DEFAULT_SITE_MAINTENANCE = Object.freeze({
  enabled: false,
  endsAt: null,
  message: '',
});
const FAIL_CLOSED_TOOL_MAINTENANCE = Object.fromEntries(
  Object.keys(DEFAULT_TOOL_MAINTENANCE).map((featureId) => [featureId, true]),
);
export const FeatureAccessContext = createContext({
  access: DEFAULT_FEATURE_ACCESS,
  maintenance: DEFAULT_TOOL_MAINTENANCE,
  siteMaintenance: DEFAULT_SITE_MAINTENANCE,
  isSiteMaintenanceActive: false,
  isSiteMaintenanceLoading: true,
  siteMaintenanceError: null,
  isLoading: true,
  settingsError: null,
  canAccess: () => true,
  isUnderMaintenance: () => false,
  saveAccess: async () => {},
  setToolMaintenance: async () => {},
  setSiteMaintenance: async () => {},
});

export const FeatureAccessProvider = ({ children, role = 'user' }) => {
  const { user } = useAuthProfile();
  const userId = user?.uid;
  const [access, setAccess] = useState(DEFAULT_FEATURE_ACCESS);
  const [maintenance, setMaintenance] = useState(DEFAULT_TOOL_MAINTENANCE);
  const [isLoading, setIsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(null);
  const [siteMaintenance, setSiteMaintenanceState] = useState(DEFAULT_SITE_MAINTENANCE);
  const [isSiteMaintenanceLoading, setIsSiteMaintenanceLoading] = useState(true);
  const [siteMaintenanceError, setSiteMaintenanceError] = useState(null);
  const [maintenanceClock, setMaintenanceClock] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    const finishSiteMaintenanceLoad = (nextState, error = null) => {
      if (!active) return;
      setSiteMaintenanceState(nextState);
      setSiteMaintenanceError(error);
      setIsSiteMaintenanceLoading(false);
    };
    const loadTimeout = window.setTimeout(() => {
      // A stalled network must not leave the whole public website behind a
      // loading screen forever. The live listener stays active and can still
      // apply the real maintenance state when Firebase reconnects.
      finishSiteMaintenanceLoad(DEFAULT_SITE_MAINTENANCE, new Error('SITE_MAINTENANCE_LOAD_TIMEOUT'));
    }, SITE_MAINTENANCE_LOAD_TIMEOUT_MS);
    const unsubscribe = onSnapshot(doc(db, 'system_settings', SITE_MAINTENANCE_DOCUMENT), (snapshot) => {
      if (!active) return;
      const data = snapshot.data();
      window.clearTimeout(loadTimeout);
      finishSiteMaintenanceLoad(data ? {
        enabled: data.enabled === true,
        endsAt: data.endsAt || null,
        message: typeof data.message === 'string' ? data.message : '',
      } : DEFAULT_SITE_MAINTENANCE);
      setMaintenanceClock(Date.now());
    }, (error) => {
      if (!active) return;
      // Fail open if the public status document cannot be read. A temporary
      // Firebase outage must not accidentally lock every user out of the app.
      console.error('Unable to subscribe to site maintenance:', error);
      window.clearTimeout(loadTimeout);
      finishSiteMaintenanceLoad(DEFAULT_SITE_MAINTENANCE, error);
    });
    return () => {
      active = false;
      window.clearTimeout(loadTimeout);
      unsubscribe();
    };
  }, []);

  const maintenanceEndsAtMs = siteMaintenanceEndsAtMs(siteMaintenance);
  const isSiteMaintenanceActive = isSiteMaintenanceActiveAt(siteMaintenance, maintenanceClock);

  useEffect(() => {
    if (!siteMaintenance.enabled || maintenanceEndsAtMs <= maintenanceClock) return undefined;
    const timeout = window.setTimeout(
      () => setMaintenanceClock(Date.now()),
      Math.min(maintenanceEndsAtMs - maintenanceClock + 100, 2147483647),
    );
    return () => window.clearTimeout(timeout);
  }, [maintenanceClock, maintenanceEndsAtMs, siteMaintenance.enabled]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      queueMicrotask(() => {
        if (!active) return;
        setAccess(DEFAULT_FEATURE_ACCESS);
        setMaintenance(DEFAULT_TOOL_MAINTENANCE);
        setSettingsError(null);
        setIsLoading(false);
      });
      return () => { active = false; };
    }

    queueMicrotask(() => {
      if (active) setIsLoading(true);
    });
    const unsubscribe = onSnapshot(doc(db, 'system_settings', FEATURE_ACCESS_DOCUMENT), (snapshot) => {
      const savedAccess = snapshot.data()?.access;
      const savedMaintenance = snapshot.data()?.maintenance;
      setAccess({ ...DEFAULT_FEATURE_ACCESS, ...(savedAccess || {}) });
      setMaintenance({ ...DEFAULT_TOOL_MAINTENANCE, ...(savedMaintenance || {}) });
      setSettingsError(null);
      setIsLoading(false);
    }, (error) => {
      console.error('Unable to subscribe to feature settings:', error);
      setAccess(DEFAULT_FEATURE_ACCESS);
      setMaintenance(FAIL_CLOSED_TOOL_MAINTENANCE);
      setSettingsError(error);
      setIsLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  const value = useMemo(() => ({
    access,
    maintenance,
    siteMaintenance,
    isSiteMaintenanceActive,
    isSiteMaintenanceLoading,
    siteMaintenanceError,
    isLoading,
    settingsError,
    canAccess: (featureId, requestedRole = role) => {
      if (requestedRole === 'admin') return true;
      const plan = requestedRole === 'premium' ? 'premium' : 'free';
      return access[featureId]?.[plan] === true;
    },
    isUnderMaintenance: (featureId) => maintenance[featureId] === true,
    saveAccess: async (nextAccess) => setDoc(doc(db, 'system_settings', FEATURE_ACCESS_DOCUMENT), {
      access: nextAccess,
      updatedAt: serverTimestamp(),
    }, { merge: true }),
    setToolMaintenance: async (featureId, enabled) => setDoc(
      doc(db, 'system_settings', FEATURE_ACCESS_DOCUMENT),
      {
        maintenance: { [featureId]: enabled },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setSiteMaintenance: async ({ enabled, endsAt, message = '' }) => {
      if (!userId) throw new Error('ADMIN_SESSION_REQUIRED');
      const parsedEndsAt = endsAt instanceof Date ? endsAt : new Date(endsAt);
      if (enabled && (!(parsedEndsAt instanceof Date) || Number.isNaN(parsedEndsAt.getTime()) || parsedEndsAt.getTime() <= Date.now())) {
        throw new Error('MAINTENANCE_END_REQUIRED');
      }
      const safeEndsAt = Number.isNaN(parsedEndsAt.getTime()) ? new Date() : parsedEndsAt;
      return setDoc(doc(db, 'system_settings', SITE_MAINTENANCE_DOCUMENT), {
        enabled: enabled === true,
        endsAt: Timestamp.fromDate(safeEndsAt),
        message: String(message).trim().slice(0, 240),
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    },
  }), [
    access,
    isLoading,
    isSiteMaintenanceActive,
    isSiteMaintenanceLoading,
    maintenance,
    role,
    settingsError,
    siteMaintenance,
    siteMaintenanceError,
    userId,
  ]);

  return <FeatureAccessContext.Provider value={value}>{children}</FeatureAccessContext.Provider>;
};

export const useFeatureAccess = () => useContext(FeatureAccessContext);
