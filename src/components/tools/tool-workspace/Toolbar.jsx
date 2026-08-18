import React from 'react';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

export default function Toolbar() {
  const {
    activeTool,
    setActiveTool,
    snapGrid,
    toggleSnapGrid,
    zoomLevel,
    zoomIn,
    zoomOut,
    fitTimeline,
    trackLaneHeight,
    setTrackLaneHeight,
  } = useWorkspace();

  const tools = [
    { id: 'select', name: 'เลือก', icon: '↖' },
    { id: 'draw', name: 'วาด', icon: '✎' },
    { id: 'erase', name: 'ลบ', icon: '⌫' },
    { id: 'move', name: 'ย้าย', icon: '✥' },
    { id: 'split', name: 'ผ่า', icon: '✂' },
    { id: 'zoom', name: 'ซูม', icon: '⌕' },
  ];

  const getSnapLabel = () => {
    if (snapGrid === 1) return '1 ห้อง';
    if (snapGrid === 0.5) return '1/2';
    if (snapGrid === 0.25) return '1/4';
    return 'อิสระ';
  };

  return (
    <aside className="w-[84px] shrink-0 bg-[#101419] border-r border-white/10 flex flex-col items-center py-4 gap-2">
      {tools.map((tool) => {
        const active = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={tool.name}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all ${
              active ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-[0_0_18px_rgba(59,130,246,0.12)]' : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-lg leading-none">{tool.icon}</span>
            <span className="text-[10px] mt-1">{tool.name}</span>
          </button>
        );
      })}

      <div className="w-12 h-px bg-white/10 my-1" />

      <button
        onClick={toggleSnapGrid}
        title={`Snap: ${getSnapLabel()}`}
        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all ${
          snapGrid > 0 ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'text-white/30 hover:text-white hover:bg-white/5'
        }`}
      >
        <span className="text-sm font-bold">⌗</span>
        <span className="text-[9px] mt-0.5">{getSnapLabel()}</span>
      </button>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-1 flex flex-col items-center gap-1 mt-1">
        <button onClick={zoomIn} className="w-12 h-10 rounded-xl text-white/60 hover:text-white hover:bg-white/5 text-lg">＋</button>
        <div className="text-[10px] text-white/45 font-mono px-1">{zoomLevel}%</div>
        <button onClick={zoomOut} className="w-12 h-10 rounded-xl text-white/60 hover:text-white hover:bg-white/5 text-lg">－</button>
      </div>

      <div className="w-14 rounded-2xl border border-white/10 bg-white/[0.02] px-2 py-2 mt-1 flex flex-col items-center gap-2">
        <span className="text-[9px] uppercase tracking-wide text-white/45">Track</span>
        <input
          type="range"
          min="108"
          max="180"
          step="4"
          value={trackLaneHeight}
          onChange={(e) => setTrackLaneHeight(Number(e.target.value))}
          className="w-10 accent-cyan-400"
          title="ปรับระยะห่างแทร็ก"
        />
        <span className="text-[10px] text-cyan-300 font-mono">{trackLaneHeight}px</span>
      </div>

      <button
        onClick={fitTimeline}
        className="w-14 h-12 rounded-2xl text-white/50 hover:text-white hover:bg-white/5 text-[10px] leading-tight mt-1"
        title="รีเซ็ตการซูม"
      >
        Fit
      </button>
    </aside>
  );
}
