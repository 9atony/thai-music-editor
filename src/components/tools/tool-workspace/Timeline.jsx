import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { INSTRUMENT_CONFIG } from '../../../utils/instrumentConfig';

const getClipInstrumentName = (clip, track) => {
  const clipInstrumentId = clip?.sourceMeta?.currentInstrument || clip?.sourceInstrumentId || track?.instrumentId;
  return clip?.sourceMeta?.currentInstrumentName
    || clip?.instrumentLabel
    || INSTRUMENT_CONFIG[clipInstrumentId]?.name
    || INSTRUMENT_CONFIG[track?.instrumentId]?.name
    || 'ไม่ระบุเครื่องดนตรี';
};

const MIN_CLIP_WIDTH = 0.25;
const COLLAPSED_TRACK_HEIGHT = 44;

export default function Timeline() {
  const {
    tracks,
    activeTool,
    deleteClip,
    removeClipById,
    addClip,
    moveClip,
    resizeClip,
    splitClip,
    setCurrentTime,
    getPlaybackPosition,
    setClipVolume,
    setClipLoops,
    isPlaying,
    startPlayback,
    bpm,
    snapGrid,
    measureWidth,
    totalMeasures,
    zoomIn,
    zoomOut,
    trackLaneHeight,
  } = useWorkspace();

  const [dragInfo, setDragInfo] = useState(null);
  const [resizeInfo, setResizeInfo] = useState(null);
  const [clipMenu, setClipMenu] = useState(null);
  
  const playheadRef = useRef(null);
  const headerRef = useRef(null); 
  // ⭐ 1. สร้าง Ref เพื่อจับตัวกล่องสกอลล์บาร์ของไทม์ไลน์
  const scrollContainerRef = useRef(null); 

  const secondsPerMeasure = 60 / Math.max(20, Number(bpm) || 120);
  const pixelsPerSecond = measureWidth / secondsPerMeasure;
  const expandedTrackHeight = Math.max(108, Number(trackLaneHeight) || 132);

  // ⭐ 2. เพิ่มระบบ Auto-scroll เข้าไปในวงจรการเรนเดอร์เส้น Playhead
  useEffect(() => {
    let raf;
    const loop = () => {
      const pos = getPlaybackPosition?.() ?? 0;
      const x = pos * pixelsPerSecond;
      
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${x}px)`;
      }

      // ระบบวิ่งตาม (Auto-Scroll) ทำงานเฉพาะตอนกด Play
      if (isPlaying && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const scrollLeft = container.scrollLeft;
        const clientWidth = container.clientWidth;

        // ถ้าเส้น Playhead วิ่งใกล้จะทะลุขอบขวา (เว้นระยะไว้ 50px)
        if (x > scrollLeft + clientWidth - 50) {
          // เลื่อนหน้ากระดาษให้เส้นเด้งไปอยู่ทางซ้าย (ประมาณ 10% ของจอ) เพื่อให้เห็นโน้ตล่วงหน้า
          container.scrollLeft = x - (clientWidth * 0.1);
        } 
        // ถ้าเส้น Playhead หลุดขอบซ้าย (เช่นกรณีกดปุ่มย้อนกลับต้นเพลง)
        else if (x < scrollLeft) {
          container.scrollLeft = Math.max(0, x - (clientWidth * 0.1));
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pixelsPerSecond, getPlaybackPosition, isPlaying]);

  const sortedTracks = useMemo(
    () => tracks.map((track) => ({
      ...track,
      clips: [...track.clips].sort((a, b) => a.start - b.start),
    })),
    [tracks],
  );

  const findClip = (clipId) => tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId);

  const snapValue = (value) => {
    if (!snapGrid || snapGrid <= 0) return Number(value.toFixed(2));
    return Number((Math.round(value / snapGrid) * snapGrid).toFixed(2));
  };

  const getTrackHeight = (track) => (track.isCollapsed ? COLLAPSED_TRACK_HEIGHT : expandedTrackHeight);

  const getClipMetrics = (track) => {
    if (track.isCollapsed) {
      return { top: 7, height: 30, bodyHeight: 0, compact: true };
    }
    const laneHeight = getTrackHeight(track);
    const height = Math.max(72, laneHeight - 32);
    return { top: 16, height, bodyHeight: Math.max(0, height - 26), compact: false };
  };

  const handleHeaderClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetTime = Math.max(0, clickX / pixelsPerSecond);
    setCurrentTime(targetTime);
    if (isPlaying) startPlayback();
  };

  const handleScroll = (e) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const handleClipMouseDown = (trackId, clipIndex, currentStart, e) => {
    e.stopPropagation();
    const clipWidthMeasures = Number(e.currentTarget.dataset.width || 0);
    const clipRect = e.currentTarget.getBoundingClientRect();
    const offsetMeasure = ((e.clientX - clipRect.left) / Math.max(1, clipRect.width)) * clipWidthMeasures;

    if (activeTool === 'erase') return deleteClip(trackId, clipIndex);
    if (activeTool === 'split') return splitClip(trackId, clipIndex, offsetMeasure);
    if (activeTool === 'move' || activeTool === 'select') {
      setDragInfo({ trackId, clipIndex, startX: e.clientX, initialStart: currentStart });
    }
  };

  const handleResizeStart = (trackId, clipId, edge, initialStart, initialWidth, e) => {
    e.stopPropagation();
    setResizeInfo({ trackId, clipId, edge, startX: e.clientX, initialStart, initialWidth });
  };

  const handleMouseMove = (e) => {
    if (dragInfo) {
      const deltaX = e.clientX - dragInfo.startX;
      const rawMeasures = dragInfo.initialStart + (deltaX / measureWidth);
      if (snapGrid === 0) {
        moveClip(dragInfo.trackId, dragInfo.clipIndex, Math.max(0, Number(rawMeasures.toFixed(2))));
        return;
      }
      const snappedMeasures = Math.round(rawMeasures / snapGrid) * snapGrid;
      moveClip(dragInfo.trackId, dragInfo.clipIndex, Math.max(0, Number(snappedMeasures.toFixed(2))));
      return;
    }

    if (resizeInfo) {
      const deltaX = e.clientX - resizeInfo.startX;
      const deltaMeasures = deltaX / measureWidth;

      if (resizeInfo.edge === 'right') {
        const newWidth = Math.max(MIN_CLIP_WIDTH, resizeInfo.initialWidth + deltaMeasures);
        resizeClip(resizeInfo.trackId, resizeInfo.clipId, { width: snapValue(newWidth) });
      } else {
        const newStart = Math.max(0, resizeInfo.initialStart + deltaMeasures);
        const consumed = newStart - resizeInfo.initialStart;
        const newWidth = Math.max(MIN_CLIP_WIDTH, resizeInfo.initialWidth - consumed);
        const trimOffset = consumed > 0 ? consumed : 0;
        resizeClip(resizeInfo.trackId, resizeInfo.clipId, {
          start: snapValue(newStart), width: snapValue(newWidth), trimOffset: Number(trimOffset.toFixed(2)),
        });
      }
    }
  };

  const handleMouseUp = () => {
    setDragInfo(null);
    setResizeInfo(null);
  };

  const handleTrackClick = (trackId, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const rawPosition = clickX / measureWidth;
    const startPosition = snapGrid > 0 ? Math.floor(rawPosition / snapGrid) * snapGrid : rawPosition;
    if (activeTool === 'draw') addClip(trackId, Number(startPosition.toFixed(2)));
    if (activeTool === 'zoom') { e.shiftKey || e.altKey ? zoomOut() : zoomIn(); }
  };

  const openClipMenu = (clipId, e) => {
    e.stopPropagation();
    setClipMenu({ clipId, x: e.clientX, y: e.clientY });
  };
  const closeClipMenu = () => setClipMenu(null);
  const menuClip = clipMenu ? findClip(clipMenu.clipId) : null;

  return (
    <main
      className="flex-1 min-w-0 flex flex-col bg-[#0c1014] overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div ref={headerRef} className="h-[54px] shrink-0 bg-[#11151a] border-b border-white/10 overflow-hidden select-none scroll-smooth">
        <div
          className="relative h-full cursor-pointer hover:bg-white/5 transition-colors"
          style={{ width: `${totalMeasures * measureWidth}px` }}
          onMouseDown={handleHeaderClick}
          title="คลิกเพื่อย้าย Playhead และเล่นจากจุดนั้น"
        >
          {Array.from({ length: totalMeasures }).map((_, index) => (
            <div key={index} className="absolute top-0 bottom-0 border-l border-white/5" style={{ left: `${index * measureWidth}px`, width: `${measureWidth}px` }}>
              <span className="absolute top-4 left-2 text-[11px] text-white/30">{index + 1}</span>
              <div className="absolute inset-0 flex pointer-events-none">
                {[0, 1, 2, 3].map((beat) => (
                  <div key={beat} className="flex-1 border-l border-white/[0.025]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ⭐ 3. ผูก ref เข้ากับกล่อง Scroll */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto select-none timeline-scroll" 
        onContextMenu={(e) => e.preventDefault()}
        onScroll={handleScroll}
      >
        <div className="relative min-h-full" style={{ width: `${totalMeasures * measureWidth}px` }}>
          <div
            ref={playheadRef}
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)] will-change-transform"
            style={{ transform: 'translateX(0px)' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-red-500" />
          </div>

          {sortedTracks.map((track) => {
            const laneHeight = getTrackHeight(track);
            const clipMetrics = getClipMetrics(track);

            return (
              <div
                key={track.id}
                onClick={(e) => handleTrackClick(track.id, e)}
                className={`relative border-b border-white/[0.06] transition-all duration-300 ${track.isMuted ? 'opacity-30 bg-black/20' : ''} ${activeTool === 'draw' ? 'cursor-crosshair hover:bg-white/[0.02]' : ''} ${activeTool === 'zoom' ? 'cursor-zoom-in hover:bg-white/[0.02]' : ''}`}
                style={{ height: `${laneHeight}px` }}
              >
                <div className="absolute inset-0 flex pointer-events-none">
                  {Array.from({ length: totalMeasures }).map((_, index) => (
                    <div key={index} className="h-full border-l border-white/[0.04]" style={{ width: `${measureWidth}px` }} />
                  ))}
                </div>

                {track.clips.map((clip, index) => {
                  const sourceClipIndex = tracks.find((entry) => entry.id === track.id)?.clips.findIndex((entry) => entry.id === clip.id) ?? index;
                  const isDragging = dragInfo && dragInfo.trackId === track.id && dragInfo.clipIndex === sourceClipIndex;
                  const isResizing = resizeInfo && resizeInfo.trackId === track.id && resizeInfo.clipId === clip.id;
                  const instrumentName = getClipInstrumentName(clip, track);
                  const clipVolume = clip.volume == null ? 100 : clip.volume;

                  return (
                    <div
                      key={clip.id || index}
                      onMouseDown={(e) => handleClipMouseDown(track.id, sourceClipIndex, clip.start, e)}
                      data-width={clip.width}
                      className={`absolute rounded-xl overflow-hidden group transition-all ${
                        activeTool === 'erase' ? 'cursor-not-allowed hover:border-red-500 hover:opacity-50' : activeTool === 'split' ? 'cursor-col-resize hover:brightness-125' : isDragging || isResizing ? 'cursor-grabbing brightness-125 scale-[1.02] shadow-xl z-10' : 'cursor-grab hover:brightness-110'
                      }`}
                      style={{
                        top: `${clipMetrics.top}px`, height: `${clipMetrics.height}px`, left: `${clip.start * measureWidth}px`, width: `${clip.width * measureWidth}px`, backgroundColor: `${track.color}18`, border: `1px solid ${track.color}66`, transitionDuration: (isDragging || isResizing) ? '0ms' : '250ms',
                      }}
                    >
                      <div onMouseDown={(e) => handleResizeStart(track.id, clip.id, 'left', clip.start, clip.width, e)} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/25 rounded-l-xl z-20" title="ลากเพื่อบีบ/ยืดแทรก (ขอบซ้าย)" />
                      <div onMouseDown={(e) => handleResizeStart(track.id, clip.id, 'right', clip.start, clip.width, e)} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/25 rounded-r-xl z-20" title="ลากเพื่อบีบ/ยืดแทรก (ขอบขวา)" />

                      <div className="h-6 px-3 flex items-center justify-between gap-2" style={{ backgroundColor: `${track.color}24` }}>
                        <div className="flex items-center min-w-0 gap-2">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: track.color }} />
                          <span className="text-[11px] text-white/80 truncate">{clip.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!clipMetrics.compact && <span className="text-[10px] text-white/45">{clip.width} ห้อง</span>}
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => openClipMenu(clip.id, e)}
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors ${clipVolume < 100 || (clip.loops || 1) > 1 ? 'bg-sky-500/20 text-sky-300 opacity-100' : 'bg-white/10 text-white/55 hover:bg-sky-500/20 hover:text-sky-300 opacity-0 group-hover:opacity-100'}`}
                            title="ตั้งค่าแทรก"
                          >⚙</button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); removeClipById(track.id, clip.id); }}
                            className="w-5 h-5 rounded-full bg-white/10 text-white/55 hover:bg-rose-500/20 hover:text-rose-300 transition-colors opacity-0 group-hover:opacity-100"
                            title="ลบแทรก"
                          >×</button>
                        </div>
                      </div>

                      {!clipMetrics.compact ? (
                        <div className="px-3 py-2 flex flex-col gap-2 overflow-hidden" style={{ height: `${clipMetrics.bodyHeight}px` }}>
                          <div className="flex flex-wrap gap-1.5">
                            {(clip.notesPreview?.length ? clip.notesPreview : ['—']).slice(0, 12).map((note, noteIndex) => (
                              <span key={`${clip.id || index}_${noteIndex}`} className="text-sm font-medium px-1.5 py-0.5 rounded-md bg-white/[0.04]" style={{ color: track.color }}>{note}</span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-white/45 gap-2">
                            <span className="truncate">{clip.sourceMeta?.sourceFileName || clip.sourceMeta?.projectName || track.sourceProjectName || 'คลิปเปล่า'}</span>
                            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/70">{instrumentName}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="px-3 h-[calc(100%-24px)] flex items-center justify-between gap-2 text-[10px] text-white/60 overflow-hidden">
                          <span className="truncate">{clip.sourceMeta?.sourceFileName || clip.sourceMeta?.projectName || 'คลิป'}</span>
                          <span className="truncate text-white/40">{instrumentName}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {clipMenu && menuClip && (
        <>
          <div className="fixed inset-0 z-[99]" onClick={closeClipMenu} onContextMenu={(e) => { e.preventDefault(); closeClipMenu(); }} />
          <div
            className="fixed z-[100] w-[220px] rounded-xl border border-white/10 bg-[#161b22] shadow-2xl p-3 text-sm"
            style={{ left: Math.min(clipMenu.x, window.innerWidth - 240), top: Math.min(clipMenu.y, window.innerHeight - 220) }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* ส่วนที่ 1: ตั้งค่าระดับเสียง */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] text-white/70 mb-1">
                <span>ระดับเสียง</span>
                <span className="font-mono text-sky-300">{clipMenu && menuClip ? (menuClip.volume == null ? 100 : menuClip.volume) : 100}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={clipMenu && menuClip ? (menuClip.volume == null ? 100 : menuClip.volume) : 100}
                onChange={(e) => setClipVolume(clipMenu.clipId, Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            {/* ส่วนที่ 2: ตั้งค่าเล่นซ้ำ */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-white/70 mb-1">
                <span>ลำดับการเล่น (รอบ)</span>
                <span className="font-mono text-amber-300">×{clipMenu && menuClip ? (menuClip.loops || 1) : 1}</span>
              </div>
              <input
                type="number"
                min="1"
                max="99"
                value={clipMenu && menuClip ? (menuClip.loops || 1) : 1}
                onChange={(e) => setClipLoops(clipMenu.clipId, Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/90 outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}