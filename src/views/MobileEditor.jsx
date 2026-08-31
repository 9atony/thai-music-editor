import React, { useContext, useEffect, useRef, useState } from 'react';
import { MusicContext } from '../contexts/MusicContext';
import Sheet from '../components/editor/Sheet'; 
import MobileMetronomeMenu from '../components/editor/MobileMetronomeMenu';
import { initAudioContext } from '../utils/audioEngine';

// ⭐ ฟังก์ชันสำหรับล้างแท็ก HTML ให้เหลือแต่ข้อความล้วน
const getPlainText = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const MobileEditor = ({ onBack }) => {
  const { 
    projectName,
    songName, 
    isPlaying, 
    togglePlay, 
    stopPlayback,
    currentTime, 
    totalTime, 
    seek,
    skipToNext,
    skipToPrev,
    playbackSequence,
    setPlaybackSequence,
    activeSequenceIdx,
    setToolbarMode,
    isLoopAll, setIsLoopAll,
    isLoopOne, setIsLoopOne,
    layoutConfig, setLayoutConfig,
    currentInstrument,
    // ⭐ ดึง State ของโหมดลดเสียงเครื่องมาใช้งาน
    isReduceMode, setIsReduceMode 
  } = useContext(MusicContext);

  const sheetContainerRef = useRef(null);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isMetronomeOpen, setIsMetronomeOpen] = useState(false);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // ⭐ แก้บัก: ออกจากหน้าแก้ไขโน้ตแล้วเสียงยังเล่นต่อ
  //    ใช้ ref กันไม่ให้หยุดเพลงทุกครั้งที่ MusicContext re-render
  const stopPlaybackRef = useRef(stopPlayback);
  useEffect(() => {
    stopPlaybackRef.current = stopPlayback;
  }, [stopPlayback]);

  useEffect(() => {
    // เมื่อ component ถูกถอดออก (ออกจากหน้า/เปลี่ยนหน้า) ให้หยุดเสียงทันที
    return () => {
      if (stopPlaybackRef.current) stopPlaybackRef.current();
    };
  }, []);

  // ⭐ ดักจับการกดปุ่ม Back
  useEffect(() => {
    window.history.pushState(null, null, window.location.href);
    
    const handlePopState = () => {
      if (isPlayingRef.current && stopPlayback) {
        stopPlayback();
      }
      onBack();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBack, stopPlayback]);

  // ⭐ ดักจับการปิดแท็บ
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = ''; 
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ⭐ ฟีเจอร์ใหม่: ดักจับการพับหน้าจอ (แก้ปัญหาเสียงกระตุก/เสียงรวบ)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // ถ้าหน้าจอถูกซ่อน (พับแอป/ปิดจอ) และเพลงกำลังเล่นอยู่ ให้สั่งหยุดทันที!
      if (document.hidden && isPlayingRef.current && stopPlayback) {
        stopPlayback();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stopPlayback]);

  const formatTimeDisplay = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (setToolbarMode) setToolbarMode('default');
  }, [setToolbarMode]);

  const handleLoopToggle = () => {
    if (!isLoopAll && !isLoopOne) {
      setIsLoopAll(true);
      setIsLoopOne(false);
    } else if (isLoopAll) {
      setIsLoopAll(false);
      setIsLoopOne(true);
    } else {
      setIsLoopAll(false);
      setIsLoopOne(false);
    }
  };

  const handleUpdateLoop = (index, delta) => {
    if (!setPlaybackSequence || !playbackSequence) return;
    const newSeq = [...playbackSequence];
    const newVal = newSeq[index].loops + delta;
    if (newVal > 0 && newVal <= 99) {
      newSeq[index].loops = newVal;
      setPlaybackSequence(newSeq);
    }
  };

  const unlockMobileAudio = () => {
    if (!isPlayingRef.current) initAudioContext().catch(() => {});
  };

  return (
    <div className="flex flex-col h-screen bg-white w-full overflow-hidden" style={{ fontFamily: 'Prompt, sans-serif' }}>
      
      {/* 1. Top Bar */}
      <header className="h-16 bg-white flex items-center justify-between px-3 shrink-0 z-20 shadow-sm rounded-b-2xl">
        <button 
          onClick={() => {
            if (isPlaying) stopPlayback();
            onBack();
          }}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors active:scale-95"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
        
        <div className="flex-1 text-center px-2 overflow-hidden flex flex-col justify-center">
          <span className="font-bold text-slate-800 text-sm truncate w-full">
            {/* ⭐ ใช้ getPlainText เพื่อกรองเอาเฉพาะตัวอักษร */}
            {getPlainText(songName) || getPlainText(projectName) || "โปรเจกต์ไม่มีชื่อ"}
          </span>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold tracking-wide border border-slate-200">
              {currentInstrument?.name || "เครื่องดนตรีไทย"}
            </span>
            <span className="text-[10px] text-sky-500 font-semibold tracking-wide">• Player</span>
          </div>
        </div>
        <div className="w-10"></div> 
      </header>

      {/* 2. Sheet Area */}
      <main className="flex-1 bg-slate-200 relative flex flex-col min-h-0">
        <div 
          className={`flex-1 w-full h-full transition-opacity duration-300 ${isPlaying ? 'opacity-90' : 'opacity-100'} 
                      [&_[contenteditable]]:pointer-events-none [&_input]:pointer-events-none`}
        >
           <Sheet ref={sheetContainerRef} defaultZoom={48} hideZoomControls={true} />
        </div>
      </main>

      {/* 3. Playback Controls */}
      <footer className="bg-white px-4 py-3 shrink-0 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.15)] z-40 rounded-t-3xl relative">
        
        <div className="flex items-center gap-3 mb-3 mt-1">
          <span className="text-[10px] font-bold text-slate-400 w-8 text-right tabular-nums">{formatTimeDisplay(currentTime)}</span>
          <div className="flex-1 relative group cursor-pointer h-5 flex items-center">
            <input 
              type="range" min="0" max={totalTime || 100} value={currentTime || 0}
              onChange={(e) => seek(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative z-10">
              <div 
                className="h-full bg-sky-500 rounded-full transition-all duration-200" 
                style={{ width: `${totalTime > 0 ? (currentTime / totalTime) * 100 : 0}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 w-8 tabular-nums">{formatTimeDisplay(totalTime)}</span>
        </div>

        <div className="flex items-center justify-between pb-1">
          
          <div className="w-[20%] flex justify-start">
            <button 
              onClick={handleLoopToggle}
              className={`p-2 rounded-full transition-all active:scale-95 flex flex-col items-center justify-center ${isLoopAll || isLoopOne ? 'text-sky-500 bg-sky-50' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              {isLoopOne ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /><text x="12" y="15" fontSize="7" strokeWidth="0.5" fontFamily="sans-serif" fontWeight="900" textAnchor="middle" fill="currentColor">1</text></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 flex-1">
            <button onClick={skipToPrev} className="text-slate-400 hover:text-sky-500 active:scale-90 transition-all p-2">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button 
              type="button"
              onPointerDown={unlockMobileAudio}
              onTouchStart={unlockMobileAudio}
              onClick={togglePlay}
              className={`w-14 h-14 touch-manipulation rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all ${isPlaying ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30' : 'bg-sky-500 hover:bg-sky-600 shadow-sky-500/30'}`}
              aria-label={isPlaying ? 'หยุดเล่น' : 'เริ่มเล่น'}
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            <button onClick={skipToNext} className="text-slate-400 hover:text-sky-500 active:scale-90 transition-all p-2">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>

          <div className="w-[25%] flex justify-end gap-1">
            <button
              type="button"
              onPointerDown={unlockMobileAudio}
              onTouchStart={unlockMobileAudio}
              onClick={() => { setIsQueueOpen(false); setIsMetronomeOpen(true); }}
              className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-200 active:scale-95 transition-all"
              aria-label="เปิดเมนูเครื่องประกอบจังหวะ"
              title="เครื่องประกอบจังหวะ"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 12h2m2-5v10m4-13v16m4-11v6m4-3h-2" /></svg>
            </button>
            <button 
              onClick={() => { setIsMetronomeOpen(false); setIsQueueOpen(true); }}
              className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all relative"
            >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
               {playbackSequence?.length > 0 && (
                 <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                   {playbackSequence.length}
                 </span>
               )}
            </button>
          </div>

        </div>
      </footer>

      {/* 4. Bottom Sheet (คิวเพลง, BPM) */}
      <div className={`fixed inset-0 z-[60] flex flex-col justify-end transition-all duration-300 ${isQueueOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isQueueOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsQueueOpen(false)} />
        
        <div className={`bg-white w-full max-h-[80vh] rounded-t-3xl shadow-2xl relative flex flex-col transition-transform duration-300 ease-out ${isQueueOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">การเล่น & ตั้งค่า</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">จัดการคีย์บอร์ด, ความเร็ว และคิวเพลง</p>
            </div>
            <button onClick={() => setIsQueueOpen(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full bg-slate-50 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-5 custom-scrollbar flex flex-col gap-5">

            {/* ⭐ เพิ่ม โหมดลดเสียงเครื่อง (Reduce Mode) เข้ามาแทน */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-sky-500 border border-slate-100">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
                 <div>
                   <div className="font-bold text-slate-700 text-sm">โหมดลดเสียงเครื่อง</div>
                   <div className="text-xs text-slate-400">ลดระดับเสียงโน้ตบนแป้นพิมพ์ลง</div>
                 </div>
              </div>
              <button 
                onClick={() => setIsReduceMode(!isReduceMode)}
                className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ${isReduceMode ? 'bg-sky-500' : 'bg-slate-300'}`}
              >
                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${isReduceMode ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-sky-500 border border-slate-100">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
                 <div>
                   <div className="font-bold text-slate-700 text-sm">ความเร็ว (BPM)</div>
                   <div className="text-xs text-slate-400">จังหวะการบรรเลง</div>
                 </div>
              </div>
              <div className="flex items-center bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                 <button 
                   onClick={() => setLayoutConfig({ ...layoutConfig, bpm: Math.max(20, (layoutConfig.bpm || 80) - 5) })}
                   className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 font-bold active:bg-slate-100 transition-colors"
                 >−</button>
                 <div className="w-12 text-center font-black text-slate-700 text-sm">
                   {layoutConfig.bpm || 80}
                 </div>
                 <button 
                   onClick={() => setLayoutConfig({ ...layoutConfig, bpm: Math.min(300, (layoutConfig.bpm || 80) + 5) })}
                   className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 font-bold active:bg-slate-100 transition-colors"
                 >+</button>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">ลำดับท่อนเพลง</div>
              {playbackSequence && playbackSequence.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {playbackSequence.map((seq, index) => {
                    const isActive = activeSequenceIdx === index;
                    return (
                      <div key={index} className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-colors ${isActive ? 'bg-sky-50 border-sky-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-black shadow-sm ${isActive ? 'bg-sky-500 text-white shadow-sky-500/20' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                            {index + 1}
                          </span>
                          <span className={`font-bold text-sm ${isActive ? 'text-sky-700' : 'text-slate-700'}`}>{getPlainText(seq.label)}</span>
                        </div>
                        
                        <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 shadow-sm overflow-hidden h-9">
                          <button onClick={() => handleUpdateLoop(index, -1)} className="w-8 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors">−</button>
                          <div className="w-12 h-full flex items-center justify-center bg-white border-x border-slate-200 text-xs font-black text-slate-700">
                            {seq.loops} <span className="text-[10px] font-medium text-slate-400 ml-1">รอบ</span>
                          </div>
                          <button onClick={() => handleUpdateLoop(index, 1)} className="w-8 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 flex flex-col items-center bg-slate-50 rounded-2xl border border-slate-100 dashed">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl mb-2 shadow-sm border border-slate-100">📭</div>
                  <p className="text-slate-500 font-bold text-sm">ไม่มีป้ายกำกับท่อนเพลง</p>
                  <p className="text-xs text-slate-400 mt-1">เพลงจะถูกเล่นตามหน้ากระดาษปกติรวดเดียว</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      <MobileMetronomeMenu isOpen={isMetronomeOpen} onClose={() => setIsMetronomeOpen(false)} />

    </div>
  );
};

export default MobileEditor;
