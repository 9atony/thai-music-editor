import React, { useEffect } from 'react';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

export default function TopBar({ onBack }) {
  const {
    projectName,
    setProjectName,
    isPlaying,
    startPlayback,
    stopPlayback,
    returnToPlaybackStart,
    bpm,
    setBpm,
    currentTime,
    totalTime,
    formatTime,
    exportWorkspace,
    importWorkspace,
    setCurrentTime,
    currentProjectId,
    saveProject,
    saveStatus,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWorkspace();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      // `code` describes the physical key position, unlike `key` which
      // changes to Thai characters when the input language is Thai.
      if (event.code === 'KeyZ') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.code === 'KeyY') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [redo, undo]);

  const handleImportProject = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => importWorkspace(e.target?.result);
    reader.readAsText(file);
    event.target.value = null; 
  };

  return (
    <header className="h-16 shrink-0 bg-[#11151a] border-b border-white/10 flex items-center px-3 gap-3">
      
      {/* กลับไปหน้ารวมเครื่องมือโดยไม่ย้อนประวัติเบราว์เซอร์ข้ามไปหน้าหลัก */}
      <button 
        onClick={async () => {
          stopPlayback();
          const saved = await saveProject();
          if (saved) onBack?.();
          else alert('ยังบันทึกโปรเจกต์ไม่ได้ กรุณาลองใหม่อีกครั้งก่อนออกจากหน้านี้');
        }}
        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        title="กลับหน้ารวมเครื่องมือ"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      </button>

      {/* 1. โลโก้และชื่อโปรเจกต์ */}
      <div className="flex items-center gap-3 w-[240px] pl-1 border-l border-white/10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 via-orange-400 to-blue-500 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]">M</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate text-white/90">Thai Music Arranger</div>
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            className="w-full bg-transparent text-[11px] text-white/55 outline-none placeholder:text-white/25"
            placeholder="ตั้งชื่อโปรเจกต์จัดวง"
            title="ตั้งชื่อโปรเจกต์จัดวง"
          />
        </div>
      </div>

      {/* 2. เครื่องมือควบคุมการเล่นเพลง */}
      <div className="flex-1 flex justify-center items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="ย้อนกลับ (Ctrl/Cmd + Z)"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-25"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7v6h6" /><path d="M3 13c1.8-4.8 6.3-7.5 11.1-6.7 3.2.5 5.9 2.7 6.9 5.8" /></svg>
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="ทำซ้ำ (Ctrl/Cmd + Shift + Z หรือ Ctrl + Y)"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-25"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 7v6h-6" /><path d="M21 13c-1.8-4.8-6.3-7.5-11.1-6.7C6.7 6.8 4 9 3 12.1" /></svg>
          </button>
        </div>
        <button
          onClick={() => setCurrentTime(0)}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          title="กลับต้นเพลง"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 19 2 12 11 5 11 19"></polygon>
            <polygon points="22 19 13 12 22 5 22 19"></polygon>
          </svg>
        </button>
        
        <div className="w-px h-5 bg-white/10 mx-1" />

        <button
          onClick={startPlayback}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
            isPlaying
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-white/5 hover:bg-white/10 text-white border border-transparent'
          }`}
          title="เล่น"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>

        <button
          onClick={() => {
            if (isPlaying) stopPlayback();
            else returnToPlaybackStart();
          }}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
            !isPlaying
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'hover:bg-white/10 text-white/80 hover:text-white border border-transparent'
          }`}
          title="หยุด"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
        </button>

        <div className="ml-4 flex items-center justify-center min-w-[120px] h-9 bg-[#0c1014] rounded-lg border border-white/5 font-mono text-[11px] tracking-wider text-white/70 shadow-inner">
          <span className={isPlaying ? "text-white" : ""}>{formatTime(currentTime)}</span>
          <span className="text-white/20 mx-1.5">/</span> 
          <span>{formatTime(totalTime)}</span>
        </div>
      </div>

      {/* 3. จัดการโปรเจกต์ */}
      <div className="flex items-center gap-2 w-[350px] justify-end">
        
        {/* BPM Input */}
        <div className="bg-[#0c1014] border border-white/5 shadow-inner rounded-lg px-2.5 py-1.5 flex items-center mr-2">
          <span className="text-white/40 text-[10px] uppercase tracking-wider mr-2">BPM</span>
          <input
            type="number"
            value={bpm}
            onChange={(e) => setBpm(Math.max(20, Math.min(240, Number(e.target.value) || 120)))}
            className="bg-transparent border-none outline-none text-xs w-9 text-white text-right font-mono"
            min="20"
            max="240"
          />
        </div>

        {/* ปุ่ม Import */}
        <label className="cursor-pointer h-9 px-3.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 text-xs font-medium transition-colors flex items-center gap-2 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Import
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportProject}
          />
        </label>

        <button
          type="button"
          onClick={saveProject}
          disabled={!currentProjectId || saveStatus === 'saving'}
          title={saveStatus === 'error' ? 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' : 'บันทึกโปรเจกต์จัดวง'}
          className="h-9 px-3.5 rounded-lg border border-emerald-400/35 bg-emerald-400/15 hover:bg-emerald-400/25 text-emerald-100 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saveStatus === 'saving'
            ? 'กำลังบันทึก'
            : saveStatus === 'error'
              ? 'บันทึกใหม่'
              : saveStatus === 'unsaved'
                ? 'รอบันทึก'
                : 'บันทึกแล้ว'}
        </button>

        {/* ปุ่ม Export */}
        <button
          onClick={exportWorkspace}
          className="h-9 px-3.5 rounded-lg border border-blue-500/50 bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium transition-colors flex items-center gap-2 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Export
        </button>
      </div>
    </header>
  );
}
