import React, { useContext, useState, useEffect, useRef } from 'react';
import { MusicContext } from '../../contexts/MusicContext';
import { INSTRUMENT_CONFIG } from '../../utils/instrumentConfig'; 

const Keyboard = () => {
  const {
    currentInstrument, changeInstrument, inputNote, layoutConfig,
    addRow, removeRow, addDoubleRow,
    addMeasure, removeMeasure, addNoteColumn, removeNoteColumn,
    copySelection, pasteSelection, clipboardData, addPageBreak,
    intervalMode, setIntervalMode,
    isReduceMode, setIsReduceMode, shiftNoteObject,
    isShowPlayMode, setIsShowPlayMode,
    isAutoScroll, setIsAutoScroll,
    appendNoteToCurrentCell, trimCurrentCellToken, moveSelectionNext, moveSelectionPrev,
    convertMeasureToText,
    addAnnotationRow, addNathapRow, // ⭐ ดึงฟังก์ชันสร้างบรรทัดหน้าทับมาใช้งาน
    selectedCell, playbackCursor, isPlaying
  } = useContext(MusicContext);

  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [activeIdx, setActiveIdx] = useState(null);
  
  const litTimersRef = useRef({});

  const [isMinimized, setIsMinimized] = useState(false);
  const [isInstMenuOpen, setIsInstMenuOpen] = useState(false);

  // ⭐ คำนวณหาเครื่องดนตรีที่จะแสดงบนแป้นพิมพ์ (ดึงจากตอนเล่นเพลง หรือตอนคลิกเลือกโน้ต)
  const activeCell = (isPlaying && playbackCursor) ? playbackCursor : selectedCell;
  let displayInstrument = currentInstrument;
  
  if (activeCell) {
    const [r, m, c] = activeCell;
    const customStyles = layoutConfig?.customStyles || {};
    const overrideInstId = customStyles[`${r}_${m}_${c}`]?.instrumentId;
    if (overrideInstId && INSTRUMENT_CONFIG[overrideInstId]) {
      displayInstrument = INSTRUMENT_CONFIG[overrideInstId];
    }
  }

  // ⭐ เช็กว่าเครื่องดนตรีที่แสดงอยู่ เป็นเครื่องประกอบจังหวะหรือไม่
  const isPercussion = displayInstrument?.type === 'percussion';

  const getFormattedStr = (eng, thai) => {
    const numMatch = eng.match(/\d+/);
    if (!numMatch) return thai; // ⭐ ถ้าไม่มีตัวเลขกำกับ (คำหน้าทับ) ให้ส่งคำนั้นไปตรงๆ เลย
    
    const octave = parseInt(numMatch[0], 10);
    let finalNote = thai;
    if (octave >= 5) finalNote += '\u0E4D';
    else if (octave === 2) finalNote += '\u0E3A\u200B';
    else if (octave === 3) finalNote += '\u0E3A';
    return finalNote;
  };

  useEffect(() => {
    const handleNotePlayed = (e) => {
      const { note, hand } = e.detail; 
      const idx = displayInstrument.keys.findIndex(k => getFormattedStr(k.eng, k.thai) === note);
      
      if (idx !== -1) {
        const btn = document.getElementById(`kbd-key-${idx}`);
        if (!btn) return;

        if (litTimersRef.current[idx]) clearTimeout(litTimersRef.current[idx]);

        btn.classList.remove('lit-left', 'lit-right', 'lit-single');
        void btn.offsetWidth;

        const handClass = `lit-${hand}`;
        btn.classList.add(handClass);

        litTimersRef.current[idx] = setTimeout(() => {
          btn.classList.remove(handClass);
        }, 200); 
      }
    };

    window.addEventListener('tme-note-played', handleNotePlayed);
    return () => window.removeEventListener('tme-note-played', handleNotePlayed);
  }, [displayInstrument]); 

  const isIntervalActive = intervalMode !== 'off';
  const intervalDist = isIntervalActive ? parseInt(intervalMode, 10) - 1 : 0;

  const handleKeyClick = (idx, e) => {
    if (!inputNote || !appendNoteToCurrentCell) return;
    if (isIntervalActive && idx < intervalDist) return; 

    const kOriginal = displayInstrument.keys[idx];
    const k = isReduceMode ? shiftNoteObject(kOriginal, 1) : kOriginal;
    const noteToInsert = getFormattedStr(k.eng, k.thai);

    if (e && e.shiftKey) {
      appendNoteToCurrentCell(noteToInsert);
    } else {
      inputNote(noteToInsert);
    }
  };

  const handleSpecialKey = (note) => {
    if (note === 'TRIM_LAST') {
      if (trimCurrentCellToken) trimCurrentCellToken();
      return;
    }
    if (note === 'NEXT_CELL') {
      if (moveSelectionNext) moveSelectionNext();
      return;
    }
    if (note === 'PREV_CELL') {
      if (moveSelectionPrev) moveSelectionPrev();
      return;
    }
    if (inputNote) inputNote(note);
  };

  const renderNoteLabel = (thai, eng) => {
    const numMatch = eng.match(/\d+/);
    const octave = numMatch ? parseInt(numMatch[0], 10) : null;
    const isWord = thai.length >= 2; // ⭐ ตรวจจับถ้าเป็นคำยาว ให้ลดฟอนต์ลงเพื่อไม่ให้ล้นปุ่ม
    
    return (
      <div className="relative flex flex-col items-center justify-center h-12 pointer-events-none transition-opacity">
        <span className={`${isWord ? 'text-[1.1rem]' : 'text-2xl'} font-bold group-hover:scale-110 transition-transform`}>
          {octave === null ? thai : (octave >= 5 ? thai + '\u0E4D' : octave <= 3 ? thai + '\u0E3A' : thai)}
        </span>
        {octave === 2 && (
          <div className="absolute -bottom-1 flex gap-0.5">
            <div className="w-1 h-1 bg-current rounded-full opacity-50"></div>
          </div>
        )}
      </div>
    );
  };

  const ToolbarSection = ({ children, bodyClass = 'bg-white border border-slate-200', wrapperClass = '' }) => (
    <div className={`flex shrink-0 items-center justify-center ${wrapperClass}`}>
      <div className={`flex items-stretch gap-1.5 rounded-2xl p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${bodyClass}`}>
        {children}
      </div>
    </div>
  );

  const ToolButton = ({ onClick, disabled, bgClass, icon, label, title, labelClass = '' }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex min-w-[50px] h-[40px] shrink-0 flex-col items-center justify-center rounded-xl border transition-all shadow-sm active:scale-[0.98]
        ${disabled ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-60' : bgClass}`}
    >
      <div className="flex h-5 items-center justify-center text-base font-black leading-none">{icon}</div>
      <span className={`mt-1 text-[10px] font-bold tracking-tight ${labelClass}`}>{label}</span>
    </button>
  );

  const iconClass = 'w-4 h-4';

  return (
    <div className={`relative flex flex-col z-10 w-full font-sans transition-colors duration-300 ${isIntervalActive && !isMinimized ? 'bg-[#fffdf0]' : 'bg-[#eaf4fc]'}`}>
      
      <style>
        {`
          .lit-left {
            background-color: #0ea5e9 !important; 
            border-color: #0284c7 !important; 
            border-bottom-width: 0px !important;
            transform: translateY(0.25rem) !important; 
            color: white !important;
            box-shadow: inset 0 4px 10px rgba(0,0,0,0.3) !important;
          }
          .lit-right, .lit-single {
            background-color: #f43f5e !important; 
            border-color: #e11d48 !important; 
            border-bottom-width: 0px !important;
            transform: translateY(0.25rem) !important;
            color: white !important;
            box-shadow: inset 0 4px 10px rgba(0,0,0,0.3) !important;
          }
          .lit-left span, .lit-right span, .lit-single span {
            color: white !important;
            font-weight: bold !important;
            opacity: 0.9 !important;
          }
        `}
      </style>

      <div className="absolute -top-[30px] right-4 sm:right-8 z-20 flex gap-2">
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

      <div className={`border-t transition-all duration-500 ease-in-out flex flex-col w-full relative ${isMinimized ? 'max-h-0 opacity-0 border-transparent overflow-hidden' : `opacity-100 overflow-visible ${isIntervalActive ? 'border-amber-200' : 'border-sky-200'}`}`}>
        
        <div className="relative z-[120] w-full overflow-visible border-b border-slate-200/70 bg-[#f8f8fb]/95 p-2 shadow-[0_2px_10px_rgba(0,0,0,0.02)] backdrop-blur-sm flex items-center gap-3">
          
          <div className="flex items-center gap-2 z-30 shrink-0">
            <ToolbarSection bodyClass="bg-[#fffaf0] border border-amber-100">
              <div className="relative">
                <div 
                  onPointerDown={() => setIsInstMenuOpen(!isInstMenuOpen)}
                  className="relative flex items-center gap-2 rounded-xl bg-[#fff4d9] px-3 py-2 text-xs font-bold text-amber-900 border border-amber-200 min-w-[130px] hover:bg-[#ffeec2] transition-colors shadow-sm cursor-pointer select-none"
                >
                  <span className="text-lg leading-none">🎼</span>
                  {/* ⭐ แสดงชื่อจาก displayInstrument */}
                  <span className="flex-1 truncate">{displayInstrument.name}</span>
                  <svg className={`h-3.5 w-3.5 text-amber-700 transition-transform ${isInstMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                </div>

                {isInstMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[180]" onPointerDown={() => setIsInstMenuOpen(false)}></div>
                    <div className="absolute left-0 top-[calc(100%+8px)] z-[220] min-w-[220px] w-max max-w-[280px] bg-white border border-amber-200 rounded-xl shadow-[0_18px_40px_rgba(15,23,42,0.18)] overflow-hidden py-1">
                      {Object.values(INSTRUMENT_CONFIG).map(inst => (
                        <button
                          key={inst.id}
                          onPointerDown={() => {
                            changeInstrument(inst.id);
                            setIsInstMenuOpen(false);
                          }}
                          /* ⭐ เปรียบเทียบกับ displayInstrument.id */
                          className={`w-full text-left px-4 py-2 text-[11px] font-bold hover:bg-amber-50 transition-colors ${displayInstrument.id === inst.id ? 'bg-amber-100 text-amber-900' : 'text-slate-600'}`}
                        >
                          {inst.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div 
                onPointerDown={() => setIsShowPlayMode(prev => !prev)} 
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500 cursor-pointer shadow-sm select-none"
              >
                <span className="whitespace-nowrap">แสดงการตี</span>
                <div className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${isShowPlayMode ? 'bg-rose-500' : 'bg-slate-300'}`}>
                  <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${isShowPlayMode ? 'translate-x-4' : ''}`}></div>
                </div>
              </div>

              {!isPercussion && (
                <>
                  <div 
                    onPointerDown={() => setIsReduceMode(prev => !prev)} 
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500 cursor-pointer shadow-sm select-none"
                  >
                    <span className="whitespace-nowrap">โหมดลดเสียง</span>
                    <div className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${isReduceMode ? 'bg-sky-400' : 'bg-slate-300'}`}>
                      <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${isReduceMode ? 'translate-x-4' : ''}`}></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500 shadow-sm select-none">
                    <span className="whitespace-nowrap">โหมดคู่เสียง</span>
                    <select 
                      value={intervalMode}
                      onChange={(e) => setIntervalMode(e.target.value)}
                      className="bg-amber-50 border border-amber-200 text-amber-700 rounded-md px-1 py-0.5 outline-none focus:ring-1 focus:ring-amber-400 font-black cursor-pointer text-center"
                    >
                      <option value="off">ปิด</option>
                      <option value="8">คู่ 8</option>
                      <option value="7">คู่ 7</option>
                      <option value="6">คู่ 6</option>
                      <option value="5">คู่ 5</option>
                      <option value="4">คู่ 4</option>
                      <option value="3">คู่ 3</option>
                      <option value="2">คู่ 2</option>
                    </select>
                  </div>
                </>
              )}

              <div 
                onPointerDown={() => setIsAutoScroll(prev => !prev)} 
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500 cursor-pointer shadow-sm select-none"
              >
                <span className="whitespace-nowrap">เลื่อนตามโน้ต</span>
                <div className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${isAutoScroll ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                  <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${isAutoScroll ? 'translate-x-4' : ''}`}></div>
                </div>
              </div>
              
            </ToolbarSection>
          </div>

          <div className="flex-1 overflow-x-auto custom-scrollbar flex items-center gap-3 pb-0.5 w-full">
            <ToolbarSection>
              <ToolButton onClick={() => handleSpecialKey('-')} bgClass="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>} label="พักเสียง" title="ใส่ขีดพักเสียง" />
              <ToolButton onClick={() => handleSpecialKey('PREV_CELL')} bgClass="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>} label="ย้อนช่อง" title="ย้ายไปช่องก่อนหน้า" />
              <ToolButton onClick={() => handleSpecialKey('NEXT_CELL')} bgClass="bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>} label="จบช่อง" title="ยืนยันช่องนี้แล้วไปช่องถัดไป" />
              <ToolButton onClick={copySelection} bgClass="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>} label="คัดลอก" title="คัดลอกโน้ต" />
              <ToolButton onClick={pasteSelection} disabled={clipboardData.length === 0} bgClass="bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} label="วาง" title="วางโน้ต" />
            </ToolbarSection>

            <ToolbarSection bodyClass="bg-slate-50 border border-slate-200">
              <ToolButton onClick={convertMeasureToText} bgClass="bg-[#fff5f0] text-orange-700 border-orange-100 hover:bg-[#ffece0]" icon={<span className="text-lg leading-none">T</span>} label="ช่องพิมพ์" title="เปลี่ยนห้องโน้ตเป็นห้องพิมพ์ข้อความ" />
              <ToolButton onClick={addNoteColumn} bgClass="bg-[#f2f4ff] text-blue-700 border-blue-100 hover:bg-[#e8ecff]" icon={<span className="text-lg leading-none">+</span>} label="จังหวะ" title="เพิ่มคอลัมน์โน้ต" />
              <ToolButton onClick={addMeasure} bgClass="bg-[#eefbf3] text-emerald-700 border-emerald-100 hover:bg-[#e1f7ea]" icon={<span className="text-lg leading-none">+</span>} label="ห้อง" title="เพิ่มห้องเพลง" />
              <ToolButton onClick={addRow} bgClass="bg-[#f7efff] text-violet-700 border-violet-100 hover:bg-[#efe2ff]" icon={<span className="text-lg leading-none">+</span>} label="บรรทัด" title="เพิ่มบรรทัดเดี่ยว" />
              <ToolButton onClick={addDoubleRow} bgClass="bg-[#f7efff] text-violet-700 border-violet-100 hover:bg-[#efe2ff]" icon={<span className="text-lg leading-none">+</span>} label="บรรทัดคู่" title="เพิ่มบรรทัดคู่" />
              
              {/* ⭐ ปุ่มใหม่: สร้างบรรทัดคำอธิบาย */}
              <ToolButton onClick={addAnnotationRow} bgClass="bg-[#fffbeb] text-amber-600 border-amber-200 hover:bg-[#fef3c7]" icon={<span className="text-lg leading-none">Aa</span>} label="คำอธิบาย" title="เพิ่มบรรทัดสำหรับพิมพ์คำอธิบาย (ไม่เล่นเสียง)" />
              {/* ⭐ ปุ่มใหม่: สร้างบรรทัดหน้าทับ */}
              <ToolButton onClick={addNathapRow} bgClass="bg-[#fff0f5] text-rose-600 border-rose-200 hover:bg-[#ffe4e6]" icon={<span className="text-lg leading-none">🥁</span>} label="หน้าทับ" title="เพิ่มบรรทัดหน้าทับกลอง" />

              <ToolButton onClick={addPageBreak} bgClass="bg-white text-slate-600 border-slate-200 hover:bg-slate-100" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 3v5h5M16 13H8M16 17H8M10 9H8" /></svg>} label="หน้าใหม่" title="เพิ่มจุดตัดหน้ากระดาษ" />
            </ToolbarSection>

            <div className="flex-1 min-w-[10px]"></div>

            <ToolbarSection wrapperClass="ml-auto" bodyClass="bg-red-50 border border-red-100">
              <ToolButton onClick={() => handleSpecialKey('BACKSPACE')} bgClass="bg-white text-red-600 border-red-200 hover:bg-red-100" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" /></svg>} label="ลบโน้ต" title="ลบโน้ต (Backspace)" />
              
              <ToolButton onClick={() => handleSpecialKey('TRIM_LAST')} bgClass="bg-white text-red-600 border-red-200 hover:bg-red-100" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H8m0 0l4 4m-4-4l4-4M4 6h7M4 18h7" /></svg>} label="ลบตัวท้าย" title="ลบตัวโน้ตตัวสุดท้ายในช่องปัจจุบัน" />
              
              <ToolButton onClick={removeNoteColumn} bgClass="bg-white text-red-600 border-red-200 hover:bg-red-100" icon={<span className="text-lg leading-none">−</span>} label="ลบจังหวะ" title="ลบคอลัมน์โน้ต" />
              <ToolButton onClick={removeMeasure} bgClass="bg-white text-red-600 border-red-200 hover:bg-red-100" icon={<span className="text-lg leading-none">−</span>} label="ลบห้อง" title="ลบห้องเพลง" />
              <ToolButton onClick={removeRow} bgClass="bg-white text-red-600 border-red-200 hover:bg-red-100" icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0l1 12h6l1-12" /></svg>} label="ลบบรรทัด" title="ลบบรรทัดปัจจุบัน" />
            </ToolbarSection>
          </div>
        </div>

        <div className="px-4 pt-2 text-[11px] font-semibold text-slate-500">
          คลิกปุ่มโน้ตเพื่อเติมโน้ตเพิ่มในช่องเดียวกัน แล้วกด “จบช่อง” เพื่อเลื่อนไปช่องถัดไป
        </div>

        <div className="relative z-0 flex w-full overflow-hidden">
          <div className="flex-1 overflow-x-auto pb-2 pt-2 custom-scrollbar transition-all duration-300">
            <div className="flex bg-slate-800 p-1 rounded-xl shadow-inner w-max mx-auto gap-[2px]">
              {/* ⭐ ใช้ displayInstrument สร้างปุ่มคีย์บอร์ด */}
              {displayInstrument.keys.map((kOriginal, i) => {
                
                const k = isReduceMode ? shiftNoteObject(kOriginal, 1) : kOriginal;
                
                const isBlocked = isIntervalActive && i < intervalDist;
                const isHovered = hoveredIdx === i || (isIntervalActive && hoveredIdx !== null && i === hoveredIdx - intervalDist);
                const isActive = activeIdx === i || (isIntervalActive && activeIdx !== null && i === activeIdx - intervalDist);

                let btnClass = 'w-14 h-[100px] shrink-0 border-b-[5px] rounded-b-md flex flex-col items-center justify-end pb-5 transition-all shadow-sm group select-none relative ';

                if (isActive) {
                  btnClass += isIntervalActive ? 'bg-amber-300 border-amber-300 border-b-0 translate-y-1 text-amber-900 ' : 'bg-sky-200 border-sky-200 border-b-0 translate-y-1 text-sky-900 ';
                } else if (isHovered) {
                  btnClass += isIntervalActive ? 'bg-amber-100 border-amber-400 text-amber-700 ' : 'bg-sky-50 border-sky-400 text-sky-600 ';
                } else if (isBlocked) {
                  btnClass += 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed opacity-60 ';
                } else {
                  btnClass += 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 ';
                }

                return (
                  <button
                    key={i}
                    id={`kbd-key-${i}`} 
                    onPointerDown={(e) => { e.preventDefault(); if (!isBlocked) setActiveIdx(i); }}
                    onPointerUp={() => setActiveIdx(null)}
                    onPointerLeave={() => { setActiveIdx(null); setHoveredIdx(null); }}
                    onPointerCancel={() => { setActiveIdx(null); setHoveredIdx(null); }}
                    onPointerEnter={() => { if (!isBlocked) setHoveredIdx(i); }}
                    onContextMenu={(e) => { 
                      e.preventDefault(); 
                        if (!isBlocked) handleSpecialKey('-');
                    }}
                    onClick={(e) => { if (!isBlocked) handleKeyClick(i, e); }}
                    className={btnClass}
                  >
                    <span className={`absolute top-2 text-[10px] uppercase tracking-wider opacity-40 ${isHovered || isActive ? 'font-bold text-current opacity-70' : ''}`}>{k.eng}</span>
                    {renderNoteLabel(k.thai, k.eng)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Keyboard;