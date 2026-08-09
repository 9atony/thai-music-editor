import React, { useContext } from 'react';
import { MusicContext } from '../../../contexts/MusicContext';

const SabatTab = () => {
  const { 
    layoutConfig, 
    setLayoutConfig, 
    symbols, 
    updateSymbol, 
    selectedSymbolId 
  } = useContext(MusicContext);

  // หาสัญลักษณ์สะบัดที่กำลังคลิกอยู่ (ถ้าไม่มี = ตั้งค่าเริ่มต้นของทั้งหน้า)
  const selectedSym = symbols.find(s => s.id === selectedSymbolId && s.type === 'sabat');
  const isGlobal = !selectedSym;

  const getValue = (key) => {
    const lowerKey = key.toLowerCase();
    if (isGlobal) {
      return layoutConfig[`sabat${key}`]; 
    }
    return selectedSym[lowerKey] !== undefined ? selectedSym[lowerKey] : layoutConfig[`sabat${key}`];
  };
  
  const handleUpdate = (key, value) => {
    const normalizedKey = key.toLowerCase();
    if (isGlobal) {
      setLayoutConfig(prev => ({ ...prev, [`sabat${key}`]: value }));
    } else {
      updateSymbol(selectedSymbolId, { [normalizedKey]: value });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 animate-fadeIn">
      {/* Header */}
      <div className={`p-4 border-b flex justify-between items-center shrink-0 shadow-sm ${isGlobal ? 'bg-amber-50 border-amber-100' : 'bg-orange-100 border-orange-200'}`}>
        <div>
          <h3 className="text-xs font-black text-amber-800 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8c4-4 8 8 16 0" /></svg>
            ตั้งค่าลูกสะบัด (กราฟิก)
          </h3>
          <p className="text-[10px] text-amber-600 mt-1 font-semibold">
            {isGlobal ? 'ค่าเริ่มต้นของทั้งโปรเจกต์' : 'กำลังแก้ไขเส้นที่เลือกอยู่'}
          </p>
        </div>
        {!isGlobal && (
           <span className="animate-pulse w-2 h-2 bg-orange-500 rounded-full shadow-sm" title="โหมดแก้ไขเฉพาะจุด"></span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
        
        {/* --- หมวดรูปลักษณ์เส้น --- */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-[11px] font-bold text-slate-700 mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
            👁️ รูปลักษณ์เส้นกราฟิก
          </h4>
          
          <div className="space-y-5">
            {/* สีของเส้น */}
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-600 font-bold">สีของเส้น</span>
              <div className="p-0.5 bg-white border border-slate-200 rounded-md shadow-sm hover:border-amber-400 transition-colors">
                <input 
                  type="color" 
                  value={getValue('Color') || '#1e293b'} 
                  onChange={(e) => handleUpdate('Color', e.target.value)} 
                  className="w-7 h-7 p-0 border-0 rounded cursor-pointer bg-transparent block" 
                  title="เปลี่ยนสีเส้น"
                />
              </div>
            </div>
            
            {/* ความนูนของเส้นโค้ง */}
            <div>
              <label className="text-[11px] text-slate-600 flex justify-between mb-2">
                <span className="font-bold">ความนูนของเส้นโค้ง</span>
                <span className="font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">{getValue('Curve') ?? 20}</span>
              </label>
              <input 
                type="range" min="0" max="60" 
                value={getValue('Curve') ?? 20} 
                onChange={(e) => handleUpdate('Curve', parseInt(e.target.value))} 
                className="w-full h-1.5 bg-slate-200 rounded-lg accent-amber-500 cursor-pointer" 
              />
            </div>

            {/* ความหนาเส้น */}
            <div>
              <label className="text-[11px] text-slate-600 flex justify-between mb-2">
                <span className="font-bold">ความหนาเส้น</span>
                <span className="font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">{getValue('StrokeWidth') ?? 2.5} px</span>
              </label>
              <input 
                type="range" min="0.5" max="10" step="0.1" 
                value={getValue('StrokeWidth') ?? 2.5} 
                onChange={(e) => handleUpdate('StrokeWidth', parseFloat(e.target.value))} 
                className="w-full h-1.5 bg-slate-200 rounded-lg accent-amber-500 cursor-pointer" 
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SabatTab;