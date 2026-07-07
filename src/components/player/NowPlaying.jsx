import React, { useContext } from 'react';
import { MusicContext } from '../../contexts/MusicContext';

const NowPlaying = ({ onOpenQueue }) => {
  // ⭐ เปลี่ยนจาก togglePlayback เป็น togglePlay ให้ตรงกับ MusicContext
  const { songName, isPlaying, togglePlay, currentTime, totalTime } = useContext(MusicContext) || {};

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = totalTime > 0 ? Math.min(100, (currentTime / totalTime) * 100) : 0;

  return (
    <div className="flex flex-col h-full w-full bg-white px-6 py-8 select-none">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <button className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        <span className="text-xs font-black text-slate-800 tracking-widest uppercase">Now Playing</span>
        <button className="p-2 -mr-2 text-slate-500 hover:text-slate-800 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center mb-10 min-h-0">
        <div className="w-full max-h-full aspect-square max-w-[320px] bg-slate-50 rounded-[40px] shadow-[0_20px_50px_rgba(15,23,42,0.07)] border border-slate-100 flex flex-col items-center justify-center">
          <span className="text-7xl sm:text-8xl font-black tracking-tighter">
            T<span className="text-sky-600">M</span><span className="text-amber-500">E</span>
          </span>
        </div>
      </div>

      <div className="mb-8 flex justify-between items-end shrink-0">
        <div className="overflow-hidden pr-4">
          <h2 className="text-2xl font-black text-slate-800 truncate mb-1">{songName || 'Untitled Project'}</h2>
          <p className="text-sm font-bold text-slate-400">Thai Music Editor</p>
        </div>
      </div>

      <div className="mb-8 shrink-0">
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden cursor-pointer relative">
          <div className="h-full bg-rose-500 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${progressPercent}%` }}>
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow border-[3px] border-rose-500 transform translate-x-1/2" style={{ left: `calc(${progressPercent}% - 7px)` }}></div>
          </div>
        </div>
        <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-3">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalTime)}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mb-8 px-2 shrink-0">
        <button className="text-slate-400 hover:text-slate-700 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
        <button className="text-slate-800 hover:text-slate-600 transition-colors"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg></button>
        
        {/* ⭐ กดเล่นได้จริงแล้ว */}
        <button onClick={togglePlay} className="w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-slate-800 transition-all shadow-[0_8px_20px_rgba(15,23,42,0.2)] active:scale-95">
          {isPlaying ? <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg> : <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
        </button>

        <button className="text-slate-800 hover:text-slate-600 transition-colors"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg></button>
        <button className="text-slate-400 hover:text-slate-700 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
      </div>

      <div className="flex justify-between items-center shrink-0">
        <button className="p-2 -ml-2 text-slate-400 hover:text-slate-700 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg></button>
        <button onClick={onOpenQueue} className="p-2 -mr-2 text-slate-800 hover:text-rose-500 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h8" /></svg></button>
      </div>
    </div>
  );
};

export default NowPlaying;