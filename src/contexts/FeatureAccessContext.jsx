/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { DEFAULT_FEATURE_ACCESS } from '../data/featureCatalog';

const FEATURE_ACCESS_DOCUMENT = 'feature_access';
export const FeatureAccessContext = createContext({
  access: DEFAULT_FEATURE_ACCESS,
  isLoading: true,
  canAccess: () => true,
  saveAccess: async () => {},
});

export const FeatureAccessProvider = ({ children, role = 'user' }) => {
  const [access, setAccess] = useState(DEFAULT_FEATURE_ACCESS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'system_settings', FEATURE_ACCESS_DOCUMENT), (snapshot) => {
      const savedAccess = snapshot.data()?.access;
      setAccess({ ...DEFAULT_FEATURE_ACCESS, ...(savedAccess || {}) });
      setIsLoading(false);
    }, () => {
      setAccess(DEFAULT_FEATURE_ACCESS);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(() => ({
    access,
    isLoading,
    canAccess: (featureId, requestedRole = role) => {
      if (requestedRole === 'admin') return true;
      const plan = requestedRole === 'premium' ? 'premium' : 'free';
      return access[featureId]?.[plan] === true;
    },
    saveAccess: async (nextAccess) => setDoc(doc(db, 'system_settings', FEATURE_ACCESS_DOCUMENT), {
      access: nextAccess,
      updatedAt: serverTimestamp(),
    }, { merge: true }),
  }), [access, isLoading, role]);

  return <FeatureAccessContext.Provider value={value}>{children}</FeatureAccessContext.Provider>;
};

export const useFeatureAccess = () => useContext(FeatureAccessContext);
