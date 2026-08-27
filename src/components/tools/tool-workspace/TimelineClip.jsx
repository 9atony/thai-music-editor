import React from 'react';
import { INSTRUMENT_CONFIG } from '../../../utils/instrumentConfig';

// ฟังก์ชันหาชื่อเครื่องดนตรี ย้ายมาไว้ที่ไฟล์นี้เพื่อให้จบในตัว
const getClipInstrumentName = (clip, track) => {
  const clipInstrumentId = clip?.sourceMeta?.currentInstrument || clip?.sourceInstrumentId || track?.instrumentId;
  return clip?.sourceMeta?.currentInstrumentName
    || clip?.instrumentLabel
    || INSTRUMENT_CONFIG[clipInstrumentId]?.name
    || INSTRUMENT_CONFIG[track?.instrumentId]?.name
    || 'ไม่ระบุเครื่องดนตรี';
};

export default function TimelineClip({
  clip,
  track,
  sourceClipIndex,
  measureWidth,
  clipMetrics,
  activeTool,
  isDragging,
  isResizing,
  handleClipMouseDown,
  handleResizeStart,
  openClipMenu,
  removeClipById
}) {
  const isLocked = track.isLocked;
  const instrumentName = getClipInstrumentName(clip, track);
  const clipVolume = clip.volume == null ? 100 : clip.volume;

  return (
    <div
      onMouseDown={(e) => handleClipMouseDown(track.id, sourceClipIndex, clip.start, e)}
      data-width={clip.width}
      className={`absolute rounded overflow-hidden group transition-all ${
        isLocked ? 'opacity-30 grayscale cursor-not-allowed'
          : activeTool === 'erase' ? 'cursor-not-allowed hover:border-red-500 hover:opacity-50'
          : activeTool === 'split' ? 'cursor-col-resize hover:brightness-125'
          : isDragging || isResizing ? 'cursor-grabbing brightness-125 scale-[1.02] shadow-xl z-10'
          : 'cursor-grab hover:brightness-110'
      }`}
      style={{
        top: `${clipMetrics.top}px`,
        height: `${clipMetrics.height}px`,
        left: `${clip.start * measureWidth}px`,
        width: `${clip.width * measureWidth}px`,
        backgroundColor: `${track.color}18`,
        border: `1px solid ${track.color}66`,
        transitionDuration: (isDragging || isResizing) ? '0ms' : '250ms',
      }}
    >
      {/* ⭐ ขอบยืดหดของ Clip */}
      <div onMouseDown={(e) => handleResizeStart(track.id, clip.id, 'left', clip.start, clip.width, e)}
           className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/70 transition-colors z-20"
           title="ลากเพื่อบีบ/ยืด (ขอบซ้าย)" />
      <div onMouseDown={(e) => handleResizeStart(track.id, clip.id, 'right', clip.start, clip.width, e)}
           className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/70 transition-colors z-20"
           title="ลากเพื่อบีบ/ยืด (ขอบขวา)" />

      {/* ⭐ Header ของ clip */}
      <div className="px-2 flex items-center justify-between gap-1.5 shrink-0" style={{ height: '22px', backgroundColor: `${track.color}24` }}>
        <div className="flex items-center min-w-0 gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: track.color }} />
          <span className="text-[10px] text-white/80 truncate">{clip.name}</span>
          {!clipMetrics.compact && <span className="text-[9px] text-white/40 shrink-0">{clip.width}ห้อง</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => openClipMenu(clip.id, e)}
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] transition-colors ${clipVolume < 100 || (clip.loops || 1) > 1 ? 'bg-sky-500/20 text-sky-300 opacity-100' : 'bg-white/10 text-white/55 hover:bg-sky-500/20 hover:text-sky-300 opacity-0 group-hover:opacity-100'}`}
                  title="ตั้งค่าแทรก">⚙</button>
          <button type="button" onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); removeClipById(track.id, clip.id); }}
                  className="w-4 h-4 rounded-full bg-white/10 text-white/55 hover:bg-rose-500/20 hover:text-rose-300 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px]"
                  title="ลบแทรก">×</button>
        </div>
      </div>

      {/* ⭐ Body ของ clip (สำหรับแสดงโน้ต) */}
      <div className="relative w-full overflow-hidden pointer-events-none" style={{ height: `${clipMetrics.bodyHeight}px` }}>
        {clipMetrics.showNotes && (() => {
          const evs = clip.playback?.events || [];
          const hasLeftHand = evs.some(e => e.rowIndex === 1);
          const noteTopByRow = hasLeftHand ? { 0: '4px', 1: '20px' } : { 0: '8px' };
          
          return (
            <div className="absolute inset-0">
              <div className="absolute left-0 right-0 border-t border-white/[0.06]" style={{ top: hasLeftHand ? '12px' : '16px' }} />
              {hasLeftHand && <div className="absolute left-0 right-0 border-t border-white/[0.06]" style={{ top: '28px' }} />}
              
              {evs.map((ev, idx) => {
                const trimOffset = clip.trimOffset || 0;
                const renderOffset = ev.measureOffset - trimOffset;
                if (renderOffset < 0 || renderOffset > clip.width) return null;
                const topPos = noteTopByRow[ev.rowIndex] || noteTopByRow[0];
                return (
                  <div key={ev.id || idx}
                       className="absolute text-[8px] font-bold px-1 rounded-[2px] bg-[#11151a]/95 border border-white/10 whitespace-nowrap z-10 shadow-sm"
                       style={{
                         left: `${renderOffset * measureWidth}px`,
                         top: topPos,
                         color: track.color,
                         lineHeight: '1.1',
                         maxHeight: `${clipMetrics.bodyHeight}px`,
                       }}>
                    {ev.note}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* แสดงชื่อไฟล์/เครื่องดนตรี เมื่อย่อ Track เล็กจนซ่อนโน้ต */}
        {!clipMetrics.showNotes && clipMetrics.bodyHeight > 0 && (
          <div className="absolute bottom-0.5 left-2 right-2 flex items-center justify-between text-[9px] text-white/50 gap-1 pointer-events-none overflow-hidden">
            <span className="truncate min-w-0">{clip.sourceMeta?.sourceFileName || track.sourceProjectName || 'คลิป'}</span>
            <span className="truncate text-white/40 shrink-0">{instrumentName}</span>
          </div>
        )}
      </div>
    </div>
  );
}