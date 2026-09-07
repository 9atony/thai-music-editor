import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MusicContext } from '../../contexts/MusicContext';
import { getVisualIndex } from '../../utils/sheetUtils';
import {
  clampTempoBpm, getPlayableMeasures, getPlaybackMeasures, getTempoAtBeat, getTempoAtPosition,
  measureToPosition, normalizeTempoTrack
} from '../../utils/tempoTrack';

const MIN_GRAPH_WIDTH = 1000;
const MEASURE_WIDTH = 72;
const GRAPH_HEIGHT = 196;
const PADDING = { left: 72, right: 30, top: 12 };

const TempoTrackPanel = () => {
  const {
    isTempoTrackOpen, setIsTempoTrackOpen, layoutConfig, sheetData, rowTypes, sectionLabels,
    selectedCell, playbackCursor, isPlaying, currentPlaybackBpm, updateTempoTrack, isReadOnly, playbackSequence, playbackProgressRef
  } = useContext(MusicContext);
  const sourceMeasures = useMemo(() => getPlayableMeasures(sheetData, rowTypes), [sheetData, rowTypes]);
  const measures = useMemo(() => getPlaybackMeasures(sheetData, rowTypes, sectionLabels, playbackSequence), [sheetData, rowTypes, sectionLabels, playbackSequence]);
  const sectionNames = useMemo(() => {
    let currentSection = '';
    let previousRow = null;
    return measures.map(measure => {
      if (measure.sectionName) return measure.sectionName.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (measure.row !== previousRow) {
        const labels = sectionLabels?.[getVisualIndex(measure.row, rowTypes)] || [];
        const section = labels.find(label => label.position === 'top-left' && label.text?.trim());
        if (section) currentSection = section.text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        previousRow = measure.row;
      }
      return currentSection;
    });
  }, [measures, rowTypes, sectionLabels]);
  const normalizedPoints = useMemo(() => normalizeTempoTrack(
    layoutConfig.tempoTrack || [], sheetData, rowTypes, layoutConfig.bpm
  ).map(point => ({ ...point, transition: 'linear' })), [layoutConfig.tempoTrack, layoutConfig.bpm, sheetData, rowTypes]);
  const [draftPoints, setDraftPoints] = useState(normalizedPoints);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState(0);
  const [draggingId, setDraggingId] = useState(null);
  const [bpmInput, setBpmInput] = useState('80');
  const [containerWidth, setContainerWidth] = useState(MIN_GRAPH_WIDTH);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const graphHeight = isFullScreen ? Math.max(GRAPH_HEIGHT, viewportHeight - 82) : GRAPH_HEIGHT;
  const graphBottomPadding = isFullScreen ? 82 : 42;
  const dragPointsRef = useRef(normalizedPoints);
  const draggingIdRef = useRef(null);
  const graphContainerRef = useRef(null);
  const playheadRef = useRef(null);
  const visiblePoints = draggingId ? draftPoints : normalizedPoints;

  useEffect(() => {
    const element = graphContainerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.max(320, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isTempoTrackOpen, isFullScreen]);

  useEffect(() => {
    const resize = () => setViewportHeight(window.innerHeight);
    const escape = event => {
      if (event.key === 'Escape' && isFullScreen) {
        event.stopPropagation();
        setIsFullScreen(false);
      }
    };
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', escape, true);
    };
  }, [isFullScreen]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    const handleKeyDown = event => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const currentCell = playbackCursor || selectedCell || [measures[0]?.row || 0, measures[0]?.measure || 0, 0];
  const currentPosition = { row: currentCell[0], measure: currentCell[1], cell: currentCell[2] };
  const displayedBpm = isPlaying
    ? currentPlaybackBpm
    : Math.round(getTempoAtPosition(currentPosition, visiblePoints, layoutConfig.bpm, sheetData, rowTypes));
  const selectedPoint = visiblePoints.find((point) => point.id === selectedId);
  const graphWidth = Math.max(
    MIN_GRAPH_WIDTH,
    containerWidth,
    PADDING.left + PADDING.right + (Math.max(1, measures.length) * MEASURE_WIDTH)
  );

  useEffect(() => {
    if (!isPlaying || !isTempoTrackOpen) return undefined;
    const occurrenceIndices = new Map(measures.map((measure, index) => [
      `${measure.row}:${measure.measure}:${measure.sequenceIndex ?? ''}:${measure.loop ?? ''}`, index
    ]));
    let frame;
    let previousTime = performance.now();
    let scrollTarget = null;
    const animate = now => {
      const progress = playbackProgressRef?.current;
      const line = playheadRef.current;
      const container = graphContainerRef.current;
      if (progress && line && container) {
        const key = `${progress.row}:${progress.measure}:${progress.sequenceIndex ?? ''}:${progress.loop ?? ''}`;
        const index = occurrenceIndices.get(key) ?? occurrenceIndices.get(`${progress.row}:${progress.measure}::`);
        if (index !== undefined) {
          const portion = Math.min(1, Math.max(0, (now - progress.startedAt) / Math.max(1, progress.durationMs)));
          const fraction = index + (progress.cell + portion) / measures[index].cellCount;
          const x = PADDING.left + fraction / Math.max(1, measures.length) * (graphWidth - PADDING.left - PADDING.right);
          line.setAttribute('x1', String(x));
          line.setAttribute('x2', String(x));
          if (!draggingId) {
            const margin = Math.min(160, container.clientWidth / 4);
            if (x < container.scrollLeft + 52 || x > container.scrollLeft + container.clientWidth - margin) {
              scrollTarget = Math.max(0, Math.min(container.scrollWidth - container.clientWidth, x - margin));
            }
            if (scrollTarget !== null) {
              const distance = scrollTarget - container.scrollLeft;
              container.scrollLeft += distance * (1 - Math.exp(-Math.min(64, now - previousTime) / 80));
              if (Math.abs(distance) < 1) scrollTarget = null;
            }
          }
        }
      }
      previousTime = now;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, isTempoTrackOpen, measures, graphWidth, draggingId, isFullScreen, playbackProgressRef]);
  if (!isTempoTrackOpen) return null;

  const plotWidth = graphWidth - PADDING.left - PADDING.right;
  const plotHeight = graphHeight - PADDING.top - graphBottomPadding;
  // Keep the scale steady during a drag; expand only for existing higher tempos.
  const graphMaxBpm = Math.min(300, Math.max(150, Math.ceil(Math.max(
    clampTempoBpm(layoutConfig.bpm), ...normalizedPoints.map(point => point.bpm)
  ) / 25) * 25));
  const bpmTicks = [20, 50, 80, 110, 150];
  for (let bpm = 175; bpm <= graphMaxBpm; bpm += 25) bpmTicks.push(bpm);
  const xForIndex = (index) => PADDING.left + ((index / Math.max(1, measures.length)) * plotWidth);
  const yForBpm = (bpm) => PADDING.top + (((graphMaxBpm - clampTempoBpm(bpm)) / (graphMaxBpm - 20)) * plotHeight);
  const indexForX = (x) => Math.min(measures.length - 1, Math.max(0, Math.floor(((x - PADDING.left) / plotWidth) * Math.max(1, measures.length))));
  const bpmForY = (y) => clampTempoBpm(graphMaxBpm - ((Math.min(1, Math.max(0, (y - PADDING.top) / plotHeight))) * (graphMaxBpm - 20)));
  const positionForX = (x) => {
    const measureIndex = indexForX(x);
    const measure = measures[measureIndex];
    if (!measure) return { measureIndex: 0, cell: 0 };
    const measureStart = xForIndex(measureIndex);
    const measureWidth = Math.max(1, xForIndex(measureIndex + 1) - measureStart);
    const fraction = Math.min(0.999999, Math.max(0, (x - measureStart) / measureWidth));
    return {
      measureIndex,
      cell: Math.min(measure.cellCount - 1, Math.max(0, Math.floor(fraction * measure.cellCount))),
    };
  };

  const commit = (points) => updateTempoTrack(normalizeTempoTrack(points, sheetData, rowTypes, layoutConfig.bpm));
  const upsertAt = (measureIndex, bpm, transition = 'linear', preferredId = null, source = visiblePoints, cell = 0) => {
    const measure = measures[measureIndex];
    if (!measure) return source;
    const position = measureToPosition(measure, cell);
    const duplicate = source.find((point) => point.position.row === position.row && point.position.measure === position.measure && point.position.cell === position.cell && point.id !== preferredId);
    let id = preferredId || duplicate?.id || `tempo-${measure.row}-${measure.measure}-${source.length}`;
    while (!preferredId && !duplicate && source.some((point) => point.id === id)) id = `${id}-next`;
    const next = source.filter((point) => point.id !== id && point.id !== duplicate?.id);
    next.push({ id, position, bpm: clampTempoBpm(bpm, layoutConfig.bpm), transition });
    return normalizeTempoTrack(next, sheetData, rowTypes, layoutConfig.bpm);
  };

  const pointerPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * graphWidth,
      y: ((event.clientY - rect.top) / rect.height) * graphHeight
    };
  };

  const handleGraphPointerDown = (event) => {
    if (event.button !== 0 || isReadOnly || event.target.dataset.tempoPoint === 'true') return;
    const { x, y } = pointerPosition(event);
    if (y < PADDING.top || y > graphHeight - graphBottomPadding || x < PADDING.left || x > graphWidth - PADDING.right) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const { measureIndex, cell } = positionForX(x);
    const next = upsertAt(measureIndex, bpmForY(y), 'linear', null, visiblePoints, cell);
    const position = measureToPosition(measures[measureIndex], cell);
    const point = next.find(entry => entry.position.row === position.row && entry.position.measure === position.measure && entry.position.cell === position.cell);
    if (!point) return;
    setDraftPoints(next);
    dragPointsRef.current = next;
    draggingIdRef.current = point.id;
    setDraggingId(point.id);
    setSelectedId(point.id);
    setSelectedOccurrence(measureIndex);
    setBpmInput(String(point.bpm));
  };

  const handlePointPointerDown = (event, id, index) => {
    if (event.button !== 0) return;
    setSelectedOccurrence(index);
    if (isReadOnly) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(id);
    const point = visiblePoints.find((entry) => entry.id === id);
    setBpmInput(String(point?.bpm || layoutConfig.bpm));
    setDraftPoints(visiblePoints);
    dragPointsRef.current = visiblePoints;
    draggingIdRef.current = id;
    setDraggingId(id);
  };

  const handleGraphPointerMove = (event) => {
    const activeId = draggingIdRef.current;
    if (!activeId) return;
    const { x, y } = pointerPosition(event);
    const { measureIndex, cell } = positionForX(x);
    setSelectedOccurrence(measureIndex);
    setDraftPoints((current) => {
      const point = current.find(entry => entry.id === activeId);
      if (!point) return current;
      const next = upsertAt(measureIndex, bpmForY(y), point.transition, activeId, current, cell);
      dragPointsRef.current = next;
      const updatedPoint = next.find(entry => entry.id === activeId);
      if (updatedPoint) setBpmInput(String(updatedPoint.bpm));
      return next;
    });
  };

  const finishDrag = (event) => {
    if (!draggingIdRef.current) return;
    if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    draggingIdRef.current = null;
    setDraggingId(null);
    commit(dragPointsRef.current);
  };

  const updateSelected = (updates) => {
    if (isReadOnly || !selectedPoint) return;
    const next = normalizeTempoTrack(visiblePoints.map((point) => point.id === selectedPoint.id ? { ...point, ...updates } : point), sheetData, rowTypes, layoutConfig.bpm);
    setDraftPoints(next);
    commit(next);
  };

  const openPointContextMenu = (event, point, index) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(point.id);
    setSelectedOccurrence(index);
    setBpmInput(String(point.bpm));
    const menuWidth = 176;
    const menuHeight = 132;
    setContextMenu({
      id: point.id,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };

  const resetContextPoint = () => {
    if (isReadOnly || !contextMenu?.id) return;
    const bpm = clampTempoBpm(layoutConfig.bpm);
    const next = normalizeTempoTrack(visiblePoints.map(point => point.id === contextMenu.id
      ? { ...point, bpm, transition: 'linear' }
      : { ...point, transition: 'linear' }), sheetData, rowTypes, layoutConfig.bpm);
    setDraftPoints(next);
    setBpmInput(String(bpm));
    commit(next);
    setContextMenu(null);
  };

  const deleteContextPoint = () => {
    if (isReadOnly || !contextMenu?.id) return;
    const next = visiblePoints.filter(point => point.id !== contextMenu.id);
    setSelectedId(null);
    setDraftPoints(next);
    commit(next);
    setContextMenu(null);
  };

  const clearTempoTrack = () => {
    if (isReadOnly) return;
    setSelectedId(null);
    setDraftPoints([]);
    commit([]);
    setContextMenu(null);
  };

  const moveSelected = (measureDelta, bpmDelta) => {
    if (isReadOnly || !selectedPoint) return;
    const nextIndex = Math.min(measures.length - 1, Math.max(0, selectedOccurrence + measureDelta));
    setSelectedOccurrence(nextIndex);
    const next = upsertAt(nextIndex, selectedPoint.bpm + bpmDelta, selectedPoint.transition, selectedPoint.id, visiblePoints, selectedPoint.position.cell);
    setDraftPoints(next);
    commit(next);
  };

  const graphPoints = measures.flatMap((measure, index) => visiblePoints
    .filter(point => point.position.row === measure.row && point.position.measure === measure.measure)
    .map(point => ({ ...point, graphIndex: index })));
  // Use the source tempo at every playlist boundary, including jumps and repeats.
  let path = '';
  measures.forEach((measure, index) => {
    const offsets = [...new Set([0, ...visiblePoints
      .filter(point => point.position.row === measure.row && point.position.measure === measure.measure)
      .map(point => point.position.cell / measure.cellCount), 1])].sort((a, b) => a - b);
    offsets.forEach((offset, offsetIndex) => {
      const beat = measure.startBeat + offset * 4;
      if (offsetIndex > 0) {
        const before = getTempoAtBeat(beat - 0.000001, visiblePoints, layoutConfig.bpm, sourceMeasures);
        path += ` L ${xForIndex(index + offset)} ${yForBpm(before)}`;
      }
      if (offset < 1) {
        const bpm = getTempoAtBeat(beat, visiblePoints, layoutConfig.bpm, sourceMeasures);
        path += ` ${path ? 'L' : 'M'} ${xForIndex(index + offset)} ${yForBpm(bpm)}`;
      }
    });
  });
  const panel = (
    <section className={`${isFullScreen ? 'fixed inset-0 z-[10000] overflow-auto p-4' : 'relative z-[130] shrink-0 px-3 py-1.5'} border-b border-orange-200 bg-white shadow-inner`} aria-label="ปรับความเร็วแต่ละช่วง">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="mr-auto flex items-center gap-2 text-sm font-black text-slate-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">⌁</span>
          ปรับความเร็วแต่ละช่วง
        </div>
        <div className="flex min-w-[132px] items-baseline justify-center gap-1 rounded-xl border border-orange-300 bg-gradient-to-br from-orange-50 to-amber-100 px-3 py-1 shadow-sm" aria-live="polite">
          <strong className="text-xl font-black tabular-nums leading-none text-orange-700">{Math.round(displayedBpm)}</strong>
          <span className="text-[10px] font-black tracking-wide text-orange-600">BPM</span>
        </div>
        <button type="button" onClick={() => setIsFullScreen(value => !value)} aria-pressed={isFullScreen} className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">{isFullScreen ? 'ออกจากเต็มหน้า' : 'เต็มหน้า'}</button>
        <button type="button" onClick={() => { setIsFullScreen(false); setIsTempoTrackOpen(false); }} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">⌃ ย่อ</button>
      </div>
      <div className="relative rounded-xl border border-orange-100 bg-slate-50/60">
        <div ref={graphContainerRef} className="overflow-x-auto rounded-xl">
          <svg width={graphWidth} height={graphHeight} viewBox={`0 0 ${graphWidth} ${graphHeight}`} className={`block touch-none ${draggingId ? 'cursor-grabbing' : 'cursor-crosshair'}`} onPointerDown={handleGraphPointerDown} onPointerMove={handleGraphPointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag} role="application" aria-label="กราฟกำหนด BPM ตามห้องเพลง">
            {bpmTicks.map((bpm) => <line key={bpm} x1={PADDING.left} x2={graphWidth - PADDING.right} y1={yForBpm(bpm)} y2={yForBpm(bpm)} stroke="#e2e8f0" />)}
            {measures.map((measure, index) => {
              const startsLine = measure.startsSection || index === 0 || measures[index - 1].lineNumber !== measure.lineNumber;
              return <g key={`${index}-${measure.row}-${measure.measure}`}>
                <line x1={xForIndex(index)} x2={xForIndex(index)} y1={PADDING.top} y2={graphHeight - graphBottomPadding} stroke={startsLine ? '#94a3b8' : '#e2e8f0'} strokeWidth={startsLine ? 1.5 : 1} />
                {startsLine && <text x={xForIndex(index) - 20} y={graphHeight - (isFullScreen ? 65 : 25)} textAnchor="start" fontSize="10" fontWeight="700" fill="#475569">
                  {sectionNames[index] ? `${sectionNames[index]}${measure.loop ? ` (รอบ ${measure.loop})` : ''} · ` : ''}บรรทัด {measure.lineNumber}
                </text>}
                <text x={xForIndex(index)} y={graphHeight - (isFullScreen ? 50 : 9)} textAnchor="middle" fontSize="10" fontWeight="600" fill="#64748b">ห้อง {measure.number}</text>
                {isFullScreen && [measure.row, ...(rowTypes[measure.row] === 'double-right' ? [measure.row + 1] : [])].map((row, hand) => {
                  const notes = sheetData[row]?.[measure.measure] || [];
                  return <g key={row} aria-label={`ตัวโน้ตห้อง ${measure.number}${hand ? ' มือซ้าย' : ''}`}>
                    <rect x={xForIndex(index)} y={graphHeight - 40 + hand * 18} width={xForIndex(index + 1) - xForIndex(index)} height="18" fill="white" stroke="#cbd5e1" />
                    {notes.map((note, cell) => <text key={cell} x={xForIndex(index + (cell + 0.5) / Math.max(1, notes.length))} y={graphHeight - 27 + hand * 18} textAnchor="middle" fontSize={notes.length > 4 ? 8 : 11} fontWeight="600" fill="#334155">{typeof note === 'string' && !note.startsWith('@') ? note : ''}</text>)}
                  </g>;
                })}
              </g>;
            })}
            <path d={path} data-tempo-line="true" fill="none" stroke="transparent" strokeWidth="16" strokeLinejoin="round" className="cursor-ns-resize" />
            <path d={path} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" pointerEvents="none" />
            {isPlaying && <line ref={playheadRef} x1={PADDING.left} x2={PADDING.left} y1={PADDING.top} y2={graphHeight - graphBottomPadding} stroke="#10b981" strokeWidth="2" />}
            {graphPoints.map((point) => {
              const index = point.graphIndex;
              const selected = point.id === selectedId && index === selectedOccurrence;
              const pointX = xForIndex(index + point.position.cell / measures[index].cellCount);
              const pointY = yForBpm(point.bpm);
              const labelY = pointY < PADDING.top + 18 ? pointY + 20 : pointY - 10;
              return <g key={`${point.id}-${index}`}>
                <text x={pointX} y={labelY} textAnchor="middle" fontSize={selected ? 12 : 11} fontWeight="900" fill={selected ? '#2563eb' : '#334155'} stroke="white" strokeWidth="3" paintOrder="stroke" pointerEvents="none">{point.bpm}</text>
                <circle data-tempo-point="true" cx={pointX} cy={pointY} r={selected ? 6 : 4.5} fill="#fff" stroke={selected ? '#2563eb' : '#f97316'} strokeWidth={selected ? 3 : 2.5} className="cursor-grab active:cursor-grabbing" tabIndex="0" role="button" aria-label={`ห้อง ${index + 1}, ${point.bpm} BPM`} onFocus={() => { setSelectedOccurrence(index); setSelectedId(point.id); setBpmInput(String(point.bpm)); }} onPointerDown={(event) => handlePointPointerDown(event, point.id, index)} onContextMenu={(event) => openPointContextMenu(event, point, index)} onKeyDown={(event) => { if (isReadOnly) return; if (event.key === 'ArrowUp') { event.preventDefault(); moveSelected(0, 1); } else if (event.key === 'ArrowDown') { event.preventDefault(); moveSelected(0, -1); } else if (event.key === 'ArrowLeft') { event.preventDefault(); moveSelected(-1, 0); } else if (event.key === 'ArrowRight') { event.preventDefault(); moveSelected(1, 0); } else if (event.key === 'Delete') { event.preventDefault(); const next = visiblePoints.filter((entry) => entry.id !== point.id); setSelectedId(null); setDraftPoints(next); commit(next); } }} />
              </g>;
            })}
          </svg>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-11 border-r border-slate-200 bg-white/95 shadow-[4px_0_8px_rgba(15,23,42,0.05)]">
          {bpmTicks.map((bpm) => <span key={bpm} className="absolute right-1.5 -translate-y-1/2 text-[9px] font-bold text-slate-500" style={{ top: `${yForBpm(bpm)}px` }}>{bpm}</span>)}
          <span className="absolute bottom-1 left-1 text-[8px] font-black text-slate-400">BPM</span>
        </div>
      </div>

      {selectedPoint && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 shadow-sm">
          <div className="min-w-[150px]">
            <p className="text-[11px] font-black text-slate-800"><span className="mr-1 text-blue-600">จุดที่เลือก</span> ห้อง {selectedOccurrence + 1} <span className="font-semibold text-slate-500">• จังหวะ {Number(selectedPoint.position.cell) + 1}</span></p>
          </div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
            BPM
            <input type="number" min="20" max="300" value={bpmInput} disabled={isReadOnly} onChange={(event) => setBpmInput(event.target.value)} onBlur={() => { const bpm = clampTempoBpm(bpmInput, selectedPoint.bpm); setBpmInput(String(bpm)); updateSelected({ bpm }); }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm font-black outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400" aria-label="ค่า BPM ของจุดที่เลือก" />
          </label>
          <div className="ml-auto flex gap-1.5">
            <button type="button" disabled={isReadOnly} onClick={() => { const next = visiblePoints.filter((point) => point.id !== selectedPoint.id); setSelectedId(null); setDraftPoints(next); commit(next); }} className="h-8 rounded-lg border border-rose-200 bg-white px-3 text-[10px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-40">ลบจุด</button>
            <button type="button" onClick={() => setSelectedId(null)} className="h-8 rounded-lg border border-blue-200 bg-white px-3 text-[10px] font-bold text-blue-700 hover:bg-blue-50">เสร็จสิ้น</button>
          </div>
        </div>
      )}
    </section>
  );
  const pointMenu = contextMenu && createPortal(
    <div
      role="menu"
      aria-label="จัดการจุด BPM"
      onPointerDown={event => event.stopPropagation()}
      className="fixed z-[11000] w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-[0_14px_35px_rgba(15,23,42,0.22)]"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button type="button" role="menuitem" disabled={isReadOnly} onClick={resetContextPoint} className="block w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">รีเซ็ตจุด</button>
      <button type="button" role="menuitem" disabled={isReadOnly} onClick={deleteContextPoint} className="block w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">ลบจุด</button>
      <div className="mx-2 border-t border-slate-200" />
      <button type="button" role="menuitem" disabled={isReadOnly || !visiblePoints.length} onClick={clearTempoTrack} className="block w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">ล้างทั้งหมด</button>
    </div>,
    document.body
  );
  return <>{isFullScreen ? createPortal(panel, document.body) : panel}{pointMenu}</>;
};

export default TempoTrackPanel;
