import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { INSTRUMENT_CONFIG } from '../utils/instrumentConfig';
import {
  initAudioContext,
  preloadSounds,
  scheduleNote,
  getAudioCurrentTime,
  getTrackGainNode,
  setTrackGain,
  getClipGainNode,
  connectClipGain,
  setClipGain,
  stopAllScheduledNotes,
} from '../utils/audioEngine';

const WorkspaceContext = createContext(null);

const TRACK_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
const DEFAULT_MEASURE_WIDTH = 90;
const MIN_ZOOM = 10;
const MAX_ZOOM = 240;
const THAI_NOTE_COMBINER_PATTERN = /[ั-๎​]/;

// ⭐ Single source of truth สำหรับความสูงของแทร็ก (ใช้ร่วมกันทั้ง Toolbar slider + Timeline lane + TrackPanel drag)
export const MIN_TRACK_LANE_HEIGHT = 54;        // ⭐ ครึ่งหนึ่งของค่าเดิม (108/132 -> 54/66) ตามที่ผู้ใช้ต้องการเล็กที่สุด
export const MAX_TRACK_LANE_HEIGHT = 320;
export const DEFAULT_TRACK_LANE_HEIGHT = 66;    // ค่าเริ่มต้น = ครึ่งของ 132 (เล็กที่สุด)
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
  isMuted: false,
  isSolo: false,
  isCollapsed: false,
  isLocked: false, // ⭐ เพิ่มสถานะล็อคตั้งต้น
  sourceProjectName: '',
  clips: [],
});

const getFormattedInstrumentNote = (key) => {
  const octave = parseInt(String(key.eng || '').replace(/\D/g, ''), 10);
  if (octave >= 5) return `${key.thai}\u0E4D`;
  if (octave === 2) return `${key.thai}\u0E3A\u200B`;
  if (octave === 3) return `${key.thai}\u0E3A`;
  return key.thai;
};

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
  const secPerWholeMeasure = 60 / bpm;
  const events = [];

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

    for (let r = section.startRow; r <= section.endRow; r += 1) {
      const rowType = rowTypes[r];
      if (shouldSkipPlaybackRow(rowType)) continue;

      const row = sheetData[r] || [];
      const startMeasure = rowType?.startsWith('double') ? 1 : 0;

      for (let m = startMeasure; m < row.length; m += 1) {
        const cells = Array.isArray(row[m]) ? row[m] : [];
        const cellCount = Math.max(1, cells.length);
        const measureBase = loopIndex * oneLoopMeasureCount + measureCursor;

        for (let c = 0; c < cellCount; c += 1) {
          const baseMeasureOffset = measureBase + (c / cellCount);
          const topInstrumentId = getCustomInstrumentId(layoutConfig, r, m, c, fallbackInstrumentId);
          const topVolume = Number(layoutConfig?.customStyles?.[`${r}_${m}_${c}`]?.velocity) || 100;

          if (rowType === 'double-right') {
            const bottomRow = sheetData[r + 1] || [];
            const bottomToken = bottomRow[m]?.[c] ?? '-';
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
  }

  return {
    measureCount: Math.max(1, oneLoopMeasureCount * loops),
    durationSec: Math.max(0.01, oneLoopMeasureCount * loops * secPerWholeMeasure),
    events,
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
    const playback = buildPlaybackEvents(parsedData, section, fallbackInstrumentId, loops);
    const displayLabel = safeDisplayName(sequenceLabel, section.label || projectName);
    const clip = {
      id: makeId('clip'),
      start: cursor,
      width: playback.measureCount,
      name: loops > 1 ? `${displayLabel} ×${loops}` : displayLabel,
      sectionLabel: displayLabel,
      loops,
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
    cursor += playback.measureCount;
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
  tracks: state.tracks,
});

export const WorkspaceProvider = ({ children }) => {
  const [projectName, setProjectName] = useState('Arranger Workspace');
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [activeTool, setActiveTool] = useState('select');
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [snapGrid, setSnapGrid] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [trackLaneHeight, setTrackLaneHeight] = useState(DEFAULT_TRACK_LANE_HEIGHT);
  const [tracks, setTracks] = useState([
    createEmptyTrack(1, TRACK_COLORS[0]),
    createEmptyTrack(2, TRACK_COLORS[1]),
  ]);

  const playbackRef = useRef({ rafId: null, startedAt: 0, durationSec: 0 });
  const schedulerIntervalRef = useRef(null);
  const clipboardRef = useRef(null);
  const [hasClipboard, setHasClipboard] = useState(false);
  
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const startPlaybackRef = useRef(null);
  const stopPlaybackRef = useRef(null);

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

  const activeTracks = useMemo(() => {
    const hasSolo = tracks.some((track) => track.isSolo);
    return tracks.filter((track) => hasSolo ? track.isSolo && !track.isMuted : !track.isMuted);
  }, [tracks]);

  // ⭐ เปลี่ยนระบบ: การกด Stop (หยุดด้วยมือ) เสียงต้องตัดขาดทันที อันนี้ทำงานถูกต้องแล้ว
  const stopPlayback = () => {
    setIsPlaying(false);
    if (playbackRef.current.rafId) cancelAnimationFrame(playbackRef.current.rafId);
    playbackRef.current.rafId = null;
    if (schedulerIntervalRef.current) {
      clearInterval(schedulerIntervalRef.current);
      schedulerIntervalRef.current = null;
    }
    stopAllScheduledNotes?.(); 
  };

  useEffect(() => () => {
    if (playbackRef.current.rafId) cancelAnimationFrame(playbackRef.current.rafId);
    if (schedulerIntervalRef.current) clearInterval(schedulerIntervalRef.current);
    stopAllScheduledNotes?.();
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    startPlaybackRef.current = startPlayback;
    stopPlaybackRef.current = stopPlayback;
  });

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      if (isPlayingRef.current) stopPlaybackRef.current?.();
      else startPlaybackRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const animatePlayback = () => {
    const elapsedSec = (performance.now() - playbackRef.current.startedAt) / 1000;
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
      return;
    }

    const now = performance.now();
    if (now - (playbackRef.current.lastUiUpdate || 0) > 80) {
      playbackRef.current.lastUiUpdate = now;
      // ล็อกเส้น Playhead ให้ไปหยุดสุดพอดีที่ขอบท้ายโปรเจกต์ (แม้ว่าจะรอหางเสียงอยู่ก็ตาม)
      setCurrentTimeWrapper(Math.min(start + elapsedSec, start + duration));
    }
    playbackRef.current.rafId = requestAnimationFrame(animatePlayback);
  };

  const startPlayback = async () => {
    stopPlayback();

    await initAudioContext();

    const secPerMeasure = 60 / Math.max(20, Number(bpm) || 120);
    const startTime = Math.max(0, currentTimeRef.current || 0);
    const events = [];
    const usedInstruments = new Set();
    let totalDuration = 0;

    // สร้าง Gain ของทุก Track + ทุกแทรก 
    tracks.forEach((track) => {
      const trackGain = getTrackGainNode(track.id);
      track.clips.forEach((clip) => {
        getClipGainNode(clip.id);
        connectClipGain(clip.id, trackGain);
        const clipVol = clip.volume == null ? 100 : clamp(Number(clip.volume) || 0, 0, 100);
        setClipGain(clip.id, clipVol / 100);
      });
    });
    // โยนการอัปเดต Volume ไปให้ useEffect จัดการ

    tracks.forEach((track) => {
      if (track.instrumentId) usedInstruments.add(track.instrumentId);
      track.clips.forEach((clip) => {
        const clipStartSec = (clip.start || 0) * secPerMeasure;
        const trimOffset = Number(clip.trimOffset) || 0;
        const clipGain = getClipGainNode(clip.id);
        const loops = Math.max(1, Number(clip.loops) || 1);
        const clipWidthSec = (clip.width || 0) * secPerMeasure;
        
        for (let lp = 0; lp < loops; lp += 1) {
          const loopStartSec = clipStartSec + (lp * clipWidthSec);
          (clip.playback?.events || []).forEach((event) => {
            const offset = (event.measureOffset || 0) - trimOffset;
            if (offset < 0) return; 
            const instrumentId = INSTRUMENT_CONFIG[event.instrumentId] ? event.instrumentId : (track.instrumentId || clip.sourceInstrumentId || 'ranat-ek');
            usedInstruments.add(instrumentId);
            events.push({
              whenSec: loopStartSec + (offset * secPerMeasure),
              instrumentId,
              note: event.note,
              volume: clamp(Number(event.volume) || 100, 0, 200), 
              destination: clipGain,
              trackId: track.id, 
            });
          });
        }
        totalDuration = Math.max(totalDuration, clipStartSec + (loops * clipWidthSec));
      });
    });

    await Promise.allSettled([...usedInstruments].map((id) => preloadSounds(id)));

    events.sort((a, b) => a.whenSec - b.whenSec);

    const playEvents = events.filter((ev) => ev.whenSec >= startTime);
    const durationSec = Math.max(0, totalDuration - startTime);

    setTotalTime(totalDuration);
    setCurrentTimeWrapper(startTime);

    playbackRef.current.startedAt = performance.now();
    playbackRef.current.startTime = startTime;
    playbackRef.current.durationSec = Math.max(durationSec, 0.01);
    playbackRef.current.events = playEvents;
    playbackRef.current.nextEventIdx = 0;
    playbackRef.current.startAudioTime = getAudioCurrentTime?.() || 0;
    playbackRef.current.lastUiUpdate = 0;

    setIsPlaying(true);

    schedulerIntervalRef.current = setInterval(() => {
      try {
        const audioNow = getAudioCurrentTime?.() || 0;
        const elapsedSec = (performance.now() - playbackRef.current.startedAt) / 1000;
        const horizon = audioNow + 1.5;
        const evs = playbackRef.current.events || [];

        while (playbackRef.current.nextEventIdx < evs.length) {
          const ev = evs[playbackRef.current.nextEventIdx];
          const whenSec = audioNow + Math.max(0, ev.whenSec - startTime - elapsedSec);
          if (whenSec > horizon) break;

          // ⭐ 2. แก้ปัญหาดีเลย์ Mute/Solo: โหลดตัวโน้ตลงไปจ่อใน AudioEngine เสมอ ห้ามบล็อก!
          // แล้วให้ตัว Gain Node ที่รับหน้าที่คุมเสียง (ใน useEffect) หรี่/เปิดเสียงแทน จะทำงานได้เร็วระดับมิลลิวินาที
          if (ev.note && ev.note !== '-') {
            scheduleNote(ev.instrumentId, ev.note, whenSec, ev.volume, ev.destination);
          }
          playbackRef.current.nextEventIdx += 1;
        }
      } catch (err) {
        console.error('เกิดข้อผิดพลาดในการจัดตารางเสียง:', err);
      }
    }, 100);

    playbackRef.current.rafId = requestAnimationFrame(animatePlayback);
  };

  // ⭐ 3. ระบบซิงค์ระดับเสียง (Gain) กับ AudioEngine ทันทีที่ State มีการเปลี่ยนแปลง
  // ลดอาการหน่วง เพราะให้ React จับตาดู tracks แล้วอัปเดตตรงไปที่ระบบเสียงทันที
  useEffect(() => {
    const hasSolo = tracks.some((t) => t.isSolo);
    tracks.forEach((track) => {
      const muted = track.isMuted || (hasSolo && !track.isSolo);
      const trackVolume = clamp(Number(track.volume) != null ? Number(track.volume) : 100, 0, 200) / 100;
      setTrackGain(track.id, muted ? 0 : trackVolume);
    });
  }, [tracks]); 

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

  const deleteClip = (trackId, clipIndex) => {
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      const nextClips = [...track.clips];
      nextClips.splice(clipIndex, 1);
      return { ...track, clips: nextClips };
    }));
  };

  const removeClipById = (trackId, clipId) => {
    setTracks((prev) => prev.map((track) => {
      if (track.id !== trackId) return track;
      return {
        ...track,
        clips: track.clips.filter((clip) => clip.id !== clipId),
      };
    }));
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
            playback: { measureCount: 2, durationSec: 0, events: [] },
          },
        ],
      };
    }));
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
        sourceMeta: source.sourceMeta ? { ...source.sourceMeta } : source.sourceMeta,
        notesPreview: Array.isArray(source.notesPreview) ? [...source.notesPreview] : undefined,
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
    const payload = serializeWorkspace({ projectName, bpm, snapGrid, zoomLevel, trackLaneHeight, tracks });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'arranger-workspace'}.arranger.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importWorkspace = (fileContent) => {
    try {
      const data = JSON.parse(fileContent);
      
      if (data.name) setProjectName(data.name);
      if (data.bpm) setBpm(data.bpm);
      if (data.snapGrid !== undefined) setSnapGrid(data.snapGrid);
      if (data.zoomLevel) setZoomLevel(data.zoomLevel);
      if (data.trackLaneHeight) setTrackLaneHeight(data.trackLaneHeight);
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

  const value = {
    projectName,
    setProjectName,
    isPlaying,
    setIsPlaying,
    startPlayback,
    stopPlayback,
    bpm,
    setBpm,
    activeTool,
    setActiveTool,
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
    setTrackCustomHeight, // ⭐ ส่งคำสั่งนี้ออกไปให้ Track Panel ใช้
    setClipVolume,
    setClipLoops,
    toggleTrackCollapse,
    toggleTrackLock, // ⭐ ส่งฟังก์ชันออกไปให้ปุ่มใน TrackPanel ใช้งาน
    addTrack,
    renameTrack,
    duplicateTrack,
    removeTrack,
    reorderTracks, 
    reorderTrackClips, // ⭐ มั่นใจ 100% ว่าฟังก์ชันสลับคลิปถูกส่งออกไปแล้วครับ!
    setTrackInstrument,
    deleteClip,
    removeClipById,
    addClip,
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

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return context;
};