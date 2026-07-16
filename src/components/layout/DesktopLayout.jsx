import React, { useState, useEffect } from 'react';
import logoImg from '../../assets/logo wep.png';
import { auth } from '../../utils/firebase'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';

// ⭐ 1. รับค่า currentPage และ onPageChange เข้ามาตรงนี้
const DesktopLayout = ({ children, currentPage, onPageChange }) => {
  const [user, setUser] = useState(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      
      {/* Sidebar (แถบเมนูด้านซ้าย) */}
      <aside className="w-[260px] flex flex-col bg-white border-r border-slate-100 h-screen shrink-0">
        
        {/* โลโก้ด้านบน */}
        <div className="pt-10 pb-10 px-8 flex justify-center">
          <img src={logoImg} alt="TME Logo" className="w-[200px] object-contain" />
        </div>

        {/* รายการเมนูหลัก */}
        <div className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto">
          
          {/* ⭐ 2. ปุ่มหน้าหลัก (อัปเดตให้เช็คหน้าปัจจุบัน) */}
          <button 
            onClick={() => onPageChange('home')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl relative group transition-all ${
              currentPage === 'home' ? 'bg-slate-50/80 text-slate-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            {currentPage === 'home' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#EF4444] rounded-r-md"></div>}
            <svg className={`w-5 h-5 ${currentPage === 'home' ? 'text-[#EF4444]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className={`text-[15px] ${currentPage === 'home' ? 'font-semibold' : 'font-medium'}`}>หน้าหลัก</span>
          </button>

          {/* ⭐ 3. ปุ่มโปรเจกต์ของฉัน (อัปเดตให้เช็คหน้าปัจจุบัน) */}
          <button 
            onClick={() => onPageChange('my-projects')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl relative group transition-all ${
              currentPage === 'my-projects' ? 'bg-slate-50/80 text-slate-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            {currentPage === 'my-projects' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#EF4444] rounded-r-md"></div>}
            <svg className={`w-5 h-5 ${currentPage === 'my-projects' ? 'text-[#EF4444]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className={`text-[15px] ${currentPage === 'my-projects' ? 'font-semibold' : 'font-medium'}`}>โปรเจกต์ของฉัน</span>
          </button>

          <button className="w-full flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="font-medium text-[15px]">เทมเพลต</span>
          </button>

          <button className="w-full flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span className="font-medium text-[15px]">ตัวอย่างเพลง</span>
          </button>

          <button className="w-full flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium text-[15px]">เครื่องมือ</span>
          </button>

          <button className="w-full flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium text-[15px]">การตั้งค่า</span>
          </button>

        </div>

        {/* ส่วนโปรไฟล์และปุ่มล็อกเอาต์ */}
        <div className="px-6 py-6 border-t border-slate-100 mt-auto relative">
          
          {/* กล่องเมนูเด้งสำหรับล็อกเอาต์ */}
          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-6 right-6 mb-4 bg-white border border-slate-200 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-2 animate-fadeIn z-50">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors text-sm font-bold group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                ออกจากระบบ
              </button>
            </div>
          )}

          <button 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="w-full flex items-center justify-between group text-left hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full border border-slate-200 object-cover shrink-0"
                  onError={(e) => {
                    // หากลิงก์รูปพัง ให้สลับกลับไปใช้ไอคอนคนแบบ Default อัตโนมัติ
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              
              {/* Default Avatar (แสดงเมื่อไม่มีรูป หรือโหลดรูปไม่สำเร็จ) */}
              <div 
                className={`w-10 h-10 rounded-full bg-slate-50 items-center justify-center border border-slate-200 text-slate-500 shrink-0 ${user?.photoURL ? 'hidden' : 'flex'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {user?.displayName || user?.email?.split('@')[0] || "ผู้ใช้งาน"}
                </p>
                <p className="text-xs font-semibold text-blue-500 mt-0.5">Premium</p>
              </div>
            </div>
            
            <svg 
              className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-all shrink-0 ${isProfileMenuOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

      </aside>

      <main className="flex-1 overflow-y-auto h-full p-8 relative">
        {children}
      </main>

    </div>
  );
};

export default DesktopLayout;