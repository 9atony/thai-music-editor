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
    <div className="tool-tab-root flex flex-col h-full animate-fadeIn">
      {/* ⭐ เติม CSS ให้ข้อความ Placeholder ทำงานได้สมบูรณ์ */}
      {/* Header */}
      <div className="tool-tab-header flex justify-between items-center shrink-0 border-b">
        <h3 className="text-xs font-black text-indigo-800 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
          จัดการป้ายกำกับ
        </h3>
        <span className="text-[10px] font-bold text-indigo-500 bg-white px-2 py-1 rounded border border-indigo-200">
          บรรทัด {visualRowNumber}
        </span>
      </div>

      <div className="tool-tab-body flex-1 overflow-y-auto custom-scrollbar space-y-4">
        <button 
          onClick={() => addSectionLabel(visualIndex)} 
          className="w-full mb-1 py-2.5 text-[11px] font-bold text-white bg-indigo-500 border border-indigo-600 rounded-lg hover:bg-indigo-600 transition-all shadow-sm flex items-center justify-center gap-1 active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          สร้างป้ายกำกับใหม่
        </button>

        {currentLabels.map((label) => {

          
          return (
            <div key={label.id} className="tool-tab-card bg-white border border-slate-200 shadow-sm relative group overflow-hidden">
              
              <button 
                onClick={() => removeSectionLabel(visualIndex, label.id)} 
                className="absolute top-1.5 right-1.5 bg-white border border-slate-200 text-rose-500 hover:bg-rose-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm"
                title="ลบป้ายกำกับ"
              >✕</button>
              
              <button onClick={() => { const editor = document.getElementById(`sheet-label-${label.id}`); editor?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); editor?.focus(); }} className="w-full p-3 pr-8 text-left text-xs text-indigo-700 bg-indigo-50 border-b border-slate-200">{'แก้ข้อความ'} (Playback Console)</button>
              <div className="p-3 bg-white">
                <span className="text-[10px] font-bold text-slate-500 mb-3 block">2. การจัดวางป้ายกำกับ (ทั้งกล่อง)</span>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-600">ขยับตำแหน่งแนวตั้ง</span>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{label.offsetY !== undefined ? label.offsetY : 6} px</span>
                  </div>
                  <input 
                    type="range" min="-50" max="100" 
                    value={label.offsetY !== undefined ? label.offsetY : 6} 
                    onChange={(e) => updateSectionLabel(visualIndex, label.id, { offsetY: parseInt(e.target.value) })} 
                    className="w-full h-1.5 bg-slate-200 rounded-lg accent-indigo-500 cursor-pointer" 
                  />
                </div>

                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <label className="text-[10px] font-bold text-slate-500 block mb-2 text-center">ชิดมุมกระดาษ</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'top-left', name: 'บนซ้าย' }, { id: 'top-center', name: 'บนกลาง' }, { id: 'top-right', name: 'บนขวา' },
                      { id: 'bottom-left', name: 'ล่างซ้าย' }, { id: 'bottom-center', name: 'ล่างกลาง' }, { id: 'bottom-right', name: 'ล่างขวา' }
                    ].map((pos) => (
                      <button 
                        key={pos.id}
                        onClick={() => updateSectionLabel(visualIndex, label.id, { position: pos.id })} 
                        className={`py-1.5 text-[10px] rounded-md transition-all border shadow-sm ${label.position === pos.id ? 'bg-indigo-100 text-indigo-700 font-black border-indigo-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                      >
                        {pos.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
        
        {currentLabels.length === 0 && (
          <div className="text-center py-10 flex flex-col items-center border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
            <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            <span className="text-[11px] font-bold text-slate-400">ยังไม่มีป้ายกำกับ</span>
            <span className="text-[10px] text-slate-400 mt-1">กดปุ่มสีม่วงด้านบนเพื่อสร้าง</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabelsTab;
