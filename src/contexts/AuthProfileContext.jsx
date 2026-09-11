/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, getUserProfile } from '../utils/firebase';
import { cacheUserProfile, invalidateUserProfile, normalizeUserProfile, setProfileAuthUser } from '../utils/profileCache';
import { recordFirestoreRead, startDevTiming } from '../utils/devPerformance';

const AuthProfileContext = createContext({
  user: null,
  profile: null,
  isLoading: true,
  refreshProfile: async () => null,
  invalidateProfile: async () => null
});

export const AuthProfileProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef(null);

  const applyProfile = useCallback((uid, value) => {
    if (userRef.current?.uid !== uid) return null;
    const normalized = normalizeUserProfile(value);
    cacheUserProfile(uid, normalized);
    setProfile(normalized);
    setIsLoading(false);
    return normalized;
  }, []);

  useEffect(() => {
    let unsubscribeProfile = () => {};
    let expirationTimer = null;

    const scheduleExpirationRefresh = (uid, rawProfile) => {
      if (expirationTimer) clearTimeout(expirationTimer);
      expirationTimer = null;
      const expiresAt = rawProfile.premiumUntil?.toDate?.()?.getTime?.();
      if (rawProfile.role !== 'premium' || !(expiresAt > Date.now())) return;
      expirationTimer = setTimeout(() => {
        applyProfile(uid, rawProfile);
        scheduleExpirationRefresh(uid, rawProfile);
      }, Math.min(expiresAt - Date.now() + 50, 2147483647));
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      unsubscribeProfile();
      unsubscribeProfile = () => {};
      if (expirationTimer) clearTimeout(expirationTimer);
      expirationTimer = null;
      userRef.current = nextUser;
      setProfileAuthUser(nextUser?.uid);
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setProfile(null);
      setIsLoading(true);
      const finishTiming = startDevTiming('profile.load', { uid: nextUser.uid });
      let initialProfileMeasured = false;
      unsubscribeProfile = onSnapshot(doc(db, 'users', nextUser.uid), (snapshot) => {
        recordFirestoreRead('profile', 1);
        const rawProfile = snapshot.exists() ? snapshot.data() : { role: 'user' };
        applyProfile(nextUser.uid, rawProfile);
        if (!initialProfileMeasured) {
          initialProfileMeasured = true;
          finishTiming({ source: 'snapshot' });
        }

        if (!rawProfile.displayName && nextUser.displayName) {
          updateDoc(doc(db, 'users', nextUser.uid), { displayName: nextUser.displayName }).catch((error) => {
            console.error('Unable to synchronize profile display name:', error);
          });
        }

        scheduleExpirationRefresh(nextUser.uid, rawProfile);
      }, (error) => {
        console.error('Unable to subscribe to user profile:', error);
        applyProfile(nextUser.uid, { role: 'user' });
        if (!initialProfileMeasured) finishTiming({ error: true });
      });
    });

    return () => {
      unsubscribeProfile();
      unsubscribeAuth();
      if (expirationTimer) clearTimeout(expirationTimer);
    };
  }, [applyProfile]);

  const refreshProfile = useCallback(async () => {
    const uid = userRef.current?.uid;
    if (!uid) return null;
    setIsLoading(true);
    const refreshed = await getUserProfile(uid, { force: true });
    return applyProfile(uid, refreshed || { role: 'user' });
  }, [applyProfile]);

  const invalidateProfile = useCallback(async () => {
    const uid = userRef.current?.uid;
    if (!uid) return null;
    invalidateUserProfile(uid);
    return refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(() => ({
    user,
    profile,
    isLoading,
    refreshProfile,
    invalidateProfile
  }), [user, profile, isLoading, refreshProfile, invalidateProfile]);

  return <AuthProfileContext.Provider value={value}>{children}</AuthProfileContext.Provider>;
};

export const useAuthProfile = () => useContext(AuthProfileContext);
