import React from 'react';
import BottomNav from './BottomNav';
import MobileTopBar from './MobileTopBar'; // ⭐ 1. นำเข้า MobileTopBar

const MobileLayout = ({ children, currentPage, onPageChange }) => {
  return (
    <div 
      className="flex flex-col h-[100dvh] bg-[#F8FAFC] antialiased text-slate-800 relative overflow-hidden"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      
      {/* ⭐ 2. เรียกใช้ MobileTopBar ไว้บนสุด */}
      <MobileTopBar currentPage={currentPage} />
      
      {/* ส่วนเนื้อหาหลัก */}
      <main className="flex-1 overflow-y-auto w-full relative z-10 pb-[76px] hide-scrollbar">
        {children}
      </main>

      {/* เรียกใช้ Bottom Navigation */}
      <BottomNav currentPage={currentPage} onPageChange={onPageChange} />

      {/* CSS เล็กๆ สำหรับซ่อน Scrollbar */}
      <style>
        {`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}
      </style>
    </div>
  );
};

export default MobileLayout;