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

const buildNotationFromEvents = (clip, cellsPerMeasure = 8) => {
  const measureCount = Math.max(1, Math.ceil(Number(clip.playback?.measureCount) || Number(clip.width) || 1));
  const events = clip.playback?.events || [];
  const hasBottom = events.some((event) => event.rowIndex === 1);
  const measures = Array.from({ length: measureCount }, (_, index) => ({
    index,
    top: Array(cellsPerMeasure).fill('-'),
    bottom: hasBottom ? Array(cellsPerMeasure).fill('-') : null,
  }));

  events.forEach((event) => {
    const offset = Math.max(0, Number(event.measureOffset) || 0);
    const measureIndex = Math.floor(offset);
    const measure = measures[measureIndex];
    if (!measure || !event.note || event.note === '-') return;
    const cellIndex = Math.min(cellsPerMeasure - 1, Math.floor((offset - measureIndex) * cellsPerMeasure + 0.0001));
    const row = event.rowIndex === 1 && measure.bottom ? measure.bottom : measure.top;
    row[cellIndex] = row[cellIndex] === '-' ? event.note : `${row[cellIndex]}${event.note}`;
  });

  return measures;
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
        boxShadow: `inset 0 0 0 1px ${track.color}66`,
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
      <div
        className="relative w-full overflow-hidden pointer-events-none"
        style={{
          height: `${clipMetrics.bodyHeight}px`,
          backgroundImage: `repeating-linear-gradient(to right, rgba(255,255,255,0.34) 0, rgba(255,255,255,0.34) 1px, transparent 1px, transparent ${measureWidth}px)`,
          backgroundPosition: `${-(Number(clip.start) || 0) * measureWidth}px 0`,
        }}
      >
        {clipMetrics.showNotes && (() => {
          const trimOffset = Number(clip.trimOffset) || 0;
          const notationMeasures = Array.isArray(clip.playback?.notationMeasures)
            ? clip.playback.notationMeasures
            : buildNotationFromEvents(clip);
          const notationSymbols = Array.isArray(clip.playback?.notationSymbols)
            ? clip.playback.notationSymbols
            : [];
          const noteFontSize = Math.max(7, Math.min(12, measureWidth / 8));
          
          return (
            <div className="absolute inset-0">
              {notationMeasures.map((measure, measureArrayIndex) => {
                const measureIndex = Number.isFinite(Number(measure.index)) ? Number(measure.index) : measureArrayIndex;
                const left = (measureIndex - trimOffset) * measureWidth;
                if (left + measureWidth < 0 || left > clip.width * measureWidth) return null;
                const rows = measure.bottom ? [measure.top, measure.bottom] : [measure.top];

                return (
                  <div
                    key={`${measureIndex}_${measureArrayIndex}`}
                    className="absolute top-0 bottom-0 flex flex-col"
                    style={{ left: `${left}px`, width: `${measureWidth}px` }}
                  >
                    {rows.map((cells, rowIndex) => (
                      <div
                        key={rowIndex}
                        className={`grid min-h-0 flex-1 items-center ${rowIndex > 0 ? 'border-t border-white/25' : ''}`}
                        style={{ gridTemplateColumns: `repeat(${Math.max(1, cells?.length || 1)}, minmax(0, 1fr))` }}
                      >
                        {(cells?.length ? cells : ['-']).map((token, cellIndex) => (
                          <span
                            key={cellIndex}
                            className="overflow-visible whitespace-nowrap text-center font-semibold text-white/90"
                            style={{
                              fontSize: `${noteFontSize}px`,
                              lineHeight: 1,
                              textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                            }}
                          >
                            {token || '-'}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
              {notationSymbols.length > 0 && (
                <svg className="absolute inset-0 z-[15] h-full w-full overflow-visible" aria-label="สัญลักษณ์กำกับโน้ต">
                  {notationSymbols.map((symbol) => {
                    const x1 = (Number(symbol.startOffset) - trimOffset) * measureWidth;
                    const x2 = (Number(symbol.endOffset) - trimOffset) * measureWidth;
                    if (Math.max(x1, x2) < 0 || Math.min(x1, x2) > clip.width * measureWidth) return null;

                    const isKro = symbol.type === 'kro';
                    const bodyHeight = Math.max(18, clipMetrics.bodyHeight);
                    const hasLowerRow = notationMeasures.some((measure) => Array.isArray(measure.bottom));
                    const startY = isKro
                      ? (symbol.startRowIndex === 1 || !hasLowerRow ? bodyHeight - 4 : Math.floor(bodyHeight / 2) - 3)
                      : (symbol.startRowIndex === 1 ? Math.floor(bodyHeight / 2) + 5 : 7);
                    const endY = isKro
                      ? (symbol.endRowIndex === 1 || !hasLowerRow ? bodyHeight - 4 : Math.floor(bodyHeight / 2) - 3)
                      : (symbol.endRowIndex === 1 ? Math.floor(bodyHeight / 2) + 5 : 7);
                    const midpoint = (x1 + x2) / 2;
                    const path = isKro
                      ? `M ${x1} ${startY} Q ${midpoint} ${Math.min(bodyHeight - 2, Math.max(startY, endY) + 5)} ${x2} ${endY}`
                      : `M ${x1} ${startY} Q ${midpoint} ${Math.max(1, Math.min(startY, endY) - 9)} ${x2} ${endY}`;

                    return (
                      <g key={symbol.id}>
                        <path
                          d={path}
                          fill="none"
                          stroke={symbol.color || (isKro ? '#38bdf8' : '#fbbf24')}
                          strokeWidth={Math.max(1, Math.min(3, Number(symbol.strokeWidth) || 2))}
                          strokeLinecap="round"
                          strokeDasharray={isKro ? '3 1.5' : undefined}
                          opacity="0.95"
                        />
                        <text
                          x={midpoint}
                          y={isKro ? Math.min(bodyHeight - 7, Math.max(startY, endY) + 8) : Math.max(8, Math.min(startY, endY) - 10)}
                          textAnchor="middle"
                          fill={symbol.color || (isKro ? '#38bdf8' : '#fbbf24')}
                          fontSize="7"
                          fontWeight="700"
                        >
                          {isKro ? 'กรอ' : 'สะบัด'}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
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
