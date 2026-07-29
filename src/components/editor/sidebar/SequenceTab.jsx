import React, { useContext, useState } from 'react';
import { MusicContext } from '../../../contexts/MusicContext';

const SequenceTab = () => {
  const { 
    playbackSequence, setPlaybackSequence,
    activeSequenceIdx, activeLoop,
    isPlaying, sectionLabels 
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
  );
};

export default SequenceTab;