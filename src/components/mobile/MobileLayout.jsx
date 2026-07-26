import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import MobileTopBar from './MobileTopBar';
import { auth } from '../../utils/firebase'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';

const MobileLayout = ({ children, currentPage, onPageChange }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false); // เพิ่ม State สำหรับจำลองโหมดมืด

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/login'; 
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleMenuSelect = (page) => {
    setIsSidebarOpen(false);
    if (onPageChange) onPageChange(page);
  };

  return (
    <div 
      className="flex flex-col h-[100dvh] bg-[#F8FAFC] antialiased text-slate-800 relative overflow-hidden"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      
      <MobileTopBar 
        currentPage={currentPage} 
        onPageChange={onPageChange}
        onMenuClick={() => setIsSidebarOpen(true)}
      />
      
      <main className="flex-1 overflow-y-auto w-full relative z-10 pb-[76px] hide-scrollbar">
        {children}
      </main>

      <BottomNav currentPage={currentPage} onPageChange={onPageChange} />

      {/* Mobile Sidebar (Drawer) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
          
          <div className="relative w-[280px] h-full bg-white shadow-2xl flex flex-col animate-slideRight">
            
            {/* 1. ส่วนโปรไฟล์ */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 pt-safe-top">
              <div className="flex items-center gap-4">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-14 h-14 rounded-full border-2 border-white shadow-sm object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center border-2 border-white shadow-sm shrink-0">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">{user?.displayName || user?.email?.split('@')[0] || "ผู้ใช้งาน"}</p>
                  <p className="text-[11px] font-semibold text-[#3B82F6] mt-0.5 bg-blue-50 px-2 py-0.5 rounded-full inline-block">นักดนตรีไทย</p>
                </div>
              </div>
            </div>

            {/* 2. ส่วนรายการเมนูที่เพิ่มเข้ามา */}
            <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
              
              <button onClick={() => handleMenuSelect('home')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${currentPage === 'home' ? 'bg-sky-50 text-[#3B82F6] font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                หน้าหลัก
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-slate-600 hover:bg-slate-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                <div className="flex-1 text-left flex justify-between items-center">
                  <span>พื้นที่จัดเก็บ</span>
                  <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold">120 KB</span>
                </div>
              </button>

              {/* หมวดหมู่: สำหรับการสอน */}
              <div className="pt-4 pb-1 pl-4">
                <p className="text-[10px] font-bold text-slate-400 tracking-wider">สำหรับการสอน</p>
              </div>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-slate-600 hover:bg-slate-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                จัดการชั้นเรียน
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-slate-600 hover:bg-slate-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                คลังใบงานทฤษฎี
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-slate-600 hover:bg-slate-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                แบบประเมินผู้เรียน
              </button>

              {/* หมวดหมู่: ทั่วไป */}
              <div className="pt-4 pb-1 pl-4">
                <p className="text-[10px] font-bold text-slate-400 tracking-wider">ทั่วไป</p>
              </div>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-slate-600 hover:bg-slate-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                <div className="flex-1 text-left flex justify-between items-center">
                  <span>โหมดกลางคืน</span>
                  <div className={`w-8 h-4 rounded-full flex items-center transition-colors ${isDarkMode ? 'bg-sky-500' : 'bg-slate-200'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${isDarkMode ? 'translate-x-4' : 'translate-x-1'}`}></div>
                  </div>
                </div>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-slate-600 hover:bg-slate-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477-4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                คู่มือการใช้งาน
              </button>

            </div>

            {/* 3. ส่วนปุ่มออกจากระบบ */}
            <div className="p-4 border-t border-slate-100 pb-safe">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors text-sm font-bold active:scale-[0.98]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          @keyframes slideRight {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
          .animate-slideRight {
            animation: slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}
      </style>
    </div>
  );
};

export default MobileLayout;