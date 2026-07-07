import React, { useContext } from 'react';
import { MusicContext } from '../../contexts/MusicContext';

const MobileQueue = ({ onClose }) => {
  const { playbackSequence, setPlaybackSequence, isPlaying, activeSequenceIdx } = useContext(MusicContext) || {};

  // ฟังก์ชันอัปเดตจำนวนรอบในมือถือ
  const updateLoops = (index, newLoops) => {
    const newSeq = [...playbackSequence];
    newSeq[index].loops = newLoops;
    setPlaybackSequence(newSeq);
  };

  // ฟังก์ชันลบท่อนเพลงในมือถือ
  const removeSeqItem = (index) => {
    const newSeq = [...playbackSequence];
    newSeq.splice(index, 1);
    setPlaybackSequence(newSeq);
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#f8f9fc]">
       {/* Header ของหน้า Queue */}
       <div className="flex justify-between items-center px-6 py-5 bg-white border-b border-slate-100 shrink-0 shadow-sm">
         <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 transition-colors">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
         </button>
         <span className="text-xs font-black text-slate-800 tracking-widest uppercase">Up Next</span>
         <div className="w-8"></div> {/* ตัวค้ำให้ Header อยู่ตรงกลาง */}
       </div>

       {/* รายการท่อนเพลง (Queue List) */}
       <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 custom-scrollbar">
         {(!playbackSequence || playbackSequence.length === 0) && (
            <div className="text-center text-slate-400 mt-10 text-sm font-bold">ยังไม่มีท่อนเพลงในคิวครับ</div>
         )}
         
         {playbackSequence?.map((item, idx) => {
            const isCurrent = isPlaying && activeSequenceIdx === idx;
            
            return (
              <div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl bg-white border transition-all ${isCurrent ? 'border-sky-300 shadow-[0_8px_20px_rgba(14,165,233,0.15)] scale-[1.02]' : 'border-slate-100 shadow-sm'}`}>
                 <div className="flex items-center gap-4 flex-1 overflow-hidden">
                   <span className="text-slate-300 cursor-grab">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8h16M4 16h16"/></svg>
                   </span>
                   <div className="overflow-hidden">
                     <p className={`font-black truncate ${isCurrent ? 'text-sky-600' : 'text-slate-700'}`}>{item.label}</p>
                     <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">ท่อนที่ {idx + 1}</p>
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-3 shrink-0 ml-3">
                   <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200">
                     <input 
                       type="number" min="1" 
                       value={item.loops} 
                       onChange={(e) => updateLoops(idx, parseInt(e.target.value) || 1)} 
                       className="w-8 text-center bg-transparent text-sm font-black text-slate-700 outline-none" 
                     />
                     <span className="text-[10px] text-slate-400 font-bold pr-2">รอบ</span>
                   </div>
                   <button onClick={() => removeSeqItem(idx)} className="text-rose-300 hover:text-rose-500 p-1.5 transition-colors bg-rose-50 rounded-lg">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                 </div>
              </div>
            )
         })}
       </div>
    </div>
  );
};

export default MobileQueue;