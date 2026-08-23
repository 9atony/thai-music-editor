import React from 'react';
import logo from '../../assets/logo.png';
import { logoutUser } from '../../utils/firebase';

// ฟังก์ชันตัวช่วยสำหรับสร้างไอคอน SVG แบบเส้น (Outline) เพื่อลดความซ้ำซ้อนของโค้ด
const getIconSvg = (pathData) => (
  <svg className="w-[22px] h-[22px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={pathData} />
  </svg>
);

const MainSidebar = ({ currentPage, onPageChange, user, userProfile }) => {
  
  const menuItems = [
    { 
      id: 'home', 
      label: 'หน้าหลัก', 
      icon: getIconSvg("M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6") 
    },
    { 
      id: 'my-projects', 
      label: 'โปรเจกต์ของฉัน', 
      icon: getIconSvg("M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z") 
    },
    { 
      id: 'templates', 
      label: 'เทมเพลต', 
      icon: getIconSvg("M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z") 
    },
    { 
      id: 'samples', 
      label: 'ตัวอย่างเพลง', 
      icon: getIconSvg("M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3") 
    },
    { 
      id: 'tools', 
      label: 'เครื่องมือ', 
      icon: getIconSvg("M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z") 
    },
    { 
      id: 'settings', 
      label: 'การตั้งค่า', 
      icon: getIconSvg("M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z") 
    },
  ];

  const handleLogout = async () => {
    try {
      await logoutUser();
      window.location.href = '/login'; 
    } catch (error) {
      console.error("ออกจากระบบไม่สำเร็จ:", error);
    }
  };

  // ⭐ อัปเดตการออกแบบป้ายยศให้ดูพรีเมียมขึ้น
  const getRoleBadge = () => {
    const role = userProfile?.role || 'user'; 
    if (role === 'premium') {
      return (
        <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-100 to-yellow-50 text-amber-700 border border-amber-200/80 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-[0_1px_2px_rgba(251,191,36,0.15)]">
          <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
          Premium
        </span>
      );
    } else if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 bg-gradient-to-r from-violet-100 to-fuchsia-50 text-violet-700 border border-violet-200/80 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-[0_1px_2px_rgba(139,92,246,0.15)]">
          <svg className="w-3 h-3 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200/80 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        Free Plan
      </span>
    );
  };

  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || "ผู้ใช้งาน";

  return (
    <aside 
      className="w-64 h-screen bg-slate-50 border-r border-slate-200 flex flex-col justify-between hidden md:flex shrink-0 antialiased"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      <div>
        <div className="p-6 flex flex-col items-center border-b border-slate-200/50">
          <img 
            src={logo} 
            alt="Thai Music Editor Logo" 
            className="h-22 w-auto object-contain drop-shadow-sm" 
          />
        </div>

        <nav className="p-4 flex flex-col gap-1.5">
          {menuItems.map((item) => {
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all w-full
                  ${isActive 
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-100 font-bold relative' 
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-medium'
                  }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#3B82F6] rounded-r-full"></div>
                )}
                {item.icon}
                <span className="text-[15px]">{item.label}</span>
              </button>
            );
          })}

          {userProfile?.role === 'admin' && (
            <button 
              onClick={() => onPageChange('admin-users')}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all w-full mt-2
                ${currentPage === 'admin-users' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-100 font-bold relative' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-medium'
                }`}
            >
              {currentPage === 'admin-users' && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-violet-500 rounded-r-full"></div>
              )}
              <div className={`${currentPage === 'admin-users' ? 'text-violet-500' : ''}`}>
                {getIconSvg("M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z")}
              </div>
              <span className="text-[15px]">จัดการผู้ใช้งาน</span>
            </button>
          )}

        </nav>
      </div>

      {/* ⭐ ส่วนล่าง (Profile Card) ที่อัปเดตใหม่ */}
      <div className="p-4 border-t border-slate-200/50 bg-slate-50 relative">
        <div className="flex flex-col gap-1 p-3 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden group">
          
          {/* แสงพื้นหลังอ่อนๆ */}
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-sky-50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

          <div className="flex items-center gap-3 relative z-10 px-1 pt-1">
            <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-black text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] font-extrabold text-slate-800 truncate leading-tight mb-1">{displayName}</h4>
              <div>{getRoleBadge()}</div>
            </div>
          </div>

          <div className="h-px w-full bg-slate-100 my-1.5 relative z-10"></div>

          <button 
            onClick={handleLogout} 
            className="relative z-10 flex items-center justify-between w-full px-2 py-1.5 hover:bg-rose-50 rounded-lg transition-colors text-left group/logout"
            title="ออกจากระบบ"
          >
             <span className="text-[12px] font-bold text-slate-500 group-hover/logout:text-rose-600 transition-colors">ออกจากระบบ</span>
             <svg className="w-4 h-4 text-slate-400 group-hover/logout:text-rose-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default MainSidebar;