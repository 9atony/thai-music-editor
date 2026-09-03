import React, { useContext, useState } from 'react';
import { MusicContext } from '../../contexts/MusicContext';
import PlaybackControls from "../editor/PlaybackControls";
import logo from '../../assets/logo wep.png';
import pdfIcon from '../../assets/icons/pdf.png';
import saveIcon from '../../assets/icons/save.png';
import newIcon from '../../assets/icons/new.png';
import openIcon from '../../assets/icons/open.png';
import MusicXmlExportDialog from '../editor/MusicXmlExportDialog';

const getPlainText = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const Navbar = ({ onPrint, onOpenSettings, onBack }) => {
  const { 
    saveProject, loadProject, newProject, undo, redo, exportThaiMusicXml, exportMusicXml, importThaiMusicXml,
    canUndo, canRedo, stopPlayback, projectName, setSongName, isReadOnly
  } = useContext(MusicContext);
  const [isMusicXmlDialogOpen, setIsMusicXmlDialogOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm flex flex-col font-sans transition-all">
      <div className="px-5 py-3 flex items-center justify-between gap-4">
        
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <button 
            onClick={onOpenSettings} 
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all active:scale-95"
            title="ตั้งค่าโปรเจกต์"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          <button onClick={onBack} className="p-2 hover:bg-sky-50 rounded-lg text-slate-500 hover:text-sky-600 transition-all active:scale-95 flex items-center justify-center" title="กลับหน้าหลัก">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>

          <div className="flex items-center gap-4 select-none border-r border-slate-200 pr-4">
            <img src={logo} alt="Thai Music Editor Logo" className="h-10 w-auto object-contain" />
          </div>

          <div className="hidden sm:flex items-center gap-3"> {/* ⭐ 2. เพิ่ม gap-3 เพื่อเว้นระยะป้ายเตือน */}
            <input 
              type="text" 
              value={getPlainText(projectName) || ''} 
              onChange={(e) => setSongName(e.target.value)}
              placeholder="โปรเจกต์ไม่มีชื่อ"
              disabled={isReadOnly} 
              className={`text-lg font-bold text-slate-700 bg-transparent border-b-2 border-transparent focus:outline-none focus:ring-0 placeholder:text-slate-300 w-[min(60vw,700px)] transition-colors px-1 py-0.5
                ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-200 focus:border-sky-500'}`}
              title={isReadOnly ? "ไม่สามารถแก้ไขชื่อได้ (อ่านได้อย่างเดียว)" : "คลิกเพื่อเปลี่ยนชื่อเพลง"}
            />

            {isReadOnly && (
              <div className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-50 text-red-500 border border-red-200 animate-pulse whitespace-nowrap shadow-sm">
                ⚠️ พื้นที่เต็ม (อ่านได้อย่างเดียว)
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 [&>*:nth-child(2)]:hidden [&>*:nth-child(3)]:hidden">
          {/* ปุ่มเครื่องมือขวาบน */}
          <div className="flex bg-slate-50/50 rounded-lg border border-slate-200 p-0.5 mr-2">
            <button onClick={undo} disabled={!canUndo || isReadOnly} className={`p-1.5 rounded-md flex items-center justify-center transition-all ${(canUndo && !isReadOnly) ? 'text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm' : 'text-slate-300 cursor-not-allowed'}`} title="ย้อนกลับ (Undo)"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
            <button onClick={redo} disabled={!canRedo || isReadOnly} className={`p-1.5 rounded-md flex items-center justify-center transition-all ${(canRedo && !isReadOnly) ? 'text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm' : 'text-slate-300 cursor-not-allowed'}`} title="ทำซ้ำ (Redo)"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
          </div>

          <button onClick={newProject} className="flex items-center gap-2 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all active:scale-95" title="ล้างข้อมูลและเริ่มโปรเจกต์ใหม่"><img src={newIcon} alt="new" className="w-5 h-5" /> <span className="hidden md:inline">กระดาษใหม่</span></button>

          <label className="flex items-center gap-2 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all cursor-pointer active:scale-95"><img src={openIcon} alt="open" className="w-5 h-5" /> <span className="hidden md:inline">เปิดไฟล์</span><input type="file" accept=".thai,.tme,.json" onChange={(e) => { const file = e.target.files[0]; if (file) { loadProject(file); } e.target.value = null; }} className="hidden" /></label>

          <label className="flex items-center gap-1.5 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-all cursor-pointer active:scale-95" title="นำเข้า ThaiMusicXML v1.0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l4-4m-4 4l-4-4M5 21h14" /></svg>
            <span className="hidden lg:inline">Import TXML</span>
            <input type="file" accept=".txml,application/xml,text/xml" onChange={(e) => { const file = e.target.files[0]; if (file) importThaiMusicXml(file); e.target.value = null; }} className="hidden" />
          </label>
          <button onClick={exportThaiMusicXml} className="flex items-center gap-1.5 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-all active:scale-95" title="ส่งออก ThaiMusicXML v1.0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21V9m0 0l4 4m-4-4l-4 4M5 3h14" /></svg>
            <span className="hidden lg:inline">Export TXML</span>
          </button>
          <button onClick={() => setIsMusicXmlDialogOpen(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-50 hover:text-indigo-800 active:scale-95" title="แปลงเป็นโน้ตสากล MusicXML">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18V5l10-2v13M9 9l10-2M6 21a3 3 0 100-6 3 3 0 000 6zm10-2a3 3 0 100-6 3 3 0 000 6z" /></svg>
            <span className="hidden xl:inline">โน้ตสากล</span>
          </button>
          
          <button onClick={saveProject} className="flex items-center gap-2 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all active:scale-95"><img src={saveIcon} alt="save" className="w-5 h-5" /> <span className="hidden md:inline">บันทึก</span></button>
          
          <button onClick={() => { stopPlayback(); onPrint(); }} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all shadow-sm hover:shadow-md active:scale-95 ml-2"><img src={pdfIcon} alt="pdf" className="w-5 h-5 filter brightness-0 invert" /><span className="hidden md:inline">ส่งออก PDF</span></button>
        </div>
      </div>

      <div className="px-5 py-2 bg-slate-50/80 border-t border-slate-100 w-full">
        <PlaybackControls />
      </div>

      <MusicXmlExportDialog isOpen={isMusicXmlDialogOpen} onClose={() => setIsMusicXmlDialogOpen(false)} onExport={(startingPitch) => exportMusicXml({ startingPitch })} />
    </header>
  );
};

export default Navbar;
