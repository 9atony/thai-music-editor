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
    // ⭐ แทนที่ Settings ด้วย Tools (ไอคอนเครื่องมือ/ประแจ)
    { 
      id: 'tools', 
      label: 'เครื่องมือ', 
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /> 
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