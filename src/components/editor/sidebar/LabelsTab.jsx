import React, { useContext } from 'react';
import { MusicContext } from '../../../contexts/MusicContext';

const LabelsTab = () => {
  const { 
    selectedCell, sectionLabels, addSectionLabel, 
    updateSectionLabel, removeSectionLabel, rowTypes 
  } = useContext(MusicContext);

  const currentRow = selectedCell ? selectedCell[0] : 0;
  const getVisualRowNumber = (rowIndex) => {
    if (!rowTypes) return 1;
    let count = 0;
    for (let i = 0; i <= rowIndex; i++) {
      if (rowTypes[i] === 'single' || rowTypes[i] === 'double-right') count++;
    }
    return count;
  };
  const visualRowNumber = getVisualRowNumber(currentRow);
  const visualIndex = visualRowNumber > 0 ? visualRowNumber - 1 : 0; 
  const currentLabels = sectionLabels ? (sectionLabels[visualIndex] || []) : [];

  return (
    <div className="flex flex-col h-full bg-slate-50/50 animate-fadeIn">
      <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center shrink-0">
        <h3 className="text-xs font-black text-indigo-800 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
          ป้ายกำกับ
        </h3>
        <span className="text-[10px] font-bold text-indigo-500 bg-white px-2 py-1 rounded border border-indigo-200">
          บรรทัด {visualRowNumber}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
        <button 
          onClick={() => addSectionLabel(visualIndex)} 
          className="w-full mb-2 py-2 text-[11px] font-bold text-indigo-500 border border-indigo-200 bg-white rounded-lg hover:bg-indigo-50 transition-all shadow-sm"
        >
          + สร้างป้ายกำกับบรรทัดนี้
        </button>

        {currentLabels.map((label) => (
          <div key={label.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative group">
            <button onClick={() => removeSectionLabel(visualIndex, label.id)} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-10">✕</button>
            <input type="text" placeholder="เช่น ท่อน ๑..." value={label.text} onChange={(e) => updateSectionLabel(visualIndex, label.id, { text: e.target.value })} className="w-full p-2 mb-3 text-sm text-indigo-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-400 font-bold" />
            
            {/* ❌ เอาส่วน Slider ปรับขนาดออกไปเรียบร้อยแล้ว */}

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-slate-500">ระยะแนวตั้ง</span>
                <span className="text-[10px] font-bold text-indigo-600">{label.offsetY !== undefined ? label.offsetY : 6}px</span>
              </div>
              <input type="range" min="-30" max="60" value={label.offsetY !== undefined ? label.offsetY : 6} onChange={(e) => updateSectionLabel(visualIndex, label.id, { offsetY: parseInt(e.target.value) })} className="w-full h-1 bg-slate-200 rounded-lg accent-indigo-500 cursor-pointer" />
            </div>

            <div className="bg-slate-50 p-2 rounded-md border border-slate-100 mt-3">
              <label className="text-[10px] font-bold text-slate-500 block mb-2 text-center">ตำแหน่งการวาง</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'top-left', name: 'บนซ้าย' }, { id: 'top-center', name: 'บนกลาง' }, { id: 'top-right', name: 'บนขวา' },
                  { id: 'bottom-left', name: 'ล่างซ้าย' }, { id: 'bottom-center', name: 'ล่างกลาง' }, { id: 'bottom-right', name: 'ล่างขวา' }
                ].map((pos) => (
                  <button 
                    key={pos.id}
                    onClick={() => updateSectionLabel(visualIndex, label.id, { position: pos.id })} 
                    className={`py-1.5 text-[10px] rounded-md transition-all border ${label.position === pos.id ? 'bg-indigo-100 text-indigo-700 font-bold border-indigo-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                  >
                    {pos.name}
                  </button>
                ))}
              </div>
            </div>

          </div>
        ))}
        
        {currentLabels.length === 0 && (
          <div className="text-center py-8 text-[11px] font-medium text-slate-400 border border-dashed border-slate-200 rounded-lg">
            ยังไม่มีป้ายกำกับในบรรทัดนี้
          </div>
        )}
      </div>
    </div>
  );
};

export default LabelsTab;