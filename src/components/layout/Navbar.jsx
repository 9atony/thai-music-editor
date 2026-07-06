import React, { useContext } from 'react';
import { MusicContext } from '../../contexts/MusicContext';
import PlaybackControls from '../controls/PlaybackControls';

const Navbar = ({ onPrint, onToggleSidebar }) => {
  const { 
    saveProject, 
    loadProject, 
    newProject, 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    stopPlayback // ⭐ 1. ดึง stopPlayback ออกมาจาก MusicContext
  } = useContext(MusicContext);

  return (
    // ⭐ ใช้พื้นหลังกึ่งโปร่งใส + เอฟเฟกต์เบลอ (Glassmorphism) และเงาบางๆ
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm flex flex-col font-sans transition-all">
      
      {/* 🚀 ชั้นที่ 1: แถบเมนูหลัก (คลีน สบายตา) */}
      <div className="px-5 py-3 flex items-center justify-between">
        
        {/* ส่วนซ้าย: เมนูแฮมเบอร์เกอร์ โลโก้ */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onToggleSidebar}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="flex items-center gap-2 select-none">
            <span className="text-2xl drop-shadow-sm">🎼</span>
            {/* ปรับฟอนต์โลโก้ให้ดูโมเดิร์นขึ้น */}
            <h1 className="text-lg font-extrabold tracking-tight text-slate-800 hidden sm:block">
              Thai Music <span className="text-sky-500">Editor</span>
            </h1>
          </div>
        </div>

        {/* ส่วนขวา: ปุ่มคำสั่งต่างๆ (เรียบหรู ไม่มีเส้นขอบกวนตา) */}
        <div className="flex items-center gap-1 sm:gap-2">
          
          {/* กรอบ Undo / Redo */}
          <div className="flex bg-slate-50/50 rounded-lg border border-slate-200 p-0.5 mr-2">
            <button 
              onClick={undo}
              disabled={!canUndo}
              className={`p-1.5 rounded-md flex items-center justify-center transition-all ${canUndo ? 'text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm' : 'text-slate-300 cursor-not-allowed'}`}
              title="ย้อนกลับ (Undo)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            </button>
            <button 
              onClick={redo}
              disabled={!canRedo}
              className={`p-1.5 rounded-md flex items-center justify-center transition-all ${canRedo ? 'text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm' : 'text-slate-300 cursor-not-allowed'}`}
              title="ทำซ้ำ (Redo)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
            </button>
          </div>

          <button 
            onClick={newProject}
            className="flex items-center gap-2 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all active:scale-95"
            title="ล้างข้อมูลและเริ่มโปรเจกต์ใหม่"
          >
            <span className="text-lg">📄</span> <span className="hidden md:inline">กระดาษใหม่</span>
          </button>

          <label className="flex items-center gap-2 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all cursor-pointer active:scale-95">
            <span className="text-lg">📂</span> <span className="hidden md:inline">เปิดไฟล์</span>
            <input 
              type="file" 
              accept=".thai,.tme,.json" // ⭐ เพิ่ม .tme เข้ามาตรงนี้ครับ
              onChange={(e) => {
                loadProject(e.target.files[0]);
                e.target.value = null; 
              }} 
              className="hidden" 
            />
          </label>
          
          <button 
            onClick={saveProject}
            className="flex items-center gap-2 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all active:scale-95"
          >
            <span className="text-lg">💾</span> <span className="hidden md:inline">บันทึก</span>
          </button>
          
          {/* ปุ่มส่งออก - ปรับให้เป็นโทนสีเข้มดูพรีเมียม */}
          <button 
            onClick={() => {
              stopPlayback(); // ⭐ 2. สั่งหยุดเพลงทันที
              onPrint();      // ⭐ 3. จากนั้นค่อยเรียกหน้าต่างสำหรับบันทึก PDF
            }} 
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all shadow-sm hover:shadow-md active:scale-95 ml-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            <span className="hidden md:inline">ส่งออก PDF</span>
          </button>
          
        </div>
      </div>

      {/* 🚀 ชั้นที่ 2: พื้นที่สำหรับควบคุมการเล่นเพลง (โทนสีสว่าง สะอาดตา ผสมผสานกลมกลืน) */}
      <div className="px-5 py-2 bg-slate-50/80 border-t border-slate-100 w-full">
        <PlaybackControls />
      </div>

    </header>
  );
};

export default Navbar;