import React from 'react';
import logo from '../../assets/logo.png';
import { logoutUser } from '../../utils/firebase';

// ⭐ 1. เพิ่มการรับค่า currentPage และ onPageChange ตรงนี้
const MainSidebar = ({ currentPage, onPageChange }) => {
  
  // ⭐ 2. เอา isActive: true ออก (เพราะเราจะเช็กจาก currentPage แทน)
  // และแก้ id ของโปรเจกต์จาก 'projects' เป็น 'my-projects' ให้ตรงกับ App.jsx
  const menuItems = [
    { id: 'home', label: 'หน้าหลัก', icon: '🏠' },
    { id: 'my-projects', label: 'โปรเจกต์ของฉัน', icon: '📁' },
    { id: 'templates', label: 'เทมเพลต', icon: '🗂️' },
    { id: 'samples', label: 'ตัวอย่างเพลง', icon: '🎵' },
    { id: 'tools', label: 'เครื่องมือ', icon: '🔧' },
    { id: 'settings', label: 'การตั้งค่า', icon: '⚙️' },
  ];

  const handleLogout = async () => {
    try {
      await logoutUser();
      window.location.href = '/login'; 
    } catch (error) {
      console.error("ออกจากระบบไม่สำเร็จ:", error);
    }
  };

  return (
    <aside 
      className="w-64 h-screen bg-slate-50 border-r border-slate-200 flex flex-col justify-between hidden md:flex shrink-0 antialiased"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      
      {/* ส่วนบน: โลโก้ และ เมนู */}
      <div>
        <div className="p-6 flex flex-col items-center border-b border-slate-200/50">
          <img 
            src={logo} 
            alt="Thai Music Editor Logo" 
            className="h-22 w-auto object-contain drop-shadow-sm" 
          />
        </div>

        {/* รายการเมนู */}
        <nav className="p-4 flex flex-col gap-1.5">
          {menuItems.map((item) => {
            // ⭐ 3. สร้างเงื่อนไขเช็กว่าเมนูไหนกำลังถูกเลือกอยู่
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                // ⭐ 4. เพิ่มคำสั่ง onClick เพื่อให้กดเปลี่ยนหน้าได้
                onClick={() => onPageChange(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm w-full
                  ${isActive 
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-100 font-bold relative' 
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-medium'
                  }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#3B82F6] rounded-r-full"></div>
                )}
                <span className="text-lg opacity-90">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200/50">
        <button 
          onClick={handleLogout} 
          className="flex items-center gap-3 w-full p-2 hover:bg-slate-100 rounded-xl transition-colors text-left group"
          title="ออกจากระบบ"
        >
          <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 group-hover:border-rose-300 transition-colors">
            <svg className="w-6 h-6 text-slate-400 group-hover:text-rose-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <div className="flex-1 overflow-hidden">
            <h4 className="text-sm font-bold text-slate-800 truncate">Rattanachai S.</h4>
            <p className="text-[11px] font-medium text-rose-500 truncate tracking-wide">ออกจากระบบ</p>
          </div>
          <svg className="w-4 h-4 text-slate-300 group-hover:text-rose-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>
    </aside>
  );
};

export default MainSidebar;