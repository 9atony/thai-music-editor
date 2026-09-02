import React, { useContext } from 'react';
import { MusicContext } from '../../../contexts/MusicContext';

const KroTab = () => {
  const { layoutConfig, setLayoutConfig, symbols, updateSymbol, selectedSymbolId } = useContext(MusicContext);

  const selectedSym = symbols.find(s => s.id === selectedSymbolId && s.type === 'kro');
  const isGlobal = !selectedSym;

  const getValue = (key) => isGlobal ? layoutConfig[`kro${key}`] : (selectedSym[key.toLowerCase()] ?? layoutConfig[`kro${key}`]);
  
  const handleUpdate = (key, value) => {
    if (isGlobal) {
      setLayoutConfig(prev => ({ ...prev, [`kro${key}`]: value }));
    } else {
      updateSymbol(selectedSymbolId, { [key.toLowerCase()]: value });
    }
  };

  // แปลงจาก ระดับ 1-10 ให้กลายเป็น มิลลิวินาที (ms) ส่งให้ระบบเสียง
  // ระดับ 1 = ช้า (150ms), ระดับ 10 = เร็วสุด (30ms)
  const speedLevelToMs = (level) => {
    const minMs = 30;
    const maxMs = 150;
    // level 1 -> 150ms, level 10 -> 30ms
    return maxMs - ((level - 1) * ((maxMs - minMs) / 9));
  };

  // แปลงกลับจาก มิลลิวินาที (ms) เป็น ระดับ 1-10 เพื่อโชว์ในสไลเดอร์
  const msToSpeedLevel = (ms) => {
    const minMs = 30;
    const maxMs = 150;
    const level = 1 + ((maxMs - ms) / ((maxMs - minMs) / 9));
    return Math.round(level);
  };

  const currentSpeedMs = getValue('Speed') ?? 65;
  const currentLevel = msToSpeedLevel(currentSpeedMs);

  return (
    <div className="tool-tab-root flex flex-col h-full animate-fadeIn">
      {/* Header */}
      <div className="tool-tab-header flex justify-between items-center shrink-0 border-b">
        <div>
          <h3 className="text-xs font-black text-blue-800 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12h16M4 12l2-2m-2 2l2 2m14-2l-2-2m2 2l-2 2" /></svg>
            ตั้งค่าลูกกรอ
          </h3>
          <p className="text-[10px] text-blue-600 mt-0.5 font-semibold">
            {isGlobal ? 'ค่าเริ่มต้นของทั้งโปรเจกต์' : 'กำลังแก้ไขเส้นที่เลือกอยู่'}
          </p>
        </div>
        {!isGlobal && (
           <span className="animate-pulse w-2 h-2 bg-sky-500 rounded-full" title="โหมดแก้ไขเฉพาะจุด"></span>
        )}
      </div>

      <div className="tool-tab-body flex-1 overflow-y-auto custom-scrollbar space-y-4">
        
        {/* --- 1. หมวดการเล่นเสียง --- */}
        <div className="tool-tab-card bg-white p-3 border border-slate-200 shadow-sm">
          <h4 className="text-[11px] font-bold text-slate-700 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            🔊 การเล่นเสียง (Playback)
          </h4>
          <div className="space-y-4">
            
            {/* ความเร็วการกรอ (ระดับ 1-10) */}
            <div>
              <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                <span>ความเร็วการรัว (Speed)</span>
                <span className="font-bold text-blue-600">ระดับ {currentLevel}</span>
              </label>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] text-slate-400">ช้า</span>
                 <input 
                    type="range" min="1" max="10" step="1" 
                    value={currentLevel} 
                    onChange={(e) => {
                       const newLevel = parseInt(e.target.value);
                       handleUpdate('Speed', speedLevelToMs(newLevel));
                    }} 
                    className="flex-1 h-1.5 bg-slate-200 rounded-lg accent-blue-500 cursor-pointer" 
                 />
                 <span className="text-[10px] text-slate-400">เร็ว</span>
              </div>
            </div>

            {/* มือที่นำก่อน */}
            <div className="bg-slate-50 p-2 rounded-md border border-slate-100">
              <label className="text-[10px] font-bold text-slate-500 block mb-2 text-center">เริ่มด้วยมือไหนก่อน?</label>
              <div className="grid grid-cols-2 gap-1">
                <button 
                  onClick={() => handleUpdate('StartHand', 'right')} 
                  className={`py-1.5 text-[10px] font-bold rounded-md transition-all border ${getValue('StartHand') !== 'left' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                >
                   ขวา (เสียงสูง)
                </button>
                <button 
                  onClick={() => handleUpdate('StartHand', 'left')} 
                  className={`py-1.5 text-[10px] font-bold rounded-md transition-all border ${getValue('StartHand') === 'left' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                >
                  ซ้าย (เสียงต่ำ) 
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* --- 2. หมวดรูปลักษณ์เส้น --- */}
        <div className="tool-tab-card bg-white p-3 border border-slate-200 shadow-sm">
          <h4 className="text-[11px] font-bold text-slate-700 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            👁️ รูปลักษณ์เส้นกราฟิก
          </h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-bold">สีของเส้นประ</span>
              <input type="color" value={getValue('Color') || '#3b82f6'} onChange={(e) => handleUpdate('Color', e.target.value)} className="w-6 h-6 p-0 border border-slate-300 rounded cursor-pointer" />
            </div>
            
            <div>
              <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                <span>ระยะแนวดิ่ง (หลบตัวโน้ต)</span>
                <span className="font-bold text-blue-600">{getValue('Offset') ?? 30}</span>
              </label>
              <input type="range" min="0" max="60" value={getValue('Offset') ?? 30} onChange={(e) => handleUpdate('Offset', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-blue-500 cursor-pointer" />
            </div>

            <div>
              <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                <span>ความหนาเส้น</span>
                <span className="font-bold text-blue-600">{getValue('StrokeWidth') ?? 2.5}px</span>
              </label>
              <input type="range" min="1" max="6" step="0.5" value={getValue('StrokeWidth') ?? 2.5} onChange={(e) => handleUpdate('StrokeWidth', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-blue-500 cursor-pointer" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default KroTab;
