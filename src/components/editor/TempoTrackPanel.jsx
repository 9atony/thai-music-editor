import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { MusicContext } from '../../contexts/MusicContext';
import {
  clampTempoBpm, getPlayableMeasures, getTempoAtPosition,
  measureToPosition, normalizeTempoTrack, positionToMeasureIndex
} from '../../utils/tempoTrack';

const MIN_GRAPH_WIDTH = 1000;
const MEASURE_WIDTH = 56;
const GRAPH_HEIGHT = 104;
const PADDING = { left: 72, right: 18, top: 8, bottom: 22 };

const TempoTrackPanel = () => {
  const {
    isTempoTrackOpen, setIsTempoTrackOpen, layoutConfig, sheetData, rowTypes,
    selectedCell, playbackCursor, isPlaying, currentPlaybackBpm, updateTempoTrack, isReadOnly
  } = useContext(MusicContext);
  const measures = useMemo(() => getPlayableMeasures(sheetData, rowTypes), [sheetData, rowTypes]);
  const normalizedPoints = useMemo(() => normalizeTempoTrack(
    layoutConfig.tempoTrack || [], sheetData, rowTypes, layoutConfig.bpm
  ), [layoutConfig.tempoTrack, layoutConfig.bpm, sheetData, rowTypes]);
  const [draftPoints, setDraftPoints] = useState(normalizedPoints);
  const [selectedId, setSelectedId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [bpmInput, setBpmInput] = useState('80');
  const [containerWidth, setContainerWidth] = useState(MIN_GRAPH_WIDTH);
  const tapTimesRef = useRef([]);
  const dragPointsRef = useRef(normalizedPoints);
  const graphContainerRef = useRef(null);
  const visiblePoints = draggingId ? draftPoints : normalizedPoints;

  useEffect(() => {
    const element = graphContainerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.max(320, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const currentCell = playbackCursor || selectedCell || [measures[0]?.row || 0, measures[0]?.measure || 0, 0];
  const currentPosition = { row: currentCell[0], measure: currentCell[1], cell: currentCell[2] };
  const currentMeasureIndex = positionToMeasureIndex(currentPosition, measures);
  const displayedBpm = isPlaying
    ? currentPlaybackBpm
    : Math.round(getTempoAtPosition(currentPosition, visiblePoints, layoutConfig.bpm, sheetData, rowTypes));
  const selectedPoint = visiblePoints.find((point) => point.id === selectedId);
  const graphWidth = Math.max(
    MIN_GRAPH_WIDTH,
    containerWidth,
    PADDING.left + PADDING.right + (Math.max(1, measures.length - 1) * MEASURE_WIDTH)
  );

  if (!isTempoTrackOpen) return null;

  const plotWidth = graphWidth - PADDING.left - PADDING.right;
  const plotHeight = GRAPH_HEIGHT - PADDING.top - PADDING.bottom;
  const xForIndex = (index) => PADDING.left + ((measures.length <= 1 ? 0 : index / (measures.length - 1)) * plotWidth);
  const yForBpm = (bpm) => PADDING.top + (((300 - clampTempoBpm(bpm)) / 280) * plotHeight);
  const indexForX = (x) => Math.min(measures.length - 1, Math.max(0, Math.round(((x - PADDING.left) / plotWidth) * Math.max(1, measures.length - 1))));
  const bpmForY = (y) => clampTempoBpm(300 - (((y - PADDING.top) / plotHeight) * 280));

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
    const point = next.find((entry) => positionToMeasureIndex(entry.position, measures) === measureIndex && entry.position.cell === cell);
    setDraftPoints(next);
    setSelectedId(point?.id || null);
    setBpmInput(String(point?.bpm || bpm));
    commit(next);
  };

  const pointerPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * graphWidth,
      y: ((event.clientY - rect.top) / rect.height) * GRAPH_HEIGHT
    };
  };

  const handleGraphPointerDown = (event) => {
    if (isReadOnly || event.target.dataset.tempoPoint === 'true') return;
    const { x, y } = pointerPosition(event);
    addPoint(indexForX(x), bpmForY(y), 0);
  };

  const handlePointPointerDown = (event, id) => {
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
    const y = ((event.clientY - rect.top) / rect.height) * GRAPH_HEIGHT;
    setDraftPoints((current) => {
      const next = upsertAt(indexForX(x), bpmForY(y), point.transition, point.id, current);
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
    const nextIndex = Math.min(measures.length - 1, Math.max(0, positionToMeasureIndex(selectedPoint.position, measures) + measureDelta));
    const next = upsertAt(nextIndex, selectedPoint.bpm + bpmDelta, selectedPoint.transition, selectedPoint.id);
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

  const sortedForPath = [...visiblePoints].sort((a, b) => positionToMeasureIndex(a.position, measures) - positionToMeasureIndex(b.position, measures));
  let path = `M ${xForIndex(0)} ${yForBpm(layoutConfig.bpm)}`;
  let lastBpm = layoutConfig.bpm;
  sortedForPath.forEach((point) => {
    const x = xForIndex(positionToMeasureIndex(point.position, measures));
    if (point.transition === 'linear') path += ` L ${x} ${yForBpm(point.bpm)}`;
    else path += ` L ${x} ${yForBpm(lastBpm)} L ${x} ${yForBpm(point.bpm)}`;
    lastBpm = point.bpm;
  });
  path += ` L ${xForIndex(Math.max(0, measures.length - 1))} ${yForBpm(lastBpm)}`;

  return (
    <section className="relative z-[130] shrink-0 border-b border-orange-200 bg-white px-3 py-1.5 shadow-inner" aria-label="ปรับความเร็วแต่ละช่วง">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <div className="mr-auto flex items-center gap-2 text-sm font-black text-slate-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">⌁</span>
          ปรับความเร็วแต่ละช่วง
        </div>
        <div className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500">ปัจจุบัน <strong className="text-slate-800">{Math.round(displayedBpm)} BPM</strong></div>
        <button type="button" onClick={handleTap} disabled={isReadOnly} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 disabled:opacity-40">แตะจังหวะ</button>
        <button type="button" onClick={() => addPoint()} disabled={isReadOnly || !measures.length} className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 disabled:opacity-40">＋ เพิ่มจุด</button>
        <button type="button" onClick={() => { setSelectedId(null); commit([]); }} disabled={isReadOnly || !visiblePoints.length} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 disabled:opacity-40">↶ รีเซ็ต</button>
        <button type="button" onClick={() => setIsTempoTrackOpen(false)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">⌃ ย่อ</button>
      </div>

      <div className="relative rounded-xl border border-orange-100 bg-slate-50/60">
        <div ref={graphContainerRef} className="overflow-x-auto rounded-xl">
          <svg width={graphWidth} height={GRAPH_HEIGHT} viewBox={`0 0 ${graphWidth} ${GRAPH_HEIGHT}`} className="block touch-none" onPointerDown={handleGraphPointerDown} role="application" aria-label="กราฟกำหนด BPM ตามห้องเพลง">
            {[20, 80, 140, 220, 300].map((bpm) => <line key={bpm} x1={PADDING.left} x2={graphWidth - PADDING.right} y1={yForBpm(bpm)} y2={yForBpm(bpm)} stroke="#e2e8f0" />)}
            {measures.map((measure, index) => <g key={`${measure.row}-${measure.measure}`}><line x1={xForIndex(index)} x2={xForIndex(index)} y1={PADDING.top} y2={GRAPH_HEIGHT - PADDING.bottom} stroke={index % 4 === 0 ? '#cbd5e1' : '#e2e8f0'} /><text x={xForIndex(index)} y={GRAPH_HEIGHT - 9} textAnchor="middle" fontSize="9" fill="#64748b">ห้อง {measure.number}</text></g>)}
            <path d={path} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" />
            {isPlaying && <line x1={xForIndex(currentMeasureIndex)} x2={xForIndex(currentMeasureIndex)} y1={PADDING.top} y2={GRAPH_HEIGHT - PADDING.bottom} stroke="#10b981" strokeWidth="2" />}
            {visiblePoints.map((point) => {
              const index = positionToMeasureIndex(point.position, measures);
              const selected = point.id === selectedId;
              return <circle key={point.id} data-tempo-point="true" cx={xForIndex(index)} cy={yForBpm(point.bpm)} r={selected ? 6 : 4.5} fill="#fff" stroke={selected ? '#2563eb' : '#f97316'} strokeWidth={selected ? 3 : 2.5} tabIndex="0" role="button" aria-label={`ห้อง ${index + 1}, ${point.bpm} BPM`} onFocus={() => { setSelectedId(point.id); setBpmInput(String(point.bpm)); }} onPointerDown={(event) => handlePointPointerDown(event, point.id)} onPointerMove={(event) => handlePointPointerMove(event, point)} onPointerUp={finishDrag} onPointerCancel={finishDrag} onKeyDown={(event) => { if (isReadOnly) return; if (event.key === 'ArrowUp') { event.preventDefault(); moveSelected(0, 1); } else if (event.key === 'ArrowDown') { event.preventDefault(); moveSelected(0, -1); } else if (event.key === 'ArrowLeft') { event.preventDefault(); moveSelected(-1, 0); } else if (event.key === 'ArrowRight') { event.preventDefault(); moveSelected(1, 0); } else if (event.key === 'Delete') { event.preventDefault(); const next = visiblePoints.filter((entry) => entry.id !== point.id); setSelectedId(null); setDraftPoints(next); commit(next); } }} />;
            })}
          </svg>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-11 border-r border-slate-200 bg-white/95 shadow-[4px_0_8px_rgba(15,23,42,0.05)]">
          {[20, 80, 140, 220, 300].map((bpm) => <span key={bpm} className="absolute right-1.5 -translate-y-1/2 text-[9px] font-bold text-slate-500" style={{ top: `${yForBpm(bpm)}px` }}>{bpm}</span>)}
          <span className="absolute bottom-1 left-1 text-[8px] font-black text-slate-400">BPM</span>
        </div>
      </div>

      {selectedPoint && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 shadow-sm">
          <div className="min-w-[150px]">
            <p className="text-[11px] font-black text-slate-800"><span className="mr-1 text-blue-600">จุดที่เลือก</span> ห้อง {positionToMeasureIndex(selectedPoint.position, measures) + 1} <span className="font-semibold text-slate-500">• จังหวะ {Number(selectedPoint.position.cell) + 1}</span></p>
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
};

export default TempoTrackPanel;
