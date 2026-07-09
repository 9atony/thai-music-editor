import React, { useContext, useEffect, useState } from 'react';
import { MusicContext } from '../../contexts/MusicContext';

const MobileQueue = ({ onClose }) => {
  const {
    playbackSequence,
    setPlaybackSequence,
    isPlaying,
    activeSequenceIdx,
    isLoopAll,
    setIsLoopAll,
    availableSections // รายชื่อท่อนที่มีในกระดาษ (ดึงมาจากระบบออโต้สแกน)
  } = useContext(MusicContext) || {};

  const [loopDrafts, setLoopDrafts] = useState({});
  // สเตตัสสำหรับเปิด/ปิดเมนูเลือกท่อนที่จะเพิ่ม
  const [showAddMenu, setShowAddMenu] = useState(false);

  useEffect(() => {
    setLoopDrafts((prev) => {
      const next = {};
      (playbackSequence || []).forEach((item, idx) => {
        const key = item?.id ?? idx;
        next[key] = prev[key] ?? String(item?.loops ?? 1);
      });
      return next;
    });
  }, [playbackSequence]);

  const updateLoops = (index, newLoops) => {
    if (!Array.isArray(playbackSequence)) return;
    const safeLoops = Math.max(1, Number(newLoops) || 1);
    const newSeq = [...playbackSequence];
    newSeq[index] = {
      ...newSeq[index],
      loops: safeLoops,
    };
    setPlaybackSequence?.(newSeq);
  };

  const handleLoopChange = (index, rawValue) => {
    const item = playbackSequence?.[index];
    const key = item?.id ?? index;

    if (!/^\d*$/.test(rawValue)) return;

    setLoopDrafts((prev) => ({
      ...prev,
      [key]: rawValue,
    }));

    if (rawValue === '') return;

    updateLoops(index, rawValue);
  };

  const handleLoopBlur = (index) => {
    const item = playbackSequence?.[index];
    const key = item?.id ?? index;
    const parsed = Math.max(1, Number(loopDrafts[key]) || 1);

    setLoopDrafts((prev) => ({
      ...prev,
      [key]: String(parsed),
    }));

    updateLoops(index, parsed);
  };

  const removeSeqItem = (index) => {
    if (!Array.isArray(playbackSequence)) return;
    const newSeq = [...playbackSequence];
    newSeq.splice(index, 1);
    setPlaybackSequence?.(newSeq);
  };

  // ฟังก์ชันสำหรับเวลากดปุ่มเพิ่มท่อนจากเมนู
  const handleAddSection = (label) => {
    const newSeq = [...(playbackSequence || [])];
    newSeq.push({ id: Date.now() + Math.random(), label: label, loops: 1 });
    setPlaybackSequence?.(newSeq);
    setShowAddMenu(false); // ปิดเมนูหลังจากเลือกเสร็จ
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#f8f9fc] relative">
      
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-5 bg-white border-b border-slate-100 shrink-0 shadow-sm">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <span className="text-xs font-black text-slate-800 tracking-widest uppercase">Up Next</span>
        <div className="w-8"></div>
      </div>

      {/* ⭐ สวิตช์โหมด Loop All */}
      <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
           <svg className={`w-5 h-5 ${isLoopAll ? 'text-sky-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
           <span className="text-sm font-bold text-slate-700">วนลูปทุกท่อน</span>
        </div>
        <button 
          onClick={() => setIsLoopAll(!isLoopAll)}
          className={`w-12 h-6 rounded-full relative transition-colors ${isLoopAll ? 'bg-sky-500' : 'bg-slate-200'}`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isLoopAll ? 'translate-x-7' : 'translate-x-1'}`}></div>
        </button>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 custom-scrollbar pb-32">
        {(!playbackSequence || playbackSequence.length === 0) && (
          <div className="text-center text-slate-400 mt-10 text-sm font-bold">
            ยังไม่มีท่อนเพลงในคิวครับ (คุณสามารถกดเพิ่มได้ที่ปุ่มด้านล่าง)
          </div>
        )}

        {playbackSequence?.map((item, idx) => {
          const isCurrent = isPlaying && activeSequenceIdx === idx;
          const draftKey = item?.id ?? idx;

          return (
            <div key={draftKey} className={`flex items-center justify-between p-4 rounded-2xl bg-white border transition-all ${
                isCurrent ? 'border-sky-300 shadow-[0_8px_20px_rgba(14,165,233,0.15)] scale-[1.02]' : 'border-slate-100 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-4 flex-1 overflow-hidden">
                <span className="text-slate-300 cursor-grab">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8h16M4 16h16" /></svg>
                </span>
                <div className="overflow-hidden">
                  <p className={`font-black truncate ${isCurrent ? 'text-sky-600' : 'text-slate-700'}`}>{item.label}</p>
                 
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-3">
                <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200">
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    value={loopDrafts[draftKey] ?? String(item.loops ?? 1)}
                    onChange={(e) => handleLoopChange(idx, e.target.value)}
                    onBlur={() => handleLoopBlur(idx)}
                    className="w-10 text-center bg-transparent text-sm font-black text-slate-700 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-bold pr-2">รอบ</span>
                </div>
                <button onClick={() => removeSeqItem(idx)} className="text-rose-300 hover:text-rose-500 p-1.5 transition-colors bg-rose-50 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          );
        })}

        {/* ⭐ ปุ่มเปิดเมนูเพิ่มท่อนเพลง (แสดงอยู่ล่างสุดของรายการ) */}
        {availableSections && availableSections.length > 0 && (
          <button 
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="mt-4 w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 font-bold hover:border-sky-400 hover:text-sky-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            เพิ่มท่อนลงในคิว
          </button>
        )}
      </div>

      {/* ⭐ เมนู (Popup) สำหรับเลือกท่อนที่จะเพิ่ม */}
      {showAddMenu && (
        <div className="absolute bottom-0 left-0 w-full bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-6 z-50 animate-slide-up border-t border-slate-100">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-black text-slate-800 text-lg">เลือกท่อนที่ต้องการเพิ่ม</h3>
             <button onClick={() => setShowAddMenu(false)} className="text-slate-400 hover:text-slate-800"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar">
             {availableSections.map(label => (
                <button 
                  key={label}
                  onClick={() => handleAddSection(label)}
                  className="bg-slate-50 hover:bg-sky-50 border border-slate-100 p-3 rounded-xl text-left font-bold text-sm text-slate-700 transition-colors"
                >
                  + {label}
                </button>
             ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default MobileQueue;