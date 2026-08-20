import React, { createContext, useState, useMemo, useEffect, useRef } from 'react';
import { INSTRUMENT_CONFIG } from '../utils/instrumentConfig';
import { preloadSounds, preloadAllSounds, playNote, scheduleNote, initAudioContext, getAudioCurrentTime, stopAllScheduledNotes } from '../utils/audioEngine'; 
import { auth, saveProjectToDB } from '../utils/firebase';

export const MusicContext = createContext();

const getVisualIndex = (rowIndex, rowTypesArray) => {
  let vIdx = 0;
  for (let i = 0; i < rowIndex; i++) {
    if (rowTypesArray[i] === 'single' || rowTypesArray[i] === 'double-right') {
      vIdx++;
    }
  }
  if (rowTypesArray[rowIndex] === 'double-left') {
    return Math.max(0, vIdx - 1);
  }
  return vIdx;
};

const getFlattenedCol = (row, rType, targetM, targetC) => {
  if (!row || rType === 'text' || rType === 'page-break') return 0;
  let col = 0;
  for (let m = 0; m < row.length; m++) {
    if (rType && rType.startsWith('double') && m === 0) continue;
    if (m === targetM) return col + targetC;
    col += row[m].length;
  }
  return col;
};

const THAI_NOTE_COMBINER_PATTERN = /[ั-๎​]/;

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

const parseCellToken = (token, sabatStyle = 'crescendo', customVels = []) => {
  const notes = splitThaiNoteToken(token);
  if (notes.length === 0) return [];
  if (notes.length === 1) return [{ note: notes[0], ratio: 0, emphasis: 1 }];

  return notes.map((note, index) => {
    let emp = 1;
    if (sabatStyle === 'custom' && customVels.length === notes.length) {
       emp = customVels[index] / 100;
    } else if (sabatStyle === 'flat') {
       emp = 1;
    } else if (sabatStyle === 'accent') {
       emp = index === 0 ? 0.5 : 1;
    } else {
       emp = index === notes.length - 1 ? 1 : Math.max(0.55, 0.88 - (index * 0.08));
    }
    return { note, ratio: index / notes.length, emphasis: emp };
  });
};

const formatInstrumentNote = (key) => {
  const octave = parseInt(key.eng.replace(/\D/g, ''), 10);
  if (octave >= 5) return key.thai + '\u0E4D';
  if (octave === 2) return key.thai + '\u0E3A\u200B';
  if (octave === 3) return key.thai + '\u0E3A';
  return key.thai;
};

const getIntervalPair = (instrument, noteStr, intervalModeVal) => {
  if (!instrument?.keys || !noteStr || noteStr === '-' || intervalModeVal === 'off') {
    return { left: noteStr, right: noteStr };
  }

  const dist = parseInt(intervalModeVal, 10) - 1;
  const idx = instrument.keys.findIndex(k => formatInstrumentNote(k) === noteStr);
  
  if (idx === -1) return { left: noteStr, right: noteStr };

  let rightIdx = idx;
  let leftIdx = idx - dist;

  if (leftIdx < 0) leftIdx = 0; 

  return {
    left: formatInstrumentNote(instrument.keys[leftIdx]),
    right: formatInstrumentNote(instrument.keys[rightIdx])
  };
};

export const shiftNoteObject = (keyObj, steps) => {
  const engPitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const thaiPitches = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'];
  const pitch = keyObj.eng.replace(/\d/g, '');
  const octave = parseInt(keyObj.eng.replace(/\D/g, ''), 10);
  const idx = engPitches.indexOf(pitch);
  if (idx === -1) return keyObj;

  const newIdx = idx + steps;
  const newOctave = octave + Math.floor(newIdx / 7);
  const newPitchIdx = ((newIdx % 7) + 7) % 7;
  
  return {
    thai: thaiPitches[newPitchIdx],
    eng: engPitches[newPitchIdx] + newOctave
  };
};

export const shiftNoteString = (noteStr, steps) => {
  if (!noteStr || noteStr === '-') return noteStr;
  let thaiChar = noteStr.replace(/[\u0E3A\u200B\u0E4D]/g, '');
  let octave = 4;
  if (noteStr.includes('\u0E4D')) octave = 5;
  else if (noteStr.includes('\u0E3A\u200B')) octave = 2;
  else if (noteStr.includes('\u0E3A')) octave = 3;

  const thaiPitches = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'];
  const engPitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const idx = thaiPitches.indexOf(thaiChar);
  if (idx === -1) return noteStr;
  
  const mockEng = engPitches[idx] + octave;
  const shifted = shiftNoteObject({ thai: thaiChar, eng: mockEng }, steps);
  
  let finalNote = shifted.thai;
  const newOctave = parseInt(shifted.eng.replace(/\D/g, ''));
  if (newOctave >= 5) finalNote += '\u0E4D';
  else if (newOctave === 2) finalNote += '\u0E3A\u200B';
  else if (newOctave === 3) finalNote += '\u0E3A';
  
  return finalNote;
};

const DEFAULT_INSTRUMENT = INSTRUMENT_CONFIG["khong-wong-yai"] || INSTRUMENT_CONFIG["ranat-ek"] || Object.values(INSTRUMENT_CONFIG)[0];
const createDefaultSheetData = () => Array(4).fill().map(() => Array(8).fill().map(() => Array(4).fill('-')));
const createDefaultRowTypes = () => Array(4).fill('single');
const createDefaultRowMargins = (length = 4) => Array.from({ length }, () => ({ top: 0, bottom: 0, left: 0 }));
const createDefaultHeaderDetails = () => ([
  { id: 1, label: "อัตราจังหวะ", value: "๒ ชั้น" },
  { id: 2, label: "หน้าทับ", value: "สองไม้" },
  { id: 3, label: "บันไดเสียง", value: "ทางเพียงออ" },
  { id: 4, label: "ผู้บันทึก", value: "9atony" }
]);
const createDefaultLayoutConfig = () => ({
  fontSize: 30, isBold: false, isItalic: false, measureHeight: 48,
  rowGap: 32, songNameSize: 48, authorSize: 16, detailsAlign: 'between',
  borderWidth: 2, innerBorderWidth: 1, borderColor: '#1e293b', borderRadius: 0,
  bpm: 80, volume: 100,
  sabatColor: '#1e293b', sabatStrokeWidth: 2.5, sabatCurve: 20, sabatOffset: 4, sabatStyle: 'crescendo',
  kroColor: '#3b82f6', kroStrokeWidth: 2.5, kroOffset: 30, kroSpeed: 65, kroStartHand: 'right',
  activeSymbol: 'sabat', symbolColor: '#1e293b', symbolStrokeWidth: 2.5, symbolHeight: 20,
  marginTop: 48, marginBottom: 48, marginLeft: 48, marginRight: 48,
  marginUnit: 'px', textLineHeight: 1.5, textFontSize: 16,
  customStyles: {}
});

export const MusicProvider = ({ children }) => {
  const [currentInstrument, setCurrentInstrument] = useState(DEFAULT_INSTRUMENT);
  const [sheetData, setSheetData] = useState(createDefaultSheetData);
  const [rowTypes, setRowTypes] = useState(createDefaultRowTypes);
  const [rowMargins, setRowMargins] = useState(() => createDefaultRowMargins());
  const [selectedCell, setSelectedCell] = useState([0, 0, 0]);
  
  const [songName, setSongName] = useState("เพลงลาวดวงเดือน");
  const [projectName, setProjectName] = useState("โปรเจกต์ไม่มีชื่อ");
  const handleSetSongName = (newName) => {
    if (isReadOnlyRef.current) return;
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = newName;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    if (projectName === "โปรเจกต์ไม่มีชื่อ" || projectName === "เพลงใหม่" || projectName === songName) {
      setProjectName(plainText);
    }
    setSongName(newName);
  };
  
  const [sectionLabels, setSectionLabels] = useState({});
  const [selectionRange, setSelectionRange] = useState(null); 
  const [symbols, setSymbols] = useState([]); 
  const [selectedSymbolId, setSelectedSymbolId] = useState(null);
  
  const [intervalMode, setIntervalMode] = useState('off');
  const [isReduceMode, setIsReduceMode] = useState(false);
  const [isShowPlayMode, setIsShowPlayMode] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [toolbarMode, setToolbarMode] = useState('default');

  const [playbackSequence, setPlaybackSequence] = useState([]); 
  const [activeSequenceIdx, setActiveSequenceIdx] = useState(0); 
  const [activeLoop, setActiveLoop] = useState(1); 
  
  const [isLoopAll, setIsLoopAll] = useState(false);
  const [isLoopOne, setIsLoopOne] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [clipboardData, setClipboardData] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [projectId, setProjectId] = useState(null); 
  const [pendingAction, setPendingAction] = useState({ isOpen: false, type: null, payload: null });
  const [isReadOnly, setIsReadOnly] = useState(false);
  
  const isReadOnlyRef = useRef(false);
  const setReadOnlyMode = (readOnly) => {
    isReadOnlyRef.current = readOnly;
    setIsReadOnly(readOnly);
    if (readOnly) setProjectId(null); 
  };
  
  const checkUnsavedAndPrompt = (type, payload, skipWarning = false) => {
    if (isReadOnlyRef.current) {
      executeAction(type, payload);
      return;
    }
    const isFreshProject = !projectId && historyIndex <= 0 && projectName === "โปรเจกต์ไม่มีชื่อ";
    if (skipWarning || isFreshProject) {
      executeAction(type, payload);
    } else {
      setPendingAction({ isOpen: true, type, payload });
    }
  };

  const executeAction = (type, payload) => {
    if (type === 'NEW') performNewProject();
    else if (type === 'LOAD_LOCAL') performLoadProject(payload);
    else if (type === 'LOAD_FIREBASE') performLoadProjectFromFirebase(payload);
    setPendingAction({ isOpen: false, type: null, payload: null });
  };
  
  // ⭐ เพิ่ม currentProjectId เข้ามารับค่าโดยตรง
  const autoSaveToFirebase = async (data, currentProjectId) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      // ใช้ currentProjectId ที่รับมาส่งให้ Firebase
      const id = await saveProjectToDB(uid, currentProjectId, data);
      if (!currentProjectId && id) setProjectId(id);
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackCursor, setPlaybackCursor] = useState(null);

  const [currentTime, setCurrentTime] = useState(0); 
  const [totalTime, setTotalTime] = useState(0);
  const uiTimerRef = useRef(null);
  const playbackStartTimeRef = useRef(0);
  const seekOffsetRef = useRef(0);
  
  const playbackTimerRef = useRef(null);
  const schedulerIntervalRef = useRef(null);
  const schedulerStateRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const runAudioSchedulerRef = useRef(null);
  const isPageHiddenRef = useRef(typeof document !== 'undefined' ? document.hidden : false);
  const effectTimersRef = useRef([]);
  const mutedCellsRef = useRef(new Set());
  const playbackCursorRef = useRef(null);
  const pendingPlaybackCursorRef = useRef(null);
  const playbackCursorRafRef = useRef(null);
  
  const [layoutConfig, setLayoutConfig] = useState(createDefaultLayoutConfig);

  const layoutConfigRef = useRef(layoutConfig);
  const isPlayingRef = useRef(false);
  const sheetDataRef = useRef(sheetData);
  const rowTypesRef = useRef(rowTypes);
  const symbolsRef = useRef(symbols);
  const intervalModeRef = useRef(intervalMode); 
  const isReduceModeRef = useRef(isReduceMode); 
  const isShowPlayModeRef = useRef(isShowPlayMode);
  const sectionLabelsRef = useRef(sectionLabels);
  const playbackSequenceRef = useRef(playbackSequence);
  const activeSequenceIdxRef = useRef(0);
  const activeLoopRef = useRef(1);
  const isLoopAllRef = useRef(isLoopAll); 
  const isLoopOneRef = useRef(isLoopOne); 
  const sheetMapRef = useRef([]);
  const isImportingRef = useRef(false);
  const currentInstrumentRef = useRef(currentInstrument); 
  const resetProjectScopedState = ({ keepProjectId = false } = {}) => {
    const defaultSheet = createDefaultSheetData();
    const defaultTypes = createDefaultRowTypes();
    const defaultMargins = createDefaultRowMargins(defaultSheet.length);

    setSheetData(defaultSheet);
    setRowTypes(defaultTypes);
    setRowMargins(defaultMargins);
    setSectionLabels({});
    setSymbols([]);
    setLayoutConfig(createDefaultLayoutConfig());
    setHeaderDetails(createDefaultHeaderDetails());
    setCurrentInstrument(DEFAULT_INSTRUMENT);
    setPlaybackSequence([]);
    setIsLoopAll(false);
    setIsLoopOne(false);
    setIntervalMode('off');
    setIsReduceMode(false);
    setIsShowPlayMode(false);
    setIsAutoScroll(true);
    setToolbarMode('default');
    setSelectedSymbolId(null);
    setSelectedCell([0, 0, 0]);
    setSelectionRange(null);
    if (!keepProjectId) setProjectId(null);

    return { defaultSheet, defaultTypes, defaultMargins };
  };


  useEffect(() => { layoutConfigRef.current = layoutConfig; }, [layoutConfig]);
  useEffect(() => { currentInstrumentRef.current = currentInstrument; }, [currentInstrument]); 
  useEffect(() => { sheetDataRef.current = sheetData; }, [sheetData]);
  useEffect(() => { rowTypesRef.current = rowTypes; }, [rowTypes]);
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]); 
  useEffect(() => { intervalModeRef.current = intervalMode; }, [intervalMode]); 
  useEffect(() => { isReduceModeRef.current = isReduceMode; }, [isReduceMode]);
  useEffect(() => { isShowPlayModeRef.current = isShowPlayMode; }, [isShowPlayMode]);
  useEffect(() => { sectionLabelsRef.current = sectionLabels; }, [sectionLabels]);
  useEffect(() => { playbackSequenceRef.current = playbackSequence; }, [playbackSequence]);
  useEffect(() => { isLoopAllRef.current = isLoopAll; }, [isLoopAll]);
  useEffect(() => { isLoopOneRef.current = isLoopOne; }, [isLoopOne]);
  useEffect(() => { playbackCursorRef.current = playbackCursor; }, [playbackCursor]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageHiddenRef.current = document.hidden;
      if (!document.hidden && isPlayingRef.current && initAudioContext) {
        initAudioContext().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const schedulePlaybackCursorUpdate = (nextCursor) => {
    pendingPlaybackCursorRef.current = nextCursor;
    if (playbackCursorRafRef.current) return;

    playbackCursorRafRef.current = requestAnimationFrame(() => {
      playbackCursorRafRef.current = null;
      const pending = pendingPlaybackCursorRef.current;
      if (!pending) return;

      const prev = playbackCursorRef.current;
      if (!prev || prev[0] !== pending[0] || prev[1] !== pending[1] || prev[2] !== pending[2]) {
        playbackCursorRef.current = pending;
        setPlaybackCursor(pending);
      }
    });
  };

  const queuePlayModeEvent = (note, hand, whenSec = null) => {
    if (!isShowPlayModeRef.current || !note) return;

    const nowSec = getAudioCurrentTime ? getAudioCurrentTime() : 0;
    const delayMs = whenSec == null ? 0 : Math.max(0, Math.round((whenSec - nowSec) * 1000));
    const dispatchEvent = () => window.dispatchEvent(new CustomEvent('tme-note-played', { detail: { note, hand } }));

    if (delayMs <= 0) {
      dispatchEvent();
    } else {
      effectTimersRef.current.push(setTimeout(dispatchEvent, delayMs));
    }
  };

  const scheduleResolvedInstrumentNote = (noteStr, vol, whenSec, options = {}) => {
    if (!noteStr || noteStr === '-') return;

    const { bypassOctaveLayer = false, hand = 'single', overrideInstId = null } = options;
    const actualNoteToPlay = isReduceModeRef.current ? shiftNoteString(noteStr, -1) : noteStr;
    
    // ⭐ เช็กว่ามีการระบุเครื่องดนตรีเฉพาะกิจมาไหม ถ้ามีใช้ตัวนั้น ถ้าไม่มีค่อยใช้ของทั้งเพลง
    const inst = overrideInstId && INSTRUMENT_CONFIG[overrideInstId] ? INSTRUMENT_CONFIG[overrideInstId] : currentInstrumentRef.current;
    
    const safeWhen = Math.max((getAudioCurrentTime ? getAudioCurrentTime() : 0) + 0.015, whenSec ?? 0);

    if (!bypassOctaveLayer && intervalModeRef.current !== 'off') {
      const { left, right } = getIntervalPair(inst, actualNoteToPlay, intervalModeRef.current);

      if (left && right) {
        if (left === right) {
          scheduleNote(inst.id, left, safeWhen, vol);
          queuePlayModeEvent(left, hand, safeWhen);
        } else {
          scheduleNote(inst.id, left, safeWhen, vol);
          scheduleNote(inst.id, right, safeWhen, vol);
          queuePlayModeEvent(left, 'left', safeWhen);
          queuePlayModeEvent(right, 'right', safeWhen);
        }
        return;
      }
    }

    scheduleNote(inst.id, actualNoteToPlay, safeWhen, vol);
    queuePlayModeEvent(actualNoteToPlay, hand, safeWhen);
  };

  const playResolvedInstrumentNote = (noteStr, vol, options = {}) => {
    if (!noteStr || noteStr === '-') return;
    const nowSec = getAudioCurrentTime ? getAudioCurrentTime() : 0;
    scheduleResolvedInstrumentNote(noteStr, vol, nowSec + 0.02, options);
  };

  const previewCellToken = (token, baseVolume = layoutConfigRef.current.volume ?? 100, previewGapMs = 90) => {
    const events = parseCellToken(token, 'flat'); 
    if (events.length === 0) return;

    // ⭐ ดึงเครื่องดนตรีเฉพาะกิจของช่องปัจจุบัน (ถ้ามี) มาใช้พรีวิวเสียง
    let overrideInstId = null;
    if (selectedCellRef.current) {
      const [r, m, c] = selectedCellRef.current;
      overrideInstId = layoutConfigRef.current.customStyles?.[`${r}_${m}_${c}`]?.instrumentId || null;
    }

    events.forEach((event, index) => {
      const delay = events.length === 1 ? 0 : Math.max(0, Math.floor(index * previewGapMs));
      const volume = Math.max(0, Math.round(baseVolume * (event.emphasis ?? 1)));
      
      // ⭐ แนบเครื่องดนตรีเฉพาะกิจส่งไปให้ฟังก์ชันเล่นเสียงด้วย
      const playEvent = () => playResolvedInstrumentNote(event.note, volume, { hand: 'single', overrideInstId }); 

      if (delay <= 0) playEvent();
      else effectTimersRef.current.push(setTimeout(playEvent, delay));
    });
  };

  const updateCellToken = (row, meas, cell, token, options = {}) => {
    if (isReadOnlyRef.current) return;
    if (rowTypes[row] === 'page-break' || rowTypes[row] === 'text' || (rowTypes[row].startsWith('double') && meas === 0)) return;

    const normalizedToken = normalizeCellToken(token);
    const newData = sheetData.map((rowData) => rowData.map((measure) => [...measure]));

    if (intervalModeRef.current !== 'off' && rowTypes[row].startsWith('double')) {
        const isRightRow = rowTypes[row] === 'double-right';
        const rightRowIdx = isRightRow ? row : row - 1; 
        const leftRowIdx = isRightRow ? row + 1 : row;  

        if (normalizedToken === '-') {
            newData[rightRowIdx][meas][cell] = '-';
            newData[leftRowIdx][meas][cell] = '-';
        } else {
            const parts = splitThaiNoteToken(normalizedToken);
            const leftParts = [];
            const rightParts = [];
            parts.forEach(n => {
                const actualNote = isReduceModeRef.current ? shiftNoteString(n, -1) : n;
                const { left, right } = getIntervalPair(currentInstrument, actualNote, intervalModeRef.current);
                leftParts.push(isReduceModeRef.current ? shiftNoteString(left, 1) : left);
                rightParts.push(isReduceModeRef.current ? shiftNoteString(right, 1) : right);
            });
            newData[leftRowIdx][meas][cell] = leftParts.join('');
            newData[rightRowIdx][meas][cell] = rightParts.join('');
        }
    } else {
        newData[row][meas][cell] = normalizedToken;
    }

    commitChange(newData);
    setSelectionRange(null);
    if (options.keepSelection !== false) setSelectedCell([row, meas, cell]);
    if (options.preview !== false && normalizedToken !== '-') {
      previewCellToken(normalizedToken, options.volume ?? (layoutConfigRef.current.volume ?? 100));
    }
  };

  const moveSelectionToAdjacentCell = (direction = 'next') => {
    if (!selectedCell) return;
    let [row, meas, cell] = selectedCell;
    const isNext = direction !== 'prev';

    if (isNext) {
      if (cell < sheetData[row][meas].length - 1) cell += 1;
      else if (meas < sheetData[row].length - 1) { meas += 1; if (rowTypes[row].startsWith('double') && meas === 0) meas = 1; cell = 0; }
      else {
        let nextR = row + 1;
        while (nextR < sheetData.length && (rowTypes[nextR] === 'page-break' || rowTypes[nextR] === 'text')) nextR++;
        if (nextR >= sheetData.length) return;
        row = nextR; meas = rowTypes[row].startsWith('double') ? 1 : 0; cell = 0;
      }
    } else {
      if (cell > 0) cell -= 1;
      else if (meas > (rowTypes[row].startsWith('double') ? 1 : 0)) { meas -= 1; cell = sheetData[row][meas].length - 1; }
      else {
        let prevR = row - 1;
        while (prevR >= 0 && (rowTypes[prevR] === 'page-break' || rowTypes[prevR] === 'text')) prevR--;
        if (prevR < 0) return;
        row = prevR; meas = sheetData[row].length - 1;
        if (rowTypes[row].startsWith('double') && meas === 0) meas = 1;
        cell = sheetData[row][meas].length - 1;
      }
    }

    setSelectionRange(null);
    setSelectedCell([row, meas, cell]);
  };

  const moveSelectionNext = () => moveSelectionToAdjacentCell('next');
  const moveSelectionPrev = () => moveSelectionToAdjacentCell('prev');

  const appendNoteToCurrentCell = (note, options = {}) => {
    if (isReadOnlyRef.current || !selectedCell) return;
    const [row, meas, cell] = selectedCell;
    if (rowTypes[row] === 'page-break' || rowTypes[row] === 'text' || (rowTypes[row].startsWith('double') && meas === 0)) return;

    const incomingParts = splitThaiNoteToken(note);
    if (incomingParts.length === 0) return;

    const newData = sheetData.map((rowData) => rowData.map((measure) => [...measure]));
    const currentToken = normalizeCellToken(newData[row][meas][cell]);
    const currentParts = currentToken === '-' ? [] : splitThaiNoteToken(currentToken);
    const mergedToken = normalizeCellToken([...currentParts, ...incomingParts].join(''));

    if (intervalModeRef.current !== 'off' && rowTypes[row].startsWith('double')) {
        const isRightRow = rowTypes[row] === 'double-right';
        const rightRowIdx = isRightRow ? row : row - 1;
        const leftRowIdx = isRightRow ? row + 1 : row;

        const parts = splitThaiNoteToken(mergedToken);
        const leftParts = [];
        const rightParts = [];
        parts.forEach(n => {
            const actualNote = isReduceModeRef.current ? shiftNoteString(n, -1) : n;
            const { left, right } = getIntervalPair(currentInstrument, actualNote, intervalModeRef.current);
            leftParts.push(isReduceModeRef.current ? shiftNoteString(left, 1) : left);
            rightParts.push(isReduceModeRef.current ? shiftNoteString(right, 1) : right);
        });
        newData[leftRowIdx][meas][cell] = leftParts.join('');
        newData[rightRowIdx][meas][cell] = rightParts.join('');
    } else {
        newData[row][meas][cell] = mergedToken;
    }

    commitChange(newData);
    setSelectionRange(null);
    if (options.keepSelection !== false) setSelectedCell([row, meas, cell]);
    if (options.preview !== false && mergedToken !== '-') {
      previewCellToken(mergedToken, options.volume ?? (layoutConfigRef.current.volume ?? 100));
    }
    if (options.moveNext) setTimeout(() => moveSelectionToAdjacentCell('next'), 0);
  };

  const trimCurrentCellToken = () => {
    if (isReadOnlyRef.current || !selectedCell) return;
    const [row, meas, cell] = selectedCell;
    if (rowTypes[row] === 'page-break' || rowTypes[row] === 'text' || (rowTypes[row].startsWith('double') && meas === 0)) return;

    const currentToken = normalizeCellToken(sheetData[row][meas][cell]);
    if (currentToken === '-') return;

    const currentParts = splitThaiNoteToken(currentToken);
    const nextToken = currentParts.length <= 1 ? '-' : currentParts.slice(0, -1).join('');

    const newData = sheetData.map((rowData) => rowData.map((measure) => [...measure]));

    if (intervalModeRef.current !== 'off' && rowTypes[row].startsWith('double')) {
        const isRightRow = rowTypes[row] === 'double-right';
        const rightRowIdx = isRightRow ? row : row - 1;
        const leftRowIdx = isRightRow ? row + 1 : row;

        if (nextToken === '-') {
            newData[leftRowIdx][meas][cell] = '-';
            newData[rightRowIdx][meas][cell] = '-';
        } else {
            const parts = splitThaiNoteToken(nextToken);
            const leftParts = [];
            const rightParts = [];
            parts.forEach(n => {
                const actualNote = isReduceModeRef.current ? shiftNoteString(n, -1) : n;
                const { left, right } = getIntervalPair(currentInstrument, actualNote, intervalModeRef.current);
                leftParts.push(isReduceModeRef.current ? shiftNoteString(left, 1) : left);
                rightParts.push(isReduceModeRef.current ? shiftNoteString(right, 1) : right);
            });
            newData[leftRowIdx][meas][cell] = leftParts.join('');
            newData[rightRowIdx][meas][cell] = rightParts.join('');
        }
    } else {
        newData[row][meas][cell] = nextToken;
    }

    commitChange(newData);
  };

  const [headerDetails, setHeaderDetails] = useState(createDefaultHeaderDetails);

  // preload เสียงของเครื่องดนตรีที่เลือกไว้ล่วงหน้า โดยไม่บังคับเปิดคู่ 8 อัตโนมัติ
  useEffect(() => {
    if (currentInstrument && currentInstrument.id) {
      preloadSounds(currentInstrument.id);
    }
  }, [currentInstrument]);

  const availableSections = useMemo(() => {
    const labels = new Set();
    Object.values(sectionLabels).forEach(arr => {
      arr.forEach(l => {
       if (l.text && l.text.trim() !== '') labels.add(l.text.trim());
      });
    });
    return Array.from(labels);
  }, [sectionLabels]);



  const getCellId = (r, m, c) => r * 100000 + m * 1000 + c;

  const startPlayback = async () => {
    if (isPlayingRef.current) return;
    if (initAudioContext) await initAudioContext();

    const currentInstId = currentInstrumentRef.current?.id;
    if (currentInstId) {
      preloadSounds(currentInstId).catch(() => {});
    }
    if (preloadAllSounds) {
      preloadAllSounds().catch(() => {});
    }

    setIsPlaying(true);
    isPlayingRef.current = true;

    const currentSheetData = sheetDataRef.current;
    const currentRowTypes = rowTypesRef.current;
    const currentSectionLabels = sectionLabelsRef.current;
    const sheetSections = [];
    let lastValidRow = 0;
    let lastProcessedVIdx = -1;

    for (let r = 0; r < currentSheetData.length; r++) {
      if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') continue;
      const vIdx = getVisualIndex(r, currentRowTypes);
      const labels = currentSectionLabels[vIdx] || [];
      const validLabels = labels.filter(l => l.text && l.text.trim() !== '');

      if (validLabels.length > 0 && vIdx !== lastProcessedVIdx) {
        if (sheetSections.length > 0) sheetSections[sheetSections.length - 1].endRow = lastValidRow;
        sheetSections.push({ label: validLabels[0].text.trim(), startRow: r, endRow: currentSheetData.length - 1 });
        lastProcessedVIdx = vIdx;
      }
      lastValidRow = r;
      if (currentRowTypes[r] === 'double-right') lastValidRow = r + 1;
    }
    if (sheetSections.length > 0) sheetSections[sheetSections.length - 1].endRow = lastValidRow;
    sheetMapRef.current = sheetSections;

    let calcTotalMs = 0;
    const currentBpm = layoutConfigRef.current.bpm || 80;
    playbackSequenceRef.current.forEach(seqItem => {
      const section = sheetSections.find(s => s.label === seqItem.label.trim());
      if (section) {
        let sectionMs = 0;
        for (let r = section.startRow; r <= section.endRow; r++) {
          if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'double-left' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') continue;
          for (let m = 0; m < currentSheetData[r].length; m++) {
            if (currentRowTypes[r].startsWith('double') && m === 0) continue;
            const cellCount = currentSheetData[r][m].length;
            if (cellCount > 0) sectionMs += (15000 / currentBpm) * 4;
          }
        }
        calcTotalMs += (sectionMs * seqItem.loops);
      }
    });

    const totalSeconds = Math.floor(calcTotalMs / 1000);
    setTotalTime(totalSeconds);
    setCurrentTime(Math.floor(seekOffsetRef.current));

    playbackStartTimeRef.current = performance.now() - (seekOffsetRef.current * 1000);
    if (uiTimerRef.current) clearInterval(uiTimerRef.current);
    uiTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((performance.now() - playbackStartTimeRef.current) / 1000);
      setCurrentTime(Math.min(elapsed, totalSeconds));
    }, 250);

    if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    if (schedulerIntervalRef.current) clearInterval(schedulerIntervalRef.current);
    effectTimersRef.current.forEach(t => clearTimeout(t));
    effectTimersRef.current = [];
    mutedCellsRef.current.clear();
    schedulerStateRef.current = null;
    nextNoteTimeRef.current = 0;
    runAudioSchedulerRef.current = null;
    stopAllScheduledNotes?.();

    let currentCursor = [...selectedCellRef.current];
    let startR = currentCursor[0];

    if (currentRowTypes[startR] === 'double-left') { startR -= 1; currentCursor[0] = startR; }
    if (currentRowTypes[startR]?.startsWith('double') && currentCursor[1] === 0) currentCursor[1] = 1;

    let startSeqIdx = 0;
    const currentMappedSection = sheetSections.find(s => startR >= s.startRow && startR <= s.endRow);
    if (currentMappedSection) {
      const foundIdx = playbackSequenceRef.current.findIndex(seq => seq.label.trim() === currentMappedSection.label);
      if (foundIdx !== -1) startSeqIdx = foundIdx;
    }

    if (seekOffsetRef.current > 0) {
      setActiveSequenceIdx(activeSequenceIdxRef.current);
      setActiveLoop(activeLoopRef.current);
    } else {
      activeSequenceIdxRef.current = startSeqIdx;
      activeLoopRef.current = 1;
      setActiveSequenceIdx(startSeqIdx);
      setActiveLoop(1);
    }

    const scheduleUiChange = (cb, whenSec) => {
      const nowSec = getAudioCurrentTime ? getAudioCurrentTime() : 0;
      const delayMs = Math.max(0, Math.round((whenSec - nowSec) * 1000));
      effectTimersRef.current.push(setTimeout(() => {
        if (isPlayingRef.current) cb();
      }, delayMs));
    };

    const getCellVolume = (r, m, c, subIdx, baseVol) => {
      const customStyles = layoutConfigRef.current.customStyles || {};
      const cellStyle = customStyles[`${r}_${m}_${c}_${subIdx}`] || customStyles[`${r}_${m}_${c}`];
      if (cellStyle && cellStyle.velocity !== undefined) {
        return Math.round(baseVol * (cellStyle.velocity / 100));
      }
      return baseVol;
    };

    const scheduleTokenPlayback = (tokenStr, baseVol, cellDurationMs, baseDelayMs = 0, options = {}, targetR, targetM, targetC, cellStartSec) => {
      const tokenEvents = parseCellToken(tokenStr, 'flat');
      if (tokenEvents.length === 0) return;

      // ⭐ แอบไปดูว่าโน้ตช่องนี้โดนคลุมดำแล้วเปลี่ยนเครื่องดนตรีฝังไว้หรือเปล่า
      const customStyles = layoutConfigRef.current.customStyles || {};
      const overrideInstId = customStyles[`${targetR}_${targetM}_${targetC}`]?.instrumentId || null;

      tokenEvents.forEach((event, subIdx) => {
        const eventDelayMs = Math.max(0, Math.floor(baseDelayMs + (cellDurationMs * (event.ratio ?? 0))));
        const eventVolume = getCellVolume(targetR, targetM, targetC, subIdx, baseVol);
        if (eventVolume > 0) {
          // ⭐ แปะเครื่องดนตรีนี้ส่งไปให้ Audio Engine เล่นด้วย
          scheduleResolvedInstrumentNote(event.note, eventVolume, cellStartSec + (eventDelayMs / 1000), { ...options, overrideInstId });
        }
      });
    };

    const scheduleSymbolPlayback = (sym, events, timeUntilEnd, cellStartSec) => {
      if (sym.type === 'kro') {
        let noteRightStr = null;
        let noteLeftStr = null;
        const firstColNotes = events[0] || [];

        // ⭐ ดึงเครื่องดนตรีเฉพาะกิจสำหรับลูกกรอ
        let overrideInstId = null;
        if (firstColNotes.length > 0) {
           const customStyles = layoutConfigRef.current.customStyles || {};
           overrideInstId = customStyles[`${firstColNotes[0].r}_${firstColNotes[0].m}_${firstColNotes[0].c}`]?.instrumentId || null;
        }

        if (firstColNotes.length >= 2) {
          noteRightStr = firstColNotes[0].note && firstColNotes[0].note !== '-' ? firstColNotes[0].note : null;
          noteLeftStr = firstColNotes[1].note && firstColNotes[1].note !== '-' ? firstColNotes[1].note : null;
          if (!noteRightStr && noteLeftStr) noteRightStr = noteLeftStr;
          if (!noteLeftStr && noteRightStr) noteLeftStr = noteRightStr;
        } else if (firstColNotes.length === 1) {
          const noteA = firstColNotes[0].note && firstColNotes[0].note !== '-' ? firstColNotes[0].note : null;
          if (noteA) {
            const actualA = isReduceModeRef.current ? shiftNoteString(noteA, -1) : noteA;
            const inst = currentInstrumentRef.current;
            const intervalVal = intervalModeRef.current !== 'off' ? intervalModeRef.current : '8';
            const { left, right } = getIntervalPair(inst, actualA, intervalVal);
            noteLeftStr = isReduceModeRef.current ? shiftNoteString(left, 1) : left;
            noteRightStr = isReduceModeRef.current ? shiftNoteString(right, 1) : right;
          }
        }

        if (noteRightStr && noteLeftStr) {
          const kroSpeed = Math.max(20, sym.speed ?? layoutConfigRef.current.kroSpeed ?? 65);
          const startHand = sym.starthand ?? layoutConfigRef.current.kroStartHand ?? 'right';
          for (let offsetMs = 0, beatIdx = 0; offsetMs <= timeUntilEnd; offsetMs += kroSpeed, beatIdx++) {
            const currentHand = beatIdx % 2 === 0
              ? (startHand === 'left' ? 'left' : 'right')
              : (startHand === 'left' ? 'right' : 'left');
            const noteToPlay = currentHand === 'right' ? noteRightStr : noteLeftStr;
            scheduleResolvedInstrumentNote(noteToPlay, layoutConfigRef.current.volume ?? 100, cellStartSec + (offsetMs / 1000), { bypassOctaveLayer: true, hand: currentHand, overrideInstId });
          }
        }
        return;
      }

      const totalDurationMs = timeUntilEnd > 0 ? timeUntilEnd : 1;
      const stepCount = events.length;

      if (stepCount === 1) {
        events[0].forEach(nData => {
          const vol = getCellVolume(nData.r, nData.m, nData.c, nData.subIdx, layoutConfigRef.current.volume ?? 100);
          const customStyles = layoutConfigRef.current.customStyles || {};
          const overrideInstId = customStyles[`${nData.r}_${nData.m}_${nData.c}`]?.instrumentId || null;

          if (vol > 0) {
            scheduleResolvedInstrumentNote(nData.note, vol, cellStartSec, { hand: 'single', overrideInstId });
          }
        });
      } else if (stepCount > 1) {
        const intervalMs = totalDurationMs / (stepCount - 1);
        events.forEach((chord, stepIdx) => {
          const playTimeMs = stepIdx * intervalMs;
          chord.forEach(nData => {
            const vol = getCellVolume(nData.r, nData.m, nData.c, nData.subIdx, layoutConfigRef.current.volume ?? 100);
            const customStyles = layoutConfigRef.current.customStyles || {};
            const overrideInstId = customStyles[`${nData.r}_${nData.m}_${nData.c}`]?.instrumentId || null;

            if (vol > 0) {
              scheduleResolvedInstrumentNote(nData.note, vol, cellStartSec + (playTimeMs / 1000), { hand: 'single', overrideInstId });
            }
          });
        });
      }
    };

    const scheduleCell = (r, m, c, cellStartSec) => {
  if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') return 0;

      const cellCountInMeasure = currentSheetData[r][m].length;
      const standardMsPerCell = 15000 / (layoutConfigRef.current.bpm || 80);
      const msPerCell = Math.floor(standardMsPerCell * (4 / cellCountInMeasure));

      scheduleUiChange(() => schedulePlaybackCursorUpdate([r, m, c]), cellStartSec);

      // ⭐ ดักจับ: ถ้าช่องนี้เป็นช่องสำหรับพิมพ์ข้อความ ให้ข้ามการเล่นเสียงไปเลย
      const firstItem = currentSheetData[r][m][0];
      const isTextMeasure = typeof firstItem === 'string' && (firstItem.startsWith('@TEXT_SPAN_') || firstItem === '@HIDDEN');
      
      if (isTextMeasure) {
        return msPerCell; // คืนค่าเวลาเพื่อให้ Cursor เดินต่อไป แต่ข้ามการสร้างเสียง 100%
      }

      const cellsToCheck = [[r, m, c]];
      if (currentRowTypes[r] === 'double-right') cellsToCheck.push([r + 1, m, c]);
      else if (currentRowTypes[r] === 'double-left') cellsToCheck.push([r - 1, m, c]);

      const processedSymbols = new Set();
      const currentSymbols = symbolsRef.current;

      cellsToCheck.forEach(cell => {
        const [cr, cm, cc] = cell;
        const startingSymbols = currentSymbols.filter(s => {
          let sStart = [...s.start];
          let sEnd = [...s.end];
          if (currentRowTypes[sStart[0]] === 'double-left') sStart[0] -= 1;
          if (currentRowTypes[sEnd[0]] === 'double-left') sEnd[0] -= 1;
          const startIdx = sStart[0] * 1000 + sStart[1] * 10 + sStart[2];
          const endIdx = sEnd[0] * 1000 + sEnd[1] * 10 + sEnd[2];
          let normalizedCr = cr;
          if (currentRowTypes[cr] === 'double-left') normalizedCr -= 1;
          const currentIdx = normalizedCr * 1000 + cm * 10 + cc;
          return currentIdx === Math.min(startIdx, endIdx);
        });

        startingSymbols.forEach(sym => {
          if (processedSymbols.has(sym.id)) return;
          processedSymbols.add(sym.id);

          let startPos = [...sym.start];
          let endPos = [...sym.end];
          if (currentRowTypes[startPos[0]] === 'double-left') startPos[0] -= 1;
          if (currentRowTypes[endPos[0]] === 'double-left') endPos[0] -= 1;
          const startAbs = startPos[0] * 1000 + startPos[1] * 10 + startPos[2];
          const endAbs = endPos[0] * 1000 + endPos[1] * 10 + endPos[2];
          if (startAbs > endAbs) {
            const temp = startPos;
            startPos = endPos;
            endPos = temp;
          }

          let currR = startPos[0];
          let currM = startPos[1];
          let currC = startPos[2];
          const endR = endPos[0];
          const endM = endPos[1];
          const endC = endPos[2];

          let events = [];
          let cellIds = [];
          let dist = 0;
          let failSafe = 0;

          while (failSafe < 500) {
            const stepRowType = currentRowTypes[currR];
            let colNotesData = [];
            if (stepRowType && stepRowType.startsWith('double')) {
              const stepTop = stepRowType === 'double-left' ? currR - 1 : currR;
              const stepBot = stepTop + 1;
              const noteTop = currentSheetData[stepTop]?.[currM]?.[currC];
              const noteBot = currentSheetData[stepBot]?.[currM]?.[currC];

              const topParts = splitThaiNoteToken(noteTop || '-');
              const botParts = splitThaiNoteToken(noteBot || '-');
              const maxParts = Math.max(topParts.length, botParts.length);

              for (let s = 0; s < maxParts; s++) {
                const currentChord = [];
                if (topParts[s] && topParts[s] !== '-') currentChord.push({ note: topParts[s], r: stepTop, m: currM, c: currC, subIdx: s });
                if (botParts[s] && botParts[s] !== '-') currentChord.push({ note: botParts[s], r: stepBot, m: currM, c: currC, subIdx: s });
                if (currentChord.length > 0) colNotesData.push(currentChord);
              }
              cellIds.push(getCellId(stepTop, currM, currC));
              cellIds.push(getCellId(stepBot, currM, currC));
            } else {
              const note = currentSheetData[currR]?.[currM]?.[currC];
              const parts = splitThaiNoteToken(note || '-');
              parts.forEach((p, s) => {
                if (p && p !== '-') colNotesData.push([{ note: p, r: currR, m: currM, c: currC, subIdx: s }]);
              });
              cellIds.push(getCellId(currR, currM, currC));
            }

            if (colNotesData.length > 0) events.push(...colNotesData);

            if (currR === endR && currM === endM && currC === endC) break;
            dist += 1;
            currC += 1;
            const currentMeasureLength = currentSheetData[currR]?.[currM]?.length ?? 0;
            if (currC >= currentMeasureLength) {
              currC = 0;
              currM += 1;
              if (currM >= (currentSheetData[currR]?.length ?? 0)) {
                let tempR = currR + 1;
                while (tempR < currentSheetData.length && (currentRowTypes[tempR] === 'page-break' || currentRowTypes[tempR] === 'text' || currentRowTypes[tempR] === 'double-left')) tempR++;
                if (tempR >= currentSheetData.length) break;
                currR = tempR;
                currM = currentRowTypes[currR]?.startsWith('double') ? 1 : 0;
              }
            }
            failSafe += 1;
          }

          cellIds.forEach(id => mutedCellsRef.current.add(id));
          const timeUntilEnd = dist * msPerCell;
          if (events.length > 0) {
            scheduleSymbolPlayback(sym, events, timeUntilEnd, cellStartSec);
          }
        });
      });

      if (currentRowTypes[r] === 'double-right') {
        const rightToken = currentSheetData[r][m][c];
        const leftToken = currentSheetData[r + 1] ? currentSheetData[r + 1][m][c] : '-';
        const rightCellId = getCellId(r, m, c);
        const leftCellId = getCellId(r + 1, m, c);

        if (!mutedCellsRef.current.has(rightCellId)) {
          scheduleTokenPlayback(rightToken, layoutConfigRef.current.volume ?? 100, msPerCell, 0, { hand: 'right', bypassOctaveLayer: true }, r, m, c, cellStartSec);
        }
        if (!mutedCellsRef.current.has(leftCellId)) {
          scheduleTokenPlayback(leftToken, layoutConfigRef.current.volume ?? 100, msPerCell, 0, { hand: 'left', bypassOctaveLayer: true }, r + 1, m, c, cellStartSec);
        }
      } else if (!mutedCellsRef.current.has(getCellId(r, m, c))) {
        scheduleTokenPlayback(currentSheetData[r][m][c], layoutConfigRef.current.volume ?? 100, msPerCell, 0, { hand: 'single' }, r, m, c, cellStartSec);
      }

      return msPerCell;
    };

    const advanceCursor = (r, m, c, scheduledAtSec) => {
      let nextC = c + 1;
      let nextM = m;
      let nextR = r;

      if (nextC >= currentSheetData[r][m].length) {
        nextC = 0;
        nextM += 1;

        if (nextM >= currentSheetData[r].length) {
          nextM = 0;
          const seq = playbackSequenceRef.current;
          const currSeqIdx = activeSequenceIdxRef.current;
          const map = sheetMapRef.current;
          let isEndOfSection = false;
          let currentItem = null;
          let currentMappedSectionForAdvance = null;

          if (seq && seq.length > 0 && currSeqIdx < seq.length) {
            currentItem = seq[currSeqIdx];
            currentMappedSectionForAdvance = map.find(s => s.label === currentItem.label.trim());
            const rowCoverage = currentRowTypes[r] === 'double-right' ? r + 1 : r;
            if (currentMappedSectionForAdvance && rowCoverage >= currentMappedSectionForAdvance.endRow) isEndOfSection = true;
          }

          if (isEndOfSection && currentItem && currentMappedSectionForAdvance) {
            if (isLoopOneRef.current) {
              nextR = currentMappedSectionForAdvance.startRow;
              nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
              nextC = 0;

              let sectionMs = 0;
              for (let sr = currentMappedSectionForAdvance.startRow; sr <= currentMappedSectionForAdvance.endRow; sr++) {
                if (currentRowTypes[sr] === 'page-break' || currentRowTypes[sr] === 'text' || currentRowTypes[sr] === 'double-left' || currentRowTypes[sr] === 'annotation' || currentRowTypes[sr] === 'nathap') continue;
                for (let sm = 0; sm < currentSheetData[sr].length; sm++) {
                  if (currentRowTypes[sr].startsWith('double') && sm === 0) continue;
                  const cellCount = currentSheetData[sr][sm].length;
                  if (cellCount > 0) sectionMs += (15000 / currentBpm) * 4;
                }
              }
              playbackStartTimeRef.current += sectionMs;
            } else if (activeLoopRef.current < currentItem.loops) {
              const nextLoop = activeLoopRef.current + 1;
              scheduleUiChange(() => {
                activeLoopRef.current = nextLoop;
                setActiveLoop(nextLoop);
              }, scheduledAtSec);
              nextR = currentMappedSectionForAdvance.startRow;
              nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
              nextC = 0;
            } else {
              const nextSeqIdx = currSeqIdx + 1;
              if (nextSeqIdx < seq.length) {
                scheduleUiChange(() => {
                  activeSequenceIdxRef.current = nextSeqIdx;
                  setActiveSequenceIdx(nextSeqIdx);
                  activeLoopRef.current = 1;
                  setActiveLoop(1);
                }, scheduledAtSec);
                const nextMappedSection = map.find(s => s.label === seq[nextSeqIdx].label.trim());
                if (nextMappedSection) {
                  nextR = nextMappedSection.startRow;
                  nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
                  nextC = 0;
                } else {
                  return null;
                }
              } else if (isLoopAllRef.current && seq.length > 0) {
                scheduleUiChange(() => {
                  activeSequenceIdxRef.current = 0;
                  setActiveSequenceIdx(0);
                  activeLoopRef.current = 1;
                  setActiveLoop(1);
                }, scheduledAtSec);
                const firstMappedSection = map.find(s => s.label === seq[0].label.trim());
                if (firstMappedSection) {
                  nextR = firstMappedSection.startRow;
                  nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
                  nextC = 0;
                  seekOffsetRef.current = 0;
                  playbackStartTimeRef.current = performance.now();
                } else {
                  return null;
                }
              } else {
                return null;
              }
            }
          } else {
            nextR = currentRowTypes[r] === 'double-right' ? r + 2 : r + 1;
            // ⭐ สั่งให้กระโดดข้ามบรรทัดคำอธิบายและข้อความอัตโนมัติ ไม่ให้ Cursor ไปค้าง
            while (nextR < currentSheetData.length && (currentRowTypes[nextR] === 'page-break' || currentRowTypes[nextR] === 'text' || currentRowTypes[nextR] === 'annotation' || currentRowTypes[nextR] === 'nathap')) {
              nextR++;
            }
            if (nextR >= currentSheetData.length) return null;
            nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
          }
        }
      }

      return { r: nextR, m: nextM, c: nextC };
    };

    const audioStartSec = (getAudioCurrentTime ? getAudioCurrentTime() : 0) + 0.08;
    schedulerStateRef.current = { r: currentCursor[0], m: currentCursor[1], c: currentCursor[2] };
    nextNoteTimeRef.current = audioStartSec;

    runAudioSchedulerRef.current = () => {
      if (!isPlayingRef.current) return;

      const scheduleAheadSec = isPageHiddenRef.current ? 8 : 1.5;
      const schedulingHorizon = (getAudioCurrentTime ? getAudioCurrentTime() : 0) + scheduleAheadSec;

      while (schedulerStateRef.current && nextNoteTimeRef.current < schedulingHorizon) {
        const { r, m, c } = schedulerStateRef.current;
        const msPerCell = scheduleCell(r, m, c, nextNoteTimeRef.current);
        const scheduledAtSec = nextNoteTimeRef.current + ((msPerCell || 0) / 1000);
        const nextState = advanceCursor(r, m, c, scheduledAtSec);
        nextNoteTimeRef.current = scheduledAtSec;
        schedulerStateRef.current = nextState;

        if (!nextState) {
          const stopDelayMs = Math.max(0, Math.round((nextNoteTimeRef.current - (getAudioCurrentTime ? getAudioCurrentTime() : 0)) * 1000) + 120);
          if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
          playbackTimerRef.current = setTimeout(() => stopPlayback({ clearScheduled: false }), stopDelayMs);
          break;
        }
      }
    };

    schedulerIntervalRef.current = setInterval(() => {
      if (runAudioSchedulerRef.current) runAudioSchedulerRef.current();
    }, 100);

    runAudioSchedulerRef.current();
  };

  const stopPlayback = (options = {}) => {
    const { preserveSeek = false, clearScheduled = true } = options;

    setIsPlaying(false);
    isPlayingRef.current = false;
    pendingPlaybackCursorRef.current = null;

    if (playbackCursorRafRef.current) {
      cancelAnimationFrame(playbackCursorRafRef.current);
      playbackCursorRafRef.current = null;
    }

    playbackCursorRef.current = null;
    setPlaybackCursor(null);

    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (schedulerIntervalRef.current) {
      clearInterval(schedulerIntervalRef.current);
      schedulerIntervalRef.current = null;
    }

    runAudioSchedulerRef.current = null;
    schedulerStateRef.current = null;
    nextNoteTimeRef.current = 0;

    effectTimersRef.current.forEach(t => clearTimeout(t));
    effectTimersRef.current = [];
    mutedCellsRef.current.clear();

    if (window.kroInterval) {
      clearInterval(window.kroInterval);
      window.kroInterval = null;
    }

    if (uiTimerRef.current) {
      clearInterval(uiTimerRef.current);
      uiTimerRef.current = null;
    }

    if (clearScheduled) {
      stopAllScheduledNotes?.();
    }

    if (!preserveSeek) {
      seekOffsetRef.current = 0;
      setCurrentTime(0);
    }
  };

  const startSelection = (r, m, c) => { setIsDragging(true); setDragStart([r, m, c]); setSelectionRange({ start: [r, m, c], end: [r, m, c] }); setSelectedCell([r, m, c]); };
  const updateSelection = (r, m, c) => { if (isDragging && dragStart) setSelectionRange({ start: dragStart, end: [r, m, c] }); };
  const endSelection = () => { setIsDragging(false); setDragStart(null); };

  const copySelection = async () => {
    if (!selectionRange) return;
    const { start: [sr, sm, sc], end: [er, em, ec] } = selectionRange;
    const minR = Math.min(sr, er), maxR = Math.max(sr, er);
    const startCol = getFlattenedCol(sheetData[sr], rowTypes[sr], sm, sc);
    const endCol = getFlattenedCol(sheetData[er], rowTypes[er], em, ec);
    const minCol = Math.min(startCol, endCol), maxCol = Math.max(startCol, endCol);

    const copiedBlock = [];
    for (let r = minR; r <= maxR; r++) {
      if (rowTypes[r] === 'page-break' || rowTypes[r] === 'text') continue;
      const rowData = []; let currentCol = 0;
      for (let m = 0; m < sheetData[r].length; m++) {
        if (rowTypes[r].startsWith('double') && m === 0) continue;
        for (let c = 0; c < sheetData[r][m].length; c++) {
          if (currentCol >= minCol && currentCol <= maxCol) {
            rowData.push(sheetData[r][m][c]);
          }
          currentCol++;
        }
      }
      if (rowData.length > 0) copiedBlock.push({ rowOffset: r - minR, cells: rowData });
    }

    const copiedSymbols = [];
    symbols.forEach(sym => {
        const symStartCol = getFlattenedCol(sheetData[sym.start[0]], rowTypes[sym.start[0]], sym.start[1], sym.start[2]);
        const symEndCol = getFlattenedCol(sheetData[sym.end[0]], rowTypes[sym.end[0]], sym.end[1], sym.end[2]);
        const sR = sym.start[0], eR = sym.end[0];

        if (sR >= minR && sR <= maxR && eR >= minR && eR <= maxR &&
            symStartCol >= minCol && symStartCol <= maxCol &&
            symEndCol >= minCol && symEndCol <= maxCol) {
            
            copiedSymbols.push({
                ...sym,
                startRelR: sR - minR,
                startRelCol: symStartCol - minCol,
                endRelR: eR - minR,
                endRelCol: symEndCol - minCol
            });
        }
    });

    const payload = { block: copiedBlock, symbols: copiedSymbols };
    setClipboardData(payload); // สำรองไว้ใน State

    // ⭐ อัปเกรด: ส่งข้อมูลยัดลง System Clipboard ของเครื่องคอมพิวเตอร์
    try {
      const payloadString = JSON.stringify({ type: 'TME_CLIPBOARD', data: payload });
      await navigator.clipboard.writeText(payloadString);
    } catch (err) {
      console.warn("ไม่สามารถคัดลอกลง Clipboard ของระบบได้", err);
    }

    setSelectionRange(null); 
  };

  const pasteSelection = async () => {
    if (isReadOnlyRef.current) return; 
    
    let payload = clipboardData; // ใช้ค่าเดิมใน State เป็นตัวสำรอง

    // ⭐ อัปเกรด: พยายามดึงข้อมูลจาก System Clipboard ของเครื่องคอมพิวเตอร์ก่อน
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && parsed.type === 'TME_CLIPBOARD') {
          payload = parsed.data; // ถ้าใช่โค้ดของ TME ให้ใช้ข้อมูลจากคอมพิวเตอร์
        }
      }
    } catch (err) {
      console.warn("ไม่สามารถอ่าน Clipboard ได้ (อาจไม่ได้รับอนุญาต) จะใช้ข้อมูลสำรองแทน", err);
    }

    if (!payload) return;
    
    let blockToPaste = [];
    let symbolsToPaste = [];

    if (Array.isArray(payload)) {
       if (payload.length === 0) return;
       blockToPaste = payload.map((row, idx) => ({ rowOffset: idx, cells: row }));
    } else {
       if (!payload.block || payload.block.length === 0) return;
       blockToPaste = payload.block;
       symbolsToPaste = payload.symbols || [];
    }

    let [r, m, c] = selectedCell;
    const newData = sheetData.map(row => row.map(meas => [...meas])); 
    let newSymbols = [...symbols];
    
    let lastValidCursor = [r, m, c];
    const startCol = getFlattenedCol(newData[r], rowTypes[r], m, c);

    const getCoordsFromFlatCol = (rowIdx, targetFlatCol) => {
        let currentCol = 0;
        for (let ms = 0; ms < newData[rowIdx].length; ms++) {
           if (rowTypes[rowIdx].startsWith('double') && ms === 0) continue;
           for (let cl = 0; cl < newData[rowIdx][ms].length; cl++) {
               if (currentCol === targetFlatCol) return [rowIdx, ms, cl];
               currentCol++;
           }
        }
        return null;
    };

    blockToPaste.forEach(pastedRow => {
        const targetR = r + pastedRow.rowOffset;
        if (targetR >= newData.length || rowTypes[targetR] === 'page-break' || rowTypes[targetR] === 'text') return;

        let colIndex = 0;
        let pasteIndex = 0;
        for (let ms = 0; ms < newData[targetR].length; ms++) {
            if (rowTypes[targetR].startsWith('double') && ms === 0) continue;
            for (let cl = 0; cl < newData[targetR][ms].length; cl++) {
                if (colIndex >= startCol && pasteIndex < pastedRow.cells.length) {
                    newData[targetR][ms][cl] = pastedRow.cells[pasteIndex];
                    lastValidCursor = [targetR, ms, cl];
                    pasteIndex++;
                }
                colIndex++;
            }
        }
    });

    const newPastedSymbols = [];
    symbolsToPaste.forEach(sym => {
        const targetStartR = r + sym.startRelR;
        const targetEndR = r + sym.endRelR;

        if (targetStartR >= newData.length || targetEndR >= newData.length) return;

        const targetStartCol = startCol + sym.startRelCol;
        const targetEndCol = startCol + sym.endRelCol;

        const newStartCoords = getCoordsFromFlatCol(targetStartR, targetStartCol);
        const newEndCoords = getCoordsFromFlatCol(targetEndR, targetEndCol);

        if (newStartCoords && newEndCoords) {
            newPastedSymbols.push({
                id: Date.now() + Math.random(),
                type: sym.type,
                start: newStartCoords,
                end: newEndCoords,
                color: sym.color,
                strokeWidth: sym.strokeWidth,
                height: sym.height
            });
        }
    });

    if (newPastedSymbols.length > 0) newSymbols = [...newSymbols, ...newPastedSymbols];

    commitChange(newData, rowTypes, sectionLabels, newSymbols, rowMargins); 
    setSelectedCell(lastValidCursor);
  };

  const cutSelection = async () => {
    if (isReadOnlyRef.current) return; 
    if (!selectionRange) return;
    
    // ⭐ เซฟช่วงคลุมดำไว้ก่อน เพราะ copySelection จะทำการล้างค่าทิ้ง
    const currentRange = { ...selectionRange };
    
    await copySelection();
    
    const { start: [sr, sm, sc], end: [er, em, ec] } = currentRange;
    const minR = Math.min(sr, er), maxR = Math.max(sr, er);
    const startCol = getFlattenedCol(sheetData[sr], rowTypes[sr], sm, sc);
    const endCol = getFlattenedCol(sheetData[er], rowTypes[er], em, ec);
    const minCol = Math.min(startCol, endCol), maxCol = Math.max(startCol, endCol);

    const newData = [...sheetData];
    for (let r = minR; r <= maxR; r++) {
      if (rowTypes[r] === 'page-break' || rowTypes[r] === 'text') continue;
      let currentCol = 0;
      for (let m = 0; m < sheetData[r].length; m++) {
        if (rowTypes[r].startsWith('double') && m === 0) continue;
        for (let c = 0; c < sheetData[r][m].length; c++) {
          if (currentCol >= minCol && currentCol <= maxCol) {
            newData[r][m][c] = '-'; 
          }
          currentCol++;
        }
      }
    }

    const remainingSymbols = symbols.filter(sym => {
        const symStartCol = getFlattenedCol(sheetData[sym.start[0]], rowTypes[sym.start[0]], sym.start[1], sym.start[2]);
        const symEndCol = getFlattenedCol(sheetData[sym.end[0]], rowTypes[sym.end[0]], sym.end[1], sym.end[2]);
        const sR = sym.start[0], eR = sym.end[0];

        const isInside = sR >= minR && sR <= maxR && eR >= minR && eR <= maxR &&
                         symStartCol >= minCol && symStartCol <= maxCol &&
                         symEndCol >= minCol && symEndCol <= maxCol;
        return !isInside; 
    });

    commitChange(newData, rowTypes, sectionLabels, remainingSymbols, rowMargins);
    setSelectionRange(null); 
  };
  
  const inputNote = (note) => {
    if (isReadOnlyRef.current) return; 
    const newData = sheetData.map(row => row.map(meas => [...meas]));
    let isBlockSelection = false;
    
    if (selectionRange && selectionRange.start && selectionRange.end) {
        const { start: [sr, sm, sc], end: [er, em, ec] } = selectionRange;
        if (sr !== er || sm !== em || sc !== ec) isBlockSelection = true;
    }

    if (isBlockSelection) {
        const { start: [sr, sm, sc], end: [er, em, ec] } = selectionRange;
        const minR = Math.min(sr, er), maxR = Math.max(sr, er);
        const minCol = Math.min(getFlattenedCol(sheetData[sr], rowTypes[sr], sm, sc), getFlattenedCol(sheetData[er], rowTypes[er], em, ec));
        const maxCol = Math.max(getFlattenedCol(sheetData[sr], rowTypes[sr], sm, sc), getFlattenedCol(sheetData[er], rowTypes[er], em, ec));

        const normalizedToken = note === 'BACKSPACE' ? '-' : normalizeCellToken(note);
        for (let r = minR; r <= maxR; r++) {
          if (rowTypes[r] === 'page-break' || rowTypes[r] === 'text') continue; 
          let currentCol = 0;
          for (let m = 0; m < sheetData[r].length; m++) {
            if (rowTypes[r].startsWith('double') && m === 0) continue;
            for (let c = 0; c < sheetData[r][m].length; c++) {
              if (currentCol >= minCol && currentCol <= maxCol) {
                  
                  if (intervalModeRef.current !== 'off' && rowTypes[r].startsWith('double')) {
                      const isRightRow = rowTypes[r] === 'double-right';
                      const rightRowIdx = isRightRow ? r : r - 1; 
                      const leftRowIdx = isRightRow ? r + 1 : r;  

                      if (normalizedToken === '-') {
                          newData[rightRowIdx][m][c] = '-';
                          newData[leftRowIdx][m][c] = '-';
                      } else {
                          const actualNote = isReduceModeRef.current ? shiftNoteString(normalizedToken, -1) : normalizedToken;
                          const { left, right } = getIntervalPair(currentInstrument, actualNote, intervalModeRef.current);
                          newData[leftRowIdx][m][c] = isReduceModeRef.current ? shiftNoteString(left, 1) : left;
                          newData[rightRowIdx][m][c] = isReduceModeRef.current ? shiftNoteString(right, 1) : right;
                      }
                  } else {
                      newData[r][m][c] = normalizedToken;
                  }
              }
              currentCol++;
            }
          }
        }
        if (normalizedToken !== '-') previewCellToken(normalizedToken, layoutConfig.volume ?? 100);
        commitChange(newData); setSelectionRange(null);
        return;
    }

    setSelectionRange(null); 
    const [row, meas, cell] = selectedCell;
    if (rowTypes[row] === 'page-break' || rowTypes[row] === 'text' || (rowTypes[row].startsWith('double') && meas === 0)) return;

    // ⭐ ดักจับ: ป้องกันไม่ให้แป้นพิมพ์คีย์บอร์ดดนตรี ส่งตัวโน้ตเข้าไปทับในช่องพิมพ์ข้อความ
    const firstItem = sheetData[row][meas][0];
    if (typeof firstItem === 'string' && (firstItem.startsWith('@TEXT_SPAN_') || firstItem === '@HIDDEN')) return;

    if (note === 'BACKSPACE') {
      if (intervalModeRef.current !== 'off' && rowTypes[row].startsWith('double')) {
          const isRightRow = rowTypes[row] === 'double-right';
          const rightRowIdx = isRightRow ? row : row - 1;
          const leftRowIdx = isRightRow ? row + 1 : row;
          newData[rightRowIdx][meas][cell] = '-';
          newData[leftRowIdx][meas][cell] = '-';
      } else {
          newData[row][meas][cell] = '-';
      }

      commitChange(newData);
      if (cell > 0) setSelectedCell([row, meas, cell - 1]);
      else if (meas > 0) {
        if (rowTypes[row].startsWith('double') && meas === 1) {
          let prevR = row - 1; while (prevR >= 0 && (rowTypes[prevR] === 'page-break' || rowTypes[prevR] === 'text')) prevR--;
          if (prevR >= 0) setSelectedCell([prevR, sheetData[prevR].length - 1, sheetData[prevR][sheetData[prevR].length - 1].length - 1]);
        } else setSelectedCell([row, meas - 1, sheetData[row][meas - 1].length - 1]);
      } else {
          let prevR = row - 1; while (prevR >= 0 && (rowTypes[prevR] === 'page-break' || rowTypes[prevR] === 'text')) prevR--;
          if (prevR >= 0) setSelectedCell([prevR, sheetData[prevR].length - 1, sheetData[prevR][sheetData[prevR].length - 1].length - 1]);
      }
    } else {
      const normalizedToken = normalizeCellToken(note);
      
      if (intervalModeRef.current !== 'off' && rowTypes[row].startsWith('double')) {
          const isRightRow = rowTypes[row] === 'double-right';
          const rightRowIdx = isRightRow ? row : row - 1;
          const leftRowIdx = isRightRow ? row + 1 : row;
          
          const actualNote = isReduceModeRef.current ? shiftNoteString(normalizedToken, -1) : normalizedToken;
          const { left, right } = getIntervalPair(currentInstrument, actualNote, intervalModeRef.current);
          
          newData[leftRowIdx][meas][cell] = isReduceModeRef.current ? shiftNoteString(left, 1) : left;
          newData[rightRowIdx][meas][cell] = isReduceModeRef.current ? shiftNoteString(right, 1) : right;
      } else {
          newData[row][meas][cell] = normalizedToken;
      }

      if (normalizedToken !== '-') previewCellToken(normalizedToken, layoutConfig.volume ?? 100);
      commitChange(newData);
      if (cell < sheetData[row][meas].length - 1) setSelectedCell([row, meas, cell + 1]);
      else if (meas < sheetData[row].length - 1) setSelectedCell([row, meas + 1, 0]);
      else {
          let nextR = row + 1; while (nextR < sheetData.length && (rowTypes[nextR] === 'page-break' || rowTypes[nextR] === 'text')) nextR++;
          if (nextR < sheetData.length) setSelectedCell([nextR, rowTypes[nextR].startsWith('double') ? 1 : 0, 0]);
      }
    }
  };

  const addRow = (insertAtTop = null) => { 
    if (isReadOnlyRef.current) return;
    if (isPlayingRef.current) stopPlayback(); 
    setSelectionRange(null); 
    
    const [rIdx, mIdx] = selectedCell;
    let insertIdx;
    let isFirstHalf = false;

    if (rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1; 
    } else {
      const currentMeasureCount = sheetData[rIdx]?.length || 8;
      isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (mIdx < Math.ceil(currentMeasureCount / 2));
      insertIdx = isFirstHalf ? rIdx : rIdx + 1;

      if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1; 
      else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1; 

      // ⭐ ดักจับ: ถ้ากดแทรกด้านล่าง ให้กระโดดข้ามบรรทัดคำอธิบาย (annotation) ลงไปต่อท้ายสุด
      if (!isFirstHalf) {
        while (insertIdx < rowTypes.length && (rowTypes[insertIdx] === 'annotation' || rowTypes[insertIdx] === 'nathap')) {
          insertIdx += 1;
        }
      }
    }

    let targetVisualIndex = 0;
    for (let i = 0; i < insertIdx; i++) if (rowTypes[i] === 'single' || rowTypes[i] === 'double-right') targetVisualIndex++;

    const newSectionLabels = {};
    Object.keys(sectionLabels).forEach(key => {
      const k = parseInt(key);
      if (k < targetVisualIndex) newSectionLabels[k] = sectionLabels[k];
      else newSectionLabels[k + 1] = sectionLabels[k];
    });

    const newData = [...sheetData], newRowTypes = [...rowTypes], newRowMargins = [...rowMargins];
    newData.splice(insertIdx, 0, Array(8).fill().map(() => Array(4).fill('-')));
    newRowTypes.splice(insertIdx, 0, 'single');
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }); 

    const newSymbols = symbols.map(sym => ({
      ...sym,
      start: [sym.start[0] >= insertIdx ? sym.start[0] + 1 : sym.start[0], sym.start[1], sym.start[2]],
      end: [sym.end[0] >= insertIdx ? sym.end[0] + 1 : sym.end[0], sym.end[1], sym.end[2]]
    }));

    commitChange(newData, newRowTypes, newSectionLabels, newSymbols, newRowMargins);
    
    if (rowTypes[rIdx] === 'page-break') setSelectedCell([insertIdx, 0, 0]);
    else if (isFirstHalf) setSelectedCell([insertIdx + 1, 0, 0]); 
  };

  const addDoubleRow = (insertAtTop = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef.current) stopPlayback(); 
    setSelectionRange(null); 
    
    const [rIdx, mIdx] = selectedCell;
    let insertIdx;
    let isFirstHalf = false;

    if (rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1;
    } else {
      const currentMeasureCount = sheetData[rIdx]?.length || (rowTypes[rIdx]?.startsWith('double') ? 9 : 8);
      isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (mIdx < Math.ceil(currentMeasureCount / 2));
      insertIdx = isFirstHalf ? rIdx : rIdx + 1;
      
      if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
      else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

      // ⭐ ดักจับ: ถ้ากดแทรกด้านล่าง ให้กระโดดข้ามบรรทัดคำอธิบาย (annotation) ลงไปต่อท้ายสุด
      if (!isFirstHalf) {
        while (insertIdx < rowTypes.length && (rowTypes[insertIdx] === 'annotation' || rowTypes[insertIdx] === 'nathap')) {
          insertIdx += 1;
        }
      }
    }

    let targetVisualIndex = 0;
    for (let i = 0; i < insertIdx; i++) if (rowTypes[i] === 'single' || rowTypes[i] === 'double-right') targetVisualIndex++;

    const newSectionLabels = {};
    Object.keys(sectionLabels).forEach(key => {
      const k = parseInt(key);
      if (k < targetVisualIndex) newSectionLabels[k] = sectionLabels[k];
      else newSectionLabels[k + 1] = sectionLabels[k];
    });

    const newData = [...sheetData], newRowTypes = [...rowTypes], newRowMargins = [...rowMargins];
    newData.splice(insertIdx, 0, [['มือขวา'], ...Array(8).fill().map(() => Array(4).fill('-'))], [['มือซ้าย'], ...Array(8).fill().map(() => Array(4).fill('-'))]);
    newRowTypes.splice(insertIdx, 0, 'double-right', 'double-left');
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }, { top: 0, bottom: 0, left: 0 }); 

    const newSymbols = symbols.map(sym => ({
      ...sym,
      start: [sym.start[0] >= insertIdx ? sym.start[0] + 2 : sym.start[0], sym.start[1], sym.start[2]],
      end: [sym.end[0] >= insertIdx ? sym.end[0] + 2 : sym.end[0], sym.end[1], sym.end[2]]
    }));

    commitChange(newData, newRowTypes, newSectionLabels, newSymbols, newRowMargins);
    
    if (rowTypes[rIdx] === 'page-break') setSelectedCell([insertIdx, 0, 0]);
    else if (isFirstHalf) setSelectedCell([insertIdx + 2, 0, 0]); 
  };

  const addPageBreak = (insertAtTop = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef.current) stopPlayback(); 
    setSelectionRange(null);
    
    const [rIdx, mIdx] = selectedCell;
    let insertIdx;

    if (rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1;
    } else {
      const isDouble = rowTypes[rIdx]?.startsWith('double');
      const isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (isDouble ? mIdx < 5 : mIdx < 4);
      insertIdx = isFirstHalf ? rIdx : rIdx + 1;
      
      if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
      else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

      // ⭐ ดักจับ: กระโดดข้ามบรรทัดคำอธิบาย ไม่ให้แทรกผ่ากลาง
      if (!isFirstHalf) {
        while (insertIdx < rowTypes.length && (rowTypes[insertIdx] === 'annotation' || rowTypes[insertIdx] === 'nathap')) {
          insertIdx += 1;
        }
      }
    }

    const newData = [...sheetData], newRowTypes = [...rowTypes], newRowMargins = [...rowMargins];
    newData.splice(insertIdx, 0, Array(8).fill().map(() => Array(4).fill('-')));
    newRowTypes.splice(insertIdx, 0, 'page-break');
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }); 

    const newSymbols = symbols.map(sym => ({
      ...sym,
      start: [sym.start[0] >= insertIdx ? sym.start[0] + 1 : sym.start[0], sym.start[1], sym.start[2]],
      end: [sym.end[0] >= insertIdx ? sym.end[0] + 1 : sym.end[0], sym.end[1], sym.end[2]]
    }));
    commitChange(newData, newRowTypes, { ...sectionLabels }, newSymbols, newRowMargins);
    setSelectedCell([insertIdx, 0, 0]);
  };

  const addTextRow = (insertAtTop = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef.current) stopPlayback(); 
    setSelectionRange(null);
    
    const [rIdx,  mIdx] = selectedCell;
    let insertIdx;

    if (rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1;
    } else {
      const isDouble = rowTypes[rIdx]?.startsWith('double');
      const isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (isDouble ? mIdx < 5 : mIdx < 4);
      insertIdx = isFirstHalf ? rIdx : rIdx + 1;
      
      if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
      else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

      // ⭐ ดักจับ: กระโดดข้ามบรรทัดคำอธิบาย ไม่ให้แทรกผ่ากลาง
      if (!isFirstHalf) {
        while (insertIdx < rowTypes.length && (rowTypes[insertIdx] === 'annotation' || rowTypes[insertIdx] === 'nathap')) {
          insertIdx += 1;
        }
      }
    }

    const newData = [...sheetData], newRowTypes = [...rowTypes], newRowMargins = [...rowMargins];
    newData.splice(insertIdx, 0, [[""]]); 
    newRowTypes.splice(insertIdx, 0, 'text');
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }); 

    const newSymbols = symbols.map(sym => ({
      ...sym,
      start: [sym.start[0] >= insertIdx ? sym.start[0] + 1 : sym.start[0], sym.start[1], sym.start[2]],
      end: [sym.end[0] >= insertIdx ? sym.end[0] + 1 : sym.end[0], sym.end[1], sym.end[2]]
    }));
    commitChange(newData, newRowTypes, { ...sectionLabels }, newSymbols, newRowMargins);
    setTimeout(() => { setSelectedCell([insertIdx, 0, 0]); }, 10);
  };

  const updateTextRow = (rIndex, text) => {
    if (isReadOnlyRef.current) return;
    const newData = [...sheetData];
    newData[rIndex] = [[text]];
    commitChange(newData);
  };

  // ⭐ ฟังก์ชันใหม่: สร้างบรรทัดคำอธิบาย (ตาราง 8 ห้อง ห้องละ 4 จังหวะ แต่เอาไว้พิมพ์ข้อความ)
  const addAnnotationRow = (insertAtTop = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef.current) stopPlayback(); 
    setSelectionRange(null);
    
    const [rIdx,  mIdx] = selectedCell;
    let insertIdx;

    if (rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1;
    } else {
      const isDouble = rowTypes[rIdx]?.startsWith('double');
      const isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (isDouble ? mIdx < 5 : mIdx < 4);
      insertIdx = isFirstHalf ? rIdx : rIdx + 1;
      
      if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
      else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

      // ⭐ ดักจับ: กระโดดข้ามบรรทัดคำอธิบายเดิมลงไปต่อด้านล่างสุด
      if (!isFirstHalf) {
        while (insertIdx < rowTypes.length && (rowTypes[insertIdx] === 'annotation' || rowTypes[insertIdx] === 'nathap')) {
          insertIdx += 1;
        }
      }
    }

    const newData = [...sheetData], newRowTypes = [...rowTypes], newRowMargins = [...rowMargins];
    // สร้างโครงสร้างให้ผสาน 8 ห้องรวดเดียวตั้งแต่เกิด (ไร้ขีดกั้น)
    newData.splice(insertIdx, 0, [
      ['@TEXT_SPAN_8', ''], ['@HIDDEN'], ['@HIDDEN'], ['@HIDDEN'],
      ['@HIDDEN'], ['@HIDDEN'], ['@HIDDEN'], ['@HIDDEN']
    ]); 
    newRowTypes.splice(insertIdx, 0, 'annotation'); 
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }); 

    const newSymbols = symbols.map(sym => ({
      ...sym,
      start: [sym.start[0] >= insertIdx ? sym.start[0] + 1 : sym.start[0], sym.start[1], sym.start[2]],
      end: [sym.end[0] >= insertIdx ? sym.end[0] + 1 : sym.end[0], sym.end[1], sym.end[2]]
    }));
    commitChange(newData, newRowTypes, { ...sectionLabels }, newSymbols, newRowMargins);
    setTimeout(() => { setSelectedCell([insertIdx, 0, 0]); }, 10);
  };

  // ⭐ ฟังก์ชันใหม่: สร้างบรรทัดหน้าทับกลอง (ตาราง 8 ห้องปกติ ไม่เล่นเสียง)
  const addNathapRow = (insertAtTop = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef.current) stopPlayback(); 
    setSelectionRange(null);
    
    const [rIdx,  mIdx] = selectedCell;
    let insertIdx;

    if (rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1;
    } else {
      const isDouble = rowTypes[rIdx]?.startsWith('double');
      const isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (isDouble ? mIdx < 5 : mIdx < 4);
      insertIdx = isFirstHalf ? rIdx : rIdx + 1;
      
      if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
      else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

      // กระโดดข้ามบรรทัดคำอธิบายหรือหน้าทับเดิมลงไปต่อด้านล่างสุด
      if (!isFirstHalf) {
        while (insertIdx < rowTypes.length && (rowTypes[insertIdx] === 'annotation' || rowTypes[insertIdx] === 'nathap')) {
          insertIdx += 1;
        }
      }
    }

    const newData = [...sheetData], newRowTypes = [...rowTypes], newRowMargins = [...rowMargins];
    newData.splice(insertIdx, 0, Array(8).fill().map(() => Array(4).fill('-'))); 
    newRowTypes.splice(insertIdx, 0, 'nathap'); 
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }); 

    const newSymbols = symbols.map(sym => ({
      ...sym,
      start: [sym.start[0] >= insertIdx ? sym.start[0] + 1 : sym.start[0], sym.start[1], sym.start[2]],
      end: [sym.end[0] >= insertIdx ? sym.end[0] + 1 : sym.end[0], sym.end[1], sym.end[2]]
    }));
    commitChange(newData, newRowTypes, { ...sectionLabels }, newSymbols, newRowMargins);
    setTimeout(() => { setSelectedCell([insertIdx, 0, 0]); }, 10);
  };
  // ⭐ เพิ่มให้รับค่า targetIdx ได้
  const removeRow = (targetIdx = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef.current) stopPlayback();
    setSelectionRange(null); 
    
    // ⭐ เช็กว่ามีการระบุบรรทัดมาตรงๆ ไหม ถ้ามีให้ยึดค่านี้ (ป้องกันลบผิดบรรทัด)
    const rowIdx = typeof targetIdx === 'number' ? targetIdx : selectedCell[0];
    
    let deleteCount = 1, startIndex = rowIdx;

    if (rowTypes[rowIdx] === 'double-right') deleteCount = 2;
    else if (rowTypes[rowIdx] === 'double-left') { startIndex = rowIdx - 1; deleteCount = 2; }

    if (sheetData.length - deleteCount <= 0) {
      commitChange([[...Array(8).fill().map(() => Array(4).fill('-'))]], ['single'], {}, [], [{ top: 0, bottom: 0, left: 0 }]); 
      setSelectedCell([0, 0, 0]); return;
    }

    const isNoteRow = rowTypes[startIndex] === 'single' || rowTypes[startIndex] === 'double-right';
    const newSectionLabels = {};
    if (!isNoteRow) Object.assign(newSectionLabels, sectionLabels);
    else {
      let startVisualIndex = 0;
      for(let i = 0; i < startIndex; i++) if (rowTypes[i] === 'single' || rowTypes[i] === 'double-right') startVisualIndex++;
      Object.keys(sectionLabels).forEach(key => {
          const k = parseInt(key);
          if (k < startVisualIndex) newSectionLabels[k] = sectionLabels[k];
          else if (k > startVisualIndex) newSectionLabels[k - 1] = sectionLabels[k];
      });
    }

    const newData = [...sheetData], newRowTypes = [...rowTypes], newRowMargins = [...rowMargins];
    newData.splice(startIndex, deleteCount); newRowTypes.splice(startIndex, deleteCount); newRowMargins.splice(startIndex, deleteCount); 

    const newSymbols = [];
    symbols.forEach(sym => {
      if (!((sym.start[0] >= startIndex && sym.start[0] < startIndex + deleteCount) || (sym.end[0] >= startIndex && sym.end[0] < startIndex + deleteCount))) {
        newSymbols.push({
          ...sym,
          start: [sym.start[0] > startIndex ? sym.start[0] - deleteCount : sym.start[0], sym.start[1], sym.start[2]],
          end: [sym.end[0] > startIndex ? sym.end[0] - deleteCount : sym.end[0], sym.end[1], sym.end[2]]
        });
      }
    });

    commitChange(newData, newRowTypes, newSectionLabels, newSymbols, newRowMargins);
    let nextRow = startIndex >= newData.length ? newData.length - 1 : startIndex;
    setSelectedCell([nextRow, newRowTypes[nextRow].startsWith('double') ? 1 : 0, 0]);
  };

  const removeMeasure = () => {
    if (isReadOnlyRef.current) return;

    let isBlockSelection = false;
    let minR, maxR, minM, maxM;

    // 1. เช็กว่ามีการ "คลุมดำ" หลายช่อง/หลายห้องหรือไม่
    if (selectionRange && selectionRange.start && selectionRange.end) {
      const { start: [sr, sm], end: [er, em] } = selectionRange;
      if (sr !== er || sm !== em) {
        isBlockSelection = true;
        minR = Math.min(sr, er);
        maxR = Math.max(sr, er);
        minM = Math.min(sm, em);
        maxM = Math.max(sm, em);
      }
    }

    // ทำการ Copy ข้อมูลกระดาษโน้ตทั้งหมด
    const newData = sheetData.map(row => row.map(meas => [...meas]));

    if (isBlockSelection) {
      // 2. กรณีคลุมดำ: วนลูปลบทีละบรรทัด ตามระยะห้องที่คลุมไว้
      for (let r = minR; r <= maxR; r++) {
        if (rowTypes[r] === 'page-break' || rowTypes[r] === 'text' || rowTypes[r] === 'annotation') continue;

        let actualMinM = minM;
        // ถ้าเป็นบรรทัดคู่ ห้ามลบห้องที่ 0 (เพราะเป็นป้ายชื่อมือซ้าย/ขวา)
        if (rowTypes[r].startsWith('double') && actualMinM === 0) actualMinM = 1;
        if (actualMinM > maxM) continue;

        const deleteCount = maxM - actualMinM + 1;
        const minAllowed = rowTypes[r].startsWith('double') ? 2 : 1; // ต้องเหลืออย่างน้อย 1 ห้องเสมอ

        if (rowTypes[r] === 'single' || rowTypes[r] === 'nathap') {
          const canDelete = Math.min(deleteCount, newData[r].length - minAllowed);
          if (canDelete > 0) newData[r].splice(actualMinM, canDelete);
        } 
        else if (rowTypes[r] === 'double-right') {
          // ถ้าเป็นมือขวา ให้ลบมือซ้าย (บรรทัดล่าง) ไปพร้อมๆ กันเลยเพื่อรักษาความสมดุล
          const canDelete = Math.min(deleteCount, newData[r].length - minAllowed);
          if (canDelete > 0) {
            newData[r].splice(actualMinM, canDelete);
            if (newData[r + 1]) newData[r + 1].splice(actualMinM, canDelete);
          }
        } 
        else if (rowTypes[r] === 'double-left') {
          // ถ้าเป็นมือซ้าย จะทำงานต่อเมื่อตอนเริ่มลากคลุม ดันไปเริ่มลากเอามือซ้าย
          if (r === minR) {
            const canDelete = Math.min(deleteCount, newData[r].length - minAllowed);
            if (canDelete > 0) {
              newData[r].splice(actualMinM, canDelete);
              if (newData[r - 1]) newData[r - 1].splice(actualMinM, canDelete);
            }
          }
        }
      }
      
      commitChange(newData);
      setSelectionRange(null);
      // เลื่อนเคอร์เซอร์กลับมาอยู่ที่ห้องแรกสุดของบล็อกที่ถูกลบไป
      setSelectedCell([minR, Math.min(minM, newData[minR].length - 1), 0]);

    } else {
      // 3. กรณีไม่ได้คลุมดำ: ทำงานลบแค่ 1 ห้อง (ตำแหน่งที่เคอร์เซอร์อยู่) แบบเดิม
      setSelectionRange(null); 
      const [rowIdx, measIdx] = selectedCell;
      if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text' || (rowTypes[rowIdx].startsWith('double') && measIdx === 0)) return; 
      
      if (sheetData[rowIdx].length > (rowTypes[rowIdx].startsWith('double') ? 2 : 1)) {
        if (rowTypes[rowIdx] === 'single' || rowTypes[rowIdx] === 'nathap') newData[rowIdx].splice(measIdx, 1);
        else if (rowTypes[rowIdx] === 'double-right') { newData[rowIdx].splice(measIdx, 1); newData[rowIdx + 1].splice(measIdx, 1); }
        else if (rowTypes[rowIdx] === 'double-left') { newData[rowIdx].splice(measIdx, 1); newData[rowIdx - 1].splice(measIdx, 1); }
        
        commitChange(newData);
        if (measIdx >= newData[rowIdx].length) setSelectedCell([rowIdx, newData[rowIdx].length - 1, 0]);
      }
    }
  };

  const addNoteColumn = () => {
    if (isReadOnlyRef.current) return;
    setSelectionRange(null); 
    const [rowIdx, measIdx, cellIdx] = selectedCell;
    if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text' || (rowTypes[rowIdx].startsWith('double') && measIdx === 0)) return; 
    const newData = [...sheetData]; newData[rowIdx][measIdx].splice(cellIdx + 1, 0, '-');
    commitChange(newData);
  };

  const removeNoteColumn = () => {
    if (isReadOnlyRef.current) return;
    setSelectionRange(null); 
    const [rowIdx, measIdx, cellIdx] = selectedCell;
    if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text' || (rowTypes[rowIdx].startsWith('double') && measIdx === 0)) return; 
    if (sheetData[rowIdx][measIdx].length > 1) {
      const newData = [...sheetData]; newData[rowIdx][measIdx].splice(cellIdx, 1);
      commitChange(newData);
      if (cellIdx >= newData[rowIdx][measIdx].length) setSelectedCell([rowIdx, measIdx, newData[rowIdx][measIdx].length - 1]);
    }
  };

  const addMeasure = () => {
    if (isReadOnlyRef.current) return;
    setSelectionRange(null); 
    const [rowIdx, measIdx] = selectedCell;
    if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text') return;
    const newData = [...sheetData];
    if (rowTypes[rowIdx] === 'single') newData[rowIdx].splice(measIdx + 1, 0, Array(4).fill('-'));
    else if (rowTypes[rowIdx] === 'double-right') { newData[rowIdx].splice(measIdx + 1, 0, Array(4).fill('-')); newData[rowIdx + 1].splice(measIdx + 1, 0, Array(4).fill('-')); }
    else if (rowTypes[rowIdx] === 'double-left') { newData[rowIdx].splice(measIdx + 1, 0, Array(4).fill('-')); newData[rowIdx - 1].splice(measIdx + 1, 0, Array(4).fill('-')); }
    commitChange(newData);
  };

 const convertMeasureToText = () => {
    if (isReadOnlyRef.current) return;
    const newData = sheetData.map(row => row.map(meas => [...meas]));
    
    let targetR, minM, maxM;
    
    if (selectionRange && selectionRange.start[0] === selectionRange.end[0]) {
        targetR = selectionRange.start[0];
        minM = Math.min(selectionRange.start[1], selectionRange.end[1]);
        maxM = Math.max(selectionRange.start[1], selectionRange.end[1]);
    } else if (selectedCell) {
        targetR = selectedCell[0];
        minM = selectedCell[1];
        maxM = selectedCell[1];
    } else {
        return;
    }

    if (rowTypes[targetR] === 'page-break' || rowTypes[targetR] === 'text') return;
    if (rowTypes[targetR].startsWith('double') && minM === 0) return;

    const span = maxM - minM + 1;
    newData[targetR][minM] = [`@TEXT_SPAN_${span}`, ''];
    
    for (let m = minM + 1; m <= maxM; m++) {
        newData[targetR][m] = ['@HIDDEN'];
    }
    
    commitChange(newData);
    setSelectionRange(null);
  };

  const updateMeasureText = (r, m, text) => {
    if (isReadOnlyRef.current) return;
    const newData = [...sheetData];
    if (!newData[r] || !newData[r][m]) return;

    if (typeof newData[r][m][0] === 'string' && newData[r][m][0].startsWith('@TEXT_SPAN_')) {
      newData[r][m][1] = text;
      commitChange(newData);
      return;
    }

    newData[r][m][0] = text;
    commitChange(newData);
  };

  const addSectionLabel = (visualIndex) => { if (isReadOnlyRef.current) return; commitChange(sheetData, rowTypes, { ...sectionLabels, [visualIndex]: [...(sectionLabels[visualIndex] || []), { id: Date.now(), text: "", position: 'top-left', fontSize: 18, isBold: true, offsetY: 6 }] }); };
  const updateSectionLabel = (visualIndex, labelId, updates) => { if (isReadOnlyRef.current) return; commitChange(sheetData, rowTypes, { ...sectionLabels, [visualIndex]: (sectionLabels[visualIndex] || []).map(l => l.id === labelId ? { ...l, ...updates } : l) }); };
  const removeSectionLabel = (visualIndex, labelId) => {
    if (isReadOnlyRef.current) return;
    const newState = { ...sectionLabels }, filtered = (sectionLabels[visualIndex] || []).filter(l => l.id !== labelId);
    if (filtered.length > 0) newState[visualIndex] = filtered; else delete newState[visualIndex];
    commitChange(sheetData, rowTypes, newState);
  };

  const saveProject = () => {
    if (isReadOnlyRef.current) return;
    const projectData = { 
      name: projectName, 
      songName, 
      sheetData, 
      rowTypes, 
      sectionLabels, 
      symbols, 
      layoutConfig, 
      headerDetails, 
      currentInstrument: currentInstrument.id, 
      rowMargins, 
      playbackSequence,
      isLoopAll,
      isLoopOne,
      intervalMode, 
      isReduceMode,
      isShowPlayMode 
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${projectName || 'my-song'}.tme`; a.click(); URL.revokeObjectURL(url);
  };

 const performLoadProject = (file) => {
    if (!file) return;
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      isImportingRef.current = true;
      try {
        const data = JSON.parse(e.target.result);
        const fileNameWithoutExt = file.name ? file.name.replace(/\.[^/.]+$/, "") : "";
        const targetProjectName = data.name || fileNameWithoutExt || "โปรเจกต์ไม่มีชื่อ";
        const targetSongName = data.songName || targetProjectName;

        const { defaultSheet, defaultTypes, defaultMargins } = resetProjectScopedState();
        setProjectName(targetProjectName);
        setSongName(targetSongName);
        setProjectId(null);

        let parsedSheetData = data.sheetData;
        if (data.sheetData) {
          parsedSheetData = typeof data.sheetData === 'string' ? JSON.parse(data.sheetData) : data.sheetData;
          setSheetData(parsedSheetData);
        } else {
          parsedSheetData = defaultSheet;
        }

        const loadedRowTypes = data.rowTypes || defaultTypes;
        const loadedSectionLabels = data.sectionLabels || {};
        const loadedSymbols = data.symbols || [];
        const loadedLayoutConfig = { ...createDefaultLayoutConfig(), ...(data.layoutConfig || {}) };
        const loadedHeaderDetails = data.headerDetails || createDefaultHeaderDetails();
        const loadedPlaybackSequence = data.playbackSequence || [];
        const loadedMargins = data.rowMargins || createDefaultRowMargins(parsedSheetData?.length || defaultMargins.length);
        const loadedInstrument = (data.currentInstrument && INSTRUMENT_CONFIG[data.currentInstrument])
          ? INSTRUMENT_CONFIG[data.currentInstrument]
          : DEFAULT_INSTRUMENT;

        setRowTypes(loadedRowTypes);
        setSectionLabels(loadedSectionLabels);
        setSymbols(loadedSymbols);
        setLayoutConfig(loadedLayoutConfig);
        setHeaderDetails(loadedHeaderDetails);
        setCurrentInstrument(loadedInstrument);
        setPlaybackSequence(loadedPlaybackSequence);
        setIsLoopAll(data.isLoopAll !== undefined ? data.isLoopAll : false);
        setIsLoopOne(data.isLoopOne !== undefined ? data.isLoopOne : false);

        if (data.intervalMode !== undefined) {
          setIntervalMode(data.intervalMode);
        } else if (data.isOctaveMode !== undefined) {
          setIntervalMode(data.isOctaveMode ? '8' : 'off');
        } else {
          setIntervalMode('off');
        }

        setIsReduceMode(data.isReduceMode !== undefined ? data.isReduceMode : false);
        setIsShowPlayMode(data.isShowPlayMode !== undefined ? data.isShowPlayMode : false);

        setRowMargins(loadedMargins);
        setSelectedCell([0, 0, 0]);
        setSelectionRange(null);
        commitChange(parsedSheetData, loadedRowTypes, loadedSectionLabels, loadedSymbols, loadedMargins);
      } catch (error) {
        console.error("Load project error:", error);
        alert("ไฟล์ไม่ถูกต้อง หรือไฟล์เสียหายครับ!"); 
      } finally {
        setTimeout(() => { isImportingRef.current = false; }, 1000);
      }
    };
    reader.readAsText(file);
  };

  const performNewProject = () => {
    isImportingRef.current = true;
    const { defaultSheet, defaultTypes, defaultMargins } = resetProjectScopedState();

    setSongName("เพลงใหม่");
    setProjectName("โปรเจกต์ไม่มีชื่อ");
    setHistoryIndex(-1);
    setHistory([]);
    localStorage.removeItem('thaiMusicEditorAutoSave');

    commitChange(defaultSheet, defaultTypes, {}, [], defaultMargins);
    setTimeout(() => { isImportingRef.current = false; }, 1000);
  };

  const visualRowCount = useMemo(() => rowTypes.filter(type => type === 'single' || type === 'double-right').length, [rowTypes]);

  const seek = (targetSeconds) => {
    if (!isLoaded || !sheetDataRef.current) return;
    const targetMs = targetSeconds * 1000;
    const currentSheetData = sheetDataRef.current;
    const currentRowTypes = rowTypesRef.current;
    const currentSectionLabels = sectionLabelsRef.current;

    const sheetSections = [];
    let lastValidRow = 0;
    let lastProcessedVIdx = -1;
    for (let r = 0; r < currentSheetData.length; r++) {
            if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'annotation') continue;
            const vIdx = getVisualIndex(r, currentRowTypes);
            const labels = currentSectionLabels[vIdx] || [];
            const validLabels = labels.filter(l => l.text && l.text.trim() !== '');

            if (validLabels.length > 0 && vIdx !== lastProcessedVIdx) {
                sheetSections.forEach(sec => {
                    if (sec.endRow === currentSheetData.length - 1) sec.endRow = lastValidRow;
                });
                validLabels.forEach(vl => {
                    sheetSections.push({ label: vl.text.trim(), startRow: r, endRow: currentSheetData.length - 1 });
                });
                lastProcessedVIdx = vIdx; 
            }
            lastValidRow = r;
            if (currentRowTypes[r] === 'double-right') lastValidRow = r + 1; 
        }
        sheetSections.forEach(sec => {
            if (sec.endRow === currentSheetData.length - 1) sec.endRow = lastValidRow;
        });
    if (sheetSections.length > 0) sheetSections[sheetSections.length - 1].endRow = lastValidRow;

    const currentBpm = layoutConfigRef.current.bpm || 80;
    const seq = playbackSequenceRef.current;
    let elapsedMs = 0;
    let foundCell = null;

    for (let seqIdx = 0; seqIdx < seq.length && !foundCell; seqIdx++) {
      const section = sheetSections.find(s => s.label === seq[seqIdx].label.trim());
      if (!section) continue;
      for (let loop = 1; loop <= seq[seqIdx].loops && !foundCell; loop++) {
        for (let r = section.startRow; r <= section.endRow && !foundCell; r++) {
          if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'double-left' || currentRowTypes[r] === 'annotation') continue;
          const startM = currentRowTypes[r].startsWith('double') ? 1 : 0;
          for (let m = startM; m < currentSheetData[r].length && !foundCell; m++) {
            const cellCount = currentSheetData[r][m].length;
            if (cellCount > 0) {
              const standardMsPerCell = 15000 / currentBpm;
              const msPerCell = Math.floor(standardMsPerCell * (4 / cellCount));
              for (let c = 0; c < cellCount; c++) {
                if (elapsedMs >= targetMs) {
                  foundCell = { r, m, c, seqIdx, loop, elapsedMs };
                  break;
                }
                elapsedMs += msPerCell;
              }
            }
          }
        }
      }
    }

    const wasPlaying = isPlayingRef.current;
    seekOffsetRef.current = foundCell ? foundCell.elapsedMs / 1000 : targetSeconds;

    if (foundCell) {
      const newCursor = [foundCell.r, foundCell.m, 0];
      setSelectedCell(newCursor); 
      selectedCellRef.current = newCursor; // ⭐ 1. บังคับอัปเดตตำแหน่งเคอร์เซอร์สดๆ ไม่ต้องรอ React
      activeSequenceIdxRef.current = foundCell.seqIdx;
      activeLoopRef.current = foundCell.loop;
    }
    if (wasPlaying) {
      stopPlayback({ preserveSeek: true });
      seekOffsetRef.current = foundCell ? foundCell.elapsedMs / 1000 : targetSeconds;
      setTimeout(() => startPlayback(), 50);
    } else {
      setCurrentTime(targetSeconds);
    }
  };

  const togglePlay = () => {
    if (isPlaying) stopPlayback();
    else startPlayback();
  };

  const jumpToSequence = (targetSeqIdx) => {
    const seq = playbackSequenceRef.current;
    if (!seq || targetSeqIdx < 0 || targetSeqIdx >= seq.length) return;
    
    const currentSheetData = sheetDataRef.current;
    const currentRowTypes = rowTypesRef.current;
    const currentSectionLabels = sectionLabelsRef.current;
    const sheetSections = [];
    let lastValidRow = 0;
    let lastProcessedVIdx = -1;
    for (let r = 0; r < currentSheetData.length; r++) {
        if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') continue;
        const vIdx = getVisualIndex(r, currentRowTypes);
        const labels = currentSectionLabels[vIdx] || [];
        const validLabels = labels.filter(l => l.text && l.text.trim() !== '');
        if (validLabels.length > 0 && vIdx !== lastProcessedVIdx) {
            if (sheetSections.length > 0) sheetSections[sheetSections.length - 1].endRow = lastValidRow;
            sheetSections.push({ label: validLabels[0].text.trim(), startRow: r, endRow: currentSheetData.length - 1 });
            lastProcessedVIdx = vIdx;
        }
        lastValidRow = r;
        if (currentRowTypes[r] === 'double-right') lastValidRow = r + 1;
    }
    if (sheetSections.length > 0) sheetSections[sheetSections.length - 1].endRow = lastValidRow;

    const currentBpm = layoutConfigRef.current.bpm || 80;
    let elapsedMs = 0;

    for (let i = 0; i < targetSeqIdx; i++) {
        const section = sheetSections.find(s => s.label === seq[i].label.trim());
        if (!section) continue;
        let sectionMs = 0;
        for (let r = section.startRow; r <= section.endRow; r++) {
            if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'double-left' || currentRowTypes[r] === 'annotation' || currentRowTypes[r] === 'nathap') continue;
            for (let m = 0; m < currentSheetData[r].length; m++) {
                if (currentRowTypes[r].startsWith('double') && m === 0) continue;
                const cellCount = currentSheetData[r][m].length;
                if (cellCount > 0) sectionMs += (15000 / currentBpm) * 4;
            }
        }
        elapsedMs += (sectionMs * seq[i].loops);
    }
    
    seek(elapsedMs / 1000);
  };

  const skipToNext = () => {
      if (!playbackSequenceRef.current || playbackSequenceRef.current.length === 0) return;
      const seq = playbackSequenceRef.current;
      let nextIdx = activeSequenceIdxRef.current + 1;
      
      if (nextIdx >= seq.length) {
          if (isLoopAllRef.current) nextIdx = 0;
          else {
              stopPlayback();
              return;
          }
      }
      jumpToSequence(nextIdx);
  };

  const skipToPrev = () => {
      if (!playbackSequenceRef.current || playbackSequenceRef.current.length === 0) return;
      let targetIdx = activeSequenceIdxRef.current;
      if (targetIdx > 0) targetIdx -= 1;
      jumpToSequence(targetIdx);
  };

  const commitChange = (newSheetData, newRowTypes, newSectionLabels, newSymbols, newRowMargins) => {
    setSheetData(newSheetData);
    if (newRowTypes) setRowTypes(newRowTypes);
    if (newSectionLabels) setSectionLabels(newSectionLabels);
    if (newSymbols) setSymbols(newSymbols);
    if (newRowMargins) setRowMargins(newRowMargins);
    
    const snapshot = {
      sheetData: newSheetData.map(row => row.map(meas => [...meas])),
      rowTypes: newRowTypes ? [...newRowTypes] : [...rowTypes],
      sectionLabels: newSectionLabels ? JSON.parse(JSON.stringify(newSectionLabels)) : JSON.parse(JSON.stringify(sectionLabels)),
      symbols: newSymbols ? [...newSymbols] : [...symbols],
      rowMargins: newRowMargins ? JSON.parse(JSON.stringify(newRowMargins)) : JSON.parse(JSON.stringify(rowMargins))
    };
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(snapshot);
      if (newHistory.length > 30) newHistory.shift(); 
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 29));
  };

  const undo = () => {
    if (isReadOnlyRef.current) return;
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setSheetData(prev.sheetData);
      setRowTypes(prev.rowTypes);
      setSectionLabels(prev.sectionLabels);
      setSymbols(prev.symbols || []); 
      setRowMargins(prev.rowMargins || Array(prev.sheetData.length).fill({ top: 0, bottom: 0, left: 0 }));
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (isReadOnlyRef.current) return;
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setSheetData(next.sheetData);
      setRowTypes(next.rowTypes);
      setSectionLabels(next.sectionLabels);
      setSymbols(next.symbols || []); 
      setRowMargins(next.rowMargins || Array(next.sheetData.length).fill({ top: 0, bottom: 0, left: 0 }));
      setHistoryIndex(historyIndex + 1);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('thaiMusicEditorAutoSave');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const restoredId = data.projectId || data.id || null;
        if (restoredId) setProjectId(restoredId);
        if (data.projectId !== undefined) setProjectId(data.projectId);
        if (data.name !== undefined) setProjectName(data.name);
        if (data.songName !== undefined) setSongName(data.songName);
        if (data.sheetData) setSheetData(data.sheetData);
        if (data.rowTypes) setRowTypes(data.rowTypes);
        if (data.sectionLabels) setSectionLabels(data.sectionLabels);
        if (data.symbols) setSymbols(data.symbols); 
        setLayoutConfig({ ...createDefaultLayoutConfig(), ...(data.layoutConfig || {}) });
        if (data.headerDetails) setHeaderDetails(data.headerDetails);
        if (data.currentInstrument && INSTRUMENT_CONFIG[data.currentInstrument]) setCurrentInstrument(INSTRUMENT_CONFIG[data.currentInstrument]);
        if (data.playbackSequence) setPlaybackSequence(data.playbackSequence);
        const loadedMargins = data.rowMargins || Array(data.sheetData?.length || 4).fill({ top: 0, bottom: 0, left: 0 });
        setRowMargins(loadedMargins);
        
        if (data.isLoopAll !== undefined) setIsLoopAll(data.isLoopAll);
        if (data.isLoopOne !== undefined) setIsLoopOne(data.isLoopOne);
        
        if (data.intervalMode !== undefined) {
          setIntervalMode(data.intervalMode);
        } else if (data.isOctaveMode !== undefined) {
          setIntervalMode(data.isOctaveMode ? '8' : 'off');
        }

        if (data.isReduceMode !== undefined) setIsReduceMode(data.isReduceMode);
        if (data.isShowPlayMode !== undefined) setIsShowPlayMode(data.isShowPlayMode); 

        commitChange(data.sheetData || sheetData, data.rowTypes || rowTypes, data.sectionLabels || sectionLabels, data.symbols || symbols, loadedMargins);
      } catch (error) {
        commitChange(sheetData, rowTypes, sectionLabels, symbols, rowMargins);
      }
    } else {
      commitChange(sheetData, rowTypes, sectionLabels, symbols, rowMargins);
    }
    setIsLoaded(true);
    
  }, []); 
  

 useEffect(() => {
    if (!isLoaded || isImportingRef.current || isReadOnly) return; 
    const isFreshProject = !projectId && historyIndex <= 0 && projectName === "โปรเจกต์ไม่มีชื่อ" && songName === "เพลงใหม่";

    const projectData = { 
      projectId: projectId, // ⭐ ฝัง ID ลงไปในข้อมูลเสมอ
      id: projectId, // ⭐ ฝังเผื่อไว้อีกตัว
      name: projectName, songName, sheetData, rowTypes, sectionLabels, 
      symbols, layoutConfig, headerDetails, currentInstrument: currentInstrument.id, 
      rowMargins, playbackSequence,
      isLoopAll, isLoopOne, intervalMode, isReduceMode, isShowPlayMode 
    };
    
    localStorage.setItem('thaiMusicEditorAutoSave', JSON.stringify(projectData));

    
    if (!isFreshProject) {
      const debounceTimer = setTimeout(() => {
        // ⭐ โยน projectId ยัดใส่มือฟังก์ชันตรงๆ แก้ปัญหา Stale Closure!
        autoSaveToFirebase(projectData, projectId);
      }, 2000);

      return () => clearTimeout(debounceTimer);
    }
  }, [isLoaded, projectName, songName, sheetData, rowTypes, sectionLabels, symbols, layoutConfig, headerDetails, currentInstrument, rowMargins, playbackSequence, isLoopAll, isLoopOne, intervalMode, isReduceMode, isShowPlayMode, projectId, historyIndex, isReadOnly]);
  const updateRowMarginsList = (arg1, arg2, arg3) => {
    if (isReadOnlyRef.current) return;
    const newRowMargins = [...rowMargins];
    if (Array.isArray(arg1)) {
      arg1.forEach(update => { newRowMargins[update.index] = { ...(newRowMargins[update.index] || { top: 0, bottom: 0, left: 0 }), ...update.changes }; });
    } else {
      for (let i = arg1; i <= arg2; i++) { newRowMargins[i] = { ...(newRowMargins[i] || { top: 0, bottom: 0, left: 0 }), ...arg3 }; }
    }
    commitChange(sheetData, rowTypes, sectionLabels, symbols, newRowMargins);
  };

  const addSymbol = (type, start, end, options = {}) => {
    if (isReadOnlyRef.current) return; 
    const newSymbols = [...symbols, { id: Date.now(), type, start, end, ...options }];
    commitChange(sheetData, rowTypes, sectionLabels, newSymbols);
  };
  const updateSymbol = (id, updates) => { if (isReadOnlyRef.current) return; commitChange(sheetData, rowTypes, sectionLabels, symbols.map(s => s.id === id ? { ...s, ...updates } : s)); };
  const removeSymbol = (id) => { if (isReadOnlyRef.current) return; commitChange(sheetData, rowTypes, sectionLabels, symbols.filter(s => s.id !== id)); };
  const removeSymbolByCell = (cell) => {
    if (isReadOnlyRef.current) return; 
    if (!cell) return;
    const newSymbols = symbols.filter(s => !(s.start[0] === cell[0] && s.start[1] === cell[1] && s.start[2] === cell[2]) && !(s.end[0] === cell[0] && s.end[1] === cell[1] && s.end[2] === cell[2]));
    if (newSymbols.length !== symbols.length) commitChange(sheetData, rowTypes, sectionLabels, newSymbols);
  };

  const addDetail = () => { if (isReadOnlyRef.current) return; setHeaderDetails([...headerDetails, { id: headerDetails.length > 0 ? Math.max(...headerDetails.map(d => d.id)) + 1 : 1, label: "หัวข้อใหม่", value: "ระบุข้อมูล" }]); };
  const removeDetail = (id) => { if (isReadOnlyRef.current) return; setHeaderDetails(headerDetails.filter(detail => detail.id !== id)); };
  const updateDetail = (id, key, newValue) => { if (isReadOnlyRef.current) return; setHeaderDetails(headerDetails.map(detail => detail.id === id ? { ...detail, [key]: newValue } : detail)); };
  const changeInstrument = (instrumentId) => {
    if (isReadOnlyRef.current) return;
    
    // ⭐ เช็กให้ชัวร์ว่าลาก "คลุมดำ" จริงๆ (จุดเริ่มต้นกับจุดสิ้นสุดต้องไม่ใช่อันเดียวกัน)
    let isBlockSelection = false;
    if (selectionRange && selectionRange.start && selectionRange.end) {
      const { start: [sr, sm, sc], end: [er, em, ec] } = selectionRange;
      if (sr !== er || sm !== em || sc !== ec) {
        isBlockSelection = true;
      }
    }
    
    if (isBlockSelection) {
      const { start: [sr, sm, sc], end: [er, em, ec] } = selectionRange;
      const minR = Math.min(sr, er), maxR = Math.max(sr, er);
      const startCol = getFlattenedCol(sheetData[sr], rowTypes[sr], sm, sc);
      const endCol = getFlattenedCol(sheetData[er], rowTypes[er], em, ec);
      const minCol = Math.min(startCol, endCol), maxCol = Math.max(startCol, endCol);

      const newLayoutConfig = { ...layoutConfig };
      const newCustomStyles = { ...(newLayoutConfig.customStyles || {}) };

      let hasChanges = false;

      for (let r = minR; r <= maxR; r++) {
        if (rowTypes[r] === 'page-break' || rowTypes[r] === 'text') continue;
        let currentCol = 0;
        for (let m = 0; m < sheetData[r].length; m++) {
          if (rowTypes[r].startsWith('double') && m === 0) continue;
          for (let c = 0; c < sheetData[r][m].length; c++) {
            if (currentCol >= minCol && currentCol <= maxCol) {
              const cellKey = `${r}_${m}_${c}`;
              newCustomStyles[cellKey] = {
                ...(newCustomStyles[cellKey] || {}),
                instrumentId: instrumentId 
              };
              
              // ⭐ ถ้าเป็นบรรทัดคู่ ต้องแอบไปฝังให้อีกมือด้วย เสียงจะได้ตรงกัน
              if (rowTypes[r] === 'double-right') {
                 newCustomStyles[`${r+1}_${m}_${c}`] = { ...(newCustomStyles[`${r+1}_${m}_${c}`] || {}), instrumentId };
              } else if (rowTypes[r] === 'double-left') {
                 newCustomStyles[`${r-1}_${m}_${c}`] = { ...(newCustomStyles[`${r-1}_${m}_${c}`] || {}), instrumentId };
              }
              
              hasChanges = true;
            }
            currentCol++;
          }
        }
      }

      if (hasChanges) {
        newLayoutConfig.customStyles = newCustomStyles;
        setLayoutConfig(newLayoutConfig);
        commitChange(sheetData, rowTypes, sectionLabels, symbols, rowMargins);
        setSelectionRange(null); 
      }
    } else {
      // ⭐ ถ้าไม่ได้คลุมดำยาวๆ (แค่คลิกเฉยๆ) ให้เปลี่ยนเครื่องดนตรีหลักของเพลงตามปกติ
      setCurrentInstrument(INSTRUMENT_CONFIG[instrumentId]);
    }
  };
  
  const performLoadProjectFromFirebase = (projectData) => {
    isImportingRef.current = true;
    try {
      const parsedFromSource = typeof projectData.sheetData === 'string' ? JSON.parse(projectData.sheetData) : projectData.sheetData;
      const { defaultSheet, defaultTypes, defaultMargins } = resetProjectScopedState({ keepProjectId: true });
      const parsedSheetData = parsedFromSource || defaultSheet;

      if (projectData.id) setProjectId(projectData.id);
      if (projectData.name !== undefined) setProjectName(projectData.name);
      if (projectData.songName !== undefined) setSongName(projectData.songName);

      setSheetData(parsedSheetData);

      const loadedRowTypes = projectData.rowTypes || defaultTypes;
      const loadedSectionLabels = projectData.sectionLabels || {};
      const loadedSymbols = projectData.symbols || [];
      const loadedLayoutConfig = { ...createDefaultLayoutConfig(), ...(projectData.layoutConfig || {}) };
      const loadedHeaderDetails = projectData.headerDetails || createDefaultHeaderDetails();
      const loadedPlaybackSequence = projectData.playbackSequence || [];
      const loadedMargins = projectData.rowMargins || createDefaultRowMargins(parsedSheetData?.length || defaultMargins.length);
      const loadedInstrument = (projectData.currentInstrument && INSTRUMENT_CONFIG[projectData.currentInstrument])
        ? INSTRUMENT_CONFIG[projectData.currentInstrument]
        : DEFAULT_INSTRUMENT;

      setRowTypes(loadedRowTypes);
      setSectionLabels(loadedSectionLabels);
      setSymbols(loadedSymbols);
      setLayoutConfig(loadedLayoutConfig);
      setHeaderDetails(loadedHeaderDetails);
      setCurrentInstrument(loadedInstrument);
      setPlaybackSequence(loadedPlaybackSequence);
      setIsLoopAll(projectData.isLoopAll !== undefined ? projectData.isLoopAll : false);
      setIsLoopOne(projectData.isLoopOne !== undefined ? projectData.isLoopOne : false);

      if (projectData.intervalMode !== undefined) {
        setIntervalMode(projectData.intervalMode);
      } else if (projectData.isOctaveMode !== undefined) {
        setIntervalMode(projectData.isOctaveMode ? '8' : 'off');
      } else {
        setIntervalMode('off');
      }

      setIsReduceMode(projectData.isReduceMode !== undefined ? projectData.isReduceMode : false);
      setIsShowPlayMode(projectData.isShowPlayMode !== undefined ? projectData.isShowPlayMode : false);

      setRowMargins(loadedMargins);
      setSelectedCell([0, 0, 0]);
      setSelectionRange(null);
    } catch (error) {
      console.error("โหลดโปรเจกต์ไม่สำเร็จ:", error);
      alert("ไม่สามารถโหลดข้อมูลจาก Firebase ได้!");
    } finally {
      setTimeout(() => { isImportingRef.current = false; }, 1000);
    }
  };

  const newProject = (skipWarning = false) => {
    const wasReadOnly = isReadOnlyRef.current;
    setReadOnlyMode(false);
    checkUnsavedAndPrompt('NEW', null, skipWarning || wasReadOnly);
  };
  const loadProject = (file, skipWarning = false) => {
    const wasReadOnly = isReadOnlyRef.current;
    setReadOnlyMode(false);
    checkUnsavedAndPrompt('LOAD_LOCAL', file, skipWarning || wasReadOnly);
  };
  const loadProjectFromFirebase = (data, skipWarning = false, readOnly = false) => {
    const wasReadOnly = isReadOnlyRef.current;
    setReadOnlyMode(readOnly);
    checkUnsavedAndPrompt('LOAD_FIREBASE', data, skipWarning || (wasReadOnly && !readOnly));
  };

  const applyTemplate = (templateData) => {
    resetProjectScopedState();

    setSongName(templateData.defaultSongName || "เพลงใหม่");
    setProjectName("โปรเจกต์ไม่มีชื่อ");
    setHeaderDetails(templateData.headerDetails || createDefaultHeaderDetails());

    if (templateData.detailsAlign) {
      setLayoutConfig(prev => ({ ...prev, detailsAlign: templateData.detailsAlign }));
    }
  };

  const selectedCellRef = useRef(selectedCell);
  const selectedSymbolIdRef = useRef(selectedSymbolId);

  useEffect(() => { selectedCellRef.current = selectedCell; }, [selectedCell]);
  useEffect(() => { selectedSymbolIdRef.current = selectedSymbolId; }, [selectedSymbolId]);

  const actionsRef = useRef({});
  useEffect(() => {
    actionsRef.current = {
      undo, redo, copySelection, pasteSelection, cutSelection, 
      togglePlay, inputNote, removeSymbol, removeSymbolByCell, 
      addRow, addDoubleRow, removeRow, setSelectionRange, 
      setSelectedSymbolId, setSelectedCell, addAnnotationRow, addNathapRow
    };
  });

  useEffect(() => {
    let isCtrlCombination = false; 

    const handleKeyDown = (e) => {
      // ⭐ 1. ดักจับ Spacebar เป็นอันดับแรกสุด!
      if (e.code === 'Space') {
        const tag = e.target?.tagName;
        // ยกเว้นกรณีที่กำลังพิมพ์ชื่อเพลง หรือพิมพ์เนื้อร้องอยู่ (เราต้องอนุญาตให้เคาะวรรคได้)
        const isEditable = e.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        
        if (!isEditable) {
          e.preventDefault();   // กันหน้าจอเลื่อน
          e.stopPropagation();  // ชิงตัดบท ไม่ให้คำสั่งทะลุไปกดปุ่มอื่นๆ
          
          // เคลียร์โฟกัสทิ้งทันที! เพื่อป้องกันปุ่มลั่นตอนจังหวะปล่อยนิ้ว (keyup)
          if (document.activeElement && document.activeElement.tagName !== 'BODY') {
            document.activeElement.blur();
          }
          
          actionsRef.current.togglePlay(); // สั่งเล่น/หยุดเพลง
          return;
        }
      }

      const tag = e.target?.tagName;
      const isEditable = e.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      
      if (isEditable) return; 

      if (e.ctrlKey && e.key !== 'Control') {
        isCtrlCombination = true;
      }

      if (e.key === 'Backspace') {
        if (isReadOnlyRef.current) { e.preventDefault(); return; } 
        e.preventDefault();
        
        if (selectedSymbolIdRef.current) {
          actionsRef.current.removeSymbol(selectedSymbolIdRef.current);
          actionsRef.current.setSelectedSymbolId(null);
        } else if (selectedCellRef.current) {
          actionsRef.current.removeSymbolByCell(selectedCellRef.current);
          actionsRef.current.inputNote('BACKSPACE');
        }
        return;
      }

      if (e.key === 'Delete') {
        if (isReadOnlyRef.current) { e.preventDefault(); return; } 
        e.preventDefault();
        
        if (selectedSymbolIdRef.current) {
          actionsRef.current.removeSymbol(selectedSymbolIdRef.current);
          actionsRef.current.setSelectedSymbolId(null);
        } else if (selectedCellRef.current) {
          actionsRef.current.removeRow(); 
        }
        return;
      }

      if (e.key === 'Insert') {
        if (isReadOnlyRef.current) { e.preventDefault(); return; }
        e.preventDefault();
        
        if (selectedCellRef.current) {
          const [rIdx] = selectedCellRef.current;
          const currentType = rowTypesRef.current[rIdx]; 
          
          if (currentType && currentType.startsWith('double')) actionsRef.current.addDoubleRow(); 
          else actionsRef.current.addRow(); 
        }
        return;
      }

      if (e.key.startsWith('Arrow')) {
        e.preventDefault(); 
        if (!selectedCellRef.current) return;
        
        let [r, m, c] = selectedCellRef.current;
        const sheet = sheetDataRef.current;
        const rTypes = rowTypesRef.current;
        
        if (e.key === 'ArrowRight') {
          if (c < sheet[r][m].length - 1) {
             c++;
          } else if (m < sheet[r].length - 1) {
             m++; c = 0;
          } else {
             let nextR = r + 1;
             while (nextR < sheet.length && (rTypes[nextR] === 'page-break' || rTypes[nextR] === 'text')) nextR++;
             if (nextR < sheet.length) {
                r = nextR;
                m = rTypes[r].startsWith('double') ? 1 : 0;
                c = 0;
             }
          }
        } else if (e.key === 'ArrowLeft') {
          if (c > 0) {
             c--;
          } else if (m > (rTypes[r].startsWith('double') ? 1 : 0)) {
             m--; c = sheet[r][m].length - 1;
          } else {
             let prevR = r - 1;
             while (prevR >= 0 && (rTypes[prevR] === 'page-break' || rTypes[prevR] === 'text')) prevR--;
             if (prevR >= 0) {
                r = prevR;
                m = sheet[r].length - 1;
                c = sheet[r][m].length - 1;
             }
          }
        } else if (e.key === 'ArrowDown') {
          let nextR = r + 1;
          while (nextR < sheet.length && (rTypes[nextR] === 'page-break' || rTypes[nextR] === 'text')) nextR++;
          if (nextR < sheet.length) {
             r = nextR;
             if (m >= sheet[r].length) m = sheet[r].length - 1;
             if (rTypes[r].startsWith('double') && m === 0) m = 1; 
             if (c >= sheet[r][m].length) c = sheet[r][m].length - 1;
          }
        } else if (e.key === 'ArrowUp') {
          let prevR = r - 1;
          while (prevR >= 0 && (rTypes[prevR] === 'page-break' || rTypes[prevR] === 'text')) prevR--;
          if (prevR >= 0) {
             r = prevR;
             if (m >= sheet[r].length) m = sheet[r].length - 1;
             if (rTypes[r].startsWith('double') && m === 0) m = 1;
             if (c >= sheet[r][m].length) c = sheet[r][m].length - 1;
          }
        }
        
        actionsRef.current.setSelectedCell([r, m, c]);
        actionsRef.current.setSelectionRange(null);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') { e.preventDefault(); if (!isReadOnlyRef.current) actionsRef.current.undo(); } 
        else if (e.code === 'KeyR' || e.code === 'KeyY') { e.preventDefault(); if (!isReadOnlyRef.current) actionsRef.current.redo(); } 
        else if (e.code === 'KeyC') { e.preventDefault(); actionsRef.current.copySelection(); }
        else if (e.code === 'KeyV') { e.preventDefault(); if (!isReadOnlyRef.current) actionsRef.current.pasteSelection(); }
        else if (e.code === 'KeyX') { e.preventDefault(); if (!isReadOnlyRef.current) actionsRef.current.cutSelection(); }
        // ⭐ เพิ่ม Ctrl+A สำหรับคลุมดำตัวโน้ตทั้งหมด
        else if (e.code === 'KeyA') {
          e.preventDefault(); // บล็อกไม่ให้เบราว์เซอร์คลุมดำทั้งหน้าเว็บ
          
          const sheet = sheetDataRef.current;
          const rTypes = rowTypesRef.current;
          let firstCell = null;
          let lastCell = null;
          
          // วนลูปหาโน้ตตัวแรกสุด และตัวสุดท้ายสุดของกระดาษ
          for (let r = 0; r < sheet.length; r++) {
            if (rTypes[r] === 'page-break' || rTypes[r] === 'text') continue;
            
            // ข้ามคอลัมน์ 0 ถ้าเป็นบรรทัดคู่ (เพราะเป็นป้ายชื่อ มือซ้าย/ขวา)
            const startM = rTypes[r].startsWith('double') ? 1 : 0;
            
            if (!firstCell && sheet[r] && sheet[r].length > startM) {
               firstCell = [r, startM, 0];
            }
            if (sheet[r] && sheet[r].length > 0) {
               const lastM = sheet[r].length - 1;
               const lastC = sheet[r][lastM].length - 1;
               lastCell = [r, lastM, lastC];
            }
          }
          
          // สั่งคลุมดำตั้งแต่ตัวแรกถึงตัวสุดท้าย
          if (firstCell && lastCell) {
             actionsRef.current.setSelectionRange({ start: firstCell, end: lastCell });
             actionsRef.current.setSelectedCell(lastCell); // ย้ายเคอร์เซอร์ไปไว้ที่ตัวสุดท้าย
          }
        }
      }
    };

    const handleKeyUp = (e) => {
      const tag = e.target?.tagName;
      const isEditable = e.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (isEditable) return; 

      if (e.code === 'ControlRight') {
        if (!isReadOnlyRef.current && !isCtrlCombination && selectedCellRef.current) {
          actionsRef.current.inputNote('-');
        }
      }

      if (e.key === 'Control') {
        isCtrlCombination = false;
      }
    };
    
   // ⭐ เติม true เข้าไปด้านหลัง
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true); 
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true); 
    };
    
  }, []); 
  
  return (
    <MusicContext.Provider value={{ 
      currentInstrument, changeInstrument, sheetData, selectedCell, setSelectedCell, inputNote, updateCellToken,
      appendNoteToCurrentCell, trimCurrentCellToken, moveSelectionNext, moveSelectionPrev,
      layoutConfig, setLayoutConfig, headerDetails, addDetail, removeDetail, updateDetail,
      songName, setSongName: handleSetSongName, 
      projectName, setProjectName,
      sectionLabels, addSectionLabel, updateSectionLabel, removeSectionLabel,
      addRow, removeRow, addMeasure, removeMeasure, selectionRange, setSelectionRange,
      addNoteColumn, removeNoteColumn, rowTypes, addDoubleRow, addPageBreak, visualRowCount,
      startSelection, updateSelection, endSelection, copySelection, pasteSelection, cutSelection, clipboardData,
      saveProject, loadProject, loadProjectFromFirebase, newProject,
      undo, redo, canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1,
      isPlaying, playbackCursor, startPlayback, stopPlayback, togglePlay,
      symbols, addSymbol, updateSymbol, removeSymbol, removeSymbolByCell,
      selectedSymbolId, setSelectedSymbolId,
      intervalMode, setIntervalMode,
      isReduceMode, setIsReduceMode, 
      isShowPlayMode, setIsShowPlayMode,
      isAutoScroll, setIsAutoScroll, 
      shiftNoteObject, shiftNoteString,
      addTextRow, updateTextRow, addAnnotationRow, addNathapRow,
      rowMargins, updateRowMarginsList,
      
      playbackSequence, setPlaybackSequence,
      activeSequenceIdx, activeLoop,
      toolbarMode, setToolbarMode,
      currentTime, totalTime, seek,
      INSTRUMENT_CONFIG,
      
      isLoopAll, setIsLoopAll,
      isLoopOne, setIsLoopOne,
      skipToNext, skipToPrev, jumpToSequence,
      availableSections, 
      applyTemplate,
      isReadOnly,
      convertMeasureToText,  
      updateMeasureText      

    }}>
      {pendingAction.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl scale-100 animate-slideUp text-center" style={{ fontFamily: 'Prompt, sans-serif' }}>
            <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-2">คุณมีงานที่ค้างอยู่</h3>
            <p className="text-sm text-slate-500 mb-6">หากเปิดโปรเจกต์ใหม่ตอนนี้ ข้อมูลบนหน้าจอที่ยังไม่ได้บันทึกจะหายไป ต้องการบันทึกก่อนหรือไม่?</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={async () => {
                  const projectData = { 
                    name: projectName, songName, sheetData, rowTypes, sectionLabels, 
                    symbols, layoutConfig, headerDetails, currentInstrument: currentInstrument.id, 
                    rowMargins, playbackSequence 
                  };
                  await autoSaveToFirebase(projectData);
                  executeAction(pendingAction.type, pendingAction.payload);
                }} 
                className="w-full py-3 font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-xl transition-all shadow-md shadow-sky-500/20 active:scale-[0.98]"
              >
                บันทึกลงฐานข้อมูล
              </button>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setPendingAction({ isOpen: false, type: null, payload: null })} 
                  className="flex-1 py-3 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors active:scale-[0.98]"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => executeAction(pendingAction.type, pendingAction.payload)} 
                  className="flex-1 py-3 font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors active:scale-[0.98]"
                >
                  ไม่บันทึก (ทิ้งงาน)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {children}
    </MusicContext.Provider>
  );
};