import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace, MIN_TRACK_LANE_HEIGHT, MAX_TRACK_LANE_HEIGHT, DEFAULT_TRACK_LANE_HEIGHT, COLLAPSED_TRACK_HEIGHT, MIN_VIEWPORT_FOR_NOTES } from '../../../contexts/WorkspaceContext';
import TimelineClip from './TimelineClip'; // ⭐ นำเข้า Component ลูกที่เราเพิ่งสร้าง

const MIN_CLIP_WIDTH = 0.25;

const BLACK_SCROLLBAR_STYLE = `
  .timeline-scroll,
  .track-lane {
    scrollbar-width: thin;
    scrollbar-color: #000000 transparent;
  }
  .timeline-scroll::-webkit-scrollbar,
  .track-lane::-webkit-scrollbar {
    width: 14px;
    height: 14px;
    background: transparent;
  }
  .timeline-scroll::-webkit-scrollbar-track,
  .track-lane::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.45);
  }
  .timeline-scroll::-webkit-scrollbar-thumb,
  .track-lane::-webkit-scrollbar-thumb {
    background-color: #000000;
    border: 3px solid #05080b;
    border-radius: 7px;
  }
  .timeline-scroll::-webkit-scrollbar-thumb:hover,
  .track-lane::-webkit-scrollbar-thumb:hover {
    background-color: #1a1a1a;
  }
  .timeline-scroll::-webkit-scrollbar-corner,
  .track-lane::-webkit-scrollbar-corner {
    background: transparent;
  }
  input[type="range"] { scrollbar-width: thin; }
  input[type="range"]::-webkit-scrollbar { height: 8px; background: rgba(0,0,0,0.4); }
  input[type="range"]::-webkit-scrollbar-thumb { background-color: #000000; border-radius: 4px; }
`;

export default function Timeline() {
  const {
    tracks, activeTool, deleteClip, removeClipById, addClip,
    moveClip, resizeClip, splitClip, setCurrentTime, getPlaybackPosition,
    setClipVolume, setClipLoops, isPlaying, startPlayback,
    bpm, snapGrid, measureWidth, totalMeasures, zoomIn, zoomOut, trackLaneHeight,
  } = useWorkspace();

  const [dragInfo, setDragInfo] = useState(null);
  const [resizeInfo, setResizeInfo] = useState(null);
  const [clipMenu, setClipMenu] = useState(null);

  const playheadRef = useRef(null);
  const headerRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const secondsPerMeasure = 60 / Math.max(20, Number(bpm) || 120);
  const pixelsPerSecond = measureWidth / secondsPerMeasure;

  const expandedTrackHeight = useMemo(
    () => Math.max(MIN_TRACK_LANE_HEIGHT, Math.min(MAX_TRACK_LANE_HEIGHT, Number(trackLaneHeight) || DEFAULT_TRACK_LANE_HEIGHT)),
    [trackLaneHeight],
  );

  useEffect(() => {
    let raf;
    const loop = () => {
      const pos = getPlaybackPosition?.() ?? 0;
      const x = pos * pixelsPerSecond;
      if (playheadRef.current) playheadRef.current.style.transform = `translateX(${x}px)`;
      if (isPlaying && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const scrollLeft = container.scrollLeft;
        const clientWidth = container.clientWidth;
        if (x > scrollLeft + clientWidth - 50) container.scrollLeft = x - (clientWidth * 0.1);
        else if (x < scrollLeft) container.scrollLeft = Math.max(0, x - (clientWidth * 0.1));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pixelsPerSecond, getPlaybackPosition, isPlaying]);

  const sortedTracks = useMemo(
    () => tracks.map((track) => ({ ...track, clips: [...track.clips].sort((a, b) => a.start - b.start) })),
    [tracks],
  );

  const findClip = (clipId) => tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId);

  const snapValue = (value) => {
    if (!snapGrid || snapGrid <= 0) return Number(value.toFixed(2));
    return Number((Math.round(value / snapGrid) * snapGrid).toFixed(2));
  };

  const getTrackHeight = (track) => {
    if (track.isCollapsed) return COLLAPSED_TRACK_HEIGHT;
    const candidate = track.customHeight || expandedTrackHeight;
    return Math.max(MIN_TRACK_LANE_HEIGHT, Math.min(MAX_TRACK_LANE_HEIGHT, candidate));
  };

  const getClipMetrics = (track) => {
    if (track.isCollapsed) {
      return { top: 2, height: COLLAPSED_TRACK_HEIGHT - 6, bodyHeight: 0, compact: true, showNotes: false };
    }
    const laneHeight = getTrackHeight(track);
    const showNotes = laneHeight >= MIN_VIEWPORT_FOR_NOTES;
    const headerH = 22;
    const bodyH = Math.max(0, laneHeight - headerH - 4);
    return { top: 2, height: laneHeight - 4, bodyHeight: bodyH, compact: !showNotes, showNotes };
  };

  const handleHeaderClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    setCurrentTime(Math.max(0, clickX / pixelsPerSecond));
    if (isPlaying) startPlayback();
  };

  const handleScroll = (e) => { 
    if (headerRef.current) headerRef.current.scrollLeft = e.target.scrollLeft; 
    
    const trackPanelScroll = document.getElementById('track-panel-scroll');
    if (trackPanelScroll && trackPanelScroll.scrollTop !== e.target.scrollTop) {
      trackPanelScroll.scrollTop = e.target.scrollTop;
    }
  };

  const handleClipMouseDown = (trackId, clipIndex, currentStart, e) => {
    e.stopPropagation();
    const track = tracks.find((t) => t.id === trackId);
    if (track?.isLocked) return;

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
    const track = tracks.find((t) => t.id === trackId);
    if (track?.isLocked) return;
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
      moveClip(dragInfo.trackId, dragInfo.clipIndex, Math.max(0, Number((Math.round(rawMeasures / snapGrid) * snapGrid).toFixed(2))));
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

  const handleMouseUp = () => { setDragInfo(null); setResizeInfo(null); };

  const handleTrackClick = (trackId, e) => {
    const track = tracks.find((t) => t.id === trackId);
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const rawPosition = clickX / measureWidth;
    const startPosition = snapGrid > 0 ? Math.floor(rawPosition / snapGrid) * snapGrid : rawPosition;
    
    if (activeTool === 'draw') {
      if (track?.isLocked) return;
      addClip(trackId, Number(startPosition.toFixed(2)));
    }
    if (activeTool === 'zoom') { e.shiftKey || e.altKey ? zoomOut() : zoomIn(); }
    
    if (activeTool !== 'draw' && activeTool !== 'zoom') {
      setCurrentTime(Math.max(0, rawPosition));
      if (isPlaying) startPlayback();
    }
  };

  const openClipMenu = (clipId, e) => { e.stopPropagation(); setClipMenu({ clipId, x: e.clientX, y: e.clientY }); };
  const closeClipMenu = () => setClipMenu(null);
  const menuClip = clipMenu ? findClip(clipMenu.clipId) : null;

  return (
    <main
      className="flex-1 min-w-0 flex flex-col bg-[#0c1014] overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <style>{BLACK_SCROLLBAR_STYLE}</style>

      <div ref={headerRef} className="h-[54px] shrink-0 bg-[#11151a] border-b border-white/10 overflow-hidden select-none scroll-smooth">
        <div className="relative h-full cursor-pointer hover:bg-white/5 transition-colors"
             style={{ width: `${totalMeasures * measureWidth}px` }}
             onMouseDown={handleHeaderClick}
             title="คลิกเพื่อย้าย Playhead และเล่นจากจุดนั้น">
          {Array.from({ length: totalMeasures }).map((_, index) => (
            <div key={index} className="absolute top-0 bottom-0 border-l border-white/5" style={{ left: `${index * measureWidth}px`, width: `${measureWidth}px` }}>
              <span className="absolute top-4 left-2 text-[11px] text-white/30">{index + 1}</span>
              <div className="absolute inset-0 flex pointer-events-none">
                {[0,1,2,3].map((beat) => <div key={beat} className="flex-1 border-l border-white/[0.025]" />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div ref={scrollContainerRef}
           id="timeline-scroll" 
           className="flex-1 overflow-auto select-none timeline-scroll track-lane"
           onContextMenu={(e) => e.preventDefault()}
           onScroll={handleScroll}>
        <div className="relative min-h-full" style={{ width: `${totalMeasures * measureWidth}px` }}>
          
          <div ref={playheadRef}
               className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)] will-change-transform"
               style={{ transform: 'translateX(0px)' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-red-500" />
          </div>

          {sortedTracks.map((track) => {
            const laneHeight = getTrackHeight(track);
            const clipMetrics = getClipMetrics(track);

            return (
              <div key={track.id}
                   onClick={(e) => handleTrackClick(track.id, e)}
                   className={`relative border-b border-white/[0.06] transition-all duration-300 box-border overflow-hidden ${track.isMuted ? 'opacity-30 bg-black/20' : ''} ${activeTool === 'draw' ? 'cursor-crosshair hover:bg-white/[0.02]' : ''} ${activeTool === 'zoom' ? 'cursor-zoom-in hover:bg-white/[0.02]' : ''}`}
                   style={{ height: `${laneHeight}px`, minHeight: `${laneHeight}px`, boxSizing: 'border-box', padding: 0 }}>
                
                <div className="absolute inset-0 flex pointer-events-none">
                  {Array.from({ length: totalMeasures }).map((_, index) => (
                    <div key={index} className="h-full border-l border-white/[0.04]" style={{ width: `${measureWidth}px` }} />
                  ))}
                </div>

                {/* ⭐ โค้ดส่วนแสดงผลถูกแพ็กเป็น TimelineClip เรียบร้อยแล้ว */}
                {track.clips.map((clip, index) => {
                  const sourceClipIndex = tracks.find((entry) => entry.id === track.id)?.clips.findIndex((entry) => entry.id === clip.id) ?? index;
                  const isDragging = dragInfo && dragInfo.trackId === track.id && dragInfo.clipIndex === sourceClipIndex;
                  const isResizing = resizeInfo && resizeInfo.trackId === track.id && resizeInfo.clipId === clip.id;

                  return (
                    <TimelineClip
                      key={clip.id || index}
                      clip={clip}
                      track={track}
                      sourceClipIndex={sourceClipIndex}
                      measureWidth={measureWidth}
                      clipMetrics={clipMetrics}
                      activeTool={activeTool}
                      isDragging={isDragging}
                      isResizing={isResizing}
                      handleClipMouseDown={handleClipMouseDown}
                      handleResizeStart={handleResizeStart}
                      openClipMenu={openClipMenu}
                      removeClipById={removeClipById}
                    />
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
          <div className="fixed z-[100] w-[220px] rounded-xl border border-white/10 bg-[#161b22] shadow-2xl p-3 text-sm"
               style={{ left: Math.min(clipMenu.x, window.innerWidth - 240), top: Math.min(clipMenu.y, window.innerHeight - 220) }}
               onContextMenu={(e) => e.preventDefault()}>
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] text-white/70 mb-1">
                <span>ระดับเสียง</span>
                <span className="font-mono text-sky-300">{menuClip.volume == null ? 100 : menuClip.volume}%</span>
              </div>
              <input type="range" min="0" max="200"
                     value={menuClip.volume == null ? 100 : menuClip.volume}
                     onChange={(e) => setClipVolume(clipMenu.clipId, Number(e.target.value))}
                     className="w-full accent-sky-500" />
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] text-white/70 mb-1">
                <span>ลำดับการเล่น (รอบ)</span>
                <span className="font-mono text-amber-300">×{menuClip.loops || 1}</span>
              </div>
              <input type="number" min="1" max="99"
                     value={menuClip.loops || 1}
                     onChange={(e) => setClipLoops(clipMenu.clipId, Number(e.target.value))}
                     className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/90 outline-none focus:border-sky-500" />
            </div>
          </div>
        </>
      )}
    </main>
  );
}