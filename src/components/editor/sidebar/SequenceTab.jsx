import React, { useContext, useState } from 'react';
import { MusicContext } from '../../../contexts/MusicContext';

// ⭐ ฟังก์ชันสำหรับล้างแท็ก HTML ให้เหลือแต่ข้อความล้วน (ใช้เฉพาะตอนโชว์หน้าจอ)
const getPlainText = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const SequenceTab = () => {
  const { 
    playbackSequence, setPlaybackSequence,
    activeSequenceIdx, activeLoop,
    isPlaying, sectionLabels,
    setSelectedCell, rowTypes,
    availableSections,
    jumpToSequence, startPlayback
  } = useContext(MusicContext);
  
  const [draggedSeqIdx, setDraggedSeqIdx] = useState(null);

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
    // ⭐ ดึงชื่อท่อนแรกสุดมาเป็นค่าเริ่มต้น ป้องกันระบบลบชื่อที่ว่างเปล่าทิ้ง
    const defaultLabel = availableSections.length > 0 ? availableSections[0] : '';
    setPlaybackSequence([...playbackSequence, { id: Date.now(), label: defaultLabel, loops: 1 }]);
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
          if (lbl.text) {
           newSeq.push({ id: Date.now() + Math.random(), label: lbl.text, loops: 1 });
          }
      });
    });
    if (newSeq.length > 0) {
      setPlaybackSequence(newSeq);
    } else {
      alert('ไม่พบป้ายกำกับบนกระดาษครับ กรุณาสร้างป้ายกำกับ (เช่น ท่อน 1) ก่อนกดสแกน');
    }
  };

  const handleJumpToSection = (labelHtml) => {
    let targetVisualIndex = -1;
    
    for (const [vIdx, labels] of Object.entries(sectionLabels)) {
      if (labels.some(l => l.text === labelHtml)) {
        targetVisualIndex = parseInt(vIdx, 10);
        break;
      }
    }

    if (targetVisualIndex !== -1) {
      let currentVIdx = 0;
      let targetRIdx = 0;
      
      for (let i = 0; i < rowTypes.length; i++) {
        if (rowTypes[i] === 'single' || rowTypes[i] === 'double-right') {
          if (currentVIdx === targetVisualIndex) {
            targetRIdx = i;
            break;
          }
          currentVIdx++;
        }
      }
      
      const targetM = rowTypes[targetRIdx].startsWith('double') ? 1 : 0;
      setSelectedCell([targetRIdx, targetM, 0]);
    }
  };

  const handlePlayFromSequence = async (idx) => {
    if (jumpToSequence) jumpToSequence(idx);
    if (!isPlaying && startPlayback) {
      // ⭐ 3. สั่งเริ่มเล่นทันที! ไม่ต้องหน่วงเวลาแล้ว เพราะระบบรู้พิกัดสดๆ แล้ว
      startPlayback(); 
    }
  };

  return (
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
              <div className="flex items-center gap-1 flex-1 overflow-hidden">
                <span className="text-[10px] text-slate-300 cursor-grab hover:text-slate-500 mr-1" title="ลากเพื่อสลับลำดับ">⠿</span>
                
                {/* ⭐ 1. ปุ่มเริ่มเล่นจากท่อนนี้ */}
                <button 
                  onClick={() => handlePlayFromSequence(idx)}
                  className={`p-1 rounded transition-colors active:scale-95 shrink-0 ${isCurrentlyPlaying ? 'text-emerald-600 bg-emerald-100' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                  title="เริ่มเล่นจากท่อนนี้"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </button>

                <button 
                  onClick={() => handleJumpToSection(item.label)}
                  className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors active:scale-95 shrink-0"
                  title="คลิกเพื่อไปที่บรรทัดนี้"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>

                {/* ⭐ เปลียน Input เป็น Dropdown ให้เลือกท่อนที่มีอยู่จริงเท่านั้น */}
                <select
                  value={item.label}
                  onChange={(e) => updateSeqItem(idx, 'label', e.target.value)}
                  className={`w-full bg-transparent outline-none font-bold text-xs truncate cursor-pointer ${isCurrentlyPlaying ? 'text-sky-800' : 'text-slate-700'}`}
                  title="คลิกเพื่อเลือกท่อนที่ต้องการให้เล่น"
                >
                  <option value="" disabled>-- เลือกท่อน --</option>
                  {availableSections.map((sec, i) => (
                    <option key={i} value={sec}>{getPlainText(sec)}</option>
                  ))}
                  {/* กันเหนียว: ถ้าท่อนโดนลบไปแล้ว แต่ยังค้างในลำดับการเล่น ให้โชว์คำเตือนสีแดง */}
                  {item.label && !availableSections.includes(item.label) && (
                    <option value={item.label} className="text-rose-500">[{getPlainText(item.label)} - ไม่พบ]</option>
                  )}
                </select>
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
  );
};

export default SequenceTab;