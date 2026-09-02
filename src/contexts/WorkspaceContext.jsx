import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { INSTRUMENT_CONFIG } from '../utils/instrumentConfig';
import { getIntervalPair } from '../utils/sheetUtils';
import { auth, createArrangerProject, getArrangerProject, saveArrangerProject } from '../utils/firebase';
import {
  initAudioContext,
  playNote,
  preloadNote,
  scheduleNote,
  getAudioCurrentTime,
  getTrackGainNode,
  setTrackGain,
  setTrackPan as setAudioTrackPan,
  setMasterGain,
  getClipGainNode,
  connectClipGain,
  setClipGain,
  stopAllScheduledNotes,
  claimPlaybackOwnership,
  releasePlaybackOwnership,
} from '../utils/audioEngine';

const WorkspaceContext = createContext(null);

const TRACK_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
const DEFAULT_MEASURE_WIDTH = 90;
const MIN_ZOOM = 10;
const MAX_ZOOM = 240;
const THAI_NOTE_COMBINER_PATTERN = /[\u0E31-\u0E4E\u200B]/;
const getMonotonicTime = () => performance.now();
// The Editor defines one measure as four beat units.  Keep this conversion in
// one place so imported clips and the Editor always advance at the same rate.
const EDITOR_BEATS_PER_MEASURE = 4;
const getEditorMeasureDurationSec = (tempo) => (
  (15000 / Math.max(20, Number(tempo) || 80)) * EDITOR_BEATS_PER_MEASURE
) / 1000;
const WORKSPACE_SESSION_KEY = 'thaiMusicEditorArrangerWorkspace';
export const ARRANGER_PROJECT_SESSION_KEY = 'thaiMusicEditorActiveArrangerProject';

const readSavedWorkspace = () => {
  try {
    const raw = sessionStorage.getItem(WORKSPACE_SESSION_KEY);
    if (!raw) return null;
    const workspace = JSON.parse(raw);
    return Array.isArray(workspace?.tracks) ? workspace : null;
  } catch (error) {
    console.warn('ไม่สามารถกู้คืนข้อมูล Arranger ล่าสุดได้:', error);
    return null;
  }
};

const saveWorkspaceSnapshot = (workspace) => {
  try {
    sessionStorage.setItem(WORKSPACE_SESSION_KEY, JSON.stringify(workspace));
  } catch (error) {
    console.warn('ไม่สามารถบันทึกข้อมูล Arranger ล่าสุดในเบราว์เซอร์ได้:', error);
  }
};

// ⭐ Single source of truth สำหรับความสูงของแทร็ก (ใช้ร่วมกันทั้ง Toolbar slider + Timeline lane + TrackPanel drag)
export const MIN_TRACK_LANE_HEIGHT = 54;        // ⭐ ครึ่งหนึ่งของค่าเดิม (108/132 -> 54/66) ตามที่ผู้ใช้ต้องการเล็กที่สุด
export const MAX_TRACK_LANE_HEIGHT = 800;
export const DEFAULT_TRACK_LANE_HEIGHT = 100;    // ค่าเริ่มต้น = ครึ่งของ 132 (เล็กที่สุด)
export const COLLAPSED_TRACK_HEIGHT = 44;
export const MIN_VIEWPORT_FOR_NOTES = 80;       // ถ้าความสูง clip น้อยกว่านี้ ซ่อนตัวโน้ตไปเลย

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const makeId = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const stripHtml = (value = '') => String(value || '')
  .replace(/<br\s*\/?/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const safeDisplayName = (value, fallback = '') => {
  const cleaned = stripHtml(value);
  return cleaned || fallback;
};
const normalizeInstrumentId = (rawInstrumentId, fallback = 'ranat-ek') => {
  const candidate = typeof rawInstrumentId === 'object' && rawInstrumentId !== null
    ? rawInstrumentId.id || rawInstrumentId.value || rawInstrumentId.name || ''
    : rawInstrumentId;

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (INSTRUMENT_CONFIG[trimmed]) return trimmed;

    const normalized = trimmed.toLowerCase();
    const matchedByName = Object.values(INSTRUMENT_CONFIG).find((instrument) => (
      instrument.id.toLowerCase() === normalized
      || instrument.name.toLowerCase() === normalized
    ));
    if (matchedByName) return matchedByName.id;
  }

  return INSTRUMENT_CONFIG[fallback] ? fallback : 'ranat-ek';
};
const getInstrumentNameById = (instrumentId) => INSTRUMENT_CONFIG[normalizeInstrumentId(instrumentId)]?.name || safeDisplayName(instrumentId, 'ไม่ระบุเครื่องดนตรี');

const createEmptyTrack = (id, color) => ({
  id,
  name: `Track ${id}`,
  type: 'ยังไม่มีคลิป',
  color,
  instrumentId: 'ranat-ek',
  volume: 100,
  pan: 0,
  isMuted: false,
  isSolo: false,
  isCollapsed: false,
  isLocked: false, // ⭐ เพิ่มสถานะล็อคตั้งต้น
  octavePairEnabled: false,
  sourceProjectName: '',
  clips: [],
});

const normalizeCellToken = (value) => {
  if (typeof value !== 'string') return value && value !== '-' ? String(value) : '-';
  const compact = value.replace(/\s+/g, '').trim();
  return compact === '' ? '-' : compact;
};

const splitThaiNoteToken = (token) => {
  const normalized = normalizeCellToken(token);
  if (!normalized || normalized === '-') return [];

  return Array.from(normalized).reduce((parts, char) => {
    if (char === '-' || char.trim() === '') return parts;
    if (THAI_NOTE_COMBINER_PATTERN.test(char) && parts.length > 0) {
      parts[parts.length - 1] += char;
    } else {
      parts.push(char);
    }
    return parts;
  }, []);
};

const createNotationMeasures = (measureCount = 2, cellsPerMeasure = 4) => (
  Array.from({ length: Math.max(1, Math.ceil(measureCount)) }, (_, index) => ({
    index,
    top: Array(cellsPerMeasure).fill('-'),
    bottom: null,
  }))
);

// A manually written clip keeps its notation as the source of truth.  The
// events are regenerated from that notation so what the user sees and hears
// always use the exact same beat grid.
const buildEventsFromNotation = (notationMeasures, instrumentId) => {
  const events = [];
  (notationMeasures || []).forEach((measure, arrayIndex) => {
    const measureIndex = Number.isFinite(Number(measure?.index)) ? Number(measure.index) : arrayIndex;
    [measure?.top, measure?.bottom].forEach((cells, rowIndex) => {
      if (!Array.isArray(cells)) return;
      const cellCount = Math.max(1, cells.length);
      cells.forEach((token, cellIndex) => {
        splitThaiNoteToken(token).forEach((note, noteIndex, notes) => {
          events.push({
            id: makeId('evt'),
            note,
            instrumentId,
            rowIndex,
            measureOffset: measureIndex + (cellIndex / cellCount) + (noteIndex / notes.length / cellCount),
          });
        });
      });
    });
  });
  return events;
};

const buildNotationFromEvents = (clip) => {
  const measureCount = Math.max(1, Math.ceil(Number(clip?.playback?.measureCount) || Number(clip?.width) || 1));
  const events = clip?.playback?.events || [];
  const hasBottom = events.some((event) => event.rowIndex === 1);
  const allowedCounts = [4, 8, 12, 16];
  const measures = Array.from({ length: measureCount }, (_, index) => {
    const offsets = events.filter((event) => Math.floor(Number(event.measureOffset)) === index)
      .map((event) => (Number(event.measureOffset) || 0) - index);
    const cellCount = allowedCounts.find((count) => offsets.every((offset) => Math.abs((offset * count) - Math.round(offset * count)) < 0.0001)) || 4;
    return { index, top: Array(cellCount).fill('-'), bottom: hasBottom ? Array(cellCount).fill('-') : null };
  });
  events.forEach((event) => {
    const offset = Math.max(0, Number(event.measureOffset) || 0);
    const measure = measures[Math.floor(offset)];
    if (!measure || !event.note || event.note === '-') return;
    const row = event.rowIndex === 1 && measure.bottom ? measure.bottom : measure.top;
    const cellIndex = Math.min(row.length - 1, Math.floor((offset - Math.floor(offset)) * row.length + 0.0001));
    row[cellIndex] = row[cellIndex] === '-' ? event.note : `${row[cellIndex]}${event.note}`;
  });
  return measures;
};

const getNotationCellOffset = (measures, selection) => {
  const measurePosition = (measures || []).findIndex((measure, index) => Number(measure.index ?? index) === selection.measureIndex);
  const measure = measures?.[measurePosition];
  const cells = measure?.[selection.rowIndex === 1 ? 'bottom' : 'top'];
  if (!measure || !Array.isArray(cells) || selection.cellIndex < 0 || selection.cellIndex >= cells.length) return null;
  const measureIndex = Number(measure.index ?? measurePosition);
  return measureIndex + (selection.cellIndex / cells.length);
};

const getVisualIndex = (rowIndex, rowTypesArray = []) => {
  let visualIndex = 0;
  for (let i = 0; i < rowIndex; i += 1) {
    if (rowTypesArray[i] === 'single' || rowTypesArray[i] === 'double-right') visualIndex += 1;
  }
  if (rowTypesArray[rowIndex] === 'double-left') return Math.max(0, visualIndex - 1);
  return visualIndex;
};

const shouldSkipSectionRow = (rowType) => (
  rowType === 'page-break' ||
  rowType === 'text' ||
  rowType === 'annotation' ||
  rowType === 'nathap'
);

const shouldSkipPlaybackRow = (rowType) => shouldSkipSectionRow(rowType) || rowType === 'double-left';

const getCustomInstrumentId = (layoutConfig, r, m, c, fallbackInstrumentId) => {
  const instrumentId = layoutConfig?.customStyles?.[`${r}_${m}_${c}`]?.instrumentId;
  return INSTRUMENT_CONFIG[instrumentId] ? instrumentId : fallbackInstrumentId;
};

const countMeasuresInSection = (sheetData = [], rowTypes = [], startRow = 0, endRow = 0) => {
  let measures = 0;
  for (let r = startRow; r <= endRow; r += 1) {
    const rowType = rowTypes[r];
    if (shouldSkipPlaybackRow(rowType)) continue;
    const row = sheetData[r] || [];
    const startMeasure = rowType?.startsWith('double') ? 1 : 0;
    measures += Math.max(0, row.length - startMeasure);
  }
  return Math.max(1, measures);
};

const collectPreviewNotes = (sheetData = [], rowTypes = [], startRow = 0, endRow = 0, limit = 14) => {
  const notes = [];
  for (let r = startRow; r <= endRow && notes.length < limit; r += 1) {
    const rowType = rowTypes[r];
    if (shouldSkipPlaybackRow(rowType)) continue;
    const row = sheetData[r] || [];
    const startMeasure = rowType?.startsWith('double') ? 1 : 0;
    for (let m = startMeasure; m < row.length && notes.length < limit; m += 1) {
      const measure = row[m] || [];
      for (let c = 0; c < measure.length && notes.length < limit; c += 1) {
        splitThaiNoteToken(measure[c]).forEach((note) => {
          if (note && notes.length < limit) notes.push(note);
        });
      }
    }
  }
  return notes;
};

const buildSectionMap = (parsedData) => {
  const sheetData = parsedData?.sheetData || [];
  const rowTypes = parsedData?.rowTypes || [];
  const sectionLabels = parsedData?.sectionLabels || {};

  const sections = [];
  let lastValidRow = 0;
  let lastProcessedVisualIndex = -1;

  for (let r = 0; r < sheetData.length; r += 1) {
    const rowType = rowTypes[r];
    if (shouldSkipSectionRow(rowType)) continue;

    const visualIndex = getVisualIndex(r, rowTypes);
    const labels = (sectionLabels[visualIndex] || []).filter((item) => item?.text?.trim());

    if (labels.length > 0 && visualIndex !== lastProcessedVisualIndex) {
      if (sections.length > 0) sections[sections.length - 1].endRow = lastValidRow;
      sections.push({
        id: makeId('section'),
        label: safeDisplayName(labels[0].text, 'ไม่มีชื่อท่อน'),
        startRow: r,
        endRow: sheetData.length - 1,
      });
      lastProcessedVisualIndex = visualIndex;
    }

    lastValidRow = r;
    if (rowType === 'double-right') lastValidRow = Math.min(sheetData.length - 1, r + 1);
  }

  if (sections.length > 0) sections[sections.length - 1].endRow = lastValidRow;

  return sections.map((section) => ({
    ...section,
    measureCount: countMeasuresInSection(sheetData, rowTypes, section.startRow, section.endRow),
    previewNotes: collectPreviewNotes(sheetData, rowTypes, section.startRow, section.endRow),
  }));
};

const buildPlaybackEvents = (parsedData, section, fallbackInstrumentId, loops = 1) => {
  if (!section) return [];

  const sheetData = parsedData?.sheetData || [];
  const rowTypes = parsedData?.rowTypes || [];
  const layoutConfig = parsedData?.layoutConfig || {};
  const bpm = Number(parsedData?.layoutConfig?.bpm) || 80;
  const secPerWholeMeasure = getEditorMeasureDurationSec(bpm);
  const events = [];
  const notationMeasures = [];
  const notationSymbols = [];
  const sourceSymbols = Array.isArray(parsedData?.symbols) ? parsedData.symbols : [];

  const oneLoopMeasureCount = countMeasuresInSection(sheetData, rowTypes, section.startRow, section.endRow);

  const pushTokenEvents = (token, ctx) => {
    const parts = splitThaiNoteToken(token);
    if (!parts.length) return;
    parts.forEach((note, index) => {
      events.push({
        id: makeId('evt'),
        measureOffset: ctx.measureOffset + (index / Math.max(parts.length, 1)) / ctx.cellCount,
        note,
        instrumentId: ctx.instrumentId,
        volume: ctx.volume,
        rowIndex: ctx.rowIndex, 
      });
    });
  };

  for (let loopIndex = 0; loopIndex < loops; loopIndex += 1) {
    let measureCursor = 0;
    const cellPositions = new Map();

    for (let r = section.startRow; r <= section.endRow; r += 1) {
      const rowType = rowTypes[r];
      if (shouldSkipPlaybackRow(rowType)) continue;

      const row = sheetData[r] || [];
      const startMeasure = rowType?.startsWith('double') ? 1 : 0;

      for (let m = startMeasure; m < row.length; m += 1) {
        const cells = Array.isArray(row[m]) ? row[m] : [];
        const bottomCells = rowType === 'double-right' && Array.isArray(sheetData[r + 1]?.[m])
          ? sheetData[r + 1][m]
          : [];
        const cellCount = Math.max(1, cells.length, bottomCells.length);
        const measureBase = loopIndex * oneLoopMeasureCount + measureCursor;

        notationMeasures.push({
          index: measureBase,
          top: Array.from({ length: cellCount }, (_, cellIndex) => normalizeCellToken(cells[cellIndex])),
          bottom: rowType === 'double-right'
            ? Array.from({ length: cellCount }, (_, cellIndex) => normalizeCellToken(bottomCells[cellIndex]))
            : null,
        });

        for (let c = 0; c < cellCount; c += 1) {
          const baseMeasureOffset = measureBase + (c / cellCount);
          const cellCenterOffset = measureBase + ((c + 0.5) / cellCount);
          cellPositions.set(`${r}_${m}_${c}`, { offset: cellCenterOffset, rowIndex: 0 });
          if (rowType === 'double-right') {
            cellPositions.set(`${r + 1}_${m}_${c}`, { offset: cellCenterOffset, rowIndex: 1 });
          }
          const topInstrumentId = getCustomInstrumentId(layoutConfig, r, m, c, fallbackInstrumentId);
          const topVolume = Number(layoutConfig?.customStyles?.[`${r}_${m}_${c}`]?.velocity) || 100;

          if (rowType === 'double-right') {
            const bottomToken = bottomCells[c] ?? '-';
            const bottomInstrumentId = getCustomInstrumentId(layoutConfig, r + 1, m, c, fallbackInstrumentId);
            const bottomVolume = Number(layoutConfig?.customStyles?.[`${r + 1}_${m}_${c}`]?.velocity) || 100;

            pushTokenEvents(cells[c], {
              measureOffset: baseMeasureOffset,
              cellCount,
              instrumentId: topInstrumentId,
              volume: topVolume,
              rowIndex: 0, 
            });
            pushTokenEvents(bottomToken, {
              measureOffset: baseMeasureOffset,
              cellCount,
              instrumentId: bottomInstrumentId,
              volume: bottomVolume,
              rowIndex: 1, 
            });
          } else {
            pushTokenEvents(cells[c], {
              measureOffset: baseMeasureOffset,
              cellCount,
              instrumentId: topInstrumentId,
              volume: topVolume,
              rowIndex: 0, 
            });
          }
        }
        measureCursor += 1;
      }
    }

    sourceSymbols.forEach((symbol, symbolIndex) => {
      const start = Array.isArray(symbol?.start) ? cellPositions.get(symbol.start.join('_')) : null;
      const end = Array.isArray(symbol?.end) ? cellPositions.get(symbol.end.join('_')) : null;
      if (!start || !end || !['sabat', 'kro'].includes(symbol.type)) return;

      const isKro = symbol.type === 'kro';
      notationSymbols.push({
        id: `${symbol.id || `symbol_${symbolIndex}`}_${loopIndex}`,
        type: symbol.type,
        startOffset: start.offset,
        endOffset: end.offset,
        startRowIndex: start.rowIndex,
        endRowIndex: end.rowIndex,
        color: symbol.color || (isKro ? (layoutConfig.kroColor || '#38bdf8') : (layoutConfig.sabatColor || '#fbbf24')),
        strokeWidth: Number(symbol.strokewidth ?? symbol.strokeWidth) || (isKro ? Number(layoutConfig.kroStrokeWidth) || 2 : Number(layoutConfig.sabatStrokeWidth) || 2),
      });
    });
  }

  return {
    measureCount: Math.max(1, oneLoopMeasureCount * loops),
    durationSec: Math.max(0.01, oneLoopMeasureCount * loops * secPerWholeMeasure),
    events,
    notationMeasures,
    notationSymbols,
  };
};

const parseTmeFile = (fileContent, fileName = 'เพลงที่นำเข้า.tme') => {
  const parsedData = JSON.parse(fileContent);
  const sections = buildSectionMap(parsedData);
  const playbackSequence = Array.isArray(parsedData?.playbackSequence) ? parsedData.playbackSequence : [];
  const fallbackInstrumentId = normalizeInstrumentId(
    parsedData?.currentInstrument
      || parsedData?.instrumentId
      || parsedData?.instrument
      || parsedData?.layoutConfig?.currentInstrument,
    'ranat-ek',
  );

  const cleanFileName = safeDisplayName(fileName, 'เพลงที่นำเข้า.tme');
  const projectName = safeDisplayName(
    parsedData?.name || parsedData?.songName || parsedData?.projectName,
    cleanFileName.replace(/\.[^/.]+$/, ''),
  ) || 'เพลงที่นำเข้า';
  const sourceBpm = Number(parsedData?.layoutConfig?.bpm || parsedData?.bpm) || 80;
  const instrumentLabel = getInstrumentNameById(fallbackInstrumentId);

  const clips = [];
  let cursor = 0;

  const appendClipFromSection = (section, sequenceLabel = section.label, loops = 1) => {
    // Store the source section once, then let the Arranger repeat that same
    // section.  Previously the events were expanded here and repeated again
    // during Arranger playback, causing imported rhythms to drift from Editor.
    const repeatCount = Math.max(1, Number(loops) || 1);
    const playback = buildPlaybackEvents(parsedData, section, fallbackInstrumentId, 1);
    const displayLabel = safeDisplayName(sequenceLabel, section.label || projectName);
    const clip = {
      id: makeId('clip'),
      start: cursor,
      width: playback.measureCount * repeatCount,
      name: repeatCount > 1 ? `${displayLabel} ×${repeatCount}` : displayLabel,
      sectionLabel: displayLabel,
      loops: repeatCount,
      notesPreview: section.previewNotes || [],
      sourceInstrumentId: fallbackInstrumentId,
      sourceBpm,
      instrumentLabel,
      playback,
      sourceMeta: {
        projectName,
        sourceFileName: cleanFileName,
        currentInstrument: fallbackInstrumentId,
        currentInstrumentName: instrumentLabel,
      },
    };
    clips.push(clip);
    cursor += playback.measureCount * repeatCount;
  };

  if (playbackSequence.length > 0) {
    playbackSequence.forEach((item) => {
      const label = safeDisplayName(item?.label);
      if (!label) return;
      const section = sections.find((entry) => safeDisplayName(entry.label) === label);
      if (!section) return;
      appendClipFromSection(section, label, Math.max(1, Number(item?.loops) || 1));
    });
  } else if (sections.length > 0) {
    sections.forEach((section) => appendClipFromSection(section, safeDisplayName(section.label, projectName), 1));
  } else {
    const fullSection = {
      id: makeId('section'),
      label: projectName,
      startRow: 0,
      endRow: Math.max(0, (parsedData?.sheetData?.length || 1) - 1),
      measureCount: countMeasuresInSection(parsedData?.sheetData || [], parsedData?.rowTypes || [], 0, Math.max(0, (parsedData?.sheetData?.length || 1) - 1)),
      previewNotes: collectPreviewNotes(parsedData?.sheetData || [], parsedData?.rowTypes || [], 0, Math.max(0, (parsedData?.sheetData?.length || 1) - 1)),
    };
    appendClipFromSection(fullSection, projectName, 1);
  }

  return {
    projectName,
    sourceBpm,
    instrumentId: fallbackInstrumentId,
    instrumentLabel,
    clips,
  };
};

const serializeWorkspace = (state) => ({
  name: state.projectName,
  bpm: state.bpm,
  snapGrid: state.snapGrid,
  zoomLevel: state.zoomLevel,
  trackLaneHeight: state.trackLaneHeight,
  masterVolume: state.masterVolume,
  tracks: state.tracks,
  hasSeenWelcome: state.hasSeenWelcome,
});

export const WorkspaceProvider = ({ children }) => {
  const [savedWorkspace] = useState(() => readSavedWorkspace());
  const [projectName, setProjectName] = useState(savedWorkspace?.name || 'Arranger Workspace');
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(savedWorkspace?.bpm || 120);
  const [activeTool, setActiveTool] = useState('select');
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [snapGrid, setSnapGrid] = useState(savedWorkspace?.snapGrid ?? 1);
  const [zoomLevel, setZoomLevel] = useState(savedWorkspace?.zoomLevel || 100);
  const [trackLaneHeight, setTrackLaneHeight] = useState(savedWorkspace?.trackLaneHeight || DEFAULT_TRACK_LANE_HEIGHT);
  const [masterVolume, setMasterVolumeState] = useState(savedWorkspace?.masterVolume ?? 100);
  const [tracks, setTracks] = useState(savedWorkspace?.tracks || []);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() => (
    savedWorkspace?.hasSeenWelcome ?? (Array.isArray(savedWorkspace?.tracks) && savedWorkspace.tracks.length > 0)
  ));
  const [selectedNotationCell, setSelectedNotationCell] = useState(null);
  const [notationSymbolTool, setNotationSymbolTool] = useState(null);
  const [isOctavePairEnabled, setIsOctavePairEnabled] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [isProjectReady, setIsProjectReady] = useState(false);

  const playbackRef = useRef({ rafId: null, startedAt: 0, durationSec: 0 });
  const schedulerIntervalRef = useRef(null);
  const playbackRequestRef = useRef(0);
  const clipboardRef = useRef(null);
  const [hasClipboard, setHasClipboard] = useState(false);
  const workspaceSnapshotRef = useRef(null);
  const historyRef = useRef({ undo: [], redo: [], committed: null, pending: null, timer: null, restoring: false, skipNext: false });
  const historySnapshotRef = useRef(null);
  const [historyRevision, setHistoryRevision] = useState(0);

  workspaceSnapshotRef.current = serializeWorkspace({
    projectName,
    bpm,
    snapGrid,
    zoomLevel,
    trackLaneHeight,
    masterVolume,
    tracks,
    hasSeenWelcome,
  });

  const historySnapshot = useMemo(() => ({
    projectName,
    bpm,
    snapGrid,
    zoomLevel,
    trackLaneHeight,
    masterVolume,
    tracks,
  }), [projectName, bpm, snapGrid, zoomLevel, trackLaneHeight, masterVolume, tracks]);
  historySnapshotRef.current = historySnapshot;

  const applyHistorySnapshot = useCallback((snapshot) => {
    setProjectName(snapshot.projectName);
    setBpm(snapshot.bpm);
    setSnapGrid(snapshot.snapGrid);
    setZoomLevel(snapshot.zoomLevel);
    setTrackLaneHeight(snapshot.trackLaneHeight);
    setMasterVolume(snapshot.masterVolume);
    setTracks(snapshot.tracks);
  }, []);

  const commitPendingHistory = useCallback(() => {
    const history = historyRef.current;
    if (history.timer) {
      window.clearTimeout(history.timer);
      history.timer = null;
    }
    if (!history.pending) return;
    history.undo.push(history.pending);
    if (history.undo.length > 80) history.undo.shift();
    history.redo = [];
    history.committed = historySnapshotRef.current;
    history.pending = null;
    setHistoryRevision((revision) => revision + 1);
  }, []);

  const undo = useCallback(() => {
    commitPendingHistory();
    const history = historyRef.current;
    const previous = history.undo.pop();
    if (!previous) return;
    if (history.committed) history.redo.push(history.committed);
    history.restoring = true;
    history.committed = previous;
    applyHistorySnapshot(previous);
    setHistoryRevision((revision) => revision + 1);
  }, [applyHistorySnapshot, commitPendingHistory]);

  const redo = useCallback(() => {
    commitPendingHistory();
    const history = historyRef.current;
    const next = history.redo.pop();
    if (!next) return;
    if (history.committed) history.undo.push(history.committed);
    history.restoring = true;
    history.committed = next;
    applyHistorySnapshot(next);
    setHistoryRevision((revision) => revision + 1);
  }, [applyHistorySnapshot, commitPendingHistory]);

  useEffect(() => {
    const history = historyRef.current;
    const sameSnapshot = (left, right) => JSON.stringify(left) === JSON.stringify(right);
    if (history.skipNext || !history.committed) {
      if (history.timer) window.clearTimeout(history.timer);
      history.undo = [];
      history.redo = [];
      history.pending = null;
      history.committed = historySnapshot;
      history.restoring = false;
      history.skipNext = false;
      setHistoryRevision((revision) => revision + 1);
      return undefined;
    }
    if (history.restoring) {
      history.committed = historySnapshot;
      history.pending = null;
      history.restoring = false;
      return undefined;
    }
    if (sameSnapshot(history.committed, historySnapshot)) {
      if (history.pending) {
        if (history.timer) window.clearTimeout(history.timer);
        history.pending = null;
        history.timer = null;
        setHistoryRevision((revision) => revision + 1);
      }
      return undefined;
    }
    if (!history.pending) {
      history.pending = history.committed;
      setHistoryRevision((revision) => revision + 1);
    }
    if (history.timer) window.clearTimeout(history.timer);
    history.timer = window.setTimeout(commitPendingHistory, 300);
    return undefined;
  }, [commitPendingHistory, historySnapshot]);

  useEffect(() => () => {
    if (historyRef.current.timer) window.clearTimeout(historyRef.current.timer);
  }, []);

  useEffect(() => {
    const saveTimer = window.setTimeout(() => {
      saveWorkspaceSnapshot(workspaceSnapshotRef.current);
    }, 300);
    return () => window.clearTimeout(saveTimer);
  }, [projectName, bpm, snapGrid, zoomLevel, trackLaneHeight, masterVolume, tracks, hasSeenWelcome]);

  // Older projects do not have the onboarding flag. Once a project has ever
  // contained a track, treat its welcome screen as completed permanently.
  useEffect(() => {
    if (tracks.length > 0 && !hasSeenWelcome) setHasSeenWelcome(true);
  }, [hasSeenWelcome, tracks.length]);

  useEffect(() => {
    const saveBeforePageReset = () => saveWorkspaceSnapshot(workspaceSnapshotRef.current);
    window.addEventListener('pagehide', saveBeforePageReset);
    return () => {
      window.removeEventListener('pagehide', saveBeforePageReset);
      saveBeforePageReset();
    };
  }, []);

  useEffect(() => {
    const projectId = sessionStorage.getItem(ARRANGER_PROJECT_SESSION_KEY);
    // A workspace can also be opened directly (or restored after a browser
    // session). It has no remote id yet, but is ready for the first auto-save
    // to create one once authentication is available.
    if (!projectId) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user?.uid) setIsProjectReady(true);
      });
      return () => unsubscribe();
    }

    let active = true;
    let didStartLoad = false;
    const loadProject = (uid) => {
      if (!uid || didStartLoad) return;
      didStartLoad = true;
      setSaveStatus('loading');
      getArrangerProject(uid, projectId)
        .then((project) => {
          if (!active || !project) return;
          historyRef.current.skipNext = true;
          setCurrentProjectId(project.id);
          setProjectName(project.name || 'โปรเจกต์จัดวงใหม่');
          setBpm(project.bpm || 120);
          setSnapGrid(project.snapGrid ?? 1);
          setZoomLevel(project.zoomLevel || 100);
          setTrackLaneHeight(project.trackLaneHeight || DEFAULT_TRACK_LANE_HEIGHT);
          setMasterVolume(project.masterVolume ?? 100);
          setTracks(Array.isArray(project.tracks) ? project.tracks : []);
          setHasSeenWelcome(project.hasSeenWelcome ?? (Array.isArray(project.tracks) && project.tracks.length > 0));
          setSaveStatus('saved');
          setIsProjectReady(true);
        })
        .catch((error) => {
          console.error('โหลดโปรเจกต์จัดวงไม่สำเร็จ:', error);
          if (active) setSaveStatus('error');
        });
    };

    loadProject(auth.currentUser?.uid);
    const unsubscribe = onAuthStateChanged(auth, (user) => loadProject(user?.uid));

    return () => { active = false; unsubscribe?.(); };
  }, []);
  

  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const startPlaybackRef = useRef(null);
  const stopPlaybackRef = useRef(null);
  const spacePlayRequestTimeRef = useRef(0);
  const hiddenPlaybackPositionRef = useRef(null);
  const visibilityResumeInFlightRef = useRef(false);

  const setCurrentTimeWrapper = (t) => {
    currentTimeRef.current = t;
    setCurrentTime(t);
  };

  const getPlaybackPosition = useCallback(() => {
    if (playbackRef.current.rafId && playbackRef.current.startAudioTime != null) {
      const start = playbackRef.current.startTime || 0;
      const pos = start + ((getAudioCurrentTime?.() || 0) - playbackRef.current.startAudioTime);
      return Math.max(start, Math.min(pos, start + (playbackRef.current.durationSec || 0)));
    }
    return currentTimeRef.current;
  }, []);

  const measureWidth = useMemo(
    () => Math.round(DEFAULT_MEASURE_WIDTH * (zoomLevel / 100)),
    [zoomLevel],
  );

  const totalMeasures = useMemo(() => {
    const maxClipEnd = tracks.reduce((max, track) => {
      const trackEnd = track.clips.reduce((clipMax, clip) => Math.max(clipMax, (clip.start || 0) + (clip.width || 0)), 0);
      return Math.max(max, trackEnd);
    }, 0);
    return Math.max(16, Math.ceil(maxClipEnd + 4));
  }, [tracks]);

  // ⭐ เปลี่ยนระบบ: การกด Stop (หยุดด้วยมือ) เสียงต้องตัดขาดทันที อันนี้ทำงานถูกต้องแล้ว
  const stopPlayback = useCallback(() => {
    playbackRequestRef.current += 1;
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (playbackRef.current.rafId) cancelAnimationFrame(playbackRef.current.rafId);
    playbackRef.current.rafId = null;
    if (schedulerIntervalRef.current) {
      clearInterval(schedulerIntervalRef.current);
      schedulerIntervalRef.current = null;
    }
    stopAllScheduledNotes?.(); 
    releasePlaybackOwnership(stopPlaybackRef.current);
  }, []);

  const returnToPlaybackStart = () => {
    setCurrentTimeWrapper(Math.max(0, Number(playbackRef.current.startTime) || 0));
  };

  useEffect(() => () => {
    stopPlayback();
  }, [stopPlayback]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const animatePlayback = () => {
    const elapsedSec = (getMonotonicTime() - playbackRef.current.startedAt) / 1000;
    const start = playbackRef.current.startTime || 0;
    const duration = playbackRef.current.durationSec || 0;

    // ⭐ 1. แก้บั๊กเสียงขาดตอนจบ: เล่นเผื่อหางเสียงอีก 2.5 วินาที แล้วค่อยหยุดการอัปเดตหน้าจอ 
    // โดยไม่ไปเรียกคำสั่ง stopAll() ทำให้เสียงกังวานต่อจนจบได้อย่างเป็นธรรมชาติ
    if (elapsedSec >= duration + 2.5) {
      setIsPlaying(false);
      if (playbackRef.current.rafId) cancelAnimationFrame(playbackRef.current.rafId);
      if (schedulerIntervalRef.current) clearInterval(schedulerIntervalRef.current);
      playbackRef.current.rafId = null;
      schedulerIntervalRef.current = null;
      isPlayingRef.current = false;
      releasePlaybackOwnership(stopPlayback);
      return;
    }

    const now = getMonotonicTime();
    if (now - (playbackRef.current.lastUiUpdate || 0) > 80) {
      playbackRef.current.lastUiUpdate = now;
      // ล็อกเส้น Playhead ให้ไปหยุดสุดพอดีที่ขอบท้ายโปรเจกต์ (แม้ว่าจะรอหางเสียงอยู่ก็ตาม)
      setCurrentTimeWrapper(Math.min(start + elapsedSec, start + duration));
    }
    playbackRef.current.rafId = requestAnimationFrame(animatePlayback);
  };

  const startPlayback = async () => {
    stopPlayback();
    const requestId = playbackRequestRef.current;
    // ⭐ ยึดสิทธิ์เป็นเจ้าของเสียงตัวเดียว: ถ้าตัวเล่นตัวโน้ต (Music Editor) ยังค้างเล่นอยู่
    //    จะถูกสั่งหยุดทันที ไม่ให้เสียงซ้อนจากโปรเจกต์อื่นเบื้องหลัง
    claimPlaybackOwnership(stopPlayback);

    try {
      await initAudioContext();
    } catch (error) {
      if (playbackRequestRef.current === requestId) {
        releasePlaybackOwnership(stopPlayback);
        console.error('ไม่สามารถเริ่มระบบเสียงของ Arranger ได้:', error);
      }
      return;
    }
    if (playbackRequestRef.current !== requestId) return;

    const secPerMeasure = getEditorMeasureDurationSec(bpm);
    const startTime = Math.max(0, currentTimeRef.current || 0);
    const events = [];
    let totalDuration = 0;

    // Create the graph and immediately apply the current mixer state. The
    // React effect can run before these nodes exist (or a previous mute/solo
    // state can leave an old node at zero), which otherwise makes a new Play
    // session silent even though events are being scheduled.
    const hasSoloTrack = tracks.some((track) => track.isSolo);
    setMasterGain(clamp(Number(masterVolume) || 0, 0, 150) / 100);
    tracks.forEach((track) => {
      const trackGain = getTrackGainNode(track.id);
      const trackMuted = track.isMuted || (hasSoloTrack && !track.isSolo);
      setTrackGain(track.id, trackMuted ? 0 : clamp(track.volume != null ? Number(track.volume) : 100, 0, 200) / 100);
      setAudioTrackPan(track.id, clamp(Number(track.pan) || 0, -100, 100) / 100);
      track.clips.forEach((clip) => {
        getClipGainNode(clip.id);
        connectClipGain(clip.id, trackGain);
        const clipVol = clip.volume == null ? 100 : clamp(Number(clip.volume) || 0, 0, 100);
        setClipGain(clip.id, clipVol / 100);
      });
    });
    // โยนการอัปเดต Volume ไปให้ useEffect จัดการ

    tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        const clipStartSec = (clip.start || 0) * secPerMeasure;
        const trimOffset = Number(clip.trimOffset) || 0;
        const clipGain = getClipGainNode(clip.id);
        const loops = Math.max(1, Number(clip.loops) || 1);
        const clipMeasureWidth = Math.max(0, Number(clip.width) || 0);
        const clipWidthSec = clipMeasureWidth * secPerMeasure;
        const loopMeasureWidth = clipMeasureWidth / loops;
        const loopWidthSec = loopMeasureWidth * secPerMeasure;
        
        for (let lp = 0; lp < loops; lp += 1) {
          const loopStartSec = clipStartSec + (lp * loopWidthSec);
          (clip.playback?.events || []).forEach((event) => {
            const offset = (event.measureOffset || 0) - trimOffset;
            if (offset < 0 || offset >= loopMeasureWidth) return;
            const instrumentId = INSTRUMENT_CONFIG[event.instrumentId] ? event.instrumentId : (track.instrumentId || clip.sourceInstrumentId || 'ranat-ek');
            events.push({
              whenSec: loopStartSec + (offset * secPerMeasure),
              instrumentId,
              note: event.note,
              volume: clamp(Number(event.volume) || 100, 0, 200), 
              destination: clipGain,
              trackId: track.id, 
              octavePairEnabled: instrumentId === 'ranat-ek' && Boolean(track.octavePairEnabled),
            });
          });
        }
        totalDuration = Math.max(totalDuration, clipStartSec + clipWidthSec);
      });
    });

    events.sort((a, b) => a.whenSec - b.whenSec);

    const playEvents = events.filter((ev) => ev.whenSec >= startTime);
    const durationSec = Math.max(0, totalDuration - startTime);

    // Decode the complete opening phrase before its clock starts. Loading only
    // the first chord let notes from the next scheduler window arrive late and
    // get normalized to "now", which made the first playback sound bunched up.
    const STARTUP_PRELOAD_WINDOW_SEC = 2;
    const startupNotes = new Map();
    playEvents.forEach((event) => {
      if (
        event.whenSec - startTime > STARTUP_PRELOAD_WINDOW_SEC
        || !event.note
        || event.note === '-'
      ) return;
      if (event.octavePairEnabled) {
        const { left, right } = getIntervalPair(INSTRUMENT_CONFIG[event.instrumentId], event.note, '8');
        [left, right].filter(Boolean).forEach((note) => startupNotes.set(`${event.instrumentId}:${note}`, { ...event, note }));
      } else {
        startupNotes.set(`${event.instrumentId}:${event.note}`, event);
      }
    });
    if (startupNotes.size > 0) {
      await Promise.allSettled(
        [...startupNotes.values()].map((event) => preloadNote(event.instrumentId, event.note)),
      );
      if (playbackRequestRef.current !== requestId) return;
    }

    setTotalTime(totalDuration);
    setCurrentTimeWrapper(startTime);

    playbackRef.current.startedAt = getMonotonicTime();
    playbackRef.current.startTime = startTime;
    playbackRef.current.durationSec = Math.max(durationSec, 0.01);
    playbackRef.current.events = playEvents;
    playbackRef.current.nextEventIdx = 0;
    playbackRef.current.startAudioTime = getAudioCurrentTime?.() || 0;
    playbackRef.current.lastUiUpdate = 0;

    isPlayingRef.current = true;
    setIsPlaying(true);

    const scheduleAhead = () => {
      try {
        if (playbackRequestRef.current !== requestId) return;
        const audioNow = getAudioCurrentTime?.() || 0;
        const elapsedSec = (getMonotonicTime() - playbackRef.current.startedAt) / 1000;
        const horizon = audioNow + 1.5;
        const evs = playbackRef.current.events || [];

        while (playbackRef.current.nextEventIdx < evs.length) {
          const ev = evs[playbackRef.current.nextEventIdx];
          const whenSec = audioNow + Math.max(0, ev.whenSec - startTime - elapsedSec);
          if (whenSec > horizon) break;

          // ⭐ 2. แก้ปัญหาดีเลย์ Mute/Solo: โหลดตัวโน้ตลงไปจ่อใน AudioEngine เสมอ ห้ามบล็อก!
          // แล้วให้ตัว Gain Node ที่รับหน้าที่คุมเสียง (ใน useEffect) หรี่/เปิดเสียงแทน จะทำงานได้เร็วระดับมิลลิวินาที
          if (ev.note && ev.note !== '-') {
            if (ev.octavePairEnabled) {
              const { left, right } = getIntervalPair(INSTRUMENT_CONFIG[ev.instrumentId], ev.note, '8');
              scheduleNote(ev.instrumentId, left, whenSec, ev.volume, ev.destination);
              if (right !== left) scheduleNote(ev.instrumentId, right, whenSec, ev.volume, ev.destination);
            } else {
              scheduleNote(ev.instrumentId, ev.note, whenSec, ev.volume, ev.destination);
            }
          }
          playbackRef.current.nextEventIdx += 1;
        }
      } catch (err) {
        console.error('เกิดข้อผิดพลาดในการจัดตารางเสียง:', err);
      }
    };

    // Schedule the first look-ahead window now instead of waiting for the
    // interval's first 100ms tick, which was visible as a pause on Play.
    scheduleAhead();
    schedulerIntervalRef.current = setInterval(scheduleAhead, 100);

    playbackRef.current.rafId = requestAnimationFrame(animatePlayback);
  };

  useEffect(() => {
    startPlaybackRef.current = startPlayback;
    stopPlaybackRef.current = stopPlayback;
  });

  useEffect(() => {
    const resumeArrangerAfterTabSwitch = async () => {
      if (document.hidden) {
        if (isPlayingRef.current) hiddenPlaybackPositionRef.current = getPlaybackPosition();
        return;
      }
      if (!isPlayingRef.current || visibilityResumeInFlightRef.current) return;

      visibilityResumeInFlightRef.current = true;
      // Background tabs can suspend AudioContext and throttle the 100ms
      // scheduler. Resume and rebuild the schedule from the last audible
      // position instead of leaving the transport running silently.
      const resumeAt = Math.max(0, Number(hiddenPlaybackPositionRef.current ?? getPlaybackPosition()) || 0);
      hiddenPlaybackPositionRef.current = null;
      try {
        await initAudioContext();
        if (!isPlayingRef.current) return;
        setCurrentTimeWrapper(resumeAt);
        startPlaybackRef.current?.();
      } catch (error) {
        console.warn('ไม่สามารถกู้เสียง Arranger หลังสลับแท็บได้:', error);
      } finally {
        visibilityResumeInFlightRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', resumeArrangerAfterTabSwitch);
    window.addEventListener('focus', resumeArrangerAfterTabSwitch);
    return () => {
      document.removeEventListener('visibilitychange', resumeArrangerAfterTabSwitch);
      window.removeEventListener('focus', resumeArrangerAfterTabSwitch);
    };
  }, [getPlaybackPosition]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'Space' || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const isTextInput = target instanceof HTMLInputElement && !['range', 'button', 'submit', 'reset'].includes(target.type);
        const isEditing = target.isContentEditable || target.closest('textarea, select, [contenteditable="true"]');
        if (isTextInput || isEditing) return;
      }

      event.preventDefault();
      event.stopPropagation();
      const now = getMonotonicTime();
      const isDoubleSpace = now - spacePlayRequestTimeRef.current < 260;
      if (isPlayingRef.current || isDoubleSpace) {
        // Space is play/pause. A fast second press immediately after resuming
        // is the DAW-style "return to the marker" gesture.
        stopPlaybackRef.current?.();
        if (isDoubleSpace) returnToPlaybackStart();
        spacePlayRequestTimeRef.current = 0;
      } else {
        spacePlayRequestTimeRef.current = now;
        startPlaybackRef.current?.();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // ⭐ 3. ระบบซิงค์ระดับเสียง (Gain) กับ AudioEngine ทันทีที่ State มีการเปลี่ยนแปลง
  // ลดอาการหน่วง เพราะให้ React จับตาดู tracks แล้วอัปเดตตรงไปที่ระบบเสียงทันที
  useEffect(() => {
    const hasSolo = tracks.some((t) => t.isSolo);
    tracks.forEach((track) => {
      const muted = track.isMuted || (hasSolo && !track.isSolo);
      const trackVolume = clamp(track.volume != null ? Number(track.volume) : 100, 0, 200) / 100;
      setTrackGain(track.id, muted ? 0 : trackVolume);
      setAudioTrackPan(track.id, clamp(Number(track.pan) || 0, -100, 100) / 100);
    });
  }, [tracks]); 

  useEffect(() => {
    setMasterGain(clamp(Number(masterVolume) || 0, 0, 150) / 100);
  }, [masterVolume]);

  const toggleMute = (trackId) => {
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, isMuted: !track.isMuted } : track));
  };

  const toggleSolo = (trackId) => {
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, isSolo: !track.isSolo } : track));
  };

  const setTrackVolume = (trackId, volume) => {
    const v = clamp(Number(volume) || 0, 0, 200);
    setTracks((prev) => prev.map((track) => (track.id === trackId ? { ...track, volume: v } : track)));
  };

  const setTrackPan = (trackId, pan) => {
    const value = clamp(Number(pan) || 0, -100, 100);
    setTracks((prev) => prev.map((track) => (track.id === trackId ? { ...track, pan: value } : track)));
  };

  const setMasterVolume = (volume) => {
    setMasterVolumeState(clamp(Number(volume) || 0, 0, 150));
  };

  // ⭐ ทั้งค่า global และ custom ต้อง clamp ด้วย min/max ตัวเดียวกันเสมอ — เลิกใช้ magic number ลอยๆ
  const setTrackLaneHeightClamped = (height) => {
    const clamped = Math.min(MAX_TRACK_LANE_HEIGHT, Math.max(MIN_TRACK_LANE_HEIGHT, Number(height) || DEFAULT_TRACK_LANE_HEIGHT));
    setTrackLaneHeight(clamped);
  };
  const setTrackCustomHeight = (trackId, height) => {
    const clamped = Math.min(MAX_TRACK_LANE_HEIGHT, Math.max(MIN_TRACK_LANE_HEIGHT, Number(height) || DEFAULT_TRACK_LANE_HEIGHT));
    setTracks((prev) => prev.map((track) => (track.id === trackId ? { ...track, customHeight: clamped } : track)));
  };

  const setClipVolume = (clipId, volume) => {
    const v = clamp(Number(volume) || 0, 0, 200);
    setTracks((prev) => prev.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, volume: v } : clip)),
    })));
    setClipGain(clipId, v / 100);
  };

  const setClipLoops = (clipId, loops) => {
    const l = Math.max(1, Math.floor(Number(loops) || 1));
    setTracks((prev) => prev.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, loops: l } : clip)),
    })));
  };

  const toggleTrackCollapse = (trackId) => {
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, isCollapsed: !track.isCollapsed } : track));
  };

  // ⭐ เพิ่มคำสั่งล็อค/ปลดล็อค แทร็ก
  const toggleTrackLock = (trackId) => {
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, isLocked: !track.isLocked } : track));
  };

  const duplicateTrack = (trackId) => {
    setTracks((prev) => {
      const source = prev.find((t) => t.id === trackId);
      if (!source) return prev;
      const nextId = prev.length > 0 ? Math.max(...prev.map((t) => t.id)) + 1 : 1;
      const copy = {
        ...source,
        id: nextId,
        name: `${source.name} (สำเนา)`,
        isMuted: false,
        isSolo: false,
        color: TRACK_COLORS[(nextId - 1) % TRACK_COLORS.length],
        clips: (source.clips || []).map((clip) => ({
          ...clip,
          id: makeId('clip'),
          playback: clip.playback ? { ...clip.playback, events: (clip.playback.events || []).map((ev) => ({ ...ev, id: makeId('evt') })) } : clip.playback,
        })),
      };
      return [...prev, copy];
    });
  };

  const removeTrack = (trackId) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const reorderTracks = (startIndex, endIndex) => {
    setTracks((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1); 
      result.splice(endIndex, 0, removed); 
      return result;
    });
  };

  const reorderTrackClips = (trackId, startIndex, endIndex) => {
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      
      const sortedClips = [...track.clips].sort((a, b) => (a.start || 0) - (b.start || 0));
      
      // ⭐ 1. จำตำแหน่งเวลา (start) เดิมของทุกคลิปบนไทม์ไลน์ไว้ก่อน เพื่อรักษาช่องว่าง
      const originalStarts = sortedClips.map(c => c.start);
      
      // ⭐ 2. ดึงตัวที่ถูกลากย้ายออก แล้วนำไปแทรกในลำดับใหม่
      const [removed] = sortedClips.splice(startIndex, 1);
      sortedClips.splice(endIndex, 0, removed);

      // ⭐ 3. แจกจ่ายตำแหน่งเวลาเดิม กลับคืนให้คลิปที่สลับที่กันแล้ว (สลับแค่ข้อมูล แต่คงช่องว่างเดิมเป๊ะๆ)
      const newClips = sortedClips.map((clip, index) => ({
        ...clip,
        start: originalStarts[index]
      }));

      return { ...track, clips: newClips };
    }));
  };
  const addTrack = () => {
    setTracks((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((track) => track.id)) + 1 : 1;
      return [...prev, createEmptyTrack(nextId, TRACK_COLORS[(nextId - 1) % TRACK_COLORS.length])];
    });
  };

  const addEnsemblePreset = () => {
    const presetInstrumentIds = ['ranat-ek', 'khong-wong-yai', 'klong-khaek', 'ching'];
    setTracks((prev) => {
      const hasOnlyEmptyTracks = prev.every((track) => track.clips.length === 0 && !track.sourceProjectName);
      const baseTracks = hasOnlyEmptyTracks ? [] : prev;
      let nextId = baseTracks.length > 0 ? Math.max(...baseTracks.map((track) => track.id)) + 1 : 1;

      const presetTracks = presetInstrumentIds.map((instrumentId, index) => {
        const track = createEmptyTrack(nextId, TRACK_COLORS[(nextId - 1) % TRACK_COLORS.length]);
        nextId += 1;
        return {
          ...track,
          name: getInstrumentNameById(instrumentId),
          type: getInstrumentNameById(instrumentId),
          instrumentId,
          isCollapsed: index > 1,
        };
      });

      return [...baseTracks, ...presetTracks];
    });
  };

  const importProjectFromWeb = (projectData, fileName = 'โปรเจกต์จากเว็บ.json') => {
    try {
      const serialized = typeof projectData === 'string' ? projectData : JSON.stringify(projectData);
      const cleanFileName = safeDisplayName(fileName, safeDisplayName(projectData?.name, 'โปรเจกต์จากเว็บ.json'));
      const parsed = parseTmeFile(serialized, cleanFileName);
      const isWorkspaceEmpty = tracksRef.current.every((track) => track.clips.length === 0);

      if (projectName === 'Arranger Workspace') {
        setProjectName(parsed.projectName);
      }

      if (isWorkspaceEmpty) {
        setBpm(parsed.sourceBpm || 120);
      }

      setTracks((prev) => {
        const nextId = prev.length > 0 ? Math.max(...prev.map((track) => track.id)) + 1 : 1;
        const importedClips = parsed.clips.map((clip, index) => ({
          ...clip,
          id: `${clip.id}_${index}_${Math.random().toString(36).slice(2, 7)}`,
          sourceMeta: {
            ...clip.sourceMeta,
            sourceFileName: cleanFileName,
            projectName: safeDisplayName(clip.sourceMeta?.projectName, parsed.projectName),
            currentInstrument: normalizeInstrumentId(clip.sourceMeta?.currentInstrument || parsed.instrumentId, parsed.instrumentId),
            currentInstrumentName: safeDisplayName(clip.sourceMeta?.currentInstrumentName, parsed.instrumentLabel),
          },
          instrumentLabel: safeDisplayName(clip.instrumentLabel, parsed.instrumentLabel),
          name: safeDisplayName(clip.name, parsed.projectName),
          sectionLabel: safeDisplayName(clip.sectionLabel, clip.name || parsed.projectName),
        }));

        return [
          ...prev,
          {
            ...createEmptyTrack(nextId, TRACK_COLORS[(nextId - 1) % TRACK_COLORS.length]),
            name: parsed.projectName,
            type: `${safeDisplayName(parsed.instrumentLabel, getInstrumentNameById(parsed.instrumentId))} • ${cleanFileName}`,
            instrumentId: parsed.instrumentId,
            sourceProjectName: parsed.projectName,
            clips: importedClips,
          },
        ];
      });
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการนำเข้าโปรเจกต์จากเว็บ:', error);
      alert('ไม่สามารถนำเข้าโปรเจกต์จากเว็บได้ครับ');
    }
  };

  const renameTrack = (trackId, newName) => {
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, name: newName } : track));
  };

  const setTrackInstrument = (trackId, instrumentId) => {
    if (!INSTRUMENT_CONFIG[instrumentId]) return;
    setTracks((prev) => prev.map((track) => track.id === trackId ? { ...track, instrumentId, type: INSTRUMENT_CONFIG[instrumentId].name } : track));
  };

  const setTrackOctavePair = (trackId, enabled) => {
    setTracks((prev) => prev.map((track) => (
      track.id === trackId ? { ...track, octavePairEnabled: Boolean(enabled) } : track
    )));
  };

  const deleteClip = (trackId, clipIndex) => {
    const targetClipId = tracks.find((track) => track.id === trackId)?.clips?.[clipIndex]?.id;
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      const nextClips = [...track.clips];
      nextClips.splice(clipIndex, 1);
      return { ...track, clips: nextClips };
    }));
    if (targetClipId && selectedNotationCell?.clipId === targetClipId) setSelectedNotationCell(null);
  };

  const removeClipById = (trackId, clipId) => {
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      return {
        ...track,
        clips: track.clips.filter((clip) => clip.id !== clipId),
      };
    }));
    if (selectedNotationCell?.trackId === trackId && selectedNotationCell?.clipId === clipId) setSelectedNotationCell(null);
  };

  const addClip = (trackId, startPosition) => {
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      const validStart = Math.max(0, startPosition);
      const hasOverlap = track.clips.some((clip) => validStart < clip.start + clip.width && validStart + 2 > clip.start);
      if (hasOverlap) return track;
      return {
        ...track,
        clips: [
          ...track.clips,
          {
            id: makeId('clip'),
            start: validStart,
            width: 2,
            name: 'คลิปใหม่',
            sectionLabel: 'manual',
            loops: 1,
            notesPreview: [],
            sourceInstrumentId: track.instrumentId,
            playback: { measureCount: 2, durationSec: getEditorMeasureDurationSec(bpm) * 2, events: [], notationMeasures: createNotationMeasures() },
          },
        ],
      };
    }));
  };

  const addNotationClipAt = (trackId, startPosition) => {
    const clipId = makeId('clip');
    const validStart = Math.max(0, Number(startPosition) || 0);
    const targetTrack = tracks.find((track) => track.id === trackId);
    if (!targetTrack || targetTrack.clips.some((clip) => validStart < clip.start + clip.width && validStart + 8 > clip.start)) return;
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      return {
        ...track,
        clips: [...track.clips, {
          id: clipId, start: validStart, width: 2, name: 'โน้ตใหม่', sectionLabel: 'manual', loops: 1,
          notesPreview: [], sourceInstrumentId: track.instrumentId,
          width: 8,
          playback: { measureCount: 8, durationSec: getEditorMeasureDurationSec(bpm) * 8, events: [], notationMeasures: createNotationMeasures(8) },
        }],
      };
    }));
    setSelectedNotationCell({ trackId, clipId, measureIndex: 0, cellIndex: 0, rowIndex: 0 });
  };

  const selectNotationCell = (selection) => setSelectedNotationCell(selection);

  const addNotationMeasures = (amount = 1) => {
    if (!selectedNotationCell) return;
    const count = Math.max(1, Math.floor(Number(amount) || 1));
    const { trackId, clipId } = selectedNotationCell;
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      return {
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const measures = (Array.isArray(clip.playback?.notationMeasures) ? clip.playback.notationMeasures : buildNotationFromEvents(clip))
            .map((measure) => ({ ...measure, top: [...(measure.top || [])], bottom: measure.bottom ? [...measure.bottom] : null }));
          const isDoubleHand = measures.some((measure) => Array.isArray(measure.bottom));
          const startIndex = measures.length;
          for (let index = 0; index < count; index += 1) {
            measures.push({ index: startIndex + index, top: Array(4).fill('-'), bottom: isDoubleHand ? Array(4).fill('-') : null });
          }
          const instrumentId = normalizeInstrumentId(track.instrumentId || clip.sourceInstrumentId, 'ranat-ek');
          const events = buildEventsFromNotation(measures, instrumentId);
          return {
            ...clip,
            width: Math.max(Number(clip.width) || 1, measures.length),
            sourceInstrumentId: instrumentId,
            playback: { ...clip.playback, measureCount: measures.length, durationSec: getEditorMeasureDurationSec(bpm) * measures.length, events, notationMeasures: measures },
          };
        }),
      };
    }));
  };

  const setNotationHandMode = (mode) => {
    if (!selectedNotationCell || !['single', 'double'].includes(mode)) return;
    const { trackId, clipId } = selectedNotationCell;
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      return {
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const measures = (Array.isArray(clip.playback?.notationMeasures) ? clip.playback.notationMeasures : buildNotationFromEvents(clip))
            .map((measure, index) => ({
              ...measure,
              index: Number(measure.index ?? index),
              top: [...(measure.top || Array(4).fill('-'))],
              bottom: mode === 'double' ? [...(measure.bottom || Array(measure.top?.length || 4).fill('-'))] : null,
            }));
          const instrumentId = normalizeInstrumentId(track.instrumentId || clip.sourceInstrumentId, 'ranat-ek');
          const events = buildEventsFromNotation(measures, instrumentId);
          return { ...clip, sourceInstrumentId: instrumentId, playback: { ...clip.playback, events, notationMeasures: measures } };
        }),
      };
    }));
    setSelectedNotationCell((current) => current ? { ...current, rowIndex: mode === 'double' ? current.rowIndex : 0 } : current);
  };

  const removeNotationMeasures = (amount = 1) => {
    if (!selectedNotationCell) return;
    const count = Math.max(1, Math.floor(Number(amount) || 1));
    const { trackId, clipId, measureIndex } = selectedNotationCell;
    // A "line" is a fixed group of eight measures. Removing one measure uses
    // the selected measure; removing a line uses the line containing it.
    const startIndex = count === 8 ? Math.floor(measureIndex / 8) * 8 : measureIndex;
    const selectedClip = tracks.find((track) => track.id === trackId)?.clips.find((clip) => clip.id === clipId);
    const sourceMeasures = Array.isArray(selectedClip?.playback?.notationMeasures)
      ? selectedClip.playback.notationMeasures
      : buildNotationFromEvents(selectedClip);
    const projectedCount = Math.max(1, sourceMeasures.length - Math.min(count, Math.max(0, sourceMeasures.length - 1), Math.max(0, sourceMeasures.length - startIndex)));
    const nextMeasureIndex = Math.min(startIndex, projectedCount - 1);
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      return {
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const measures = (Array.isArray(clip.playback?.notationMeasures) ? clip.playback.notationMeasures : buildNotationFromEvents(clip))
            .map((measure) => ({ ...measure, top: [...(measure.top || [])], bottom: measure.bottom ? [...measure.bottom] : null }));
          if (measures.length <= 1 || startIndex >= measures.length) return clip;
          const deleteCount = Math.min(count, measures.length - 1, measures.length - startIndex);
          if (deleteCount <= 0) return clip;
          measures.splice(startIndex, deleteCount);
          measures.forEach((measure, index) => { measure.index = index; });
          const instrumentId = normalizeInstrumentId(track.instrumentId || clip.sourceInstrumentId, 'ranat-ek');
          const events = buildEventsFromNotation(measures, instrumentId);
          return {
            ...clip,
            width: Math.max(1, measures.length),
            sourceInstrumentId: instrumentId,
            notesPreview: events.slice(0, 14).map((event) => event.note),
            playback: { ...clip.playback, measureCount: measures.length, durationSec: getEditorMeasureDurationSec(bpm) * measures.length, events, notationMeasures: measures },
          };
        }),
      };
    }));
    setSelectedNotationCell((current) => current && current.trackId === trackId && current.clipId === clipId
      ? { ...current, measureIndex: nextMeasureIndex, cellIndex: 0 }
      : current);
  };

  const moveNotationSelection = (direction) => {
    if (!selectedNotationCell) return;
    const { trackId, clipId, measureIndex, cellIndex, rowIndex } = selectedNotationCell;
    const clip = tracks.find((track) => track.id === trackId)?.clips.find((entry) => entry.id === clipId);
    const measures = Array.isArray(clip?.playback?.notationMeasures) ? clip.playback.notationMeasures : buildNotationFromEvents(clip);
    const measurePosition = measures.findIndex((measure, index) => Number(measure.index ?? index) === measureIndex);
    if (measurePosition < 0) return;
    const rowKey = rowIndex === 1 ? 'bottom' : 'top';
    const cells = measures[measurePosition]?.[rowKey] || measures[measurePosition]?.top || [];
    let next = { trackId, clipId, measureIndex, cellIndex, rowIndex };

    if (direction === 'up' || direction === 'down') {
      const targetRow = direction === 'up' ? 0 : 1;
      if (Array.isArray(measures[measurePosition]?.[targetRow === 1 ? 'bottom' : 'top'])) next = { ...next, rowIndex: targetRow };
    } else if (direction === 'left' && cellIndex > 0) {
      next = { ...next, cellIndex: cellIndex - 1 };
    } else if (direction === 'right' && cellIndex < cells.length - 1) {
      next = { ...next, cellIndex: cellIndex + 1 };
    } else if (direction === 'left' && measurePosition > 0) {
      const previous = measures[measurePosition - 1];
      const previousCells = previous?.[rowKey] || previous?.top || [];
      next = { ...next, measureIndex: Number(previous.index ?? measurePosition - 1), cellIndex: Math.max(0, previousCells.length - 1) };
    } else if (direction === 'right' && measurePosition < measures.length - 1) {
      const following = measures[measurePosition + 1];
      next = { ...next, measureIndex: Number(following.index ?? measurePosition + 1), cellIndex: 0 };
    }
    setSelectedNotationCell(next);
  };

  const addNotationSymbol = (start, end, type = notationSymbolTool) => {
    if (!start || !end || !['sabat', 'kro'].includes(type) || start.trackId !== end.trackId || start.clipId !== end.clipId) return;
    if (start.measureIndex === end.measureIndex && start.cellIndex === end.cellIndex && start.rowIndex === end.rowIndex) return;
    setTracks((prev) => prev.map((track) => {
      if (track.id !== start.trackId) return track;
      return {
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== start.clipId) return clip;
          const measures = Array.isArray(clip.playback?.notationMeasures) ? clip.playback.notationMeasures : buildNotationFromEvents(clip);
          const startOffset = getNotationCellOffset(measures, start);
          const endOffset = getNotationCellOffset(measures, end);
          if (startOffset == null || endOffset == null) return clip;
          const notationSymbols = [...(clip.playback?.notationSymbols || []), {
            id: makeId('symbol'), type, startOffset, endOffset,
            startRowIndex: start.rowIndex || 0, endRowIndex: end.rowIndex || 0,
            color: type === 'kro' ? '#38bdf8' : 'rgba(255, 255, 255, 0.88)', strokeWidth: 2,
          }];
          return { ...clip, playback: { ...clip.playback, notationMeasures: measures, notationSymbols } };
        }),
      };
    }));
  };

  const appendNotationNote = (token) => {
    if (!selectedNotationCell) return;
    const { trackId, clipId, measureIndex, cellIndex, rowIndex = 0 } = selectedNotationCell;
    const clip = tracks.find((track) => track.id === trackId)?.clips.find((entry) => entry.id === clipId);
    const measures = Array.isArray(clip?.playback?.notationMeasures) ? clip.playback.notationMeasures : buildNotationFromEvents(clip);
    const measure = measures.find((entry, index) => Number(entry.index ?? index) === measureIndex);
    const cells = measure?.[rowIndex === 1 ? 'bottom' : 'top'];
    const previous = normalizeCellToken(cells?.[cellIndex]);
    inputNotationNote(previous === '-' ? token : `${previous}${token}`, false);
  };

  const inputNotationNote = (token, advance = token !== '-') => {
    if (!selectedNotationCell) return;
    const nextToken = normalizeCellToken(token);
    const { trackId, clipId, measureIndex, cellIndex, rowIndex = 0 } = selectedNotationCell;
    if (nextToken !== '-') {
      const track = tracks.find((entry) => entry.id === trackId);
      const noteToPreview = splitThaiNoteToken(nextToken).at(-1);
      if (track?.instrumentId && noteToPreview) {
        // The arranger writer uses the same AudioEngine preview path as the
        // Editor keyboard, including resuming the context from a user gesture.
        const notesToPreview = track.instrumentId === 'ranat-ek' && track.octavePairEnabled
          ? Object.values(getIntervalPair(INSTRUMENT_CONFIG[track.instrumentId], noteToPreview, '8'))
          : [noteToPreview];
        void initAudioContext()
          .then(() => Promise.all(notesToPreview.filter(Boolean).map((note) => playNote(track.instrumentId, note, track.volume ?? 100))))
          .catch(() => {});
      }
    }
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      return {
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          const fallbackMeasures = buildNotationFromEvents(clip);
          const measures = Array.isArray(clip.playback?.notationMeasures)
            ? clip.playback.notationMeasures.map((measure) => ({ ...measure, top: [...(measure.top || [])], bottom: measure.bottom ? [...measure.bottom] : null }))
            : fallbackMeasures;
          const measurePosition = measures.findIndex((measure, index) => Number(measure.index ?? index) === measureIndex);
          const targetMeasure = measures[measurePosition >= 0 ? measurePosition : measureIndex];
          if (!targetMeasure) return clip;
          const rowKey = rowIndex === 1 ? 'bottom' : 'top';
          if (!Array.isArray(targetMeasure[rowKey])) targetMeasure[rowKey] = Array(targetMeasure.top?.length || 4).fill('-');
          if (cellIndex < 0 || cellIndex >= targetMeasure[rowKey].length) return clip;
          targetMeasure[rowKey][cellIndex] = nextToken;
          const instrumentId = normalizeInstrumentId(track.instrumentId || clip.sourceInstrumentId, 'ranat-ek');
          const events = buildEventsFromNotation(measures, instrumentId);
          return {
            ...clip,
            sourceInstrumentId: instrumentId,
            notesPreview: events.slice(0, 14).map((event) => event.note),
            playback: {
              ...clip.playback,
              measureCount: Math.max(1, measures.length),
              durationSec: getEditorMeasureDurationSec(bpm) * Math.max(1, measures.length),
              events,
              notationMeasures: measures,
            },
          };
        }),
      };
    }));

    if (advance) {
      const clip = tracks.find((track) => track.id === trackId)?.clips.find((entry) => entry.id === clipId);
      const measures = clip?.playback?.notationMeasures;
      const measurePosition = Array.isArray(measures)
        ? measures.findIndex((measure, index) => Number(measure.index ?? index) === measureIndex)
        : -1;
      const cells = measures?.[measurePosition]?.[rowIndex === 1 ? 'bottom' : 'top'];
      const nextMeasure = measures?.[measurePosition + 1];
      const nextCells = nextMeasure?.[rowIndex === 1 ? 'bottom' : 'top'];
      setSelectedNotationCell((current) => {
        if (!current || current.trackId !== trackId || current.clipId !== clipId) return current;
        if (Array.isArray(cells) && cellIndex + 1 < cells.length) return { ...current, cellIndex: cellIndex + 1 };
        if (Array.isArray(nextCells)) return { ...current, measureIndex: Number(nextMeasure.index ?? measurePosition + 1), cellIndex: 0 };
        return current;
      });
    }
  };

  const moveClip = (trackId, clipIndex, newStart) => {
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      const nextClips = [...track.clips];
      nextClips[clipIndex] = {
        ...nextClips[clipIndex],
        start: Math.max(0, newStart),
      };
      return { ...track, clips: nextClips };
    }));
  };

  const copyClip = (clipId) => {
    const source = tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId);
    if (!source) return;
    clipboardRef.current = source;
    setHasClipboard(true);
  };

  const pasteClipAt = (trackId, startPosition = 0) => {
    const source = clipboardRef.current;
    if (!source) return;
    const width = Math.max(0.25, Number(source.width) || 1);

    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      let start = Math.max(0, Number(startPosition) || 0);
      const overlaps = (s) => track.clips.some((clip) => s < ((clip.start || 0) + (clip.width || 0)) && (s + width) > (clip.start || 0));
      let guard = 0;
      while (overlaps(start) && guard < 400) {
        start = Number((start + 0.5).toFixed(2));
        guard += 1;
      }
      const clip = {
        ...source,
        id: makeId('clip'),
        start,
        width,
        name: `${safeDisplayName(source.name, 'คลิป')} (สำเนา)`,
        playback: source.playback ? { ...source.playback, events: (source.playback.events || []).map((ev) => ({ ...ev, id: makeId('evt') })) } : source.playback,
        ...(source.sourceMeta ? { sourceMeta: { ...source.sourceMeta } } : {}),
        ...(Array.isArray(source.notesPreview) ? { notesPreview: [...source.notesPreview] } : {}),
      };
      return { ...track, clips: [...track.clips, clip] };
    }));
  };

  const resizeClip = (trackId, clipId, patch) => {
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      return { ...track, clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip)) };
    }));
  };

  const splitClip = (trackId, clipIndex, splitPoint) => {
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      const target = track.clips[clipIndex];
      if (!target) return track;

      const baseTrimOffset = Number(target.trimOffset) || 0;
      const localSplit = Math.max(0.25, Math.min(target.width - 0.25, Number(splitPoint) || 0));
      if (localSplit <= 0 || localSplit >= target.width) return track;

      const leftWidth = Number(localSplit.toFixed(2));
      const rightWidth = Number((target.width - leftWidth).toFixed(2));
      const rightTrimOffset = Number((baseTrimOffset + leftWidth).toFixed(2));

      const leftClip = {
        ...target,
        id: makeId('clip'),
        width: leftWidth,
        trimOffset: baseTrimOffset,
        name: `${target.name} A`,
      };
      const rightClip = {
        ...target,
        id: makeId('clip'),
        start: Number((target.start + leftWidth).toFixed(2)),
        width: rightWidth,
        trimOffset: rightTrimOffset,
        name: `${target.name} B`,
      };

      const nextClips = [...track.clips];
      nextClips.splice(clipIndex, 1, leftClip, rightClip);
      return { ...track, clips: nextClips };
    }));
  };

  const toggleSnapGrid = () => {
    setSnapGrid((prev) => {
      if (prev === 1) return 0.5;
      if (prev === 0.5) return 0.25;
      if (prev === 0.25) return 0;
      return 1;
    });
  };

  const zoomIn = () => setZoomLevel((prev) => clamp(prev + 5, MIN_ZOOM, MAX_ZOOM));
  const zoomOut = () => setZoomLevel((prev) => clamp(prev - 5, MIN_ZOOM, MAX_ZOOM));
  const fitTimeline = () => setZoomLevel(100);

  const importTmeToTrack = (trackId, fileContent, fileName = 'เพลงที่นำเข้า.tme') => {
    try {
      const cleanFileName = safeDisplayName(fileName, 'เพลงที่นำเข้า.tme');
      const parsed = parseTmeFile(fileContent, cleanFileName);
      const isWorkspaceEmpty = tracks.every((track) => track.clips.length === 0);

      if (projectName === 'Arranger Workspace') {
        setProjectName(parsed.projectName);
      }

      if (isWorkspaceEmpty) {
        setBpm(parsed.sourceBpm || 120);
      }

      setTracks((prev) => prev.map((track) => {
        if (track.id !== trackId) return track;

        const appendFrom = track.clips.reduce((max, clip) => Math.max(max, clip.start + clip.width), 0);
        const importedClips = parsed.clips.map((clip, index) => ({
          ...clip,
          id: `${clip.id}_${index}_${Math.random().toString(36).slice(2, 7)}`,
          start: Number((clip.start + appendFrom).toFixed(2)),
          sourceMeta: {
            ...clip.sourceMeta,
            sourceFileName: cleanFileName,
            projectName: safeDisplayName(clip.sourceMeta?.projectName, parsed.projectName),
            currentInstrument: normalizeInstrumentId(clip.sourceMeta?.currentInstrument || parsed.instrumentId, parsed.instrumentId),
            currentInstrumentName: safeDisplayName(clip.sourceMeta?.currentInstrumentName, parsed.instrumentLabel),
          },
          instrumentLabel: safeDisplayName(clip.instrumentLabel, parsed.instrumentLabel),
          name: safeDisplayName(clip.name, parsed.projectName),
          sectionLabel: safeDisplayName(clip.sectionLabel, clip.name || parsed.projectName),
        }));

        const shouldRenameTrack = !track.name || /^Track\s+\d+$/i.test(track.name);
        const nextTrackName = shouldRenameTrack ? parsed.projectName : track.name;
        const nextInstrumentId = track.clips.length === 0 ? parsed.instrumentId : track.instrumentId;

        return {
          ...track,
          name: nextTrackName,
          type: `${safeDisplayName(parsed.instrumentLabel, getInstrumentNameById(parsed.instrumentId))} • ${cleanFileName}`,
          instrumentId: nextInstrumentId,
          sourceProjectName: parsed.projectName,
          clips: [...track.clips, ...importedClips],
        };
      }));
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการอ่านไฟล์ .tme:', error);
      alert('ไฟล์ที่นำเข้าไม่ถูกต้อง หรือโครงสร้างข้อมูลยังไม่ตรงกับระบบ Arranger');
    }
  };

  const exportWorkspace = () => {
    const payload = serializeWorkspace({ projectName, bpm, snapGrid, zoomLevel, trackLaneHeight, masterVolume, tracks });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'arranger-workspace'}.arranger.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveProject = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    setSaveStatus('saving');
    try {
      let projectId = currentProjectId;
      if (!projectId) {
        const project = await createArrangerProject(uid, workspaceSnapshotRef.current.name || 'โปรเจกต์จัดวงใหม่');
        projectId = project.id;
        sessionStorage.setItem(ARRANGER_PROJECT_SESSION_KEY, projectId);
        setCurrentProjectId(projectId);
        setIsProjectReady(true);
      }
      await saveArrangerProject(uid, projectId, workspaceSnapshotRef.current);
      setSaveStatus('saved');
      return true;
    } catch (error) {
      console.error('บันทึกโปรเจกต์จัดวงไม่สำเร็จ:', error);
      setSaveStatus('error');
      return false;
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (!isProjectReady) return undefined;

    setSaveStatus('unsaved');
    const autoSaveTimer = window.setTimeout(() => {
      saveProject();
    }, 1000);

    return () => window.clearTimeout(autoSaveTimer);
  }, [
    projectName,
    bpm,
    snapGrid,
    zoomLevel,
    trackLaneHeight,
    masterVolume,
    tracks,
    isProjectReady,
    currentProjectId,
    saveProject,
  ]);

  const importWorkspace = (fileContent) => {
    try {
      const data = JSON.parse(fileContent);
      
      if (data.name) setProjectName(data.name);
      if (data.bpm) setBpm(data.bpm);
      if (data.snapGrid !== undefined) setSnapGrid(data.snapGrid);
      if (data.zoomLevel) setZoomLevel(data.zoomLevel);
      if (data.trackLaneHeight) setTrackLaneHeight(data.trackLaneHeight);
      if (data.masterVolume !== undefined) setMasterVolume(data.masterVolume);
      if (data.tracks && Array.isArray(data.tracks)) {
        setTracks(data.tracks);
      }
      
      stopPlayback();
      setCurrentTimeWrapper(0);
      
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการโหลดโปรเจกต์:', error);
      alert('ไฟล์โปรเจกต์ไม่ถูกต้อง หรือไม่สามารถอ่านข้อมูลได้ครับ');
    }
  };

  const formatTime = (seconds) => {
    const totalMs = Math.max(0, Math.floor((seconds || 0) * 1000));
    const ms = String(totalMs % 1000).padStart(3, '0');
    const totalSec = Math.floor(totalMs / 1000);
    const sec = String(totalSec % 60).padStart(2, '0');
    const min = String(Math.floor(totalSec / 60) % 60).padStart(2, '0');
    const hr = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    return `${hr}:${min}:${sec}.${ms}`;
  };

  // Reading historyRevision subscribes the toolbar to ref-backed history.
  const canUndo = historyRevision >= 0 && Boolean(historyRef.current.pending || historyRef.current.undo.length);
  const canRedo = historyRevision >= 0 && historyRef.current.redo.length > 0;

  const value = {
    projectName,
    setProjectName,
    currentProjectId,
    saveProject,
    saveStatus,
    isPlaying,
    setIsPlaying,
    startPlayback,
    stopPlayback,
    returnToPlaybackStart,
    bpm,
    setBpm,
    activeTool,
    setActiveTool,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedNotationCell,
    selectNotationCell,
    hasSeenWelcome,
    dismissWorkspaceWelcome: () => setHasSeenWelcome(true),
    inputNotationNote,
    moveNotationSelection,
    notationSymbolTool,
    setNotationSymbolTool,
    isOctavePairEnabled,
    setIsOctavePairEnabled,
    addNotationSymbol,
    appendNotationNote,
    addNotationMeasures,
    setNotationHandMode,
    removeNotationMeasures,
    currentTime,
    setCurrentTime: setCurrentTimeWrapper,
    getPlaybackPosition,
    totalTime,
    formatTime,
    snapGrid,
    toggleSnapGrid,
    zoomLevel,
    setZoomLevel,
    zoomIn,
    zoomOut,
    fitTimeline,
    trackLaneHeight,
    setTrackLaneHeight,
    setTrackLaneHeightClamped,
    measureWidth,
    totalMeasures,
    tracks,
    setTracks,
    toggleMute,
    toggleSolo,
    setTrackVolume,
    setTrackPan,
    masterVolume,
    setMasterVolume,
    setTrackCustomHeight, // ⭐ ส่งคำสั่งนี้ออกไปให้ Track Panel ใช้
    setClipVolume,
    setClipLoops,
    toggleTrackCollapse,
    toggleTrackLock, // ⭐ ส่งฟังก์ชันออกไปให้ปุ่มใน TrackPanel ใช้งาน
    addTrack,
    addEnsemblePreset,
    renameTrack,
    duplicateTrack,
    removeTrack,
    reorderTracks, 
    reorderTrackClips, // ⭐ มั่นใจ 100% ว่าฟังก์ชันสลับคลิปถูกส่งออกไปแล้วครับ!
    setTrackInstrument,
    setTrackOctavePair,
    deleteClip,
    removeClipById,
    addClip,
    addNotationClipAt,
    moveClip,
    resizeClip,
    copyClip,
    pasteClipAt,
    hasClipboard,
    splitClip,
    importTmeToTrack,
    importProjectFromWeb,
    exportWorkspace,
    importWorkspace, 
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return context;
};
