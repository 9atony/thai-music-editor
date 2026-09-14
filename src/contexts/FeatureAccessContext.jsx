/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { DEFAULT_FEATURE_ACCESS, DEFAULT_TOOL_MAINTENANCE } from '../data/featureCatalog';

const FEATURE_ACCESS_DOCUMENT = 'feature_access';
export const FeatureAccessContext = createContext({
  access: DEFAULT_FEATURE_ACCESS,
  maintenance: DEFAULT_TOOL_MAINTENANCE,
  isLoading: true,
  canAccess: () => true,
  isUnderMaintenance: () => false,
  saveAccess: async () => {},
  setToolMaintenance: async () => {},
});

export const FeatureAccessProvider = ({ children, role = 'user' }) => {
  const [access, setAccess] = useState(DEFAULT_FEATURE_ACCESS);
  const [maintenance, setMaintenance] = useState(DEFAULT_TOOL_MAINTENANCE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'system_settings', FEATURE_ACCESS_DOCUMENT), (snapshot) => {
      const savedAccess = snapshot.data()?.access;
      const savedMaintenance = snapshot.data()?.maintenance;
      setAccess({ ...DEFAULT_FEATURE_ACCESS, ...(savedAccess || {}) });
      setMaintenance({ ...DEFAULT_TOOL_MAINTENANCE, ...(savedMaintenance || {}) });
      setIsLoading(false);
    }, () => {
      setAccess(DEFAULT_FEATURE_ACCESS);
      setMaintenance(DEFAULT_TOOL_MAINTENANCE);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(() => ({
    access,
    maintenance,
    isLoading,
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
  }), [access, isLoading, maintenance, role]);

  return <FeatureAccessContext.Provider value={value}>{children}</FeatureAccessContext.Provider>;
};

export const useFeatureAccess = () => useContext(FeatureAccessContext);
