import React, { useContext, useState } from 'react';
import { MusicContext } from '../../contexts/MusicContext';
import { INSTRUMENT_CONFIG } from '../../utils/instrumentConfig';

const Sidebar = ({ isOpen }) => {
  const { 
    currentInstrument, changeInstrument, 
    layoutConfig, setLayoutConfig,
    headerDetails, addDetail, removeDetail, updateDetail,
    songName, setSongName,
    selectedCell, sectionLabels, addSectionLabel, updateSectionLabel, removeSectionLabel,
    rowTypes
  } = useContext(MusicContext);
  
  // เปลี่ยนเป็น 3 แท็บหลักให้เป็นระเบียบ
  const [activeTab, setActiveTab] = useState('info');

  const updateLayout = (key, value) => {
    setLayoutConfig(prev => ({ ...prev, [key]: value }));
  };

  const currentRow = selectedCell[0];

  const getVisualRowNumber = (rowIndex) => {
    let count = 0;
    for (let i = 0; i <= rowIndex; i++) {
      if (rowTypes[i] === 'single' || rowTypes[i] === 'double-right') {
        count++;
      }
    }
    return count;
  };

  const visualRowNumber = getVisualRowNumber(currentRow);
  const visualIndex = visualRowNumber > 0 ? visualRowNumber - 1 : 0; 
  const currentLabels = sectionLabels[visualIndex] || [];

  return (
    <aside 
      className={`bg-[#f8fafd] border-r border-slate-200 flex flex-col h-full shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-0 font-sans transition-all duration-300 ease-in-out overflow-hidden
        ${isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-r-0'}`}
    >
      {/* 🚀 แถบเมนู Tabs แบบคลีนๆ (Pill Design) */}
      <div className="flex p-2 bg-slate-50 border-b border-slate-200 shrink-0 gap-1">
        {[
          { id: 'info', label: 'ข้อมูลโปรเจกต์', icon: '📄' },
          { id: 'labels', label: 'ป้ายกำกับ', icon: '🏷️' },
          { id: 'style', label: 'สไตล์กระดาษ', icon: '🎨' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-1 text-[11px] font-bold rounded-md transition-all flex flex-col items-center gap-1 ${activeTab === tab.id ? 'bg-white shadow-sm text-sky-600 border border-slate-200/60' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar min-w-[18rem]">
        
        {/* 📄 แท็บที่ 1: ข้อมูลโปรเจกต์ */}
        {activeTab === 'info' && (
          <div className="space-y-6">
            
            <section>
              <label className="text-xs font-bold text-slate-700 block mb-2">🎹 เครื่องดนตรีหลัก</label>
              <select 
                value={currentInstrument.id}
                onChange={(e) => changeInstrument(e.target.value)}
                className="w-full p-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 font-bold transition-all cursor-pointer"
              >
                {Object.values(INSTRUMENT_CONFIG).map((inst) => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </section>

            <hr className="border-slate-200" />

            <section>
              <label className="text-xs font-bold text-slate-700 block mb-2">📝 หัวกระดาษ (ชื่อเพลง)</label>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-4">
                <input 
                  type="text" value={songName} onChange={(e) => setSongName(e.target.value)}
                  className="w-full p-2 text-sm text-sky-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-sky-400 font-bold text-center transition-colors"
                  placeholder="พิมพ์ชื่อเพลงที่นี่..."
                />
                <div>
                  <label className="text-[11px] text-slate-500 flex justify-between mb-1.5">
                    <span>ขนาดอักษร</span>
                    <span className="font-bold text-sky-600">{layoutConfig.songNameSize}px</span>
                  </label>
                  <input 
                    type="range" min="20" max="100" value={layoutConfig.songNameSize} 
                    onChange={(e) => updateLayout('songNameSize', parseInt(e.target.value))} 
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" 
                  />
                </div>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-700">📌 รายละเอียดเพิ่มเติม</label>
              </div>
              
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-4">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1.5">การจัดวาง</label>
                  <div className="flex bg-slate-100 p-1 rounded-md gap-1">
                    {[
                      { id: 'left', label: 'ซ้าย' }, { id: 'center', label: 'กลาง' },
                      { id: 'right', label: 'ขวา' }, { id: 'between', label: 'แยกซ้าย-ขวา' }
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => updateLayout('detailsAlign', pos.id)}
                        className={`flex-1 py-1.5 text-[10px] rounded transition-all ${layoutConfig.detailsAlign === pos.id ? 'bg-white shadow-sm text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {headerDetails.map((detail) => (
                    <div key={detail.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-md border border-slate-100 group relative">
                      <button 
                        onClick={() => removeDetail(detail.id)}
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                        title="ลบ"
                      >✕</button>
                      <input 
                        type="text" value={detail.label} onChange={(e) => updateDetail(detail.id, 'label', e.target.value)}
                        className="w-1/3 text-[11px] font-bold text-slate-500 bg-transparent border-b border-transparent focus:border-sky-300 outline-none focus:text-sky-600 transition-colors"
                        placeholder="หัวข้อ"
                      />
                      <span className="text-slate-300">:</span>
                      <input 
                        type="text" value={detail.value} onChange={(e) => updateDetail(detail.id, 'value', e.target.value)}
                        className="w-2/3 text-xs text-slate-700 bg-transparent border-b border-transparent focus:border-sky-300 outline-none transition-colors"
                        placeholder="รายละเอียด"
                      />
                    </div>
                  ))}
                  <button 
                    onClick={addDetail}
                    className="w-full py-2 border border-dashed border-slate-300 rounded-md text-xs text-slate-500 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50 transition-all font-semibold flex items-center justify-center gap-1"
                  >
                    <span>+</span> เพิ่มข้อมูล
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <label className="text-[11px] text-slate-500 flex justify-between mb-1.5">
                    <span>ขนาดอักษรรายละเอียด</span>
                    <span className="font-bold text-sky-600">{layoutConfig.authorSize}px</span>
                  </label>
                  <input type="range" min="12" max="30" value={layoutConfig.authorSize} onChange={(e) => updateLayout('authorSize', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 🏷️ แท็บที่ 2: ป้ายกำกับ (Section Labels) */}
        {activeTab === 'labels' && (
          <div className="space-y-4">
            <div className="bg-sky-50/50 border border-sky-100 p-3 rounded-lg text-center mb-2">
               <span className="text-xs text-slate-500">กำลังเลือกบรรทัดที่: </span>
               <span className="text-lg font-black text-sky-600">{visualRowNumber}</span>
            </div>

            <button 
              onClick={() => addSectionLabel(visualIndex)}
              className="w-full py-2.5 bg-sky-500 text-white rounded-lg hover:bg-sky-600 font-bold shadow-sm transition-all text-sm flex justify-center items-center gap-2 active:scale-95"
            >
              <span>+</span> สร้างป้ายกำกับใหม่
            </button>
            
            <div className="space-y-3 mt-4">
              {currentLabels.map((label) => (
                <div key={label.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative group">
                  <button 
                    onClick={() => removeSectionLabel(visualIndex, label.id)}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm"
                  >✕</button>
                  
                  <input 
                    type="text" 
                    placeholder="เช่น ท่อน ๑, ลูกล้อ..."
                    value={label.text} 
                    onChange={(e) => updateSectionLabel(visualIndex, label.id, { text: e.target.value })}
                    className="w-full p-2 mb-3 text-sm text-sky-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 font-bold transition-all"
                  />

                  <div className="flex gap-2 items-end mb-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 flex justify-between mb-1.5">
                        <span>ขนาดตัวอักษร</span>
                        <span className="font-bold text-sky-600">{label.fontSize}px</span>
                      </label>
                      <input 
                        type="range" min="10" max="40" value={label.fontSize} 
                        onChange={(e) => updateSectionLabel(visualIndex, label.id, { fontSize: parseInt(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" 
                      />
                    </div>
                    <button 
                      onClick={() => updateSectionLabel(visualIndex, label.id, { isBold: !label.isBold })}
                      className={`w-9 h-7 flex items-center justify-center rounded-md text-xs transition-all border
                        ${label.isBold ? 'bg-slate-800 text-white font-bold border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                      title="ตัวหนา"
                    >
                      B
                    </button>
                  </div>

                  <div className="mb-4">
                      <label className="text-[10px] text-slate-500 flex justify-between mb-1.5">
                        <span>ระยะห่างแนวตั้ง (ลอยขึ้น-ลง)</span>
                        <span className="font-bold text-sky-600">{label.offsetY !== undefined ? label.offsetY : 6}px</span>
                      </label>
                      <input 
                        type="range" min="-30" max="60" value={label.offsetY !== undefined ? label.offsetY : 6} 
                        onChange={(e) => updateSectionLabel(visualIndex, label.id, { offsetY: parseInt(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" 
                      />
                  </div>

                  <div className="bg-slate-50 p-2 rounded-md border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-500 block mb-2 text-center">ตำแหน่งการวาง</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'top-left', name: 'บนซ้าย' }, { id: 'top-center', name: 'บนกลาง' }, { id: 'top-right', name: 'บนขวา' },
                        { id: 'bottom-left', name: 'ล่างซ้าย' }, { id: 'bottom-center', name: 'ล่างกลาง' }, { id: 'bottom-right', name: 'ล่างขวา' }
                      ].map((pos) => (
                        <button 
                          key={pos.id}
                          onClick={() => updateSectionLabel(visualIndex, label.id, { position: pos.id })} 
                          className={`py-1.5 text-[10px] rounded-md transition-all border ${label.position === pos.id ? 'bg-sky-100 text-sky-700 font-bold border-sky-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                        >
                          {pos.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              
              {currentLabels.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 bg-white border border-dashed border-slate-200 rounded-lg">
                  ยังไม่มีป้ายกำกับในบรรทัดนี้
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🎨 แท็บที่ 3: สไตล์กระดาษ */}
        {activeTab === 'style' && (
          <div className="space-y-6">
            
            <section className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <label className="text-xs font-bold text-slate-700 block border-b border-slate-100 pb-2">🎵 อักษรตัวโน้ต</label>
              <div>
                <label className="text-[11px] text-slate-500 flex justify-between mb-1.5">
                  <span>ขนาดตัวโน้ต</span>
                  <span className="font-bold text-sky-600">{layoutConfig.fontSize}px</span>
                </label>
                <input type="range" min="16" max="60" value={layoutConfig.fontSize} onChange={(e) => updateLayout('fontSize', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => updateLayout('isBold', !layoutConfig.isBold)}
                  className={`flex-1 py-2 text-xs rounded-md border transition-all ${layoutConfig.isBold ? 'bg-slate-800 text-white border-slate-800 font-bold shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                >
                  ตัวหนา (B)
                </button>
                <button 
                  onClick={() => updateLayout('isItalic', !layoutConfig.isItalic)}
                  className={`flex-1 py-2 text-xs rounded-md border transition-all ${layoutConfig.isItalic ? 'bg-slate-800 text-white border-slate-800 italic font-bold shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                >
                  ตัวเอียง (I)
                </button>
              </div>
            </section>

            <section className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <label className="text-xs font-bold text-slate-700 block border-b border-slate-100 pb-2">📏 สัดส่วนหน้ากระดาษ</label>
              <div>
                <label className="text-[11px] text-slate-500 flex justify-between mb-1.5">
                  <span>ความสูงห้องเพลง</span>
                  <span className="font-bold text-sky-600">{layoutConfig.measureHeight}px</span>
                </label>
                <input type="range" min="30" max="100" value={layoutConfig.measureHeight} onChange={(e) => updateLayout('measureHeight', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 flex justify-between mb-1.5">
                  <span>ระยะห่างระหว่างบรรทัด</span>
                  <span className="font-bold text-sky-600">{layoutConfig.rowGap}px</span>
                </label>
                <input type="range" min="0" max="100" value={layoutConfig.rowGap} onChange={(e) => updateLayout('rowGap', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
              </div>
            </section>

            <section className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <label className="text-xs font-bold text-slate-700">✍️ เส้นตาราง</label>
                <div className="flex items-center gap-2">
                   <label className="text-[10px] text-slate-400">สีเส้น:</label>
                   <input type="color" value={layoutConfig.borderColor} onChange={(e) => updateLayout('borderColor', e.target.value)} className="w-6 h-6 p-0 border border-slate-200 rounded cursor-pointer bg-transparent" title="สีเส้นตาราง" />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 flex justify-between mb-1.5">
                  <span>เส้นขอบนอก</span>
                  <span className="font-bold text-sky-600">{layoutConfig.borderWidth}px</span>
                </label>
                <input type="range" min="1" max="5" value={layoutConfig.borderWidth} onChange={(e) => updateLayout('borderWidth', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 flex justify-between mb-1.5">
                  <span>เส้นกั้นภายในช่อง</span>
                  <span className="font-bold text-sky-600">{layoutConfig.innerBorderWidth}px</span>
                </label>
                <input type="range" min="0" max="3" step="0.5" value={layoutConfig.innerBorderWidth} onChange={(e) => updateLayout('innerBorderWidth', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 flex justify-between mb-1.5">
                  <span>ความมนขอบตาราง</span>
                  <span className="font-bold text-sky-600">{layoutConfig.borderRadius}px</span>
                </label>
                <input type="range" min="0" max="20" value={layoutConfig.borderRadius} onChange={(e) => updateLayout('borderRadius', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
              </div>
            </section>

          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;