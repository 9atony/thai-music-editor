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
    tracks, activeTool, deleteClip, removeClipById, addClip, addNotationClipAt,
    moveClip, resizeClip, splitClip, copyClip, pasteClipAt, hasClipboard, setCurrentTime, getPlaybackPosition,
    setClipVolume, setClipLoops, isPlaying, startPlayback,
    bpm, snapGrid, measureWidth, totalMeasures, zoomIn, zoomOut, trackLaneHeight,
    selectedNotationCell, selectNotationCell,
    notationSymbolTool, addNotationSymbol, addTrack, addEnsemblePreset, importTmeToTrack,
    importProjectFromWeb, hasSeenWelcome, dismissWorkspaceWelcome,
  } = useWorkspace();

  const [dragInfo, setDragInfo] = useState(null);
  const [resizeInfo, setResizeInfo] = useState(null);
  const [clipSelection, setClipSelection] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const [clipMenu, setClipMenu] = useState(null);
  const [timelineMenu, setTimelineMenu] = useState(null);
  const [pasteTarget, setPasteTarget] = useState(null);
  const [copiedClipWidth, setCopiedClipWidth] = useState(0);
  const [symbolDrag, setSymbolDrag] = useState(null);

  const playheadRef = useRef(null);
  const headerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const importFileRef = useRef(null);
  const pasteTargetRef = useRef(null);
  const copiedClipWidthRef = useRef(0);
  const hasTimelineClipboardRef = useRef(false);

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
    // Keep the notation visible even on short lanes. The clip decides whether
    // to use one compact line or two full note lines from the available height.
    const showNotes = laneHeight >= MIN_TRACK_LANE_HEIGHT;
    const headerH = 22;
    const bodyH = Math.max(0, laneHeight - headerH - 4);
    return { top: 2, height: laneHeight - 4, bodyHeight: bodyH, compact: laneHeight < MIN_VIEWPORT_FOR_NOTES, showNotes };
  };

  const getSelectionKey = (trackId, clipId) => `${trackId}:${clipId}`;

  const setNextPasteTarget = (target) => {
    pasteTargetRef.current = target;
    setPasteTarget(target);
  };

  const getSelectedClips = () => tracks.flatMap((track) => track.clips.map((clip, clipIndex) => ({
    trackId: track.id,
    clipId: clip.id,
    clipIndex,
    start: Math.max(0, Number(clip.start) || 0),
    width: Math.max(0, Number(clip.width) || 0),
    isLocked: track.isLocked,
  }))).filter((item) => clipSelection.includes(getSelectionKey(item.trackId, item.clipId)) && !item.isLocked);

  const getMarqueeRect = (event) => {
    const container = scrollContainerRef.current;
    if (!container || !marquee) return null;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left + container.scrollLeft;
    const y = event.clientY - rect.top + container.scrollTop;
    return {
      left: Math.min(marquee.startX, x),
      top: Math.min(marquee.startY, y),
      width: Math.abs(x - marquee.startX),
      height: Math.abs(y - marquee.startY),
    };
  };

  const selectClipsInRect = (rect) => {
    if (!rect) return;
    let laneTop = 0;
    const selected = [];
    sortedTracks.forEach((track) => {
      const laneHeight = getTrackHeight(track);
      track.clips.forEach((clip) => {
        const clipLeft = (Number(clip.start) || 0) * measureWidth;
        const clipRight = clipLeft + (Number(clip.width) || 0) * measureWidth;
        const clipBottom = laneTop + laneHeight;
        const overlaps = clipLeft < rect.left + rect.width && clipRight > rect.left
          && laneTop < rect.top + rect.height && clipBottom > rect.top;
        if (overlaps) selected.push(getSelectionKey(track.id, clip.id));
      });
      laneTop += laneHeight;
    });
    setClipSelection(selected);
  };

  const beginMarquee = (event) => {
    if (activeTool !== 'select' || event.button !== 0 || event.target.closest('[data-timeline-clip]')) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startX = event.clientX - rect.left + container.scrollLeft;
    const startY = event.clientY - rect.top + container.scrollTop;
    setMarquee({ startX, startY, rect: { left: startX, top: startY, width: 0, height: 0 } });
    setClipSelection([]);
    event.preventDefault();
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

  const handleClipMouseDown = (trackId, clipIndex, currentStart, e, forceDrag = false) => {
    e.preventDefault();
    e.stopPropagation();
    const track = tracks.find((t) => t.id === trackId);
    if (track?.isLocked) return;
    const clip = track?.clips?.[clipIndex];

    const beginClipDrag = () => {
      const selectionKey = getSelectionKey(trackId, clip?.id);
      const selectedClips = clipSelection.includes(selectionKey) ? getSelectedClips() : [{
        trackId,
        clipId: clip?.id,
        clipIndex,
        start: Math.max(0, Number(currentStart) || 0),
        width: Math.max(0, Number(clip?.width) || 0),
        isLocked: track?.isLocked,
      }];
      if (!clipSelection.includes(selectionKey)) setClipSelection([selectionKey]);
      setDragInfo({
        clips: selectedClips,
        startX: e.clientX,
        initialScrollLeft: scrollContainerRef.current?.scrollLeft || 0,
      });
    };

    // Selecting or dragging any part of a clip must also make it the active
    // notation target. Without this, the on-screen/physical keyboard had no
    // selected instrument to audition until the user clicked a tiny note cell.
    if (forceDrag || activeTool === 'select' || activeTool === 'move') {
      if (clip && selectedNotationCell?.clipId !== clip.id) {
        selectNotationCell({ trackId, clipId: clip.id, measureIndex: 0, cellIndex: 0, rowIndex: 0 });
      }
    }

    // The clip header is a permanent drag handle.
    if (forceDrag) {
      beginClipDrag();
      return;
    }

    const clipWidthMeasures = Number(e.currentTarget.dataset.width || 0);
    const clipRect = e.currentTarget.getBoundingClientRect();
    const offsetMeasure = ((e.clientX - clipRect.left) / Math.max(1, clipRect.width)) * clipWidthMeasures;

    if (activeTool === 'erase') return deleteClip(trackId, clipIndex);
    if (activeTool === 'split') return splitClip(trackId, clipIndex, offsetMeasure);
    if (activeTool === 'move' || activeTool === 'select') {
      beginClipDrag();
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
      const container = scrollContainerRef.current;
      if (!container) return;

      // Preserve the exact point where the user grabbed the clip. Moving from
      // its middle or tail therefore does not make the leading edge jump under
      // the pointer. Include scroll movement so the relation remains stable.
      const pointerDelta = e.clientX - dragInfo.startX;
      const scrollDelta = container.scrollLeft - dragInfo.initialScrollLeft;
      const rawDelta = (pointerDelta + scrollDelta) / measureWidth;
      const minDelta = Math.max(...dragInfo.clips.map((clip) => -clip.start));
      const maxDelta = Math.min(...dragInfo.clips.map((clip) => totalMeasures - clip.width - clip.start));

      // Snap is applied only while moving. This preserves the point originally
      // grabbed on the clip and leaves the visible position unchanged on drop.
      const nextDelta = Math.max(minDelta, Math.min(maxDelta, snapValue(rawDelta)));
      dragInfo.clips.forEach((clip) => moveClip(clip.trackId, clip.clipIndex, Number((clip.start + nextDelta).toFixed(2))));
      return;
    }
    if (marquee) {
      const rect = getMarqueeRect(e);
      if (rect) {
        setMarquee((current) => current ? { ...current, rect } : current);
        selectClipsInRect(rect);
      }
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
    // Do not calculate the position again here. Re-snapping on mouseup was the
    // cause of a clip moving one measure away from the position shown while
    // dragging.
    setDragInfo(null);
    setResizeInfo(null);
    setMarquee(null);
  };

  useEffect(() => {
    if (!dragInfo && !resizeInfo && !marquee) return undefined;
    const onMouseMove = (event) => handleMouseMove(event);
    const onMouseUp = (event) => handleMouseUp(event);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragInfo, resizeInfo, marquee, measureWidth, snapGrid, totalMeasures]);

  const beginSymbolDrag = (selection, event) => {
    if (!notationSymbolTool) return;
    event.preventDefault();
    event.stopPropagation();
    setSymbolDrag(selection);
  };

  const finishSymbolDrag = (selection, event) => {
    if (!symbolDrag || !notationSymbolTool) return;
    event.preventDefault();
    event.stopPropagation();
    addNotationSymbol(symbolDrag, selection, notationSymbolTool);
    setSymbolDrag(null);
  };

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
    if (activeTool === 'note') {
      if (track?.isLocked) return;
      addNotationClipAt(trackId, Number(startPosition.toFixed(2)));
      return;
    }
    if (activeTool === 'zoom') { e.shiftKey || e.altKey ? zoomOut() : zoomIn(); }
    
    if (activeTool !== 'draw' && activeTool !== 'zoom' && activeTool !== 'select') {
      setCurrentTime(Math.max(0, rawPosition));
      if (isPlaying) startPlayback();
    }
  };

  const getTimelinePosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rawPosition = (event.clientX - rect.left) / measureWidth;
    return Number((snapGrid > 0 ? Math.floor(rawPosition / snapGrid) * snapGrid : rawPosition).toFixed(2));
  };

  const openTrackContextMenu = (trackId, event) => {
    event.preventDefault();
    event.stopPropagation();
    const track = tracks.find((item) => item.id === trackId);
    if (track?.isLocked) return;
    const start = getTimelinePosition(event);
    setNextPasteTarget({ trackId, start });
    setTimelineMenu({ trackId, start, x: event.clientX, y: event.clientY, sourceClipId: null });
  };

  const openClipContextMenu = (track, clip, clipIndex, event) => {
    event.preventDefault();
    event.stopPropagation();
    if (track.isLocked) return;
    const selectionKey = getSelectionKey(track.id, clip.id);
    setClipSelection([selectionKey]);
    const start = Number((Number(clip.start) + Number(clip.width)).toFixed(2));
    setNextPasteTarget({ trackId: track.id, start });
    setTimelineMenu({ trackId: track.id, start, x: event.clientX, y: event.clientY, sourceClipId: clip.id, clipIndex });
  };

  const copyTimelineClip = (clipId) => {
    const source = findClip(clipId);
    if (!source) return;
    const track = tracks.find((item) => item.clips.some((clip) => clip.id === clipId));
    const width = Math.max(0.25, Number(source.width) || 1);
    copyClip(clipId);
    hasTimelineClipboardRef.current = true;
    copiedClipWidthRef.current = width;
    setCopiedClipWidth(width);
    // Ctrl/Cmd+V should immediately extend the phrase, even if the user has
    // not right-clicked a destination first.
    if (track) setNextPasteTarget({ trackId: track.id, start: Number((Number(source.start) + width).toFixed(2)) });
  };

  const pasteAtTarget = (target = pasteTargetRef.current || pasteTarget) => {
    if (!target || !(hasClipboard || hasTimelineClipboardRef.current)) return;
    pasteClipAt(target.trackId, target.start);
    const width = copiedClipWidthRef.current || copiedClipWidth;
    if (width > 0) {
      setNextPasteTarget({ trackId: target.trackId, start: Number((target.start + width).toFixed(2)) });
    }
    setTimelineMenu(null);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      // Use the physical-key code so Ctrl/Cmd shortcuts work with both Thai
      // and English keyboard layouts.
      if (event.code === 'KeyC') {
        const selected = getSelectedClips()[0];
        if (!selected) return;
        event.preventDefault();
        copyTimelineClip(selected.clipId);
        return;
      }
      if (event.code === 'KeyV') {
        const fallback = selectedNotationCell ? (() => {
          const track = tracks.find((item) => item.id === selectedNotationCell.trackId);
          const clip = track?.clips.find((item) => item.id === selectedNotationCell.clipId);
          return track && clip ? { trackId: track.id, start: Number(clip.start) + Number(clip.width) } : null;
        })() : null;
        const immediateTarget = pasteTargetRef.current || pasteTarget || fallback;
        if (!(hasClipboard || hasTimelineClipboardRef.current) || !immediateTarget) return;
        event.preventDefault();
        pasteAtTarget(immediateTarget);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [clipSelection, copiedClipWidth, hasClipboard, pasteTarget, selectedNotationCell, tracks]);

  const openClipMenu = (clipId, e) => { e.stopPropagation(); setClipMenu({ clipId, x: e.clientX, y: e.clientY }); };
  const closeClipMenu = () => setClipMenu(null);
  const menuClip = clipMenu ? findClip(clipMenu.clipId) : null;
  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    const targetTrack = tracks[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const content = loadEvent.target?.result;
      dismissWorkspaceWelcome();
      if (targetTrack) importTmeToTrack(targetTrack.id, content, file.name);
      else importProjectFromWeb(content, file.name);
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  const handleCreateNotation = () => {
    dismissWorkspaceWelcome();
    const targetTrack = tracks[0];
    if (!targetTrack) {
      addTrack();
      return;
    }
    addNotationClipAt(targetTrack.id, 0);
  };

  const handleAddTrack = () => {
    dismissWorkspaceWelcome();
    addTrack();
  };

  const handleAddEnsemblePreset = () => {
    dismissWorkspaceWelcome();
    addEnsemblePreset();
  };

  return (
    <main
      className="flex-1 min-w-0 flex flex-col bg-[#0c1014] overflow-hidden"
      onPointerUp={() => setSymbolDrag(null)}
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
        <div className="relative min-h-full" style={{ width: `${totalMeasures * measureWidth}px` }} onMouseDown={beginMarquee}>
          
          <div ref={playheadRef}
               className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)] will-change-transform"
               style={{ transform: 'translateX(0px)' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-red-500" />
          </div>

          {marquee?.rect && (
            <div
              className="pointer-events-none absolute z-40 border border-sky-300 bg-sky-400/15 shadow-[0_0_18px_rgba(56,189,248,0.2)]"
              style={{ left: marquee.rect.left, top: marquee.rect.top, width: marquee.rect.width, height: marquee.rect.height }}
            />
          )}

          {!hasSeenWelcome && (
            <section className="absolute inset-0 z-30 flex items-center justify-center bg-[#0c1014]/85 p-6 backdrop-blur-[2px]">
              <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#121922] p-7 text-center shadow-2xl">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/25 bg-sky-400/10 text-2xl text-sky-300">♫</div>
                <h2 className="text-lg font-bold text-white">เริ่มจัดวงของคุณ</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/50">เลือกวิธีเริ่มต้นได้เลย: นำโน้ตเพลงเดิมมาจัดเป็นวง สร้างชุดวงพื้นฐาน หรือเขียนโน้ตด้วยตัวเอง</p>
                <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                  <button type="button" onClick={() => importFileRef.current?.click()} className="rounded-2xl border border-sky-400/25 bg-sky-400/10 p-4 transition-colors hover:bg-sky-400/20">
                    <span className="block text-sm font-bold text-sky-100">นำเข้าไฟล์เพลง</span>
                    <span className="mt-1 block text-xs leading-5 text-sky-100/55">รองรับ .tme, .thai และ .json</span>
                  </button>
                  <button type="button" onClick={handleAddEnsemblePreset} className="rounded-2xl border border-violet-400/25 bg-violet-400/10 p-4 transition-colors hover:bg-violet-400/20">
                    <span className="block text-sm font-bold text-violet-100">สร้างชุดวงพื้นฐาน</span>
                    <span className="mt-1 block text-xs leading-5 text-violet-100/55">ระนาดเอก · ฆ้องวงใหญ่ · กลองแขก · ฉิ่ง</span>
                  </button>
                  <button type="button" onClick={handleCreateNotation} className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 transition-colors hover:bg-emerald-400/20">
                    <span className="block text-sm font-bold text-emerald-100">เริ่มเขียนโน้ต</span>
                    <span className="mt-1 block text-xs leading-5 text-emerald-100/55">สร้างคลิปโน้ตในแทร็กแรกทันที</span>
                  </button>
                </div>
                <button type="button" onClick={handleAddTrack} className="mt-4 text-xs font-semibold text-white/45 transition-colors hover:text-white">หรือเพิ่มแทร็กว่างด้วยตัวเอง</button>
                <input ref={importFileRef} type="file" accept=".tme,.thai,.json" className="hidden" onChange={handleImportFile} />
              </div>
            </section>
          )}

          {sortedTracks.map((track) => {
            const laneHeight = getTrackHeight(track);
            const clipMetrics = getClipMetrics(track);

            return (
              <div key={track.id}
                   onClick={(e) => handleTrackClick(track.id, e)}
                   onContextMenu={(e) => openTrackContextMenu(track.id, e)}
                   className={`relative border-b border-white/[0.06] transition-all duration-300 box-border overflow-hidden ${track.isMuted ? 'opacity-30 bg-black/20' : ''} ${activeTool === 'draw' || activeTool === 'note' ? 'cursor-crosshair hover:bg-white/[0.02]' : ''} ${activeTool === 'zoom' ? 'cursor-zoom-in hover:bg-white/[0.02]' : ''}`}
                   style={{ height: `${laneHeight}px`, minHeight: `${laneHeight}px`, boxSizing: 'border-box', padding: 0 }}>
                
                <div className="absolute inset-0 flex pointer-events-none">
                  {Array.from({ length: totalMeasures }).map((_, index) => (
                    <div key={index} className="h-full border-l border-white/[0.04]" style={{ width: `${measureWidth}px` }} />
                  ))}
                </div>

                {/* ⭐ โค้ดส่วนแสดงผลถูกแพ็กเป็น TimelineClip เรียบร้อยแล้ว */}
                {track.clips.map((clip, index) => {
                  const sourceClipIndex = tracks.find((entry) => entry.id === track.id)?.clips.findIndex((entry) => entry.id === clip.id) ?? index;
                  const selectionKey = getSelectionKey(track.id, clip.id);
                  const isDragging = dragInfo?.clips?.some((item) => item.trackId === track.id && item.clipId === clip.id);
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
                      isSelected={clipSelection.includes(selectionKey)}
                      isDragging={isDragging}
                      isResizing={isResizing}
                      handleClipMouseDown={handleClipMouseDown}
                      handleResizeStart={handleResizeStart}
                      openClipMenu={openClipMenu}
                      removeClipById={removeClipById}
                      selectedNotationCell={selectedNotationCell}
                      selectNotationCell={selectNotationCell}
                      notationSymbolTool={notationSymbolTool}
                      onSymbolPointerDown={beginSymbolDrag}
                      onSymbolPointerUp={finishSymbolDrag}
                      onClipContextMenu={openClipContextMenu}
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

      {timelineMenu && (
        <>
          <div className="fixed inset-0 z-[109]" onClick={() => setTimelineMenu(null)} onContextMenu={(event) => { event.preventDefault(); setTimelineMenu(null); }} />
          <div
            className="fixed z-[110] w-[218px] overflow-hidden rounded-xl border border-white/10 bg-[#161b22] p-1.5 shadow-2xl"
            style={{ left: Math.min(timelineMenu.x, window.innerWidth - 235), top: Math.min(timelineMenu.y, window.innerHeight - 150) }}
          >
            {timelineMenu.sourceClipId && (
              <button
                type="button"
                onClick={() => { copyTimelineClip(timelineMenu.sourceClipId); setTimelineMenu(null); }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-white/85 transition-colors hover:bg-sky-400/15 hover:text-sky-100"
              >
                <span>คัดลอกคลิป</span><kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/50">Ctrl C</kbd>
              </button>
            )}
            <button
              type="button"
              disabled={!hasClipboard}
              onClick={() => pasteAtTarget({ trackId: timelineMenu.trackId, start: timelineMenu.start })}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-white/85 transition-colors hover:bg-emerald-400/15 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span>{timelineMenu.sourceClipId ? 'วางหลังคลิปนี้' : 'วางคลิปที่นี่'}</span><kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/50">Ctrl V</kbd>
            </button>
            <div className="mx-2 my-1 border-t border-white/[0.08]" />
            <div className="px-3 py-1 text-[9px] text-white/35">ตำแหน่ง: ห้อง {Number(timelineMenu.start + 1).toFixed(2)}</div>
          </div>
        </>
      )}
    </main>
  );
}
