import React from 'react';
// ⭐ 1. นำเข้ารูปโลโก้จากโฟลเดอร์ assets
import logoImg from '../../assets/logo wep.png';

const MobileTopBar = ({ currentPage }) => {
  // ฟังก์ชันสำหรับเลือกแสดงเนื้อหาตรงกลางตามหน้าปัจจุบัน
  const renderCenterContent = () => {
    if (currentPage === 'home') {
      return (
        // ⭐ 2. เปลี่ยนจากตัวหนังสือ เป็นการเรียกใช้แท็ก <img> แทนครับ
        // ตั้งความสูงไว้ที่ h-8 (กำลังสวยสำหรับหน้าจอมือถือ) 
        <img 
          src={logoImg} 
          alt="TME Logo" 
          className="h-8 w-auto object-contain drop-shadow-sm mt-1" 
        />
      );
    }
    if (currentPage === 'my-projects') {
      return <h1 className="text-lg font-bold text-slate-800">โปรเจกต์ของฉัน</h1>;
    }
    return <h1 className="text-lg font-bold text-slate-800">Thai Music Editor</h1>;
  };

  // ฟังก์ชันสำหรับเลือกแสดงไอคอนขวาตามหน้าปัจจุบัน
  const renderRightIcon = () => {
    if (currentPage === 'home') {
      return (
        <button className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {/* จุดแดงแจ้งเตือน */}
          <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
        </button>
      );
    }
    if (currentPage === 'my-projects') {
      return (
        <button className="p-2 text-slate-600 hover:text-slate-900 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      );
    }
    return <div className="w-10"></div>; 
  };

  return (
    <header className="flex items-center justify-between px-4 h-16 bg-white/95 backdrop-blur-md border-b border-slate-100/80 sticky top-0 z-40 transition-all pt-safe">
      {/* ซ้าย: Hamburger Menu */}
      <button className="p-2 -ml-2 text-slate-600 hover:text-slate-900 transition-colors">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* กลาง: Logo / ชื่อหน้า */}
      <div className="flex-1 flex justify-center">
        {renderCenterContent()}
      </div>

      {/* ขวา: Action Icon */}
      <div className="w-10 flex justify-end -mr-2">
        {renderRightIcon()}
      </div>
    </header>
  );
};

export default MobileTopBar;