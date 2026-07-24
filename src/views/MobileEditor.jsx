import React, { useContext } from 'react';
import { MusicContext } from '../contexts/MusicContext';

const MobileEditor = ({ onBack }) => {
  const { songName, isPlaying, togglePlay } = useContext(MusicContext);

  return (
    <div className="flex flex-col h-screen bg-slate-50 w-full overflow-hidden" style={{ fontFamily: 'Prompt, sans-serif' }}>
      
      {/* 1. Top Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-2 shrink-0 z-20">
        <button 
          onClick={onBack}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
        
        <div className="flex-1 text-center px-2 truncate">
          <span className="font-bold text-slate-800 text-sm truncate">{songName || "โปรเจกต์ไม่มีชื่อ"}</span>
        </div>

        <button 
          onClick={togglePlay}
          className={`p-2 rounded-full text-white ${isPlaying ? 'bg-rose-500' : 'bg-emerald-500'} shadow-sm`}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd"/></svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg>
          )}
        </button>
      </header>

      {/* 2. Sheet Area (พื้นที่ตารางโน้ต) */}
      <main className="flex-1 overflow-auto bg-slate-100 p-2">
        <div className="min-w-max bg-white p-4 rounded-xl shadow-sm border border-slate-200">
           {/* เดี๋ยวเราจะเอา Component ตารางโน้ต (Sheet.jsx) มาใส่ตรงนี้ครับ */}
           <div className="h-64 flex items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
              [พื้นที่แสดงตารางกระดาษโน้ต]
           </div>
        </div>
      </main>

      {/* 3. Bottom Keyboard (แผงปุ่มคีย์บอร์ดด้านล่าง) */}
      <footer className="bg-white border-t border-slate-200 p-2 shrink-0 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
         <div className="grid grid-cols-7 gap-1 h-12">
            {['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'].map(note => (
               <button key={note} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm active:scale-95 transition-transform">
                  {note}
               </button>
            ))}
         </div>
         <div className="flex gap-2 mt-2 h-10">
            <button className="flex-1 bg-sky-50 text-sky-600 font-bold rounded-lg text-xs border border-sky-100">ย้อนกลับ</button>
            <button className="flex-1 bg-slate-100 text-slate-600 font-bold rounded-lg text-xs">- (ขีดพัก)</button>
            <button className="flex-1 bg-sky-50 text-sky-600 font-bold rounded-lg text-xs border border-sky-100">ลบโน้ต</button>
         </div>
      </footer>

    </div>
  );
};

export default MobileEditor;