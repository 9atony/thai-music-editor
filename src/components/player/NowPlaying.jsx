import React, { useContext, useRef, useState } from 'react';
import { MusicContext } from '../../contexts/MusicContext';

const NowPlaying = ({ onOpenQueue, onBack }) => {
  const {
    songName,
    isPlaying,
    togglePlay,
    currentTime,
    totalTime,
    seek,
    isOctaveMode,
    setIsOctaveMode,
    layoutConfig,
    setLayoutConfig,
    currentInstrument,
    changeInstrument,
    INSTRUMENT_CONFIG,
  } = useContext(MusicContext) || {};

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent =
    totalTime > 0 ? Math.min(100, (currentTime / totalTime) * 100) : 0;

  const currentBpm = layoutConfig?.bpm || 80;

  const changeBpm = (delta) => {
    setLayoutConfig?.((prev) => ({
      ...prev,
      bpm: Math.min(240, Math.max(40, (prev?.bpm || 80) + delta)),
    }));
  };

  // ⭐ State และ Ref สำหรับการลากเส้นเวลา (Seek)
  const progressRef = useRef(null);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);

  const handleSeekFromEvent = (clientX) => {
    if (!progressRef.current || !totalTime || totalTime <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = percent * totalTime;
    seek?.(targetTime);
  };

  const handleProgressPointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsDraggingProgress(true);
    handleSeekFromEvent(e.clientX);
  };

  const handleProgressPointerMove = (e) => {
    if (!isDraggingProgress) return;
    handleSeekFromEvent(e.clientX);
  };

  const handleProgressPointerUp = (e) => {
    if (e?.currentTarget?.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDraggingProgress(false);
  };

  // ⭐ State สำหรับเปิด/ปิด dropdown เครื่องดนตรี
  const [showInstrumentPicker, setShowInstrumentPicker] = useState(false);

  const instrumentList = INSTRUMENT_CONFIG
    ? Object.entries(INSTRUMENT_CONFIG).map(([id, config]) => ({ id, ...config }))
    : [];

  const handleSelectInstrument = (id) => {
    changeInstrument?.(id);
    setShowInstrumentPicker(false);
  };

  return (
    <div className="flex flex-col h-full w-full bg-white px-6 py-8 select-none">
      <div className="flex justify-between items-center mb-8 shrink-0">
        {/* ⭐ ปุ่มกลับไปหน้า Home */}
        <button
          onClick={onBack}
          aria-label="กลับหน้าแรก"
          className="flex items-center gap-1.5 px-2 py-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10.25L12 3l9 7.25V21a1 1 0 01-1 1h-5.5v-6h-5v6H4a1 1 0 01-1-1V10.25z"
            />
          </svg>
          <span className="text-[11px] font-black uppercase tracking-wide">Home</span>
        </button>

        <span className="text-xs font-black text-slate-800 tracking-widest uppercase">
          Now Playing
        </span>

        <button className="p-2 -mr-2 text-slate-500 hover:text-slate-800 transition-colors">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center mb-10 min-h-0">
        <div className="w-full max-h-full aspect-square max-w-[320px] bg-slate-50 rounded-[40px] shadow-[0_20px_50px_rgba(15,23,42,0.07)] border border-slate-100 flex flex-col items-center justify-center">
          <span className="text-7xl sm:text-8xl font-black tracking-tighter">
            T<span className="text-sky-600">M</span>
            <span className="text-amber-500">E</span>
          </span>
        </div>
      </div>

      <div className="mb-6 flex justify-between items-end shrink-0">
        <div className="overflow-hidden pr-4">
          <h2 className="text-2xl font-black text-slate-800 truncate mb-1">
            {songName || 'Untitled Project'}
          </h2>
          <p className="text-sm font-bold text-slate-400">Thai Music Editor</p>
        </div>
      </div>

      {/* ⭐ ปุ่มคู่ 8, BPM, และเครื่องดนตรี */}
      <div className="mb-6 flex justify-center gap-3 shrink-0 flex-wrap">
        <button
          onClick={() => setIsOctaveMode?.((prev) => !prev)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            isOctaveMode
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {isOctaveMode ? 'คู่ 8: เปิด' : 'คู่ 8: ปิด'}
        </button>

        <div className="flex items-center bg-slate-100 rounded-xl px-2">
          <button
            onClick={() => changeBpm(-5)}
            className="p-2 font-bold text-slate-700"
          >
            -
          </button>

          <span className="px-2 text-xs font-black text-slate-700 min-w-[72px] text-center">
            {currentBpm} BPM
          </span>

          <button
            onClick={() => changeBpm(5)}
            className="p-2 font-bold text-slate-700"
          >
            +
          </button>
        </div>

        {/* ⭐ ตัวเลือกเครื่องดนตรี */}
        <div className="relative">
          <button
            onClick={() => setShowInstrumentPicker((prev) => !prev)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-1.5 max-w-[140px]"
          >
            <span className="truncate">{currentInstrument?.name || currentInstrument?.id || 'เครื่องดนตรี'}</span>
            <svg
              className={`w-3 h-3 shrink-0 transition-transform ${showInstrumentPicker ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showInstrumentPicker && (
            <>
              {/* Overlay สำหรับปิด dropdown เมื่อคลิกข้างนอก */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowInstrumentPicker(false)}
              />

              <div className="absolute top-full left-0 mt-2 w-56 max-h-64 overflow-y-auto bg-white rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.12)] border border-slate-100 z-50 py-1.5">
                {instrumentList.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => handleSelectInstrument(inst.id)}
                    className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center justify-between ${
                      currentInstrument?.id === inst.id
                        ? 'bg-sky-50 text-sky-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{inst.name || inst.id}</span>
                    {currentInstrument?.id === inst.id && (
                      <svg className="w-4 h-4 shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ⭐ เส้นเวลาที่ลากได้ (Seekable Progress Bar) */}
      <div className="mb-8 shrink-0">
        <div
          ref={progressRef}
          className="h-2 w-full bg-slate-100 rounded-full overflow-visible cursor-pointer relative touch-none"
          style={{ touchAction: 'none' }}
          onPointerDown={handleProgressPointerDown}
          onPointerMove={handleProgressPointerMove}
          onPointerUp={handleProgressPointerUp}
          onPointerCancel={handleProgressPointerUp}
        >
          <div
            className="h-full bg-rose-500 rounded-full"
            style={{
              width: `${progressPercent}%`,
              transition: isDraggingProgress ? 'none' : 'width 0.3s ease',
            }}
          />
          {/* วงกลมเลื่อน (Thumb) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md border-[3px] border-rose-500"
            style={{
              left: `calc(${progressPercent}% - 8px)`,
              transition: isDraggingProgress ? 'none' : 'left 0.3s ease',
            }}
          />
        </div>

        <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-3">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalTime)}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mb-8 px-2 shrink-0">
        <button className="text-slate-400 hover:text-slate-700 transition-colors">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
        </button>

        <button className="text-slate-800 hover:text-slate-600 transition-colors">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>

        <button
          onClick={togglePlay}
          className="w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-slate-800 transition-all shadow-[0_8px_20px_rgba(15,23,42,0.2)] active:scale-95"
        >
          {isPlaying ? (
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button className="text-slate-800 hover:text-slate-600 transition-colors">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          </svg>
        </button>

        <button className="text-slate-400 hover:text-slate-700 transition-colors">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <div className="flex justify-between items-center shrink-0">
        <button className="p-2 -ml-2 text-slate-400 hover:text-slate-700 transition-colors">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
        </button>

        <button
          onClick={onOpenQueue}
          className="p-2 -mr-2 text-slate-800 hover:text-rose-500 transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M4 6h16M4 12h16M4 18h8"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default NowPlaying;
