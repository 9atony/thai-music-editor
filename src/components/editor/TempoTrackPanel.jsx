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
const PADDING = { left: 72, right: 30, top: 12, bottom: 82 };

const TempoTrackPanel = () => {
  const {
    isTempoTrackOpen, setIsTempoTrackOpen, layoutConfig, sheetData, rowTypes, sectionLabels,
    selectedCell, playbackCursor, isPlaying, currentPlaybackBpm, updateTempoTrack, isReadOnly, playbackSequence, activeSequenceIdx, activeLoop, playFromTempoMeasure, togglePlay, playbackProgressRef
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
  ), [layoutConfig.tempoTrack, layoutConfig.bpm, sheetData, rowTypes]);
  const [draftPoints, setDraftPoints] = useState(normalizedPoints);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState(0);
  const [draggingId, setDraggingId] = useState(null);
  const [bpmInput, setBpmInput] = useState('80');
  const [containerWidth, setContainerWidth] = useState(MIN_GRAPH_WIDTH);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const graphHeight = isFullScreen ? Math.max(GRAPH_HEIGHT, viewportHeight - 210) : GRAPH_HEIGHT;
  const tapTimesRef = useRef([]);
  const dragPointsRef = useRef(normalizedPoints);
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

  const currentCell = playbackCursor || selectedCell || [measures[0]?.row || 0, measures[0]?.measure || 0, 0];
  const currentPosition = { row: currentCell[0], measure: currentCell[1], cell: currentCell[2] };
  const currentMeasureIndex = Math.max(0, measures.findIndex(measure => measure.row === currentPosition.row && measure.measure === currentPosition.measure && (!isPlaying || measure.sequenceIndex === undefined || (measure.sequenceIndex === activeSequenceIdx && measure.loop === activeLoop))));
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
  const plotHeight = graphHeight - PADDING.top - PADDING.bottom;
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

  const commit = (points) => updateTempoTrack(normalizeTempoTrack(points, sheetData, rowTypes, layoutConfig.bpm));
  const upsertAt = (measureIndex, bpm, transition = 'step', preferredId = null, source = visiblePoints, cell = 0) => {
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

  const addPoint = (measureIndex = currentMeasureIndex, bpm = displayedBpm, cell = currentPosition.cell) => {
    const next = upsertAt(measureIndex, bpm, 'step', null, visiblePoints, cell);
    const point = next.find((entry) => entry.position.row === measures[measureIndex]?.row && entry.position.measure === measures[measureIndex]?.measure && entry.position.cell === cell);
    setDraftPoints(next);
    setSelectedId(point?.id || null);
    setSelectedOccurrence(measureIndex);
    setBpmInput(String(point?.bpm || bpm));
    commit(next);
  };

  const pointerPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * graphWidth,
      y: ((event.clientY - rect.top) / rect.height) * graphHeight
    };
  };

  const handleGraphPointerDown = (event) => {
    if (isReadOnly || event.target.dataset.tempoPoint === 'true') return;
    const { x, y } = pointerPosition(event);
    if (y < PADDING.top || y > graphHeight - PADDING.bottom || x < PADDING.left || x > graphWidth - PADDING.right) return;
    addPoint(indexForX(x), bpmForY(y), 0);
  };

  const handlePointPointerDown = (event, id, index) => {
    setSelectedOccurrence(index);
    if (isReadOnly) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(id);
    const point = visiblePoints.find((entry) => entry.id === id);
    setBpmInput(String(point?.bpm || layoutConfig.bpm));
    setDraftPoints(visiblePoints);
    dragPointsRef.current = visiblePoints;
    setDraggingId(id);
  };

  const handlePointPointerMove = (event, point) => {
    if (draggingId !== point.id) return;
    const svg = event.currentTarget.ownerSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * graphWidth;
    const y = ((event.clientY - rect.top) / rect.height) * graphHeight;
    setSelectedOccurrence(indexForX(x));
    setDraftPoints((current) => {
      const next = upsertAt(indexForX(x), bpmForY(y), point.transition, point.id, current, point.position.cell);
      dragPointsRef.current = next;
      return next;
    });
  };

  const finishDrag = () => {
    if (!draggingId) return;
    setDraggingId(null);
    commit(dragPointsRef.current);
  };

  const updateSelected = (updates) => {
    if (isReadOnly || !selectedPoint) return;
    const next = normalizeTempoTrack(visiblePoints.map((point) => point.id === selectedPoint.id ? { ...point, ...updates } : point), sheetData, rowTypes, layoutConfig.bpm);
    setDraftPoints(next);
    commit(next);
  };

  const moveSelected = (measureDelta, bpmDelta) => {
    if (isReadOnly || !selectedPoint) return;
    const nextIndex = Math.min(measures.length - 1, Math.max(0, selectedOccurrence + measureDelta));
    setSelectedOccurrence(nextIndex);
    const next = upsertAt(nextIndex, selectedPoint.bpm + bpmDelta, selectedPoint.transition, selectedPoint.id, visiblePoints, selectedPoint.position.cell);
    setDraftPoints(next);
    commit(next);
  };

  const handleTap = (event) => {
    const now = event.timeStamp;
    tapTimesRef.current = [...tapTimesRef.current.filter((time) => now - time < 3000), now].slice(-5);
    if (tapTimesRef.current.length < 2) return;
    const intervals = tapTimesRef.current.slice(1).map((time, index) => time - tapTimesRef.current[index]);
    const bpm = clampTempoBpm(60000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length));
    addPoint(currentMeasureIndex, bpm);
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
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <div className="mr-auto flex items-center gap-2 text-sm font-black text-slate-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">⌁</span>
          ปรับความเร็วแต่ละช่วง
        </div>
        <div className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500">ปัจจุบัน <strong className="text-slate-800">{Math.round(displayedBpm)} BPM</strong></div>
        <button type="button" onClick={togglePlay} title="Spacebar เล่น/หยุด" className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{isPlaying ? 'หยุด' : 'เล่น'} (Space)</button>
        <button type="button" onClick={handleTap} disabled={isReadOnly} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 disabled:opacity-40">แตะจังหวะ</button>
        <button type="button" onClick={() => addPoint()} disabled={isReadOnly || !measures.length} className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 disabled:opacity-40">＋ เพิ่มจุด</button>
        <button type="button" onClick={() => { setSelectedId(null); commit([]); }} disabled={isReadOnly || !visiblePoints.length} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 disabled:opacity-40">↶ รีเซ็ต</button>
        <button type="button" onClick={() => setIsFullScreen(value => !value)} aria-pressed={isFullScreen} className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">{isFullScreen ? 'ออกจากเต็มหน้า' : 'เต็มหน้า'}</button>
        <button type="button" onClick={() => { setIsFullScreen(false); setIsTempoTrackOpen(false); }} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">⌃ ย่อ</button>
      </div>

      {playbackSequence?.length > 0 && <p className="mb-1 text-[10px] text-slate-500">
        เรียงตามลำดับการเล่น · {measures.length} ห้องรวมท่อนซ้ำ · ปรับความเร็วห้องเดิมมีผลทุกรอบที่เล่นซ้ำ
      </p>}
      <div className="relative rounded-xl border border-orange-100 bg-slate-50/60">
        <div ref={graphContainerRef} className="overflow-x-auto rounded-xl">
          <svg width={graphWidth} height={graphHeight} viewBox={`0 0 ${graphWidth} ${graphHeight}`} className="block touch-none" onPointerDown={handleGraphPointerDown} role="application" aria-label="กราฟกำหนด BPM ตามห้องเพลง">
            {bpmTicks.map((bpm) => <line key={bpm} x1={PADDING.left} x2={graphWidth - PADDING.right} y1={yForBpm(bpm)} y2={yForBpm(bpm)} stroke="#e2e8f0" />)}
            {measures.map((measure, index) => {
              const startsLine = measure.startsSection || index === 0 || measures[index - 1].lineNumber !== measure.lineNumber;
              return <g key={`${index}-${measure.row}-${measure.measure}`}>
                <line x1={xForIndex(index)} x2={xForIndex(index)} y1={PADDING.top} y2={graphHeight - PADDING.bottom} stroke={startsLine ? '#94a3b8' : '#e2e8f0'} strokeWidth={startsLine ? 1.5 : 1} />
                {startsLine && <text x={xForIndex(index) - 20} y={graphHeight - 65} textAnchor="start" fontSize="10" fontWeight="700" fill="#475569">
                  {sectionNames[index] ? `${sectionNames[index]}${measure.loop ? ` (รอบ ${measure.loop})` : ''} · ` : ''}บรรทัด {measure.lineNumber}
                </text>}
                <text x={xForIndex(index)} y={graphHeight - 50} textAnchor="middle" fontSize="10" fill="#64748b">ห้อง {measure.number}</text>
                {[measure.row, ...(rowTypes[measure.row] === 'double-right' ? [measure.row + 1] : [])].map((row, hand) => {
                  const notes = sheetData[row]?.[measure.measure] || [];
                  return <g key={row} role="button" tabIndex={0} aria-label={`เล่นจากห้อง ${measure.number}${measure.loop ? ` รอบ ${measure.loop}` : ''}`} className="cursor-pointer outline-none focus:stroke-blue-500" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); playFromTempoMeasure(index); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); playFromTempoMeasure(index); } }}>
                    <title>คลิกเพื่อเล่นจากห้องนี้ · Spacebar เล่น/หยุด</title>
                    <rect x={xForIndex(index)} y={graphHeight - 40 + hand * 18} width={xForIndex(index + 1) - xForIndex(index)} height="18" fill="white" stroke="#cbd5e1" />
                    {notes.map((note, cell) => <text key={cell} x={xForIndex(index + (cell + 0.5) / notes.length)} y={graphHeight - 27 + hand * 18} textAnchor="middle" fontSize={notes.length > 4 ? 8 : 11} fill="#334155">{typeof note === 'string' && !note.startsWith('@') ? note : ''}</text>)}
                  </g>;
                })}
              </g>;
            })}
            <path d={path} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" />
            {isPlaying && <line ref={playheadRef} x1={PADDING.left} x2={PADDING.left} y1={PADDING.top} y2={graphHeight - PADDING.bottom} stroke="#10b981" strokeWidth="2" />}
            {graphPoints.map((point) => {
              const index = point.graphIndex;
              const selected = point.id === selectedId && index === selectedOccurrence;
              return <circle key={`${point.id}-${index}`} data-tempo-point="true" cx={xForIndex(index + point.position.cell / measures[index].cellCount)} cy={yForBpm(point.bpm)} r={selected ? 6 : 4.5} fill="#fff" stroke={selected ? '#2563eb' : '#f97316'} strokeWidth={selected ? 3 : 2.5} tabIndex="0" role="button" aria-label={`ห้อง ${index + 1}, ${point.bpm} BPM`} onFocus={() => { setSelectedOccurrence(index); setSelectedId(point.id); setBpmInput(String(point.bpm)); }} onPointerDown={(event) => handlePointPointerDown(event, point.id, index)} onPointerMove={(event) => handlePointPointerMove(event, point)} onPointerUp={finishDrag} onPointerCancel={finishDrag} onKeyDown={(event) => { if (isReadOnly) return; if (event.key === 'ArrowUp') { event.preventDefault(); moveSelected(0, 1); } else if (event.key === 'ArrowDown') { event.preventDefault(); moveSelected(0, -1); } else if (event.key === 'ArrowLeft') { event.preventDefault(); moveSelected(-1, 0); } else if (event.key === 'ArrowRight') { event.preventDefault(); moveSelected(1, 0); } else if (event.key === 'Delete') { event.preventDefault(); const next = visiblePoints.filter((entry) => entry.id !== point.id); setSelectedId(null); setDraftPoints(next); commit(next); } }} />;
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
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button type="button" disabled={isReadOnly} onClick={() => updateSelected({ transition: 'step' })} className={`rounded-md px-3 py-1.5 text-[10px] font-bold disabled:opacity-40 ${selectedPoint.transition === 'step' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>เปลี่ยนทันที</button>
            <button type="button" disabled={isReadOnly} onClick={() => updateSelected({ transition: 'linear' })} className={`rounded-md px-3 py-1.5 text-[10px] font-bold disabled:opacity-40 ${selectedPoint.transition === 'linear' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>ค่อย ๆ เปลี่ยน</button>
          </div>
          <div className="ml-auto flex gap-1.5">
            <button type="button" disabled={isReadOnly} onClick={() => { const next = visiblePoints.filter((point) => point.id !== selectedPoint.id); setSelectedId(null); setDraftPoints(next); commit(next); }} className="h-8 rounded-lg border border-rose-200 bg-white px-3 text-[10px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-40">ลบจุด</button>
            <button type="button" onClick={() => setSelectedId(null)} className="h-8 rounded-lg border border-blue-200 bg-white px-3 text-[10px] font-bold text-blue-700 hover:bg-blue-50">เสร็จสิ้น</button>
          </div>
        </div>
      )}
    </section>
  );
  return isFullScreen ? createPortal(panel, document.body) : panel;
};

export default TempoTrackPanel;
