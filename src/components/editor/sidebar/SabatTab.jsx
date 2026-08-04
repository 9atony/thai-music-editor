import React, { useContext, useState, useEffect } from 'react';
import { MusicContext } from '../../../contexts/MusicContext';

const splitThaiNoteToken = (token) => {
  if (!token || token === '-') return [];
  const THAI_NOTE_COMBINER_PATTERN = /[ั-๎​]/;
  return Array.from(String(token).replace(/\s+/g, '').trim()).reduce((parts, char) => {
    if (!char || char === '-') return parts;
    if (THAI_NOTE_COMBINER_PATTERN.test(char) && parts.length > 0) {
      parts[parts.length - 1] += char;
    } else {
      parts.push(char);
    }
    return parts;
  }, []);
};

const SabatTab = () => {
  const { 
    layoutConfig, 
    setLayoutConfig, 
    symbols, 
    updateSymbol, 
    selectedSymbolId, 
    sheetData, 
    rowTypes 
  } = useContext(MusicContext);

  const selectedSym = symbols.find(s => s.id === selectedSymbolId && s.type === 'sabat');
  const isGlobal = !selectedSym;

  const getValue = (key) => isGlobal ? layoutConfig[`sabat${key}`] : (selectedSym[key.toLowerCase()] ?? layoutConfig[`sabat${key}`]);
  
  const handleUpdate = (key, value) => {
    if (isGlobal) {
      setLayoutConfig(prev => ({ ...prev, [`sabat${key}`]: value }));
    } else {
      updateSymbol(selectedSymbolId, { [key.toLowerCase()]: value });
    }
  };

  const [activeNotes, setActiveNotes] = useState([]);
  const [customVelocities, setCustomVelocities] = useState([]);

  useEffect(() => {
    if (isGlobal) {
      setActiveNotes([]);
      setCustomVelocities([]);
      return;
    }

    const { start, end } = selectedSym;
    let startPos = [...start];
    let endPos = [...end];

    const startAbs = startPos[0] * 100000 + startPos[1] * 1000 + startPos[2];
    const endAbs = endPos[0] * 100000 + endPos[1] * 1000 + endPos[2];
    if (startAbs > endAbs) {
      let temp = startPos; startPos = endPos; endPos = temp;
    }

    let currR = startPos[0], currM = startPos[1], currC = startPos[2];
    const endR = endPos[0], endM = endPos[1], endC = endPos[2];

    let extractedNotes = [];
    let failSafe = 0;

    while (failSafe < 500) {
      if (sheetData[currR] && sheetData[currR][currM] && sheetData[currR][currM][currC]) {
        const note = sheetData[currR][currM][currC];
        if (note && note !== '-') {
          extractedNotes.push(...splitThaiNoteToken(note));
        }
      }

      if (currR === endR && currM === endM && currC === endC) break;

      currC++;
      if (currC >= (sheetData[currR]?.[currM]?.length ?? 0)) {
        currC = 0;
        currM++;
        if (currM >= (sheetData[currR]?.length ?? 0)) {
          let tempR = currR + 1;
          while (tempR < sheetData.length && (rowTypes[tempR] === 'page-break' || rowTypes[tempR] === 'text')) {
             tempR++;
          }
          if (tempR >= sheetData.length) break;
          currR = tempR;
          currM = rowTypes[currR]?.startsWith('double') ? 1 : 0;
        }
      }
      failSafe++;
    }

    setActiveNotes(extractedNotes);

    const currentStyle = selectedSym.style ?? 'crescendo';
    const savedVelocities = selectedSym.customvelocities;

    if (currentStyle === 'custom' && savedVelocities && savedVelocities.length === extractedNotes.length) {
      setCustomVelocities(savedVelocities);
    } else {
      const len = extractedNotes.length;
      const defaultVels = extractedNotes.map((_, idx) => {
        if (currentStyle === 'flat') return 100;
        if (currentStyle === 'accent') return idx === 0 ? 50 : 100;
        return idx === len - 1 ? 100 : Math.round(Math.max(55, 88 - (idx * 8)));
      });
      setCustomVelocities(defaultVels);
    }
  }, [selectedSymbolId, isGlobal]); // 👈 ตัด sheetData ออกจาก dependency เพื่อกันการรีเซ็ตค่ากลางคัน

  const handleStyleSelect = (newStyle) => {
    handleUpdate('Style', newStyle);

    const len = activeNotes.length;
    const newVels = activeNotes.map((_, idx) => {
      if (newStyle === 'flat') return 100;
      if (newStyle === 'accent') return idx === 0 ? 50 : 100;
      return idx === len - 1 ? 100 : Math.round(Math.max(55, 88 - (idx * 8)));
    });
    setCustomVelocities(newVels);
    handleUpdate('CustomVelocities', newVels);
  };

  // เปลี่ยนค่าหน้าจอทันทีตอนลาก (Input)
  const handleVelocityInput = (index, value) => {
    const newVels = [...customVelocities];
    newVels[index] = value;
    setCustomVelocities(newVels);
  };

  // บันทึกลงระบบจริงเมื่อปล่อยมือจากการลาก (Change / MouseUp)
  const handleVelocityCommit = () => {
    handleUpdate('CustomVelocities', customVelocities);
    handleUpdate('Style', 'custom'); 
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 animate-fadeIn">
      {/* Header */}
      <div className={`p-3 border-b flex justify-between items-center shrink-0 ${isGlobal ? 'bg-amber-50 border-amber-100' : 'bg-orange-100 border-orange-200'}`}>
        <div>
          <h3 className="text-xs font-black text-amber-800 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8c4-4 8 8 16 0" /></svg>
            ตั้งค่าลูกสะบัด
          </h3>
          <p className="text-[10px] text-amber-600 mt-0.5 font-semibold">
            {isGlobal ? 'ค่าเริ่มต้นของทั้งโปรเจกต์' : 'กำลังแก้ไขเส้นที่เลือกอยู่'}
          </p>
        </div>
        {!isGlobal && (
           <span className="animate-pulse w-2 h-2 bg-orange-500 rounded-full" title="โหมดแก้ไขเฉพาะจุด"></span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-4">
        
        {/* --- 1. หมวดรูปลักษณ์เส้น --- */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="text-[11px] font-bold text-slate-700 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            👁️ รูปลักษณ์เส้นกราฟิก
          </h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-bold">สีของเส้น</span>
              <input type="color" value={getValue('Color') || '#1e293b'} onChange={(e) => handleUpdate('Color', e.target.value)} className="w-6 h-6 p-0 border border-slate-300 rounded cursor-pointer" />
            </div>
            
            <div>
              <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                <span>ความนูนของเส้นโค้ง</span>
                <span className="font-bold text-amber-600">{getValue('Curve') ?? 20}</span>
              </label>
              <input type="range" min="0" max="60" value={getValue('Curve') ?? 20} onChange={(e) => handleUpdate('Curve', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-amber-500 cursor-pointer" />
            </div>

            <div>
              <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                <span>ความหนาเส้น</span>
                <span className="font-bold text-amber-600">{getValue('StrokeWidth') ?? 2.5}px</span>
              </label>
              <input type="range" min="1" max="6" step="0.5" value={getValue('StrokeWidth') ?? 2.5} onChange={(e) => handleUpdate('StrokeWidth', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-amber-500 cursor-pointer" />
            </div>
          </div>
        </div>

        {/* --- 2. หมวดน้ำหนักเสียง --- */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="text-[11px] font-bold text-slate-700 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            🔊 น้ำหนักการตี (Velocity)
          </h4>
          
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button 
              onClick={() => handleStyleSelect('crescendo')}
              className={`p-1.5 rounded-md border text-[10px] font-bold transition-colors ${getValue('Style') === 'crescendo' ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              title="ค่อยๆ ดังขึ้น"
            >
               <div className="flex items-end justify-center gap-0.5 mb-1 h-3">
                 <div className="w-1.5 h-1/3 bg-current rounded-sm"></div>
                 <div className="w-1.5 h-2/3 bg-current rounded-sm"></div>
                 <div className="w-1.5 h-full bg-current rounded-sm"></div>
               </div>
               เน้นตก
            </button>
            <button 
              onClick={() => handleStyleSelect('flat')}
              className={`p-1.5 rounded-md border text-[10px] font-bold transition-colors ${getValue('Style') === 'flat' ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              title="เท่ากันหมด"
            >
               <div className="flex items-end justify-center gap-0.5 mb-1 h-3">
                 <div className="w-1.5 h-full bg-current rounded-sm"></div>
                 <div className="w-1.5 h-full bg-current rounded-sm"></div>
                 <div className="w-1.5 h-full bg-current rounded-sm"></div>
               </div>
               เท่ากัน
            </button>
            <button 
              onClick={() => handleStyleSelect('accent')}
              className={`p-1.5 rounded-md border text-[10px] font-bold transition-colors ${getValue('Style') === 'accent' ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              title="ตัวแรกเบา ตัวที่เหลือหนัก"
            >
               <div className="flex items-end justify-center gap-0.5 mb-1 h-3">
                 <div className="w-1.5 h-1/3 bg-current rounded-sm"></div>
                 <div className="w-1.5 h-full bg-current rounded-sm"></div>
                 <div className="w-1.5 h-full bg-current rounded-sm"></div>
               </div>
               เบาดังดัง
            </button>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative">
             {isGlobal ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/90 rounded-lg backdrop-blur-[1px]">
                   <p className="text-[10px] font-bold text-slate-400 text-center px-4">
                     โปรดคลิกเลือกลูกสะบัดบนกระดาษ <br/>เพื่อปรับน้ำหนักแยกทีละโน้ต
                   </p>
                </div>
             ) : activeNotes.length === 0 ? (
                <div className="text-center py-4">
                   <p className="text-[10px] font-bold text-slate-400">ไม่พบตัวโน้ตในช่องนี้</p>
                </div>
             ) : (
                <>
                  <div className="flex justify-between items-center mb-1">
                     <p className="text-[10px] font-bold text-slate-500">ปรับน้ำหนักแยกโน้ต</p>
                     {getValue('Style') === 'custom' && (
                        <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-md font-bold">เปิดใช้งานอยู่</span>
                     )}
                  </div>
                  
                  <div className="flex flex-col gap-3 pt-2">
                     {activeNotes.map((note, idx) => (
                       <div key={`${idx}-${note}`} className="flex items-center gap-3 w-full">
                          
                          <div className="w-8 h-8 shrink-0 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm">
                            <span className="text-[12px] font-black text-slate-700">{note}</span>
                          </div>
                          
                          <div className="flex-1 flex items-center gap-2">
                            <input 
                               type="range" min="0" max="100" 
                               value={customVelocities[idx] ?? 100} 
                               onInput={(e) => handleVelocityInput(idx, parseInt(e.target.value))}
                               onMouseUp={() => handleVelocityCommit()}
                               onTouchEnd={() => handleVelocityCommit()}
                               className="w-2 h-2 bg-slate-200 rounded-lg accent-amber-500 cursor-pointer flex-1" 
                            />
                            <span className="text-[10px] font-bold text-slate-500 w-6 text-right">
                              {customVelocities[idx] ?? 100}
                            </span>
                          </div>
                          
                       </div>
                     ))}
                  </div>
                </>
             )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default SabatTab;