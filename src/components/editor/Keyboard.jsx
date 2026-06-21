import React, { useContext, useState } from 'react';
import { MusicContext } from '../../contexts/MusicContext';
import { playNote } from '../../utils/audioEngine';

const Keyboard = () => {
  const { 
    currentInstrument, inputNote, layoutConfig,
    addRow, removeRow, addDoubleRow,
    addMeasure, removeMeasure, addNoteColumn, removeNoteColumn,
    copySelection, pasteSelection, clipboardData, addPageBreak,
    isOctaveMode, setIsOctaveMode 
  } = useContext(MusicContext);

  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [activeIdx, setActiveIdx] = useState(null);
  
  // ⭐ เพิ่ม State สำหรับจดจำสถานะการพับเก็บคีย์บอร์ด
  const [isMinimized, setIsMinimized] = useState(false); 

  const getFormattedStr = (eng, thai) => {
    const octave = parseInt(eng.replace(/\D/g, ''));
    let finalNote = thai;
    if (octave >= 5) finalNote += '\u0E4D'; 
    else if (octave === 2) finalNote += '\u0E3A\u200B'; 
    else if (octave === 3) finalNote += '\u0E3A'; 
    return finalNote;
  };

  const handleKeyClick = (idx) => {
    if (!inputNote) return;

    if (isOctaveMode && currentInstrument.id === 'ranat-ek' && idx > 14) return;

    const k = currentInstrument.keys[idx];
    const clickedNoteStr = getFormattedStr(k.eng, k.thai); 
    
    if (isOctaveMode && currentInstrument.id === 'ranat-ek') {
      const pairIdx = idx + 7;
      if (pairIdx < currentInstrument.keys.length) {
        const pairK = currentInstrument.keys[pairIdx];
        const rightHandNoteStr = getFormattedStr(pairK.eng, pairK.thai); 
        
        inputNote(rightHandNoteStr); 
        playNote(currentInstrument.id, clickedNoteStr, layoutConfig.volume ?? 100);
      }
    } else {
      inputNote(clickedNoteStr); 
    }
  };

  const handleSpecialKey = (note) => {
    if (inputNote) inputNote(note);
  };

  const renderNoteLabel = (thai, eng) => {
    const octave = parseInt(eng.replace(/\D/g, ''));
    return (
      <div className="relative flex flex-col items-center justify-center h-12 pointer-events-none transition-opacity">
        <span className="text-2xl font-bold group-hover:scale-110 transition-transform">
          {octave >= 5 ? thai + '\u0E4D' : octave <= 3 ? thai + '\u0E3A' : thai}
        </span>
        {octave === 2 && (
          <div className="absolute -bottom-1 flex gap-0.5">
            <div className="w-1 h-1 bg-current rounded-full opacity-50"></div>
          </div>
        )}
      </div>
    );
  };

  const ToolButton = ({ onClick, disabled, bgClass, icon, label, title }) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      title={title}
      className={`flex flex-col items-center justify-center w-[46px] h-[46px] shrink-0 rounded-lg border-b-[3px] transition-all shadow-sm active:border-b-0 active:translate-y-[3px]
        ${disabled ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-60' : bgClass}`}
    >
      <div className="text-base font-black leading-none flex items-center justify-center h-5">{icon}</div>
      <span className="text-[9px] font-bold mt-0.5 tracking-tight">{label}</span>
    </button>
  );

  return (
    // ⭐ ครอบ Container นอกสุด และตั้งค่าพื้นหลังตามโหมด
    <div className={`relative flex flex-col z-10 w-full font-sans transition-colors duration-300 ${isOctaveMode && !isMinimized ? 'bg-[#fffdf0]' : 'bg-[#eaf4fc]'}`}>
      
      {/* ⭐ ปุ่มแท็บ (Tab) สำหรับพับ/กางคีย์บอร์ด (ลอยอยู่มุมขวาบน) */}
      <div className="absolute -top-[30px] right-4 sm:right-8 z-20">
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-200 border-b-0 rounded-t-xl shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)] text-xs font-bold text-slate-500 hover:text-sky-600 transition-colors"
        >
          {isMinimized ? (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg> เปิดคีย์บอร์ด</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg> ซ่อนคีย์บอร์ด</>
          )}
        </button>
      </div>

      {/* ⭐ พื้นที่ที่จะถูกพับเก็บ (ใช้ max-h และ opacity ในการทำแอนิเมชัน) */}
      <div className={`border-t transition-all duration-500 ease-in-out overflow-hidden flex flex-col ${isMinimized ? 'max-h-0 opacity-0 border-transparent' : `max-h-[600px] opacity-100 ${isOctaveMode ? 'border-amber-200' : 'border-sky-200'}`}`}>
        
        {/* 🛠️ โซนที่ 1: แถบเครื่องมือจัดหน้า */}
        <div className="w-full bg-white/60 backdrop-blur-sm border-b border-slate-200/50 p-2 sm:p-3 flex flex-wrap lg:flex-nowrap items-center gap-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3 shrink-0">
            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${isOctaveMode ? 'text-amber-700 bg-amber-100 border-amber-200' : 'text-sky-700 bg-sky-100 border-sky-200'}`}>
              {currentInstrument.name}
            </div>
            
            {currentInstrument.id === 'ranat-ek' && (
              <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-all active:scale-95">
                <input 
                  type="checkbox" className="sr-only" 
                  checked={isOctaveMode} onChange={(e) => setIsOctaveMode(e.target.checked)} 
                />
                <div className={`w-8 h-4 rounded-full transition-colors duration-300 ${isOctaveMode ? 'bg-amber-400' : 'bg-slate-300'} relative`}>
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-300 ${isOctaveMode ? 'translate-x-4' : ''}`}></div>
                </div>
                <span className={`text-[11px] font-bold transition-colors ${isOctaveMode ? 'text-amber-600' : 'text-slate-500'}`}>
                  🎚️ โหมดคู่ 8
                </span>
              </label>
            )}
          </div>

          <div className="flex-1 overflow-x-auto custom-scrollbar pb-1">
            <div className="flex items-center gap-3 w-max">
              <div className="flex gap-1 border-r border-slate-300/50 pr-3">
                 <ToolButton onClick={() => handleSpecialKey('-')} bgClass="bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200" icon="-" label="พักเสียง" title="ใส่ขีดพักเสียง" />
                 <ToolButton onClick={() => handleSpecialKey('BACKSPACE')} bgClass="bg-red-50 text-red-600 border-red-300 hover:bg-red-100" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" /></svg>} label="ลบ" title="ลบโน้ต (Backspace)" />
                 <ToolButton onClick={copySelection} bgClass="bg-emerald-50 text-emerald-600 border-emerald-300 hover:bg-emerald-100" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>} label="คัดลอก" title="คัดลอกโน้ต" />
                 <ToolButton onClick={pasteSelection} disabled={clipboardData.length === 0} bgClass="bg-blue-50 text-blue-600 border-blue-300 hover:bg-blue-100" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} label="วาง" title="วางโน้ต" />
              </div>

              <div className="flex gap-1 border-r border-slate-300/50 pr-3">
                 <ToolButton onClick={addNoteColumn} bgClass="bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100" icon="+" label="โน้ต" title="เพิ่มคอลัมน์โน้ต" />
                 <ToolButton onClick={removeNoteColumn} bgClass="bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100" icon="-" label="โน้ต" title="ลบคอลัมน์โน้ต" />
                 <ToolButton onClick={addMeasure} bgClass="bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100" icon="+" label="ห้อง" title="เพิ่มห้องเพลง" />
                 <ToolButton onClick={removeMeasure} bgClass="bg-fuchsia-50 text-fuchsia-700 border-fuchsia-300 hover:bg-fuchsia-100" icon="-" label="ห้อง" title="ลบห้องเพลง" />
              </div>

              <div className="flex gap-1">
                 <ToolButton onClick={addRow} bgClass="bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100" icon="+" label="บรรทัด" title="เพิ่มบรรทัดเดี่ยว" />
                 <ToolButton onClick={addDoubleRow} bgClass="bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100" icon="+" label="บรรทัดคู่" title="เพิ่มบรรทัดคู่" />
                 <ToolButton onClick={removeRow} bgClass="bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100" icon="-" label="ลบบรรทัด" title="ลบบรรทัดปัจจุบัน" />
                 <ToolButton onClick={addPageBreak} bgClass="bg-blue-100 text-blue-700 border-blue-400 hover:bg-blue-200" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 3v5h5M16 13H8M16 17H8M10 9H8" /></svg>} label="ตัดหน้า" title="เพิ่มจุดตัดหน้ากระดาษ" />
              </div>
            </div>
          </div>
        </div>
        
        {/* 🎹 โซนที่ 2: รางคีย์บอร์ด */}
        <div className="w-full max-w-full overflow-x-auto pb-4 pt-4 custom-scrollbar">
          <div className="flex bg-slate-800 p-2 rounded-xl shadow-inner w-max mx-auto gap-[2px]">
            
            {currentInstrument.keys.map((k, i) => {
              const isBlocked = isOctaveMode && currentInstrument.id === 'ranat-ek' && i > 14;
              const isHovered = hoveredIdx === i || (isOctaveMode && currentInstrument.id === 'ranat-ek' && hoveredIdx !== null && i === hoveredIdx + 7);
              const isActive = activeIdx === i || (isOctaveMode && currentInstrument.id === 'ranat-ek' && activeIdx !== null && i === activeIdx + 7);

              let btnClass = "w-14 h-[150px] shrink-0 border-b-[5px] rounded-b-md flex flex-col items-center justify-end pb-5 transition-all shadow-sm group select-none relative ";

              if (isActive) {
                 btnClass += isOctaveMode 
                   ? "bg-amber-300 border-amber-300 border-b-0 translate-y-1 text-amber-900 " 
                   : "bg-sky-200 border-sky-200 border-b-0 translate-y-1 text-sky-900 ";
              } else if (isHovered) {
                 btnClass += isOctaveMode 
                   ? "bg-amber-100 border-amber-400 text-amber-700 " 
                   : "bg-sky-50 border-sky-400 text-sky-600 ";
              } else if (isBlocked) {
                 btnClass += "bg-white border-slate-300 text-slate-700 cursor-not-allowed ";
              } else {
                 btnClass += "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 ";
              }

              return (
                <button 
                  key={i} 
                  onPointerDown={(e) => { e.preventDefault(); if(!isBlocked) setActiveIdx(i); }}
                  onPointerUp={() => setActiveIdx(null)}
                  onPointerLeave={() => { setActiveIdx(null); setHoveredIdx(null); }}
                  onPointerCancel={() => { setActiveIdx(null); setHoveredIdx(null); }}
                  onPointerEnter={() => { if(!isBlocked) setHoveredIdx(i); }}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => { if(!isBlocked) handleKeyClick(i); }} 
                  className={btnClass}
                >
                  <span className={`absolute top-2 text-[10px] uppercase tracking-wider opacity-40 ${isHovered || isActive ? 'font-bold text-current opacity-70' : ''}`}>{k.eng}</span>
                  {renderNoteLabel(k.thai, k.eng)}
                </button>
              );
            })}
            
          </div>
          
          <div className="text-[11px] text-slate-500 font-medium mt-3 text-center w-full select-none">
            * จุดล่างคือเสียงต่ำ | จุดบนคือเสียงสูง | ไม่มีสัญลักษณ์คือเสียงกลาง
          </div>
        </div>
      </div>

    </div>
  );
};

export default Keyboard;