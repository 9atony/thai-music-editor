import React, { createContext, useState, useMemo, useEffect, useRef } from 'react';
import { INSTRUMENT_CONFIG } from '../utils/instrumentConfig';
import { preloadSounds, playNote, initAudioContext } from '../utils/audioEngine'; 
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

// ⭐ อัปเดต: รองรับ Accent และ Custom Velocities
const parseCellToken = (token, sabatStyle = 'crescendo', customVels = []) => {
  const notes = splitThaiNoteToken(token);
  if (notes.length === 0) return [];
  if (notes.length === 1) return [{ note: notes[0], ratio: 0, emphasis: 1 }];

  return notes.map((note, index) => {
    let emp = 1;
    
    if (sabatStyle === 'custom' && customVels.length === notes.length) {
       // ถ้าใช้แบบ Custom ให้ดึงจากสไลเดอร์ (หาร 100 ให้เป็นทศนิยม)
       emp = customVels[index] / 100;
    } else if (sabatStyle === 'flat') {
       emp = 1;
    } else if (sabatStyle === 'accent') {
       // เบา-ดัง-ดัง (ตัวแรกเบา 50%, ตัวที่เหลือ 100%)
       emp = index === 0 ? 0.5 : 1;
    } else {
       // Crescendo เดิม
       emp = index === notes.length - 1 ? 1 : Math.max(0.55, 0.88 - (index * 0.08));
    }

    return {
      note,
      ratio: index / notes.length,
      emphasis: emp,
    };
  });
};

const formatInstrumentNote = (key) => {
  const octave = parseInt(key.eng.replace(/\D/g, ''), 10);
  if (octave >= 5) return key.thai + '\u0E4D';
  if (octave === 2) return key.thai + '\u0E3A\u200B';
  if (octave === 3) return key.thai + '\u0E3A';
  return key.thai;
};

const getNoteMeta = (instrument, noteStr) => {
  if (!instrument?.keys || !noteStr) return null;
  return instrument.keys
    .map((key) => ({
      formatted: formatInstrumentNote(key),
      pitch: key.eng.replace(/\d/g, ''),
      octave: parseInt(key.eng.replace(/\D/g, ''), 10),
    }))
    .find((key) => key.formatted === noteStr) || null;
};

const getPreferredOctaveDirection = (instrument, noteStr) => {
  const meta = getNoteMeta(instrument, noteStr);
  if (!meta) return 'up';
  if (meta.octave >= 4) return 'down';
  if (meta.octave === 3 && ['G', 'A', 'B'].includes(meta.pitch)) return 'down';
  return 'up';
};

const getOctavePairNote = (instrument, noteStr, preferredDirection = 'up') => {
  if (!instrument?.keys || !noteStr) return null;
  const keys = instrument.keys.map((key) => ({
    formatted: formatInstrumentNote(key),
    pitch: key.eng.replace(/\d/g, ''),
    octave: parseInt(key.eng.replace(/\D/g, ''), 10),
  }));
  const current = keys.find((key) => key.formatted === noteStr);
  if (!current) return null;
  const directions = preferredDirection === 'down' ? [-1, 1] : [1, -1];
  for (const step of directions) {
    const pair = keys.find(
      (key) => key.pitch === current.pitch && key.octave === current.octave + step
    );
    if (pair) return pair.formatted;
  }
  return null;
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

export const MusicProvider = ({ children }) => {
  const [currentInstrument, setCurrentInstrument] = useState(INSTRUMENT_CONFIG["khong-wong-yai"] || INSTRUMENT_CONFIG["ranat-ek"]);
  const [sheetData, setSheetData] = useState(Array(4).fill().map(() => Array(8).fill().map(() => Array(4).fill('-'))));
  const [rowTypes, setRowTypes] = useState(Array(4).fill('single'));
  const [rowMargins, setRowMargins] = useState(Array(4).fill({ top: 0, bottom: 0, left: 0 }));
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
  
  const [isOctaveMode, setIsOctaveMode] = useState(false);
  const [isReduceMode, setIsReduceMode] = useState(false);
  const [isShowPlayMode, setIsShowPlayMode] = useState(false);
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
  
  const autoSaveToFirebase = async (data) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return; 
    try {
      const id = await saveProjectToDB(uid, projectId, data);
      if (!projectId && id) setProjectId(id); 
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
  const effectTimersRef = useRef([]);
  const mutedCellsRef = useRef(new Set());
  
  // ⭐ อัปเดต: เพิ่มการตั้งค่าเริ่มต้นแบบ Global สำหรับลูกสะบัดและลูกกรอ
  const [layoutConfig, setLayoutConfig] = useState({
    fontSize: 30, isBold: false, isItalic: false, measureHeight: 48,
    rowGap: 32, songNameSize: 48, authorSize: 16, detailsAlign: 'between',
    borderWidth: 2, innerBorderWidth: 1, borderColor: '#1e293b', borderRadius: 0,
    bpm: 80, volume: 100, 
    
    // === ตั้งค่าเริ่มต้น ลูกสะบัด ===
    sabatColor: '#1e293b', sabatStrokeWidth: 2.5, sabatCurve: 20, sabatOffset: 4, sabatStyle: 'crescendo',
    // === ตั้งค่าเริ่มต้น ลูกกรอ ===
    kroColor: '#3b82f6', kroStrokeWidth: 2.5, kroOffset: 30, kroSpeed: 65, kroStartHand: 'right',
    
    activeSymbol: 'sabat', symbolColor: '#1e293b', symbolStrokeWidth: 2.5, symbolHeight: 20, 
    marginTop: 48, marginBottom: 48, marginLeft: 48, marginRight: 48,
    marginUnit: 'px', textLineHeight: 1.5, textFontSize: 16
  });

  const layoutConfigRef = useRef(layoutConfig);
  const isPlayingRef = useRef(false);
  const sheetDataRef = useRef(sheetData);
  const rowTypesRef = useRef(rowTypes);
  const symbolsRef = useRef(symbols);
  const isOctaveModeRef = useRef(isOctaveMode); 
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

  useEffect(() => { layoutConfigRef.current = layoutConfig; }, [layoutConfig]);
  useEffect(() => { sheetDataRef.current = sheetData; }, [sheetData]);
  useEffect(() => { rowTypesRef.current = rowTypes; }, [rowTypes]);
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]); 
  useEffect(() => { isOctaveModeRef.current = isOctaveMode; }, [isOctaveMode]); 
  useEffect(() => { isReduceModeRef.current = isReduceMode; }, [isReduceMode]);
  useEffect(() => { isShowPlayModeRef.current = isShowPlayMode; }, [isShowPlayMode]);
  useEffect(() => { sectionLabelsRef.current = sectionLabels; }, [sectionLabels]);
  useEffect(() => { playbackSequenceRef.current = playbackSequence; }, [playbackSequence]);
  useEffect(() => { isLoopAllRef.current = isLoopAll; }, [isLoopAll]);
  useEffect(() => { isLoopOneRef.current = isLoopOne; }, [isLoopOne]);

  const playResolvedInstrumentNote = (noteStr, vol, options = {}) => {
    if (!noteStr || noteStr === '-') return;

    const { bypassOctaveLayer = false, hand = 'single' } = options;
    const actualNoteToPlay = isReduceModeRef.current ? shiftNoteString(noteStr, -1) : noteStr;
    
    playNote(currentInstrument.id, actualNoteToPlay, vol);
    
    if (isShowPlayModeRef.current) {
        window.dispatchEvent(new CustomEvent('tme-note-played', { detail: { note: actualNoteToPlay, hand } }));
    }

   if (!bypassOctaveLayer && isOctaveModeRef.current) {
      const preferredDirection = getPreferredOctaveDirection(currentInstrument, actualNoteToPlay);
      const octavePairNote = getOctavePairNote(currentInstrument, actualNoteToPlay, preferredDirection);
      if (octavePairNote && octavePairNote !== actualNoteToPlay) {
        playNote(currentInstrument.id, octavePairNote, vol);
        
        if (isShowPlayModeRef.current) {
            window.dispatchEvent(new CustomEvent('tme-note-played', { detail: { note: octavePairNote, hand } }));
        }
      }
    }
  };

  const previewCellToken = (token, baseVolume = layoutConfigRef.current.volume ?? 100, previewGapMs = 90) => {
    // ⭐ ใช้ค่าสไตล์เริ่มต้นในการพรีวิว
    const sabatStyle = layoutConfigRef.current.sabatStyle ?? 'crescendo';
    const events = parseCellToken(token, sabatStyle);
    if (events.length === 0) return;

    events.forEach((event, index) => {
      const delay = events.length === 1 ? 0 : Math.max(0, Math.floor(index * previewGapMs));
      const volume = Math.max(0, Math.round(baseVolume * (event.emphasis ?? 1)));
      const playEvent = () => playResolvedInstrumentNote(event.note, volume, { hand: 'single' }); 

      if (delay <= 0) playEvent();
      else effectTimersRef.current.push(setTimeout(playEvent, delay));
    });
  };

  const updateCellToken = (row, meas, cell, token, options = {}) => {
    if (isReadOnlyRef.current) return;
    if (rowTypes[row] === 'page-break' || rowTypes[row] === 'text' || (rowTypes[row].startsWith('double') && meas === 0)) return;

    const normalizedToken = normalizeCellToken(token);
    const newData = sheetData.map((rowData) => rowData.map((measure) => [...measure]));
    newData[row][meas][cell] = normalizedToken;

    if (isOctaveModeRef.current && rowTypes[row].startsWith('double')) {
        const pairRow = rowTypes[row] === 'double-right' ? row + 1 : row - 1;
        if (pairRow >= 0 && pairRow < newData.length) {
            if (normalizedToken === '-') {
                newData[pairRow][meas][cell] = '-';
            } else {
                const parts = splitThaiNoteToken(normalizedToken);
                const pairedParts = parts.map(n => {
                    const actualNote = isReduceModeRef.current ? shiftNoteString(n, -1) : n;
                    const prefDir = getPreferredOctaveDirection(currentInstrument, actualNote);
                    const pairNoteBase = getOctavePairNote(currentInstrument, actualNote, prefDir) || actualNote;
                    return isReduceModeRef.current ? shiftNoteString(pairNoteBase, 1) : pairNoteBase;
                });
                newData[pairRow][meas][cell] = pairedParts.join('');
            }
        }
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

    newData[row][meas][cell] = mergedToken;

    if (isOctaveModeRef.current && rowTypes[row].startsWith('double')) {
        const pairRow = rowTypes[row] === 'double-right' ? row + 1 : row - 1;
        if (pairRow >= 0 && pairRow < newData.length) {
            const incomingStr = incomingParts.join('');
            const actualIncoming = isReduceModeRef.current ? shiftNoteString(incomingStr, -1) : incomingStr;
            const prefDir = getPreferredOctaveDirection(currentInstrument, actualIncoming);
            const pairBase = getOctavePairNote(currentInstrument, actualIncoming, prefDir) || actualIncoming;
            const incomingPair = isReduceModeRef.current ? shiftNoteString(pairBase, 1) : pairBase;
            
            const pairCurrentToken = normalizeCellToken(newData[pairRow][meas][cell]);
            const pairCurrentParts = pairCurrentToken === '-' ? [] : splitThaiNoteToken(pairCurrentToken);
            const pairMergedToken = normalizeCellToken([...pairCurrentParts, incomingPair].join(''));
            
            newData[pairRow][meas][cell] = pairMergedToken;
        }
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
    newData[row][meas][cell] = nextToken;

    if (isOctaveModeRef.current && rowTypes[row].startsWith('double')) {
        const pairRow = rowTypes[row] === 'double-right' ? row + 1 : row - 1;
        if (pairRow >= 0 && pairRow < newData.length) {
            const pairCurrentToken = normalizeCellToken(newData[pairRow][meas][cell]);
            if (pairCurrentToken !== '-') {
                const pairCurrentParts = splitThaiNoteToken(pairCurrentToken);
                const pairNextToken = pairCurrentParts.length <= 1 ? '-' : pairCurrentParts.slice(0, -1).join('');
                newData[pairRow][meas][cell] = pairNextToken;
            }
        }
    }

    commitChange(newData);
  };

  const [headerDetails, setHeaderDetails] = useState([
    { id: 1, label: "อัตราจังหวะ", value: "๒ ชั้น" },
    { id: 2, label: "หน้าทับ", value: "สองไม้" },
    { id: 3, label: "บันไดเสียง", value: "ทางเพียงออ" },
    { id: 4, label: "ผู้บันทึก", value: "9atony" }
  ]);

  useEffect(() => {
    if (currentInstrument && currentInstrument.id) {
      preloadSounds(currentInstrument.id);
      if (currentInstrument.id !== 'ranat-ek') setIsOctaveMode(false);
    }
  }, [currentInstrument]);

  const availableSections = useMemo(() => {
    const labels = new Set();
    Object.values(sectionLabels).forEach(arr => {
      arr.forEach(l => {
        if (l.text && !l.text.includes('กลับต้น') && l.text.trim() !== '') labels.add(l.text.trim());
      });
    });
    return Array.from(labels);
  }, [sectionLabels]);

  useEffect(() => {
    if (!isLoaded) return;
    const sheetLabelsSet = new Set(availableSections);
    
    setPlaybackSequence(prev => {
      let changed = false;
      let nextSeq = [...prev];
      const filteredSeq = nextSeq.filter(item => sheetLabelsSet.has(item.label.trim()));
      if (filteredSeq.length !== nextSeq.length) changed = true;
      nextSeq = filteredSeq;
      const seqLabelsSet = new Set(nextSeq.map(item => item.label.trim()));
      sheetLabelsSet.forEach(label => {
        if (!seqLabelsSet.has(label)) {
          nextSeq.push({ id: Date.now() + Math.random(), label: label, loops: 1 });
          changed = true;
        }
      });
      return changed ? nextSeq : prev;
    });
  }, [availableSections, isLoaded]);

  const getCellId = (r, m, c) => r * 100000 + m * 1000 + c;

  const startPlayback = async () => {
    if (isPlaying) return;
    if (initAudioContext) await initAudioContext();

    setIsPlaying(true);
    isPlayingRef.current = true;

    const currentSheetData = sheetDataRef.current;
    const currentRowTypes = rowTypesRef.current;
    const currentSectionLabels = sectionLabelsRef.current;
    const sheetSections = [];
    let lastValidRow = 0;
    let lastProcessedVIdx = -1; 

    for (let r = 0; r < currentSheetData.length; r++) {
        if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text') continue;
        const vIdx = getVisualIndex(r, currentRowTypes);
        const labels = currentSectionLabels[vIdx] || [];
        const validLabels = labels.filter(l => !l.text.includes('กลับต้น') && l.text.trim() !== '');

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
          if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'double-left') continue;
          for (let m = 0; m < currentSheetData[r].length; m++) {
            if (currentRowTypes[r].startsWith('double') && m === 0) continue;
            const cellCount = currentSheetData[r][m].length;
            if (cellCount > 0) {
              sectionMs += (15000 / currentBpm) * 4; 
            }
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
    }, 1000);

    effectTimersRef.current.forEach(t => clearTimeout(t));
    effectTimersRef.current = [];
    mutedCellsRef.current.clear();

    let currentCursor = [...selectedCell];
    let startR = currentCursor[0];

    if (currentRowTypes[startR] === 'double-left') { startR -= 1; currentCursor[0] = startR; }
    if (currentRowTypes[startR].startsWith('double') && currentCursor[1] === 0) currentCursor[1] = 1; 

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

    let expectedNextTick;

    const playNextStep = (r, m, c) => {
      if (!isPlayingRef.current) return; 
      if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text') {
          let nextR = r + 1;
          if (nextR >= currentSheetData.length) { playbackTimerRef.current = setTimeout(() => stopPlayback(), 500); return; }
          let nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
          playbackTimerRef.current = setTimeout(() => playNextStep(nextR, nextM, 0), 0);
          return;
      }
      
      const currentBpm = layoutConfigRef.current.bpm || 80;
      const cellCountInMeasure = currentSheetData[r][m].length;
      const standardMsPerCell = 15000 / currentBpm;
      const msPerCell = Math.floor(standardMsPerCell * (4 / cellCountInMeasure));

      // ⭐ ส่งค่าสไตล์ของลูกสะบัดเข้าไปคำนวณน้ำหนักเสียง
      const scheduleTokenPlayback = (tokenStr, vol, cellDurationMs = msPerCell, baseDelayMs = 0, options = {}) => {
        const sabatStyle = layoutConfigRef.current.sabatStyle ?? 'crescendo';
        const tokenEvents = parseCellToken(tokenStr, sabatStyle);
        if (tokenEvents.length === 0) return;

        tokenEvents.forEach((event) => {
          const eventDelay = Math.max(0, Math.floor(baseDelayMs + (cellDurationMs * (event.ratio ?? 0))));
          const eventVolume = Math.max(0, Math.round(vol * (event.emphasis ?? 1)));
          const playEvent = () => playResolvedInstrumentNote(event.note, eventVolume, options);

          if (eventDelay <= 0) playEvent();
          else effectTimersRef.current.push(setTimeout(playEvent, eventDelay));
        });
      };

      setPlaybackCursor([r, m, c]);
      let cellsToCheck = [[r, m, c]];
      if (currentRowTypes[r] === 'double-right') cellsToCheck.push([r + 1, m, c]);
      else if (currentRowTypes[r] === 'double-left') cellsToCheck.push([r - 1, m, c]);

      let processedSymbols = new Set();
      const currentSymbols = symbolsRef.current; 

      cellsToCheck.forEach(cell => {
          const [cr, cm, cc] = cell;
          const startingSymbols = currentSymbols.filter(s => {
              let sStart = [...s.start]; let sEnd = [...s.end];
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
              let startPos = [...sym.start]; let endPos = [...sym.end];
              if (currentRowTypes[startPos[0]] === 'double-left') startPos[0] -= 1;
              if (currentRowTypes[endPos[0]] === 'double-left') endPos[0] -= 1;
              const startAbs = startPos[0] * 1000 + startPos[1] * 10 + startPos[2];
              const endAbs = endPos[0] * 1000 + endPos[1] * 10 + endPos[2];
              if (startAbs > endAbs) { let temp = startPos; startPos = endPos; endPos = temp; }
              let currR = startPos[0], currM = startPos[1], currC = startPos[2];
              const endR = endPos[0], endM = endPos[1], endC = endPos[2];
              let events = [], cellIds = [], dist = 0, failSafe = 0;

              while (failSafe < 500) {
                  const stepRowType = currentRowTypes[currR];
                  let colNotes = [];
                  if (stepRowType && stepRowType.startsWith('double')) {
                      const stepTop = stepRowType === 'double-left' ? currR - 1 : currR;
                      const stepBot = stepTop + 1;
                      const noteTop = currentSheetData[stepTop]?.[currM]?.[currC];
                      const noteBot = currentSheetData[stepBot]?.[currM]?.[currC];
                      if (noteTop && noteTop !== '-') colNotes.push(noteTop);
                      if (noteBot && noteBot !== '-') colNotes.push(noteBot);
                      cellIds.push(getCellId(stepTop, currM, currC));
                      cellIds.push(getCellId(stepBot, currM, currC));
                  } else {
                      const note = currentSheetData[currR]?.[currM]?.[currC];
                      if (note && note !== '-') colNotes.push(note);
                      cellIds.push(getCellId(currR, currM, currC));
                  }
                  if (colNotes.length > 0) events.push(colNotes);
                  if (currR === endR && currM === endM && currC === endC) break;
                  dist++; currC++;
                  const currentMeasureLength = currentSheetData[currR]?.[currM]?.length ?? 0;
                  if (currC >= currentMeasureLength) {
                      currC = 0; currM++;
                      if (currM >= (currentSheetData[currR]?.length ?? 0)) {
                          let tempR = currR + 1;
                          while (tempR < currentSheetData.length && (currentRowTypes[tempR] === 'page-break' || currentRowTypes[tempR] === 'text' || currentRowTypes[tempR] === 'double-left')) tempR++;
                          if (tempR >= currentSheetData.length) break;
                          currR = tempR; currM = currentRowTypes[currR]?.startsWith('double') ? 1 : 0;
                      }
                  }
                  failSafe++;
              }
              cellIds.forEach(id => mutedCellsRef.current.add(id));
              const timeUntilEnd = dist * msPerCell; 

              if (sym.type === 'kro') {
                  if (window.kroInterval) clearInterval(window.kroInterval);
                  const startNotes = events[0] ? events[0].filter(n => n !== '-') : [];
                  const noteA = startNotes.length > 0 ? startNotes[0] : null;
                  if (noteA) {
                      const actualA = isReduceModeRef.current ? shiftNoteString(noteA, -1) : noteA;
                      const preferredDirection = getPreferredOctaveDirection(currentInstrument, actualA);
                      const pairBase = getOctavePairNote(currentInstrument, actualA, preferredDirection) || getOctavePairNote(currentInstrument, actualA, preferredDirection === 'down' ? 'up' : 'down') || actualA;
                      const noteB = isReduceModeRef.current ? shiftNoteString(pairBase, 1) : pairBase;
                      
                      // ⭐ อัปเดต: ระบบดึงความเร็วจากค่าเฉพาะจุดก่อน ถ้าไม่มีค่อยดึงจาก Global
                      const kroSpeed = sym.speed ?? layoutConfigRef.current.kroSpeed ?? 65;
                      const startHand = sym.startHand ?? layoutConfigRef.current.kroStartHand ?? 'right';
                      
                      let isNoteA = true;
                      window.kroInterval = setInterval(() => {
                          // ⭐ อัปเดต: สลับมือซ้าย/ขวาตามลำดับที่เลือกไว้
                          const currentHand = isNoteA 
                              ? (startHand === 'left' ? 'left' : 'right') 
                              : (startHand === 'left' ? 'right' : 'left');
                              
                          playResolvedInstrumentNote(isNoteA ? noteA : noteB, layoutConfigRef.current.volume ?? 100, { bypassOctaveLayer: true, hand: currentHand });
                          isNoteA = !isNoteA;
                      }, kroSpeed);
                      effectTimersRef.current.push(setTimeout(() => { clearInterval(window.kroInterval); window.kroInterval = null; }, timeUntilEnd));
                  }
              } else {
                  let sequenceOfChords = [];
                  events.forEach(colNotes => {
                      let parsedCols = colNotes.map(token => parseCellToken(token, sym.style ?? layoutConfigRef.current.sabatStyle ?? 'crescendo')); 
                      let maxNotes = Math.max(...parsedCols.map(p => p.length));
                      for(let i = 0; i < maxNotes; i++) {
                          let chord = [];
                          parsedCols.forEach(p => { if (i < p.length) chord.push(p[i].note); });
                          if (chord.length > 0) sequenceOfChords.push(chord);
                      }
                  });

                  const totalDurationMs = dist > 0 ? (dist * msPerCell) : (msPerCell * 0.8);
                  const stepCount = sequenceOfChords.length;
                  const sabatStyle = sym.style ?? layoutConfigRef.current.sabatStyle ?? 'crescendo';

                  if (stepCount === 1) {
                      let vol = layoutConfigRef.current.volume ?? 100;
                      sequenceOfChords[0].forEach(n => scheduleTokenPlayback(n, vol, msPerCell, totalDurationMs, { hand: 'single' }));
                  } else if (stepCount > 1) {
                      const intervalMs = totalDurationMs / (stepCount - 1);
                      const sabatStyle = sym.style ?? layoutConfigRef.current.sabatStyle ?? 'crescendo';
                      const customVels = sym.customvelocities || sym.customVelocities || []; // ⭐ ดึงค่าน้ำหนักจากสไลเดอร์

                      sequenceOfChords.forEach((chord, stepIdx) => {
                          const playTime = stepIdx * intervalMs;
                          const revIdx = (stepCount - 1) - stepIdx; 
                          let vol = layoutConfigRef.current.volume ?? 100;
                          
                          // ⭐ ลอจิกปรับความดังตามที่คุณเลื่อนสไลเดอร์หรือเลือก Preset
                          if (sabatStyle === 'custom' && customVels.length === stepCount) {
                              // ถ้าปรับแต่งเอง (Custom) ให้คูณตามค่าสไลเดอร์ของโน้ตตัวนั้นๆ ตรงๆ เลย
                              vol = Math.round(vol * (customVels[stepIdx] / 100));
                          } else if (sabatStyle === 'accent') {
                              // เบอดังดัง (ตัวแรก 50%, ที่เหลือ 100%)
                              vol = stepIdx === 0 ? Math.round(vol * 0.5) : vol;
                          } else if (sabatStyle === 'flat') {
                              // เท่ากันหมด
                              vol = layoutConfigRef.current.volume ?? 100;
                          } else if (sabatStyle === 'crescendo' && revIdx > 0) {
                              // เน้นตก (ค่อยๆ ดังขึ้น)
                              vol = Math.max(0, vol * (1 - (revIdx * 0.15)));
                          }
                          
                          chord.forEach(n => scheduleTokenPlayback(n, vol, Math.max(80, intervalMs), playTime, { hand: 'single' }));
                      });
                  }
              }
          });
      });

      if (currentRowTypes[r] === 'double-right') {
        const rightCellId = getCellId(r, m, c);
        const leftCellId = getCellId(r + 1, m, c);
        if (!mutedCellsRef.current.has(rightCellId)) scheduleTokenPlayback(currentSheetData[r][m][c], layoutConfigRef.current.volume ?? 100, msPerCell, 0, { hand: 'right' });
        if (!mutedCellsRef.current.has(leftCellId)) scheduleTokenPlayback(currentSheetData[r + 1] ? currentSheetData[r + 1][m][c] : '-', layoutConfigRef.current.volume ?? 100, msPerCell, 0, { hand: 'left' });
      } else {
        if (!mutedCellsRef.current.has(getCellId(r, m, c))) scheduleTokenPlayback(currentSheetData[r][m][c], layoutConfigRef.current.volume ?? 100, msPerCell, 0, { hand: 'single' });
      }

      let nextC = c + 1;
      let nextM = m;
      let nextR = r; 

      if (nextC >= currentSheetData[r][m].length) {
        nextC = 0; nextM++;
        if (nextM >= currentSheetData[r].length) {
          nextM = 0; 
          const seq = playbackSequenceRef.current;
          const currSeqIdx = activeSequenceIdxRef.current;
          const map = sheetMapRef.current;
          let isEndOfSection = false, currentItem = null, currentMappedSection = null;

          if (seq && seq.length > 0 && currSeqIdx < seq.length) {
              currentItem = seq[currSeqIdx];
              currentMappedSection = map.find(s => s.label === currentItem.label.trim());
              const rowCoverage = currentRowTypes[r] === 'double-right' ? r + 1 : r;
              if (currentMappedSection && rowCoverage >= currentMappedSection.endRow) isEndOfSection = true;
          }

          if (isEndOfSection && currentItem && currentMappedSection) {
              if (isLoopOneRef.current) {
                  nextR = currentMappedSection.startRow;
                  nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
                  nextC = 0;
                  let sectionMs = 0;
                  for (let sr = currentMappedSection.startRow; sr <= currentMappedSection.endRow; sr++) {
                      if (currentRowTypes[sr] === 'page-break' || currentRowTypes[sr] === 'text' || currentRowTypes[sr] === 'double-left') continue;
                      for (let sm = 0; sm < currentSheetData[sr].length; sm++) {
                          if (currentRowTypes[sr].startsWith('double') && sm === 0) continue;
                          const cellCount = currentSheetData[sr][sm].length;
                          if (cellCount > 0) sectionMs += (15000 / currentBpm) * 4;
                      }
                  }
                  playbackStartTimeRef.current += sectionMs;
              } 
              else if (activeLoopRef.current < currentItem.loops) {
                  activeLoopRef.current += 1;
                  setActiveLoop(activeLoopRef.current);
                  nextR = currentMappedSection.startRow;
                  nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
                  nextC = 0;
              } else {
                  const nextSeqIdx = currSeqIdx + 1;
                  if (nextSeqIdx < seq.length) {
                      activeSequenceIdxRef.current = nextSeqIdx;
                      setActiveSequenceIdx(nextSeqIdx);
                      activeLoopRef.current = 1;
                      setActiveLoop(1);
                      const nextMappedSection = map.find(s => s.label === seq[nextSeqIdx].label.trim());
                      if (nextMappedSection) {
                          nextR = nextMappedSection.startRow;
                          nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
                          nextC = 0;
                      } else { stopPlayback(); return; }
                  } else if (isLoopAllRef.current && seq.length > 0) {
                      activeSequenceIdxRef.current = 0;
                      setActiveSequenceIdx(0);
                      activeLoopRef.current = 1;
                      setActiveLoop(1);
                      const firstMappedSection = map.find(s => s.label === seq[0].label.trim());
                      if (firstMappedSection) {
                          nextR = firstMappedSection.startRow;
                          nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
                          nextC = 0;
                          seekOffsetRef.current = 0;
                          playbackStartTimeRef.current = performance.now();
                      } else { stopPlayback(); return; }
                  } else { 
                      stopPlayback(); return; 
                  }
              }
          } else {
              nextR = currentRowTypes[r] === 'double-right' ? r + 2 : r + 1;
              if (nextR >= currentSheetData.length) { playbackTimerRef.current = setTimeout(() => stopPlayback(), 500); return; }
              nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
          }
        }
      }

      expectedNextTick += msPerCell;
      let delay = expectedNextTick - performance.now();
      playbackTimerRef.current = setTimeout(() => playNextStep(nextR, nextM, nextC), delay < 0 ? 0 : delay);
    };

    expectedNextTick = performance.now();
    playNextStep(currentCursor[0], currentCursor[1], currentCursor[2]);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    setPlaybackCursor(null);
    if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    effectTimersRef.current.forEach(t => clearTimeout(t));
    effectTimersRef.current = [];
    mutedCellsRef.current.clear();
    if (window.kroInterval) { clearInterval(window.kroInterval); window.kroInterval = null; }
    
    if (uiTimerRef.current) {
        clearInterval(uiTimerRef.current);
        uiTimerRef.current = null;
    }
    seekOffsetRef.current = 0;
    setCurrentTime(0);
  };

  const startSelection = (r, m, c) => { setIsDragging(true); setDragStart([r, m, c]); setSelectionRange({ start: [r, m, c], end: [r, m, c] }); setSelectedCell([r, m, c]); };
  const updateSelection = (r, m, c) => { if (isDragging && dragStart) setSelectionRange({ start: dragStart, end: [r, m, c] }); };
  const endSelection = () => { setIsDragging(false); setDragStart(null); };

  const copySelection = () => {
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

    setClipboardData({ block: copiedBlock, symbols: copiedSymbols });
    setSelectionRange(null); 
  };

  const pasteSelection = () => {
    if (isReadOnlyRef.current) return; 
    if (!clipboardData) return;
    
    let blockToPaste = [];
    let symbolsToPaste = [];

    if (Array.isArray(clipboardData)) {
       if (clipboardData.length === 0) return;
       blockToPaste = clipboardData.map((row, idx) => ({ rowOffset: idx, cells: row }));
    } else {
       if (!clipboardData.block || clipboardData.block.length === 0) return;
       blockToPaste = clipboardData.block;
       symbolsToPaste = clipboardData.symbols || [];
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

  const cutSelection = () => {
    if (isReadOnlyRef.current) return; 
    if (!selectionRange) return;
    
    copySelection();
    
    const { start: [sr, sm, sc], end: [er, em, ec] } = selectionRange;
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
                  newData[r][m][c] = normalizedToken;
                  
                  if (isOctaveModeRef.current && rowTypes[r].startsWith('double')) {
                      const pairRow = rowTypes[r] === 'double-right' ? r + 1 : r - 1;
                      if (pairRow >= 0 && pairRow < newData.length) {
                          if (normalizedToken === '-') {
                              newData[pairRow][m][c] = '-';
                          } else {
                              const actualNote = isReduceModeRef.current ? shiftNoteString(normalizedToken, -1) : normalizedToken;
                              const prefDir = getPreferredOctaveDirection(currentInstrument, actualNote);
                              const pairBase = getOctavePairNote(currentInstrument, actualNote, prefDir) || actualNote;
                              newData[pairRow][m][c] = isReduceModeRef.current ? shiftNoteString(pairBase, 1) : pairBase;
                          }
                      }
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

    if (note === 'BACKSPACE') {
      newData[row][meas][cell] = '-';
      
      if (isOctaveModeRef.current && rowTypes[row].startsWith('double')) {
          const pairRow = rowTypes[row] === 'double-right' ? row + 1 : row - 1;
          if (pairRow >= 0 && pairRow < newData.length) newData[pairRow][meas][cell] = '-';
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
      newData[row][meas][cell] = normalizedToken;
      
      if (isOctaveModeRef.current && rowTypes[row].startsWith('double')) {
          const pairRow = rowTypes[row] === 'double-right' ? row + 1 : row - 1;
          if (pairRow >= 0 && pairRow < newData.length) {
              const actualNote = isReduceModeRef.current ? shiftNoteString(normalizedToken, -1) : normalizedToken;
              const prefDir = getPreferredOctaveDirection(currentInstrument, actualNote);
              const pairBase = getOctavePairNote(currentInstrument, actualNote, prefDir) || actualNote;
              newData[pairRow][meas][cell] = isReduceModeRef.current ? shiftNoteString(pairBase, 1) : pairBase;
          }
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
    const currentMeasureCount = sheetData[rIdx]?.length || 8;
    const isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (mIdx < Math.ceil(currentMeasureCount / 2));
    
    let insertIdx = isFirstHalf ? rIdx : rIdx + 1;

    if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1; 
    else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1; 

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
    if (isFirstHalf) setSelectedCell([insertIdx + 1, 0, 0]); 
  };

  const addDoubleRow = (insertAtTop = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef.current) stopPlayback(); 
    setSelectionRange(null); 
    
    const [rIdx, mIdx] = selectedCell;
    const isDouble = rowTypes[rIdx]?.startsWith('double');
    const isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (isDouble ? mIdx < 5 : mIdx < 4);
    
    let insertIdx = isFirstHalf ? rIdx : rIdx + 1;
    
    if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
    else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

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
    if (insertAtTop) setSelectedCell([insertIdx + 2, 0, 0]);
  };

  const addPageBreak = (insertAtTop = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef.current) stopPlayback(); 
    setSelectionRange(null);
    
    const [rIdx, mIdx] = selectedCell;
    const isDouble = rowTypes[rIdx]?.startsWith('double');
    const isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (isDouble ? mIdx < 5 : mIdx < 4);
    
    let insertIdx = isFirstHalf ? rIdx : rIdx + 1;
    
    if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
    else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

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
    const isDouble = rowTypes[rIdx]?.startsWith('double');
    const isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (isDouble ? mIdx < 5 : mIdx < 4);
    
    let insertIdx = isFirstHalf ? rIdx : rIdx + 1;
    
    if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
    else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

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

  const updateTextRow = (rIndex, text) => { if (isReadOnlyRef.current) return; const newData = [...sheetData]; newData[rIndex] = [[text]]; setSheetData(newData); };

  const removeRow = () => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef.current) stopPlayback();
    setSelectionRange(null); 
    const rowIdx = selectedCell[0];
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
    setSelectionRange(null); 
    const [rowIdx, measIdx] = selectedCell;
    if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text' || (rowTypes[rowIdx].startsWith('double') && measIdx === 0)) return; 
    if (sheetData[rowIdx].length > (rowTypes[rowIdx].startsWith('double') ? 2 : 1)) {
      const newData = [...sheetData];
      if (rowTypes[rowIdx] === 'single') newData[rowIdx].splice(measIdx, 1);
      else if (rowTypes[rowIdx] === 'double-right') { newData[rowIdx].splice(measIdx, 1); newData[rowIdx + 1].splice(measIdx, 1); }
      else if (rowTypes[rowIdx] === 'double-left') { newData[rowIdx].splice(measIdx, 1); newData[rowIdx - 1].splice(measIdx, 1); }
      commitChange(newData);
      if (measIdx >= newData[rowIdx].length) setSelectedCell([rowIdx, newData[rowIdx].length - 1, 0]);
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
    if (newData[r][m][0].startsWith('@TEXT_SPAN_')) {
       newData[r][m][1] = text;
       commitChange(newData);
    }
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
      isOctaveMode,
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
        
        setProjectName(targetProjectName);
        setSongName(targetSongName); 
        setProjectId(null);
      
        let parsedSheetData = data.sheetData;
        if (data.sheetData) {
          parsedSheetData = typeof data.sheetData === 'string' ? JSON.parse(data.sheetData) : data.sheetData;
          setSheetData(parsedSheetData);
        }
        if (data.rowTypes) setRowTypes(data.rowTypes);
        if (data.sectionLabels) setSectionLabels(data.sectionLabels);
        if (data.symbols) setSymbols(data.symbols);
        if (data.layoutConfig) setLayoutConfig(prev => ({ ...prev, ...data.layoutConfig }));
        if (data.headerDetails) setHeaderDetails(data.headerDetails);
        if (data.currentInstrument && INSTRUMENT_CONFIG[data.currentInstrument]) setCurrentInstrument(INSTRUMENT_CONFIG[data.currentInstrument]);

        if (data.playbackSequence) setPlaybackSequence(data.playbackSequence);
        if (data.isLoopAll !== undefined) setIsLoopAll(data.isLoopAll);
        if (data.isLoopOne !== undefined) setIsLoopOne(data.isLoopOne);
        if (data.isOctaveMode !== undefined) setIsOctaveMode(data.isOctaveMode);
        if (data.isReduceMode !== undefined) setIsReduceMode(data.isReduceMode);
        if (data.isShowPlayMode !== undefined) setIsShowPlayMode(data.isShowPlayMode);
        
        const loadedMargins = data.rowMargins || Array(data.sheetData?.length || 4).fill({ top: 0, bottom: 0, left: 0 });
        setRowMargins(loadedMargins);
        setSelectedCell([0, 0, 0]); 
        setSelectionRange(null);
        commitChange(parsedSheetData, data.rowTypes, data.sectionLabels, data.symbols, loadedMargins);

        const uid = auth.currentUser?.uid;
        if (uid) {
           const projectDataToSave = { 
             name: targetProjectName, songName: targetSongName, sheetData: parsedSheetData || sheetData, 
             rowTypes: data.rowTypes || rowTypes, sectionLabels: data.sectionLabels || sectionLabels, 
             symbols: data.symbols || symbols, layoutConfig: { ...layoutConfig, ...(data.layoutConfig || {}) }, 
             headerDetails: data.headerDetails || headerDetails, currentInstrument: data.currentInstrument || currentInstrument?.id || 'ranat-ek', 
             rowMargins: loadedMargins, playbackSequence: data.playbackSequence || playbackSequence,
             isLoopAll: data.isLoopAll || false, isLoopOne: data.isLoopOne || false, 
             isOctaveMode: data.isOctaveMode || false, isReduceMode: data.isReduceMode || false,
             isShowPlayMode: data.isShowPlayMode || false
           };
           
           const newId = await saveProjectToDB(uid, null, projectDataToSave);
           if (newId) setProjectId(newId); 
        }
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
    const initSheet = Array(4).fill().map(() => Array(8).fill().map(() => Array(4).fill('-')));
    const initType = Array(4).fill('single');
    const initMar = Array(4).fill({ top: 0, bottom: 0, left: 0 });
    
    setSongName("เพลงใหม่"); 
    setProjectName("โปรเจกต์ไม่มีชื่อ"); 
    setProjectId(null); 
    setSheetData(initSheet); setRowTypes(initType); setRowMargins(initMar); setSectionLabels({}); setSymbols([]);
    setHeaderDetails([{ id: 1, label: "อัตราจังหวะ", value: "๒ ชั้น" }, { id: 2, label: "หน้าทับ", value: "สองไม้" }, { id: 3, label: "บันไดเสียง", value: "ทางเพียงออ" }, { id: 4, label: "ผู้บันทึก", value: "9atony" }]);
    setSelectedCell([0, 0, 0]); setSelectionRange(null); setHistoryIndex(-1); setHistory([]); localStorage.removeItem('thaiMusicEditorAutoSave');
    commitChange(initSheet, initType, {}, [], initMar);
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
            if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text') continue;
            const vIdx = getVisualIndex(r, currentRowTypes);
            const labels = currentSectionLabels[vIdx] || [];
            const validLabels = labels.filter(l => !l.text.includes('กลับต้น') && l.text.trim() !== '');

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
          if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'double-left') continue;
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
    setSelectedCell([foundCell.r, foundCell.m, 0]); 
    activeSequenceIdxRef.current = foundCell.seqIdx;
    activeLoopRef.current = foundCell.loop;
}
    if (wasPlaying) {
      stopPlayback();
      seekOffsetRef.current = foundCell ? foundCell.elapsedMs / 1000 : targetSeconds;
      setTimeout(() => startPlayback(), 100);
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
        if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text') continue;
        const vIdx = getVisualIndex(r, currentRowTypes);
        const labels = currentSectionLabels[vIdx] || [];
        const validLabels = labels.filter(l => !l.text.includes('กลับต้น') && l.text.trim() !== '');
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
            if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text' || currentRowTypes[r] === 'double-left') continue;
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
      sheetData: JSON.parse(JSON.stringify(newSheetData)),
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
        if (data.name !== undefined) setProjectName(data.name);
        if (data.songName !== undefined) setSongName(data.songName);
        if (data.sheetData) setSheetData(data.sheetData);
        if (data.rowTypes) setRowTypes(data.rowTypes);
        if (data.sectionLabels) setSectionLabels(data.sectionLabels);
        if (data.symbols) setSymbols(data.symbols); 
        if (data.layoutConfig) setLayoutConfig(prev => ({ ...prev, ...data.layoutConfig }));
        if (data.headerDetails) setHeaderDetails(data.headerDetails);
        if (data.currentInstrument && INSTRUMENT_CONFIG[data.currentInstrument]) setCurrentInstrument(INSTRUMENT_CONFIG[data.currentInstrument]);
        if (data.playbackSequence) setPlaybackSequence(data.playbackSequence);
        const loadedMargins = data.rowMargins || Array(data.sheetData?.length || 4).fill({ top: 0, bottom: 0, left: 0 });
        setRowMargins(loadedMargins);
        
        if (data.isLoopAll !== undefined) setIsLoopAll(data.isLoopAll);
        if (data.isLoopOne !== undefined) setIsLoopOne(data.isLoopOne);
        if (data.isOctaveMode !== undefined) setIsOctaveMode(data.isOctaveMode);
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
      name: projectName, songName, sheetData, rowTypes, sectionLabels, 
      symbols, layoutConfig, headerDetails, currentInstrument: currentInstrument.id, 
      rowMargins, playbackSequence,
      isLoopAll, isLoopOne, isOctaveMode, isReduceMode, isShowPlayMode 
    };
    
    localStorage.setItem('thaiMusicEditorAutoSave', JSON.stringify(projectData));
    
    if (!isFreshProject) {
      autoSaveToFirebase(projectData);
    }
  }, [isLoaded, projectName, songName, sheetData, rowTypes, sectionLabels, symbols, layoutConfig, headerDetails, currentInstrument, rowMargins, playbackSequence, isLoopAll, isLoopOne, isOctaveMode, isReduceMode, isShowPlayMode, projectId, historyIndex, isReadOnly]);

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
  const changeInstrument = (instrumentId) => setCurrentInstrument(INSTRUMENT_CONFIG[instrumentId]);
  
  const performLoadProjectFromFirebase = (projectData) => {
    isImportingRef.current = true;
    try {
      const parsedSheetData = typeof projectData.sheetData === 'string' ? JSON.parse(projectData.sheetData) : projectData.sheetData;

      if (projectData.id) setProjectId(projectData.id);
      if (projectData.name !== undefined) setProjectName(projectData.name);
      if (projectData.songName !== undefined) setSongName(projectData.songName);
      
      if (parsedSheetData) setSheetData(parsedSheetData);
      if (projectData.rowTypes) setRowTypes(projectData.rowTypes);
      if (projectData.sectionLabels) setSectionLabels(projectData.sectionLabels);
      if (projectData.symbols) setSymbols(projectData.symbols);
      if (projectData.layoutConfig) setLayoutConfig(prev => ({ ...prev, ...projectData.layoutConfig }));
      if (projectData.headerDetails) setHeaderDetails(projectData.headerDetails);
      
      if (projectData.currentInstrument && INSTRUMENT_CONFIG[projectData.currentInstrument]) setCurrentInstrument(INSTRUMENT_CONFIG[projectData.currentInstrument]);
      if (projectData.playbackSequence) setPlaybackSequence(projectData.playbackSequence);
      if (projectData.isLoopAll !== undefined) setIsLoopAll(projectData.isLoopAll);
      if (projectData.isLoopOne !== undefined) setIsLoopOne(projectData.isLoopOne);
      if (projectData.isOctaveMode !== undefined) setIsOctaveMode(projectData.isOctaveMode);
      if (projectData.isReduceMode !== undefined) setIsReduceMode(projectData.isReduceMode);
      if (projectData.isShowPlayMode !== undefined) setIsShowPlayMode(projectData.isShowPlayMode);

      const loadedMargins = projectData.rowMargins || Array(parsedSheetData?.length || 4).fill({ top: 0, bottom: 0, left: 0 });
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
    setSheetData(Array(4).fill().map(() => Array(8).fill().map(() => Array(4).fill('-'))));
    setRowTypes(Array(4).fill('single'));
    setSectionLabels({});
    setProjectId(null);

    setSongName(templateData.defaultSongName || "เพลงใหม่");
    setProjectName("โปรเจกต์ไม่มีชื่อ");
    setHeaderDetails(templateData.headerDetails || []);
    
    if (templateData.detailsAlign) {
      setLayoutConfig(prev => ({ ...prev, detailsAlign: templateData.detailsAlign }));
    }
  };

  useEffect(() => {
    let isCtrlCombination = false; 

    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      const isEditable = e.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      
      if (isEditable) return; 

      if (e.ctrlKey && e.key !== 'Control') {
        isCtrlCombination = true;
      }

      if (e.code === 'Space') {
        e.preventDefault(); 
        togglePlay();       
        return;             
      }

      if (e.key === 'Backspace') {
        if (isReadOnlyRef.current) { e.preventDefault(); return; } 
        e.preventDefault();
        
        if (selectedSymbolId) {
          removeSymbol(selectedSymbolId);
          setSelectedSymbolId(null);
        } else if (selectedCell) {
          removeSymbolByCell(selectedCell);
          inputNote('BACKSPACE');
        }
        return;
      }

      if (e.key === 'Delete') {
        if (isReadOnlyRef.current) { e.preventDefault(); return; } 
        e.preventDefault();
        
        if (selectedSymbolId) {
          removeSymbol(selectedSymbolId);
          setSelectedSymbolId(null);
        } else if (selectedCell) {
          removeRow(); 
        }
        return;
      }

      if (e.key === 'Insert') {
        if (isReadOnlyRef.current) { e.preventDefault(); return; }
        e.preventDefault();
        
        if (selectedCell) {
          const [rIdx] = selectedCell;
          const currentType = rowTypes[rIdx]; 
          
          if (currentType && currentType.startsWith('double')) addDoubleRow(); 
          else addRow(); 
        }
        return;
      }

      if (e.key.startsWith('Arrow')) {
        e.preventDefault(); 
        if (!selectedCell) return;
        
        let [r, m, c] = selectedCell;
        
        if (e.key === 'ArrowRight') {
          if (c < sheetData[r][m].length - 1) {
             c++;
          } else if (m < sheetData[r].length - 1) {
             m++; c = 0;
          } else {
             let nextR = r + 1;
             while (nextR < sheetData.length && (rowTypes[nextR] === 'page-break' || rowTypes[nextR] === 'text')) nextR++;
             if (nextR < sheetData.length) {
                r = nextR;
                m = rowTypes[r].startsWith('double') ? 1 : 0;
                c = 0;
             }
          }
        } else if (e.key === 'ArrowLeft') {
          if (c > 0) {
             c--;
          } else if (m > (rowTypes[r].startsWith('double') ? 1 : 0)) {
             m--; c = sheetData[r][m].length - 1;
          } else {
             let prevR = r - 1;
             while (prevR >= 0 && (rowTypes[prevR] === 'page-break' || rowTypes[prevR] === 'text')) prevR--;
             if (prevR >= 0) {
                r = prevR;
                m = sheetData[r].length - 1;
                c = sheetData[r][m].length - 1;
             }
          }
        } else if (e.key === 'ArrowDown') {
          let nextR = r + 1;
          while (nextR < sheetData.length && (rowTypes[nextR] === 'page-break' || rowTypes[nextR] === 'text')) nextR++;
          if (nextR < sheetData.length) {
             r = nextR;
             if (m >= sheetData[r].length) m = sheetData[r].length - 1;
             if (rowTypes[r].startsWith('double') && m === 0) m = 1; 
             if (c >= sheetData[r][m].length) c = sheetData[r][m].length - 1;
          }
        } else if (e.key === 'ArrowUp') {
          let prevR = r - 1;
          while (prevR >= 0 && (rowTypes[prevR] === 'page-break' || rowTypes[prevR] === 'text')) prevR--;
          if (prevR >= 0) {
             r = prevR;
             if (m >= sheetData[r].length) m = sheetData[r].length - 1;
             if (rowTypes[r].startsWith('double') && m === 0) m = 1;
             if (c >= sheetData[r][m].length) c = sheetData[r][m].length - 1;
          }
        }
        
        setSelectedCell([r, m, c]);
        setSelectionRange(null);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') { e.preventDefault(); if (!isReadOnlyRef.current) undo(); } 
        else if (e.code === 'KeyR' || e.code === 'KeyY') { e.preventDefault(); if (!isReadOnlyRef.current) redo(); } 
        else if (e.code === 'KeyC') { e.preventDefault(); copySelection(); }
        else if (e.code === 'KeyV') { e.preventDefault(); if (!isReadOnlyRef.current) pasteSelection(); }
        else if (e.code === 'KeyX') { e.preventDefault(); if (!isReadOnlyRef.current) cutSelection(); }
      }
    };

    const handleKeyUp = (e) => {
      const tag = e.target?.tagName;
      const isEditable = e.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (isEditable) return; 

      if (e.code === 'ControlRight') {
        if (!isReadOnlyRef.current && !isCtrlCombination && selectedCell) {
          inputNote('-');
        }
      }

      if (e.key === 'Control') {
        isCtrlCombination = false;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp); 
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp); 
    };
    
  }, [
    undo, redo, copySelection, pasteSelection, cutSelection, 
    togglePlay, selectedSymbolId, selectedCell, inputNote, 
    removeSymbol, removeSymbolByCell, setSelectedSymbolId,
    sheetData, rowTypes, setSelectionRange,
    addRow, addDoubleRow, removeRow
  ]);
  
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
      isOctaveMode, setIsOctaveMode,
      isReduceMode, setIsReduceMode, 
      isShowPlayMode, setIsShowPlayMode, 
      shiftNoteObject, shiftNoteString,
      addTextRow, updateTextRow,
      rowMargins, updateRowMarginsList,
      
      playbackSequence, setPlaybackSequence,
      activeSequenceIdx, activeLoop,
      toolbarMode, setToolbarMode,
      currentTime, totalTime, seek,
      INSTRUMENT_CONFIG,
      
      isLoopAll, setIsLoopAll,
      isLoopOne, setIsLoopOne,
      skipToNext, skipToPrev,
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