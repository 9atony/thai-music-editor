import React, { useRef, useState, useEffect, useContext } from 'react';
import { useReactToPrint } from 'react-to-print';
import Navbar from '../components/layout/Navbar';
import SettingsModal from '../components/editor/SettingsModal'; 
import Keyboard from '../components/editor/Keyboard';
import Sheet from '../components/editor/Sheet';
import { MusicContext } from '../contexts/MusicContext'; 

function DesktopEditor({ onBack }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // ⭐ เปลี่ยนมาใช้ State ตัวเดียวเพื่อควบคุมว่ากำลังเปิดแผงไหนอยู่ ('sequence', 'labels', 'table' หรือ null)
  const [activeSidePanel, setActiveSidePanel] = useState(null); 
  
  const [draggedSeqIdx, setDraggedSeqIdx] = useState(null);
  const componentRef = useRef();

  const { 
    addTextRow, stopPlayback,
    playbackSequence, setPlaybackSequence,
    activeSequenceIdx, activeLoop,
    isPlaying, sectionLabels,
    selectedCell, addSectionLabel, updateSectionLabel, removeSectionLabel, rowTypes,
    layoutConfig, setLayoutConfig // ✨ ดึง State การตั้งค่าเลย์เอาต์มาใช้งาน
  } = useContext(MusicContext);

  const stopPlaybackRef = useRef(stopPlayback);
  useEffect(() => {
    stopPlaybackRef.current = stopPlayback;
  }, [stopPlayback]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: 'Thai-Music-Note', 
  });

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault(); 
        if (addTextRow) {
          addTextRow(); 
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addTextRow]);

  useEffect(() => {
    return () => {
      if (stopPlaybackRef.current) {
        stopPlaybackRef.current(); 
      }
    };
  }, []); 

  // ================== ฟังก์ชันตั้งค่าตาราง ==================
  const updateLayout = (key, value) => {
    setLayoutConfig(prev => ({ ...prev, [key]: value }));
  };

  // ================== ฟังก์ชันจัดการลำดับการเล่น ==================
  const handleDragStart = (e, index) => {
    setDraggedSeqIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedSeqIdx === null || draggedSeqIdx === targetIndex) return;
    const newSeq = [...playbackSequence];
    const draggedItem = newSeq[draggedSeqIdx];
    newSeq.splice(draggedSeqIdx, 1);
    newSeq.splice(targetIndex, 0, draggedItem);
    setPlaybackSequence(newSeq);
    setDraggedSeqIdx(null);
  };
  const updateSeqItem = (index, key, value) => {
    const newSeq = [...playbackSequence];
    newSeq[index] = { ...newSeq[index], [key]: value };
    setPlaybackSequence(newSeq);
  };
  const addSeqItem = () => {
    setPlaybackSequence([...playbackSequence, { id: Date.now(), label: 'ท่อนใหม่', loops: 1 }]);
  };
  const removeSeqItem = (index) => {
    const newSeq = [...playbackSequence];
    newSeq.splice(index, 1);
    setPlaybackSequence(newSeq);
  };
  const autoScanSections = () => {
    const newSeq = [];
    const sortedIndices = Object.keys(sectionLabels).map(Number).sort((a, b) => a - b);
    sortedIndices.forEach(vIdx => {
      sectionLabels[vIdx].forEach(lbl => {
        if (!lbl.text.includes('กลับต้น')) {
          newSeq.push({ id: Date.now() + Math.random(), label: lbl.text.trim(), loops: 1 });
        }
      });
    });
    if (newSeq.length > 0) {
      setPlaybackSequence(newSeq);
    } else {
      alert('ไม่พบป้ายกำกับบนกระดาษครับ กรุณาสร้างป้ายกำกับ (เช่น ท่อน 1) ก่อนกดสแกน');
    }
  };

  // ================== ฟังก์ชันคำนวณป้ายกำกับ ==================
  const currentRow = selectedCell ? selectedCell[0] : 0;
  const getVisualRowNumber = (rowIndex) => {
    if (!rowTypes) return 1;
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
  const currentLabels = sectionLabels ? (sectionLabels[visualIndex] || []) : [];

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 font-sans overflow-hidden">
      
      <Navbar onPrint={handlePrint} onOpenSettings={handleOpenSettings} onBack={onBack} />

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* ⭐ แผงสไลด์ด้านซ้าย */}
        <div 
          className={`absolute top-0 left-0 h-full z-40 bg-white border-r border-slate-200 shadow-xl transition-transform duration-300 flex flex-col ${activeSidePanel ? 'w-[260px] translate-x-0' : 'w-[260px] -translate-x-full'}`}
        >
          {/* ================= ปุ่มเปิด/ปิด 1: ลำดับการเล่น ================= */}
          <button 
            onClick={() => setActiveSidePanel(activeSidePanel === 'sequence' ? null : 'sequence')}
            className={`absolute top-4 -right-[41px] border-y border-r border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group
              ${activeSidePanel === 'sequence' ? 'bg-sky-500 text-white border-sky-600' : 'bg-white text-slate-500 hover:text-sky-500'}`}
            title="ลำดับการเล่น"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7M15 15l5-3-5-3v6z" /></svg>
          </button>

          {/* ================= ปุ่มเปิด/ปิด 2: ป้ายกำกับ ================= */}
          <button 
            onClick={() => setActiveSidePanel(activeSidePanel === 'labels' ? null : 'labels')}
            className={`absolute top-16 -right-[41px] border-y border-r border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group
              ${activeSidePanel === 'labels' ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-white text-slate-500 hover:text-indigo-500'}`}
            title="ป้ายกำกับ"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
          </button>

          {/* ================= ปุ่มเปิด/ปิด 3: ตั้งค่าตาราง ================= */}
          <button 
            onClick={() => setActiveSidePanel(activeSidePanel === 'table' ? null : 'table')}
            className={`absolute top-28 -right-[41px] border-y border-r border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group
              ${activeSidePanel === 'table' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-500 hover:text-emerald-500'}`}
            title="ตั้งค่าตาราง"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>

          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* ---------------- หน้าต่าง 1: ลำดับการเล่น ---------------- */}
            {activeSidePanel === 'sequence' && (
              <div className="flex flex-col h-full bg-slate-50/50 animate-fadeIn">
                <div className="p-3 bg-sky-50 border-b border-sky-100 flex justify-between items-center shrink-0">
                  <h3 className="text-xs font-black text-sky-800 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h16M7 16V8m5 8V5m5 11v-6" /></svg>
                    ลำดับการเล่น
                  </h3>
                  <button onClick={autoScanSections} className="text-[10px] bg-white border border-sky-200 text-sky-600 px-2 py-1 rounded hover:bg-sky-100 font-bold active:scale-95 transition-all shadow-sm">
                    สแกนป้าย
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1.5">
                  {playbackSequence.map((item, idx) => {
                    const isCurrentlyPlaying = isPlaying && activeSequenceIdx === idx;
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        className={`flex justify-between items-center px-2 py-2 rounded-lg border transition-all ${
                          isCurrentlyPlaying 
                            ? 'bg-sky-100 border-sky-300 text-sky-800 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-600 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
                          <span className="text-[10px] text-slate-300 cursor-grab hover:text-slate-500">⠿</span>
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateSeqItem(idx, 'label', e.target.value)}
                            className={`w-full bg-transparent outline-none font-bold text-xs truncate ${isCurrentlyPlaying ? 'text-sky-800' : 'text-slate-700'}`}
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0 pl-1">
                          <input
                            type="number" min="1"
                            value={item.loops}
                            onChange={(e) => updateSeqItem(idx, 'loops', parseInt(e.target.value) || 1)}
                            className="w-8 text-center bg-slate-100 border border-slate-200 rounded p-1 text-[10px] font-bold outline-none focus:border-sky-400 focus:bg-white"
                            title="จำนวนรอบ"
                          />
                          <button onClick={() => removeSeqItem(idx)} className="text-slate-300 hover:text-rose-500 text-xs pl-1">✕</button>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={addSeqItem} className="w-full py-2.5 mt-2 text-[11px] font-bold text-slate-400 border border-dashed border-slate-200 rounded-lg hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50 transition-all">
                    + เพิ่มท่อนใหม่
                  </button>
                </div>

                <div className="p-3 bg-slate-800 text-white flex justify-between items-center text-xs border-t border-slate-700 shrink-0">
                  <span className="font-semibold text-slate-300">รอบที่เล่นอยู่</span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black shadow-inner ${isPlaying ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                    {isPlaying ? activeLoop : '-'}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- หน้าต่าง 2: ป้ายกำกับ ---------------- */}
            {activeSidePanel === 'labels' && (
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
                      <div className="flex gap-2 items-end mb-3">
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-slate-500">ขนาด</span>
                            <span className="text-[10px] font-bold text-indigo-600">{label.fontSize}px</span>
                          </div>
                          <input type="range" min="10" max="40" value={label.fontSize} onChange={(e) => updateSectionLabel(visualIndex, label.id, { fontSize: parseInt(e.target.value) })} className="w-full h-1 bg-slate-200 rounded-lg accent-indigo-500 cursor-pointer" />
                        </div>
                        <button onClick={() => updateSectionLabel(visualIndex, label.id, { isBold: !label.isBold })} className={`w-7 h-7 flex items-center justify-center rounded-md text-[11px] border transition-colors ${label.isBold ? 'bg-slate-800 text-white font-bold border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>B</button>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-slate-500">ระยะแนวตั้ง</span>
                          <span className="text-[10px] font-bold text-indigo-600">{label.offsetY !== undefined ? label.offsetY : 6}px</span>
                        </div>
                        <input type="range" min="-30" max="60" value={label.offsetY !== undefined ? label.offsetY : 6} onChange={(e) => updateSectionLabel(visualIndex, label.id, { offsetY: parseInt(e.target.value) })} className="w-full h-1 bg-slate-200 rounded-lg accent-indigo-500 cursor-pointer" />
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
            )}

            {/* ---------------- หน้าต่าง 3: ตั้งค่าตาราง ---------------- */}
            {activeSidePanel === 'table' && (
              <div className="flex flex-col h-full bg-slate-50/50 animate-fadeIn">
                <div className="p-3 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center shrink-0">
                  <h3 className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    ตั้งค่าตาราง
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-4">
                  
                  {/* --- ส่วนที่ 1: สัดส่วนตาราง --- */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <h4 className="text-[11px] font-bold text-slate-700 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      📏 สัดส่วนตาราง
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                          <span>ความสูงห้องเพลง</span>
                          <span className="font-bold text-emerald-600">{layoutConfig?.measureHeight || 50}px</span>
                        </label>
                        <input 
                          type="range" min="30" max="100" 
                          value={layoutConfig?.measureHeight || 50} 
                          onChange={(e) => updateLayout('measureHeight', parseInt(e.target.value))} 
                          className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer" 
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                          <span>ระยะห่างระหว่างบรรทัด</span>
                          <span className="font-bold text-emerald-600">{layoutConfig?.rowGap || 10}px</span>
                        </label>
                        <input 
                          type="range" min="0" max="100" 
                          value={layoutConfig?.rowGap || 10} 
                          onChange={(e) => updateLayout('rowGap', parseInt(e.target.value))} 
                          className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* --- ส่วนที่ 2: เส้นตาราง --- */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                      <h4 className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        ✍️ เส้นตาราง
                      </h4>
                      {/* กล่องเลือกสีเส้น */}
                      <input 
                        type="color" 
                        value={layoutConfig?.borderColor || '#0f172a'} 
                        onChange={(e) => updateLayout('borderColor', e.target.value)} 
                        className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                        title="สีเส้นตาราง"
                      />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                          <span>เส้นขอบนอก</span>
                          <span className="font-bold text-emerald-600">{layoutConfig?.outerBorderWidth !== undefined ? layoutConfig.outerBorderWidth : 1}px</span>
                        </label>
                        <input 
                          type="range" min="0" max="10" 
                          value={layoutConfig?.outerBorderWidth !== undefined ? layoutConfig.outerBorderWidth : 1} 
                          onChange={(e) => updateLayout('outerBorderWidth', parseInt(e.target.value))} 
                          className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer" 
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                          <span>เส้นกั้นภายในช่อง</span>
                          <span className="font-bold text-emerald-600">{layoutConfig?.innerBorderWidth !== undefined ? layoutConfig.innerBorderWidth : 0}px</span>
                        </label>
                        <input 
                          type="range" min="0" max="10" 
                          value={layoutConfig?.innerBorderWidth !== undefined ? layoutConfig.innerBorderWidth : 0} 
                          onChange={(e) => updateLayout('innerBorderWidth', parseInt(e.target.value))} 
                          className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer" 
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                          <span>ความมนขอบตาราง</span>
                          <span className="font-bold text-emerald-600">{layoutConfig?.borderRadius !== undefined ? layoutConfig.borderRadius : 6}px</span>
                        </label>
                        <input 
                          type="range" min="0" max="20" 
                          value={layoutConfig?.borderRadius !== undefined ? layoutConfig.borderRadius : 6} 
                          onChange={(e) => updateLayout('borderRadius', parseInt(e.target.value))} 
                          className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer" 
                        />
                      </div>
                    </div>
                  </div>
                    {/* --- ส่วนที่ 3: เลข/เส้นระบุบรรทัด --- */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                      <h4 className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        🔢 เลข/เส้นระบุบรรทัด
                      </h4>
                      <div className="flex items-center gap-3">
                        {/* ปุ่มเปิด/ปิด การแสดงผล */}
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={layoutConfig?.showRowNumber !== false} 
                            onChange={(e) => updateLayout('showRowNumber', e.target.checked)}
                            className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                          />
                          <span className="text-[10px] text-slate-500 font-bold">แสดง</span>
                        </label>
                        {/* กล่องเลือกสี */}
                        <input 
                          type="color" 
                          value={layoutConfig?.rowNumberColor || '#cbd5e1'} 
                          onChange={(e) => updateLayout('rowNumberColor', e.target.value)} 
                          className="w-5 h-5 p-0 border-0 rounded cursor-pointer disabled:opacity-50"
                          title="สีเส้นและตัวเลข"
                          disabled={layoutConfig?.showRowNumber === false}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                          <span>ความหนาเส้น (บรรทัดคู่)</span>
                          <span className="font-bold text-emerald-600">{layoutConfig?.rowNumberWidth !== undefined ? layoutConfig.rowNumberWidth : 3}px</span>
                        </label>
                        <input 
                          type="range" min="1" max="10" 
                          value={layoutConfig?.rowNumberWidth !== undefined ? layoutConfig.rowNumberWidth : 3} 
                          onChange={(e) => updateLayout('rowNumberWidth', parseInt(e.target.value))} 
                          className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer disabled:opacity-50" 
                          disabled={layoutConfig?.showRowNumber === false}
                        />
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>
            )}

          </div>
        </div>
        
        {/* พื้นที่หลัก */}
        <main className="flex-1 flex flex-col bg-[#f0f4f8] overflow-hidden relative">
          <div className="flex-1 overflow-hidden p-0 flex flex-col items-center">
            <Sheet ref={componentRef} /> 
          </div>
          <Keyboard /> 
        </main>

        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      </div>
    </div>
  );
}

export default DesktopEditor;