import React, { useState, useEffect } from 'react';
import MainSidebar from './MainSidebar'; // ⭐ นำเข้า MainSidebar มาใช้งาน
import { auth, getUserProfile } from '../../utils/firebase'; 
import { onAuthStateChanged } from 'firebase/auth';

const DesktopLayout = ({ children, currentPage, onPageChange }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // ดึงข้อมูลผู้ใช้และยศ (Role) เพื่อส่งต่อให้ MainSidebar
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const profileData = await getUserProfile(currentUser.uid);
        setUserProfile(profileData);
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div 
      className="flex h-screen bg-[#F8FAFC] overflow-hidden antialiased text-slate-800"
      style={{ fontFamily: 'Prompt, Noto Sans Thai, sans-serif' }}
    >
      
      {/* ⭐ เรียกใช้ MainSidebar และส่ง Props ที่จำเป็นเข้าไป */}
      <MainSidebar 
        currentPage={currentPage} 
        onPageChange={onPageChange}
        user={user}
        userProfile={userProfile}
      />

      <main className="flex-1 overflow-y-auto h-full relative z-10">
        {children}
      </main>

    </div>
  );
};

export default DesktopLayout;