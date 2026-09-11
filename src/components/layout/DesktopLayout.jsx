import React from 'react';
import MainSidebar from './MainSidebar'; // ⭐ นำเข้า MainSidebar มาใช้งาน
import { useAuthProfile } from '../../contexts/AuthProfileContext';

const DesktopLayout = ({ children, currentPage, onPageChange }) => {
  const { user, profile: userProfile } = useAuthProfile();

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
