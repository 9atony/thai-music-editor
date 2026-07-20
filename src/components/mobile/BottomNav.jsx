import React from 'react';

const BottomNav = ({ currentPage, onPageChange }) => {
  // จำลองรายการเมนูตามภาพเดโม
  const navItems = [
    { 
      id: 'home', 
      label: 'หน้าหลัก', 
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> 
    },
    { 
      id: 'my-projects', 
      label: 'โปรเจกต์', 
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /> 
    },
    { 
      id: 'templates', 
      label: 'เทมเพลต', 
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /> 
    },
    { 
      id: 'samples', 
      label: 'ตัวอย่างเพลง', 
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /> 
    },
    { 
      id: 'settings', 
      label: 'ตั้งค่า', 
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /> 
    }
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-50 pb-safe">
      <div className="flex justify-between items-center px-2 pt-2 pb-3">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-all"
            >
              <svg 
                className={`w-6 h-6 ${isActive ? 'text-[#EF4444]' : 'text-slate-400'}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {item.icon}
                {/* วาดวงกลมทับไอคอนตั้งค่าเพิ่มนิดหน่อย */}
                {item.id === 'settings' && <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />}
              </svg>
              <span className={`text-[10px] font-bold ${isActive ? 'text-[#EF4444]' : 'text-slate-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;