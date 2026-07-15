import React, { useContext } from 'react';
import { MusicContext } from '../../contexts/MusicContext';
import PlaybackControls from '../controls/PlaybackControls';
import logo from '../../assets/logo wep.png';
import newIcon from '../../assets/icons/new.png';
import openIcon from '../../assets/icons/open.png';
import pdfIcon from '../../assets/icons/pdf.png';
import saveIcon from '../../assets/icons/save.png';

const Navbar = ({ onPrint, onToggleSidebar, onBack }) => {
  const { 
    saveProject, 
    loadProject, 
    newProject, 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    stopPlayback,
    // ⭐ ดึง State ชื่อโปรเจกต์มาใช้งานที่นี่
    projectName, 
    setProjectName 
  } = useContext(MusicContext);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm flex flex-col font-sans transition-all">
      
      <div className="px-5 py-3 flex items-center justify-between">
        
        {/* ส่วนซ้าย: เมนูแฮมเบอร์เกอร์ + โลโก้ + ชื่อโปรเจกต์ */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onToggleSidebar}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <button 
            onClick={onBack}
            className="p-2 hover:bg-sky-50 rounded-lg text-slate-500 hover:text-sky-600 transition-all active:scale-95 flex items-center justify-center"
            title="กลับหน้าหลัก"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-4 select-none border-r border-slate-200 pr-4">
            <img 
              src={logo} 
              alt="Thai Music Editor Logo" 
              className="h-10 w-auto object-contain" 
            />
          </div>

          {/* ⭐ ส่วนที่เพิ่มใหม่: ช่องสำหรับตั้งชื่อโปรเจกต์ (อยู่หลังโลโก้) */}
          <div className="hidden sm:flex items-center">
            <input 
              type="text" 
              value={projectName || ''} 
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="โปรเจกต์ไม่มีชื่อ"
              className="text-lg font-bold text-slate-700 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-sky-500 focus:outline-none focus:ring-0 placeholder:text-slate-300 w-40 md:w-64 truncate transition-colors px-1 py-0.5"
              title="คลิกเพื่อเปลี่ยนชื่อเพลง"
            />
          </div>
        </div>

        {/* ส่วนขวา: ปุ่มคำสั่งต่างๆ */}
        <div className="flex items-center gap-1 sm:gap-2">
          
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
            <img src={newIcon} alt="new" className="w-5 h-5" /> 
            <span className="hidden md:inline">กระดาษใหม่</span>
          </button>

          <label className="flex items-center gap-2 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all cursor-pointer active:scale-95">
            <img src={openIcon} alt="open" className="w-5 h-5" /> 
            <span className="hidden md:inline">เปิดไฟล์</span>
            <input 
              type="file" 
              accept=".thai,.tme,.json"
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
            <img src={saveIcon} alt="save" className="w-5 h-5" /> 
            <span className="hidden md:inline">บันทึก</span>
          </button>
          
          <button 
            onClick={() => {
              stopPlayback();
              onPrint();
            }} 
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all shadow-sm hover:shadow-md active:scale-95 ml-2"
          >
            <img src={pdfIcon} alt="pdf" className="w-5 h-5 filter brightness-0 invert" />
            <span className="hidden md:inline">ส่งออก PDF</span>
          </button>
          
        </div>
      </div>

      <div className="px-5 py-2 bg-slate-50/80 border-t border-slate-100 w-full">
        <PlaybackControls />
      </div>

    </header>
  );
};

export default Navbar;