/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { DEFAULT_FEATURE_ACCESS, DEFAULT_TOOL_MAINTENANCE } from '../data/featureCatalog';
import { useAuthProfile } from './AuthProfileContext';

const FEATURE_ACCESS_DOCUMENT = 'feature_access';
const FAIL_CLOSED_TOOL_MAINTENANCE = Object.fromEntries(
  Object.keys(DEFAULT_TOOL_MAINTENANCE).map((featureId) => [featureId, true]),
);
export const FeatureAccessContext = createContext({
  access: DEFAULT_FEATURE_ACCESS,
  maintenance: DEFAULT_TOOL_MAINTENANCE,
  isLoading: true,
  settingsError: null,
  canAccess: () => true,
  isUnderMaintenance: () => false,
  saveAccess: async () => {},
  setToolMaintenance: async () => {},
});

export const FeatureAccessProvider = ({ children, role = 'user' }) => {
  const { user } = useAuthProfile();
  const [access, setAccess] = useState(DEFAULT_FEATURE_ACCESS);
  const [maintenance, setMaintenance] = useState(DEFAULT_TOOL_MAINTENANCE);
  const [isLoading, setIsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(null);

  useEffect(() => {
    let active = true;
    if (!user?.uid) {
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
  }, [user?.uid]);

  const value = useMemo(() => ({
    access,
    maintenance,
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
  }), [access, isLoading, maintenance, role, settingsError]);

  return <FeatureAccessContext.Provider value={value}>{children}</FeatureAccessContext.Provider>;
};

export const useFeatureAccess = () => useContext(FeatureAccessContext);
