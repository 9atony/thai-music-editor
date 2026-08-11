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
  
  // เปลี่ยนจาก Emoji เป็น SVG Path ตามภาพตัวอย่าง
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
      // ไอคอนประแจ (Wrench)
      icon: getIconSvg("M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z") 
    },
    { 
      id: 'settings', 
      label: 'การตั้งค่า', 
      // ไอคอนฟันเฟือง (Gear)
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

  const getRoleBadge = () => {
    const role = userProfile?.role || 'user'; 
    if (role === 'premium') {
      return <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">Premium</span>;
    } else if (role === 'admin') {
      return <span className="bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">Admin</span>;
    }
    return <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Free Plan</span>;
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
                
                {/* เรนเดอร์ไอคอน SVG */}
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
              
              {/* ไอคอนโล่ (Shield) สำหรับแอดมิน */}
              <div className={`${currentPage === 'admin-users' ? 'text-violet-500' : ''}`}>
                {getIconSvg("M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z")}
              </div>
              
              <span className="text-[15px]">จัดการผู้ใช้งาน</span>
            </button>
          )}

        </nav>
      </div>

      <div className="p-4 border-t border-slate-200/50">
        <div className="flex flex-col gap-2">
          
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">👤</span>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="text-sm font-bold text-slate-800 truncate">{displayName}</h4>
              <div className="mt-1">{getRoleBadge()}</div>
            </div>
          </div>

          <button 
            onClick={handleLogout} 
            className="flex items-center justify-between w-full p-2.5 hover:bg-rose-50 rounded-xl transition-colors text-left group border border-transparent hover:border-rose-100 mt-1"
            title="ออกจากระบบ"
          >
             <span className="text-sm font-bold text-slate-400 group-hover:text-rose-600 transition-colors pl-1">ออกจากระบบ</span>
             {/* ไอคอนออกจากระบบ (ประตูและลูกศร) */}
             <svg className="w-5 h-5 text-slate-300 group-hover:text-rose-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
          
        </div>
      </div>
    </aside>
  );
};

export default MainSidebar;