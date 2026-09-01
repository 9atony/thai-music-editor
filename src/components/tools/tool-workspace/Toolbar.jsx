import React, { useEffect } from 'react';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

const BLACK_SCROLLBAR_STYLE = `
  aside.toolbar-area,
  aside.toolbar-area * {
    scrollbar-width: thin;
    scrollbar-color: #000000 transparent;
  }
  aside.toolbar-area ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
    background: transparent;
  }
  aside.toolbar-area ::-webkit-scrollbar-track { background: rgba(0,0,0,0.4); }
  aside.toolbar-area ::-webkit-scrollbar-thumb {
    background-color: #000000;
    border: 2px solid #101419;
    border-radius: 5px;
  }
  aside.toolbar-area ::-webkit-scrollbar-thumb:hover { background-color: #1a1a1a; }
  aside.toolbar-area ::-webkit-scrollbar-corner { background: #000000; }
  aside.toolbar-area input[type="range"] { accent-color: #000000; }
  aside.toolbar-area input[type="range"]::-webkit-slider-runnable-track {
    background: #000000;
    height: 2px;
  }
  aside.toolbar-area input[type="range"]::-webkit-slider-thumb {
    background-color: #000000;
    border: 1px solid #333;
    width: 12px;
    height: 12px;
    border-radius: 999px;
  }
`;

const WORKSPACE_TOOLS = [
  { id: 'select', name: 'เลือก', icon: '↖' },
  { id: 'erase', name: 'ลบ', icon: '⌫' },
  { id: 'split', name: 'ตัด', icon: '✂' },
  { id: 'zoom', name: 'ซูม', icon: '⌕' },
];

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
  } = useWorkspace();

  useEffect(() => {
    if (!WORKSPACE_TOOLS.some((tool) => tool.id === activeTool)) {
      setActiveTool('select');
    }
  }, [activeTool, setActiveTool]);

  const getSnapLabel = () => {
    if (snapGrid === 1) return '1 ห้อง';
    if (snapGrid === 0.5) return '1/2';
    if (snapGrid === 0.25) return '1/4';
    return 'อิสระ';
  };

  const handleToolClick = (toolId) => {
    if (toolId === 'zoom') {
      setActiveTool('zoom');
      zoomIn();
      return;
    }
    setActiveTool(toolId);
  };

  const handleZoomToolContextMenu = (event) => {
    event.preventDefault();
    setActiveTool('zoom');
    zoomOut();
  };

  return (
    <aside className="toolbar-area w-[92px] shrink-0 bg-[#101419] border-r border-white/10 flex flex-col items-center py-4 px-2 gap-3">
      <style>{BLACK_SCROLLBAR_STYLE}</style>

      <div className="w-full rounded-[22px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="mb-2 px-1 text-center text-[9px] uppercase tracking-[0.22em] text-white/35">Tools</div>
        <div className="space-y-2">
          {WORKSPACE_TOOLS.map((tool) => {
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                onContextMenu={tool.id === 'zoom' ? handleZoomToolContextMenu : undefined}
                title={tool.id === 'zoom' ? 'คลิกซ้าย = ซูมเข้า • คลิกขวา = ซูมออก' : tool.name}
                className={`w-full min-h-[58px] rounded-2xl flex flex-col items-center justify-center transition-all border ${
                  active
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 shadow-[0_0_18px_rgba(59,130,246,0.12)]'
                    : 'border-transparent text-white/50 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <span className="text-[18px] leading-none">{tool.icon}</span>
                <span className="text-[10px] mt-1 font-medium tracking-wide">{tool.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={toggleSnapGrid}
        title={`Snap: ${getSnapLabel()}`}
        className={`w-full rounded-2xl border px-2 py-3 flex flex-col items-center justify-center transition-all ${
          snapGrid > 0
            ? 'border-purple-500/30 bg-purple-500/12 text-purple-300'
            : 'border-white/10 text-white/35 hover:text-white hover:bg-white/[0.06]'
        }`}
      >
        <span className="text-sm font-bold">⌗</span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/40">Snap</span>
        <span className="mt-1 text-[11px] font-semibold">{getSnapLabel()}</span>
      </button>

      <div className="w-full rounded-[24px] border border-white/10 bg-gradient-to-b from-[#131b22] to-[#0b1116] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.24)] flex flex-col items-center">
        <div className="text-[8px] uppercase tracking-[0.2em] text-cyan-300/55 mb-2 mt-1">Zoom</div>

        {/* ⭐ ดีไซน์แคปซูลแนวตั้ง (Vertical Pill) พร้อม Icon แบบมินิมอล */}
        <div className="flex flex-col items-center bg-[#080d12] rounded-full p-1 shadow-inner border border-white/5 w-[46px]">
          <button
            onClick={zoomIn}
            title="ซูมเข้า"
            className="w-9 h-9 rounded-full bg-white/[0.04] text-white/50 hover:bg-white/[0.12] hover:text-white transition-all flex items-center justify-center active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>

          <div className="py-2.5 text-[10px] font-mono text-white/90 tabular-nums select-none">
            {zoomLevel}%
          </div>

          <button
            onClick={zoomOut}
            title="ซูมออก"
            className="w-9 h-9 rounded-full bg-white/[0.04] text-white/50 hover:bg-white/[0.12] hover:text-white transition-all flex items-center justify-center active:scale-95"
          >
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>

        {/* ⭐ ปุ่ม Fit แยกออกมาด้านล่างให้กดง่าย */}
        <button
          onClick={fitTimeline}
          className="mt-3 w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[9px] uppercase tracking-wider text-white/60 hover:text-white transition-colors border border-white/5 hover:border-white/10 active:scale-95 font-medium"
          title="ปรับให้พอดี"
        >
          Fit
        </button>
      </div>
    </aside>
  );
}
