import React, { createContext, useState, useMemo, useEffect, useRef } from 'react';
import { INSTRUMENT_CONFIG } from '../utils/instrumentConfig';
import { preloadSounds, playNote } from '../utils/audioEngine'; 

export const MusicContext = createContext();

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

export const MusicProvider = ({ children }) => {
  const [currentInstrument, setCurrentInstrument] = useState(INSTRUMENT_CONFIG["khong-wong-yai"] || INSTRUMENT_CONFIG["ranat-ek"]);
  const [sheetData, setSheetData] = useState(
    Array(4).fill().map(() => Array(8).fill().map(() => Array(4).fill('-')))
  );
  const [rowTypes, setRowTypes] = useState(Array(4).fill('single'));
  
  // ⭐ เพิ่ม State สำหรับจำค่า Margin (บน, ล่าง, ซ้าย) ของแต่ละบรรทัด
  const [rowMargins, setRowMargins] = useState(Array(4).fill({ top: 0, bottom: 0, left: 0 }));

  const [selectedCell, setSelectedCell] = useState([0, 0, 0]);
  const [songName, setSongName] = useState("เพลงลาวดวงเดือน");
  const [sectionLabels, setSectionLabels] = useState({});
  const [selectionRange, setSelectionRange] = useState(null); 
  const [symbols, setSymbols] = useState([]); 
  const [selectedSymbolId, setSelectedSymbolId] = useState(null);

  const [isOctaveMode, setIsOctaveMode] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [clipboardData, setClipboardData] = useState([]);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoaded, setIsLoaded] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackCursor, setPlaybackCursor] = useState(null);
  
  const playbackTimerRef = useRef(null);
  const effectTimersRef = useRef([]);
  const mutedCellsRef = useRef(new Set());

  const [layoutConfig, setLayoutConfig] = useState({
    fontSize: 30, isBold: false, isItalic: false, measureHeight: 48,
    rowGap: 32, songNameSize: 48, authorSize: 16, detailsAlign: 'between',
    borderWidth: 2, innerBorderWidth: 1, borderColor: '#1e293b', borderRadius: 0,
    bpm: 80,
    volume: 100,
    activeSymbol: 'sabat', 
    symbolColor: '#1e293b',
    symbolStrokeWidth: 2.5,
    symbolHeight: 20,
    marginTop: 48, marginBottom: 48, marginLeft: 48, marginRight: 48,
    marginUnit: 'px',
    textLineHeight: 1.5, textFontSize: 16
  });

  const layoutConfigRef = useRef(layoutConfig);
  const isPlayingRef = useRef(false);
  const sheetDataRef = useRef(sheetData);
  const rowTypesRef = useRef(rowTypes);
  const symbolsRef = useRef(symbols);
  const isOctaveModeRef = useRef(isOctaveMode); 

  useEffect(() => { layoutConfigRef.current = layoutConfig; }, [layoutConfig]);
  useEffect(() => { sheetDataRef.current = sheetData; }, [sheetData]);
  useEffect(() => { rowTypesRef.current = rowTypes; }, [rowTypes]);
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]); 
  useEffect(() => { isOctaveModeRef.current = isOctaveMode; }, [isOctaveMode]); 

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

  const getCellId = (r, m, c) => r * 100000 + m * 1000 + c;

  const startPlayback = () => {
    if (isPlaying) return;
    setIsPlaying(true);
    isPlayingRef.current = true;

    effectTimersRef.current.forEach(t => clearTimeout(t));
    effectTimersRef.current = [];
    mutedCellsRef.current.clear();

    let currentCursor = [...selectedCell];
    let startR = currentCursor[0];

    if (rowTypesRef.current[startR] === 'double-left') {
      startR -= 1;
      currentCursor[0] = startR;
    }
    if (rowTypesRef.current[startR].startsWith('double') && currentCursor[1] === 0) {
      currentCursor[1] = 1; 
    }

    let expectedNextTick;

    const playNextStep = (r, m, c) => {
      if (!isPlayingRef.current) return; 

      const currentSheetData = sheetDataRef.current;
      const currentRowTypes = rowTypesRef.current;
      const currentSymbols = symbolsRef.current; 
      
      const triggerPlaybackNote = (noteStr, vol) => {
          if (!noteStr || noteStr === '-') return;
          playNote(currentInstrument.id, noteStr, vol);
          
          if (isOctaveModeRef.current && currentInstrument.id === 'ranat-ek') {
              const formattedKeys = currentInstrument.keys.map(k => {
                 const octave = parseInt(k.eng.replace(/\D/g, ''));
                 if (octave >= 5) return k.thai + '\u0E4D';
                 if (octave === 2) return k.thai + '\u0E3A\u200B';
                 if (octave === 3) return k.thai + '\u0E3A';
                 return k.thai;
              });
              const idx = formattedKeys.indexOf(noteStr);
              if (idx >= 7) { 
                  playNote(currentInstrument.id, formattedKeys[idx - 7], vol);
              }
          }
      };

      if (currentRowTypes[r] === 'page-break' || currentRowTypes[r] === 'text') {
          let nextR = r + 1;
          if (nextR >= currentSheetData.length) {
              playbackTimerRef.current = setTimeout(() => stopPlayback(), 500);
              return;
          }
          let nextM = currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double') ? 1 : 0;
          playbackTimerRef.current = setTimeout(() => playNextStep(nextR, nextM, 0), 0);
          return;
      }
      
      const currentBpm = layoutConfigRef.current.bpm || 80;
      const msPerCell = Math.floor(15000 / currentBpm); 

      setPlaybackCursor([r, m, c]);

      let cellsToCheck = [[r, m, c]];
      if (currentRowTypes[r] === 'double-right') {
          cellsToCheck.push([r + 1, m, c]);
      } else if (currentRowTypes[r] === 'double-left') {
          cellsToCheck.push([r - 1, m, c]);
      }

      let processedSymbols = new Set();

      cellsToCheck.forEach(cell => {
          const [cr, cm, cc] = cell;
          
          const startingSymbols = currentSymbols.filter(s => {
              let mStart = s.start[1], cStart = s.start[2];
              let mEnd = s.end[1], cEnd = s.end[2];
              if (mStart * 4 + cStart > mEnd * 4 + cEnd) {
                  mStart = s.end[1]; cStart = s.end[2];
              }
              return cm === mStart && cc === cStart && (s.start[0] === cr || s.end[0] === cr);
          });

          startingSymbols.forEach(sym => {
              if (processedSymbols.has(sym.id)) return;
              processedSymbols.add(sym.id);

              let startPos = sym.start;
              let endPos = sym.end;
              if (startPos[1] * 4 + startPos[2] > endPos[1] * 4 + endPos[2]) {
                  startPos = sym.end;
                  endPos = sym.start;
              }

              const isDouble = currentRowTypes[startPos[0]].startsWith('double');
              const rTop = isDouble ? (currentRowTypes[startPos[0]] === 'double-left' ? startPos[0] - 1 : startPos[0]) : startPos[0];
              const rBot = isDouble ? rTop + 1 : null;

              let currM = startPos[1];
              let currC = startPos[2];
              const endM = endPos[1];
              const endC = endPos[2];

              let events = []; 
              let cellIds = [];
              let dist = 0;
              let failSafe = 0;

              while (failSafe < 200) {
                  let colNotes = [];
                  if (isDouble) {
                      const noteTop = currentSheetData[rTop][currM][currC];
                      const noteBot = currentSheetData[rBot][currM][currC];
                      if (noteTop !== '-') colNotes.push(noteTop);
                      if (noteBot !== '-') colNotes.push(noteBot);
                      cellIds.push(getCellId(rTop, currM, currC));
                      cellIds.push(getCellId(rBot, currM, currC));
                  } else {
                      const note = currentSheetData[rTop][currM][currC];
                      if (note !== '-') colNotes.push(note);
                      cellIds.push(getCellId(rTop, currM, currC));
                  }

                  if (colNotes.length > 0) {
                      events.push(colNotes);
                  }

                  if (currM === endM && currC === endC) break;

                  dist++;
                  currC++;
                  if (currC >= currentSheetData[rTop][currM].length) {
                      currC = 0;
                      currM++;
                      if (currM >= currentSheetData[rTop].length) break;
                  }
                  failSafe++;
              }

              cellIds.forEach(id => mutedCellsRef.current.add(id));

              const timeUntilEnd = dist * msPerCell; 
              const intervalMs = Math.floor(msPerCell * 0.25); 

              events.reverse().forEach((colNotes, revIdx) => {
                  const playTime = timeUntilEnd - (revIdx * intervalMs);
                  let vol = layoutConfigRef.current.volume ?? 100;
                  if (revIdx > 0) vol = Math.max(0, vol * (1 - (revIdx * 0.15)));

                  colNotes.forEach(n => {
                      if (playTime >= 0) {
                          const timer = setTimeout(() => {
                              triggerPlaybackNote(n, vol); 
                          }, playTime);
                          effectTimersRef.current.push(timer);
                      } else {
                          triggerPlaybackNote(n, vol);
                      }
                  });
              });
          });
      });

      if (currentRowTypes[r] === 'double-right') {
        const rightCellId = getCellId(r, m, c);
        const leftCellId = getCellId(r + 1, m, c);
        const rightNote = currentSheetData[r][m][c];
        const leftNote = currentSheetData[r + 1] ? currentSheetData[r + 1][m][c] : '-';
        if (!mutedCellsRef.current.has(rightCellId)) triggerPlaybackNote(rightNote, layoutConfigRef.current.volume ?? 100);
        if (!mutedCellsRef.current.has(leftCellId)) triggerPlaybackNote(leftNote, layoutConfigRef.current.volume ?? 100);
      } else {
        const cellId = getCellId(r, m, c);
        if (!mutedCellsRef.current.has(cellId)) triggerPlaybackNote(currentSheetData[r][m][c], layoutConfigRef.current.volume ?? 100);
      }

      let nextC = c + 1;
      let nextM = m;
      let nextR = r;

      if (nextC >= currentSheetData[nextR][nextM].length) {
        nextC = 0; nextM++;
        if (nextM >= currentSheetData[nextR].length) {
          nextM = 0; 
          if (currentRowTypes[nextR] === 'double-right') nextR += 2;
          else nextR += 1;
          if (nextR >= currentSheetData.length) {
            playbackTimerRef.current = setTimeout(() => stopPlayback(), 500);
            return; 
          }
          if (currentRowTypes[nextR] && currentRowTypes[nextR].startsWith('double')) nextM = 1; 
        }
      }

      expectedNextTick += msPerCell;
      const now = performance.now();
      let delay = expectedNextTick - now;
      if (delay < 0) delay = 0;
      playbackTimerRef.current = setTimeout(() => playNextStep(nextR, nextM, nextC), delay);
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
  };

  const getVisualIndex = (rowIndex, types) => {
    let count = 0;
    for (let i = 0; i <= rowIndex; i++) {
      if (types[i] === 'single' || types[i] === 'double-right') count++;
    }
    return count > 0 ? count - 1 : 0;
  };

  // ⭐ อัปเดต commitChange ให้บันทึก rowMargins ลงประวัติด้วย
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
    setHistoryIndex(prev => Math.min(prev + 1, 30));
  };

  const undo = () => {
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
        if (data.songName !== undefined) setSongName(data.songName);
        if (data.sheetData) setSheetData(data.sheetData);
        if (data.rowTypes) setRowTypes(data.rowTypes);
        if (data.sectionLabels) setSectionLabels(data.sectionLabels);
        if (data.symbols) setSymbols(data.symbols); 
        if (data.layoutConfig) setLayoutConfig(data.layoutConfig);
        if (data.headerDetails) setHeaderDetails(data.headerDetails);
        if (data.currentInstrument && INSTRUMENT_CONFIG[data.currentInstrument]) {
          setCurrentInstrument(INSTRUMENT_CONFIG[data.currentInstrument]);
        }
        
        // โหลดค่า Margin รายบรรทัด
        const loadedMargins = data.rowMargins || Array(data.sheetData?.length || 4).fill({ top: 0, bottom: 0, left: 0 });
        setRowMargins(loadedMargins);

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
    if (!isLoaded) return; 
    const projectData = {
      songName, sheetData, rowTypes, sectionLabels, symbols, layoutConfig, headerDetails, currentInstrument: currentInstrument.id, rowMargins
    };
    localStorage.setItem('thaiMusicEditorAutoSave', JSON.stringify(projectData));
  }, [isLoaded, songName, sheetData, rowTypes, sectionLabels, symbols, layoutConfig, headerDetails, currentInstrument, rowMargins]);

  // ⭐ อัปเดตฟังก์ชันให้รองรับข้อมูลทั้งจากการกด Tab และจาก Toolbar
  const updateRowMarginsList = (arg1, arg2, arg3) => {
    const newRowMargins = [...rowMargins];
    
    // กรณีที่รับค่ามาจาก Sheet.jsx (ตอนกด Tab) -> รับเป็น Array
    if (Array.isArray(arg1)) {
      const updates = arg1;
      updates.forEach(update => {
        newRowMargins[update.index] = { 
          ...(newRowMargins[update.index] || { top: 0, bottom: 0, left: 0 }), 
          ...update.changes 
        };
      });
    } 
    // กรณีที่รับค่ามาจาก MainToolbar -> รับเป็น (minR, maxR, updates)
    else {
      const minR = arg1;
      const maxR = arg2;
      const updates = arg3;
      for (let i = minR; i <= maxR; i++) {
        newRowMargins[i] = { 
          ...(newRowMargins[i] || { top: 0, bottom: 0, left: 0 }), 
          ...updates 
        };
      }
    }
    
    // บันทึกผ่านระบบ Undo/Redo เพื่อให้ทำงานสมบูรณ์
    commitChange(sheetData, rowTypes, sectionLabels, symbols, newRowMargins);
  };

  const addSymbol = (type, start, end, options = {}) => {
    const newSymbol = { id: Date.now(), type, start, end, ...options };
    const newSymbols = [...symbols, newSymbol];
    commitChange(sheetData, rowTypes, sectionLabels, newSymbols);
  };

  const updateSymbol = (id, updates) => {
    const newSymbols = symbols.map(s => s.id === id ? { ...s, ...updates } : s);
    commitChange(sheetData, rowTypes, sectionLabels, newSymbols);
  };

  const removeSymbol = (id) => {
    const newSymbols = symbols.filter(s => s.id !== id);
    commitChange(sheetData, rowTypes, sectionLabels, newSymbols);
  };

  const removeSymbolByCell = (cell) => {
    if (!cell) return;
    const newSymbols = symbols.filter(s => 
      !(s.start[0] === cell[0] && s.start[1] === cell[1] && s.start[2] === cell[2]) &&
      !(s.end[0] === cell[0] && s.end[1] === cell[1] && s.end[2] === cell[2])
    );
    if (newSymbols.length !== symbols.length) {
      commitChange(sheetData, rowTypes, sectionLabels, newSymbols);
    }
  };

  const addDetail = () => {
    const newId = headerDetails.length > 0 ? Math.max(...headerDetails.map(d => d.id)) + 1 : 1;
    setHeaderDetails([...headerDetails, { id: newId, label: "หัวข้อใหม่", value: "ระบุข้อมูล" }]);
  };
  const removeDetail = (id) => setHeaderDetails(headerDetails.filter(detail => detail.id !== id));
  const updateDetail = (id, key, newValue) => setHeaderDetails(headerDetails.map(detail => detail.id === id ? { ...detail, [key]: newValue } : detail));
  const changeInstrument = (instrumentId) => setCurrentInstrument(INSTRUMENT_CONFIG[instrumentId]);

  const startSelection = (r, m, c) => {
    setIsDragging(true);
    setDragStart([r, m, c]);
    setSelectionRange({ start: [r, m, c], end: [r, m, c] });
    setSelectedCell([r, m, c]); 
  };
  const updateSelection = (r, m, c) => {
    if (isDragging && dragStart) setSelectionRange({ start: dragStart, end: [r, m, c] });
  };
  const endSelection = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const copySelection = () => {
    if (!selectionRange) return;
    const sr = selectionRange.start[0];
    const sm = selectionRange.start[1];
    const sc = selectionRange.start[2];
    const er = selectionRange.end[0];
    const em = selectionRange.end[1];
    const ec = selectionRange.end[2];

    const minR = Math.min(sr, er);
    const maxR = Math.max(sr, er);

    const startCol = getFlattenedCol(sheetData[sr], rowTypes[sr], sm, sc);
    const endCol = getFlattenedCol(sheetData[er], rowTypes[er], em, ec);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const copiedBlock = [];
    for (let r = minR; r <= maxR; r++) {
      if (rowTypes[r] === 'page-break' || rowTypes[r] === 'text') continue;
      const rowData = [];
      let currentCol = 0;
      for (let m = 0; m < sheetData[r].length; m++) {
        if (rowTypes[r].startsWith('double') && m === 0) continue;
        for (let c = 0; c < sheetData[r][m].length; c++) {
          if (currentCol >= minCol && currentCol <= maxCol) {
            rowData.push(sheetData[r][m][c]);
          }
          currentCol++;
        }
      }
      if (rowData.length > 0) copiedBlock.push(rowData);
    }
    setClipboardData(copiedBlock);
    setSelectionRange(null); 
  };

  const pasteSelection = () => {
    if (!clipboardData || clipboardData.length === 0) return;
    let [r, m, c] = selectedCell;
    const newData = sheetData.map(row => row.map(meas => [...meas])); 
    let lastValidCursor = [r, m, c];

    const startCol = getFlattenedCol(newData[r], rowTypes[r], m, c);

    let currentDataRow = 0;
    for (let i = r; i < newData.length && currentDataRow < clipboardData.length; i++) {
       if (rowTypes[i] === 'page-break' || rowTypes[i] === 'text') continue;
       
       const rowToPaste = clipboardData[currentDataRow];
       if (typeof rowToPaste === 'string' || !Array.isArray(rowToPaste)) {
           setClipboardData([]); return;
       }

       let colIndex = 0;
       let pasteIndex = 0;
       
       for (let meas = 0; meas < newData[i].length; meas++) {
          if (rowTypes[i].startsWith('double') && meas === 0) continue;
          for (let cell = 0; cell < newData[i][meas].length; cell++) {
             if (colIndex >= startCol && pasteIndex < rowToPaste.length) {
                newData[i][meas][cell] = rowToPaste[pasteIndex];
                lastValidCursor = [i, meas, cell];
                pasteIndex++;
             }
             colIndex++;
          }
       }
       currentDataRow++;
    }

    commitChange(newData); 
    setSelectedCell(lastValidCursor);
  };

  const inputNote = (note) => {
    const newData = [...sheetData];

    let isBlockSelection = false;
    if (selectionRange && selectionRange.start && selectionRange.end) {
        const sr = selectionRange.start[0], sm = selectionRange.start[1], sc = selectionRange.start[2];
        const er = selectionRange.end[0], em = selectionRange.end[1], ec = selectionRange.end[2];
        if (sr !== er || sm !== em || sc !== ec) {
            isBlockSelection = true;
        }
    }

    if (isBlockSelection) {
        const sr = selectionRange.start[0], sm = selectionRange.start[1], sc = selectionRange.start[2];
        const er = selectionRange.end[0], em = selectionRange.end[1], ec = selectionRange.end[2];

        const minR = Math.min(sr, er);
        const maxR = Math.max(sr, er);

        const startCol = getFlattenedCol(sheetData[sr], rowTypes[sr], sm, sc);
        const endCol = getFlattenedCol(sheetData[er], rowTypes[er], em, ec);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);

        for (let r = minR; r <= maxR; r++) {
          if (rowTypes[r] === 'page-break' || rowTypes[r] === 'text') continue; 
          let currentCol = 0;
          for (let m = 0; m < sheetData[r].length; m++) {
            if (rowTypes[r].startsWith('double') && m === 0) continue;
            for (let c = 0; c < sheetData[r][m].length; c++) {
              if (currentCol >= minCol && currentCol <= maxCol) {
                 if (note === 'BACKSPACE') {
                     newData[r][m][c] = '-';
                 } else {
                     newData[r][m][c] = note;
                 }
              }
              currentCol++;
            }
          }
        }
        if (note !== 'BACKSPACE' && note !== '-') {
           playNote(currentInstrument.id, note, layoutConfig.volume ?? 100);
        }
        commitChange(newData);
        setSelectionRange(null);
        return;
    }

    setSelectionRange(null); 
    const [row, meas, cell] = selectedCell;
    
    if (rowTypes[row] === 'page-break' || rowTypes[row] === 'text') return;
    if (rowTypes[row].startsWith('double') && meas === 0) return;

    if (note === 'BACKSPACE') {
      newData[row][meas][cell] = '-';
      commitChange(newData);
      
      if (cell > 0) {
          setSelectedCell([row, meas, cell - 1]);
      } else if (meas > 0) {
        if (rowTypes[row].startsWith('double') && meas === 1) {
          let prevR = row - 1;
          while (prevR >= 0 && (rowTypes[prevR] === 'page-break' || rowTypes[prevR] === 'text')) prevR--;
          if (prevR >= 0) setSelectedCell([prevR, sheetData[prevR].length - 1, sheetData[prevR][sheetData[prevR].length - 1].length - 1]);
        } else {
          setSelectedCell([row, meas - 1, sheetData[row][meas - 1].length - 1]);
        }
      } else {
          let prevR = row - 1;
          while (prevR >= 0 && (rowTypes[prevR] === 'page-break' || rowTypes[prevR] === 'text')) prevR--;
          if (prevR >= 0) setSelectedCell([prevR, sheetData[prevR].length - 1, sheetData[prevR][sheetData[prevR].length - 1].length - 1]);
      }
    } else {
      newData[row][meas][cell] = note;
      playNote(currentInstrument.id, note, layoutConfig.volume ?? 100);
      commitChange(newData);
      
      if (cell < sheetData[row][meas].length - 1) {
          setSelectedCell([row, meas, cell + 1]);
      } else if (meas < sheetData[row].length - 1) {
          setSelectedCell([row, meas + 1, 0]);
      } else {
          let nextR = row + 1;
          while (nextR < sheetData.length && (rowTypes[nextR] === 'page-break' || rowTypes[nextR] === 'text')) nextR++;
          if (nextR < sheetData.length) {
              setSelectedCell([nextR, rowTypes[nextR].startsWith('double') ? 1 : 0, 0]);
          }
      }
    }
  };

  const addRow = (insertAtTop = false) => {
    setSelectionRange(null); 
    const rowIdx = selectedCell[0];
    const newData = [...sheetData];
    const newRowTypes = [...rowTypes];
    const newRowMargins = [...rowMargins]; // ⭐

    const isTop = insertAtTop === true; 
    let insertIdx = isTop ? rowIdx : rowIdx + 1;
    
    if (isTop) {
      if (rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') {
        insertIdx -= 1; 
      }
    } else {
      if (rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') {
        insertIdx += 1; 
      }
    }

    const targetVisualIndex = getVisualIndex(insertIdx > 0 ? insertIdx - 1 : 0, rowTypes);
    const newSectionLabels = {};
    Object.keys(sectionLabels).forEach(key => {
      const k = parseInt(key);
      if (k < targetVisualIndex) {
        newSectionLabels[k] = sectionLabels[k];
      } else {
        newSectionLabels[k + 1] = sectionLabels[k];
      }
    });

    newData.splice(insertIdx, 0, Array(8).fill().map(() => Array(4).fill('-')));
    newRowTypes.splice(insertIdx, 0, 'single');
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }); // ⭐ แทรก Margin ว่างๆ ให้บรรทัดใหม่

    const newSymbols = symbols.map(sym => {
      const newStartR = sym.start[0] >= insertIdx ? sym.start[0] + 1 : sym.start[0];
      const newEndR = sym.end[0] >= insertIdx ? sym.end[0] + 1 : sym.end[0];
      return { ...sym, start: [newStartR, sym.start[1], sym.start[2]], end: [newEndR, sym.end[1], sym.end[2]] };
    });

    commitChange(newData, newRowTypes, newSectionLabels, newSymbols, newRowMargins);
    if (isTop) setSelectedCell([insertIdx + 1, 0, 0]);
  };

  const addDoubleRow = (insertAtTop = false) => {
    setSelectionRange(null); 
    const rowIdx = selectedCell[0];
    const newData = [...sheetData];
    const newRowTypes = [...rowTypes];
    const newRowMargins = [...rowMargins]; // ⭐

    const isTop = insertAtTop === true;
    let insertIdx = isTop ? rowIdx : rowIdx + 1;
    
    if (isTop) {
      if (rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
    } else {
      if (rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;
    }

    const targetVisualIndex = getVisualIndex(insertIdx > 0 ? insertIdx - 1 : 0, rowTypes);
    const newSectionLabels = {};
    Object.keys(sectionLabels).forEach(key => {
      const k = parseInt(key);
      if (k < targetVisualIndex) {
        newSectionLabels[k] = sectionLabels[k];
      } else {
        newSectionLabels[k + 1] = sectionLabels[k];
      }
    });

    newData.splice(insertIdx, 0, [['มือขวา'], ...Array(8).fill().map(() => Array(4).fill('-'))], [['มือซ้าย'], ...Array(8).fill().map(() => Array(4).fill('-'))]);
    newRowTypes.splice(insertIdx, 0, 'double-right', 'double-left');
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }, { top: 0, bottom: 0, left: 0 }); // ⭐

    const newSymbols = symbols.map(sym => {
      const newStartR = sym.start[0] >= insertIdx ? sym.start[0] + 2 : sym.start[0];
      const newEndR = sym.end[0] >= insertIdx ? sym.end[0] + 2 : sym.end[0];
      return { ...sym, start: [newStartR, sym.start[1], sym.start[2]], end: [newEndR, sym.end[1], sym.end[2]] };
    });

    commitChange(newData, newRowTypes, newSectionLabels, newSymbols, newRowMargins);
    if (isTop) setSelectedCell([insertIdx + 2, 0, 0]);
  };

  const addPageBreak = (insertAtTop = false) => {
    setSelectionRange(null);
    const rowIdx = selectedCell[0];
    const newData = [...sheetData];
    const newRowTypes = [...rowTypes];
    const newRowMargins = [...rowMargins]; // ⭐

    const isTop = insertAtTop === true;
    let insertIdx = isTop ? rowIdx : rowIdx + 1;
    
    if (isTop) {
      if (rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
    } else {
      if (rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;
    }

    newData.splice(insertIdx, 0, Array(8).fill().map(() => Array(4).fill('-')));
    newRowTypes.splice(insertIdx, 0, 'page-break');
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }); // ⭐

    const newSymbols = symbols.map(sym => {
      const newStartR = sym.start[0] >= insertIdx ? sym.start[0] + 1 : sym.start[0];
      const newEndR = sym.end[0] >= insertIdx ? sym.end[0] + 1 : sym.end[0];
      return { ...sym, start: [newStartR, sym.start[1], sym.start[2]], end: [newEndR, sym.end[1], sym.end[2]] };
    });

    const newSectionLabels = { ...sectionLabels };
    commitChange(newData, newRowTypes, newSectionLabels, newSymbols, newRowMargins);
    setSelectedCell([insertIdx, 0, 0]);
  };

  const addTextRow = (insertAtTop = false) => {
    setSelectionRange(null);
    const rowIdx = selectedCell[0];
    const newData = [...sheetData];
    const newRowTypes = [...rowTypes];
    const newRowMargins = [...rowMargins]; // ⭐

    const isTop = insertAtTop === true;
    let insertIdx = isTop ? rowIdx : rowIdx + 1;
    
    if (isTop) {
      if (rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
    } else {
      if (rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;
    }

    newData.splice(insertIdx, 0, [[""]]); 
    newRowTypes.splice(insertIdx, 0, 'text');
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }); // ⭐

    const newSymbols = symbols.map(sym => {
      const newStartR = sym.start[0] >= insertIdx ? sym.start[0] + 1 : sym.start[0];
      const newEndR = sym.end[0] >= insertIdx ? sym.end[0] + 1 : sym.end[0];
      return { ...sym, start: [newStartR, sym.start[1], sym.start[2]], end: [newEndR, sym.end[1], sym.end[2]] };
    });

    const newSectionLabels = { ...sectionLabels };
    commitChange(newData, newRowTypes, newSectionLabels, newSymbols, newRowMargins);
    
    setTimeout(() => {
      setSelectedCell([insertIdx, 0, 0]);
    }, 10);
  };

  const updateTextRow = (rIndex, text) => {
    const newData = [...sheetData];
    newData[rIndex] = [[text]];
    setSheetData(newData); 
  };

  const removeRow = () => {
    setSelectionRange(null); 
    const rowIdx = selectedCell[0];
    
    const newData = [...sheetData];
    const newRowTypes = [...rowTypes];
    const newRowMargins = [...rowMargins]; // ⭐
    
    let deleteCount = 1;
    let startIndex = rowIdx;

    if (rowTypes[rowIdx] === 'single' || rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text') {
      deleteCount = 1;
    } else if (rowTypes[rowIdx] === 'double-right') {
      deleteCount = 2;
    } else if (rowTypes[rowIdx] === 'double-left') {
      startIndex = rowIdx - 1;
      deleteCount = 2;
    }

    if (newData.length - deleteCount <= 0) {
      const emptyRow = Array(8).fill().map(() => Array(4).fill('-'));
      commitChange([emptyRow], ['single'], {}, [], [{ top: 0, bottom: 0, left: 0 }]); 
      setSelectedCell([0, 0, 0]);
      return;
    }

    const isNoteRow = rowTypes[startIndex] === 'single' || rowTypes[startIndex] === 'double-right';
    const newSectionLabels = {};

    if (!isNoteRow) {
      Object.assign(newSectionLabels, sectionLabels);
    } else {
      let startVisualIndex = 0;
      for(let i = 0; i < startIndex; i++) {
          if (rowTypes[i] === 'single' || rowTypes[i] === 'double-right') startVisualIndex++;
      }

      Object.keys(sectionLabels).forEach(key => {
          const k = parseInt(key);
          if (k < startVisualIndex) {
              newSectionLabels[k] = sectionLabels[k];
          } else if (k > startVisualIndex) {
              newSectionLabels[k - 1] = sectionLabels[k];
          }
      });
    }

    newData.splice(startIndex, deleteCount);
    newRowTypes.splice(startIndex, deleteCount);
    newRowMargins.splice(startIndex, deleteCount); // ⭐

    const newSymbols = [];
    symbols.forEach(sym => {
      const isDeleted = (sym.start[0] >= startIndex && sym.start[0] < startIndex + deleteCount) ||
                        (sym.end[0] >= startIndex && sym.end[0] < startIndex + deleteCount);
      if (!isDeleted) {
        const newStartR = sym.start[0] > startIndex ? sym.start[0] - deleteCount : sym.start[0];
        const newEndR = sym.end[0] > startIndex ? sym.end[0] - deleteCount : sym.end[0];
        newSymbols.push({
          ...sym,
          start: [newStartR, sym.start[1], sym.start[2]],
          end: [newEndR, sym.end[1], sym.end[2]]
        });
      }
    });

    commitChange(newData, newRowTypes, newSectionLabels, newSymbols, newRowMargins);

    let nextRow = startIndex;
    if (nextRow >= newData.length) nextRow = newData.length - 1;
    const nextMeas = newRowTypes[nextRow].startsWith('double') ? 1 : 0;
    setSelectedCell([nextRow, nextMeas, 0]);
  };

  const addNoteColumn = () => {
    setSelectionRange(null); 
    const [rowIdx, measIdx, cellIdx] = selectedCell;
    if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text') return;
    if (rowTypes[rowIdx].startsWith('double') && measIdx === 0) return; 
    const newData = [...sheetData];
    newData[rowIdx][measIdx].splice(cellIdx + 1, 0, '-');
    commitChange(newData);
  };

  const removeNoteColumn = () => {
    setSelectionRange(null); 
    const [rowIdx, measIdx, cellIdx] = selectedCell;
    if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text') return;
    if (rowTypes[rowIdx].startsWith('double') && measIdx === 0) return; 
    if (sheetData[rowIdx][measIdx].length > 1) {
      const newData = [...sheetData];
      newData[rowIdx][measIdx].splice(cellIdx, 1);
      commitChange(newData);
      if (cellIdx >= newData[rowIdx][measIdx].length) setSelectedCell([rowIdx, measIdx, newData[rowIdx][measIdx].length - 1]);
    }
  };

  const addMeasure = () => {
    setSelectionRange(null); 
    const [rowIdx, measIdx] = selectedCell;
    if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text') return;
    const newData = [...sheetData];
    if (rowTypes[rowIdx] === 'single') newData[rowIdx].splice(measIdx + 1, 0, Array(4).fill('-'));
    else if (rowTypes[rowIdx] === 'double-right') { newData[rowIdx].splice(measIdx + 1, 0, Array(4).fill('-')); newData[rowIdx + 1].splice(measIdx + 1, 0, Array(4).fill('-')); }
    else if (rowTypes[rowIdx] === 'double-left') { newData[rowIdx].splice(measIdx + 1, 0, Array(4).fill('-')); newData[rowIdx - 1].splice(measIdx + 1, 0, Array(4).fill('-')); }
    commitChange(newData);
  };

  const removeMeasure = () => {
    setSelectionRange(null); 
    const [rowIdx, measIdx] = selectedCell;
    if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text') return;
    if (rowTypes[rowIdx].startsWith('double') && measIdx === 0) return; 
    const minLength = rowTypes[rowIdx].startsWith('double') ? 2 : 1;
    if (sheetData[rowIdx].length > minLength) {
      const newData = [...sheetData];
      if (rowTypes[rowIdx] === 'single') newData[rowIdx].splice(measIdx, 1);
      else if (rowTypes[rowIdx] === 'double-right') { newData[rowIdx].splice(measIdx, 1); newData[rowIdx + 1].splice(measIdx, 1); }
      else if (rowTypes[rowIdx] === 'double-left') { newData[rowIdx].splice(measIdx, 1); newData[rowIdx - 1].splice(measIdx, 1); }
      commitChange(newData);
      if (measIdx >= newData[rowIdx].length) setSelectedCell([rowIdx, newData[rowIdx].length - 1, 0]);
    }
  };

  const addSectionLabel = (visualIndex) => {
    const currentLabels = sectionLabels[visualIndex] || [];
    const newLabel = { id: Date.now(), text: "ท่อน ", position: 'top-left', fontSize: 18, isBold: true, offsetY: 6 };
    commitChange(sheetData, rowTypes, { ...sectionLabels, [visualIndex]: [...currentLabels, newLabel] });
  };

  const updateSectionLabel = (visualIndex, labelId, updates) => {
    const currentLabels = sectionLabels[visualIndex] || [];
    const updatedLabels = currentLabels.map(label => label.id === labelId ? { ...label, ...updates } : label);
    commitChange(sheetData, rowTypes, { ...sectionLabels, [visualIndex]: updatedLabels });
  };

  const removeSectionLabel = (visualIndex, labelId) => {
    const currentLabels = sectionLabels[visualIndex] || [];
    const filteredLabels = currentLabels.filter(label => label.id !== labelId);
    const newState = { ...sectionLabels };
    if (filteredLabels.length > 0) newState[visualIndex] = filteredLabels;
    else delete newState[visualIndex];
    commitChange(sheetData, rowTypes, newState);
  };

  const saveProject = () => {
    const projectData = {
      songName, sheetData, rowTypes, sectionLabels, symbols, layoutConfig, headerDetails, currentInstrument: currentInstrument.id, rowMargins
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${songName || 'my-song'}.thai`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadProject = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.songName !== undefined) setSongName(data.songName);
        if (data.sheetData) setSheetData(data.sheetData);
        if (data.rowTypes) setRowTypes(data.rowTypes);
        if (data.sectionLabels) setSectionLabels(data.sectionLabels);
        if (data.symbols) setSymbols(data.symbols);
        if (data.layoutConfig) setLayoutConfig(data.layoutConfig);
        if (data.headerDetails) setHeaderDetails(data.headerDetails);
        if (data.currentInstrument && INSTRUMENT_CONFIG[data.currentInstrument]) {
          setCurrentInstrument(INSTRUMENT_CONFIG[data.currentInstrument]);
        }
        
        const loadedMargins = data.rowMargins || Array(data.sheetData?.length || 4).fill({ top: 0, bottom: 0, left: 0 });
        setRowMargins(loadedMargins);

        setSelectedCell([0, 0, 0]);
        setSelectionRange(null);
        commitChange(data.sheetData, data.rowTypes, data.sectionLabels, data.symbols, loadedMargins);
      } catch (error) {
        alert("ไฟล์ไม่ถูกต้อง หรือไฟล์เสียหายครับ!");
      }
    };
    reader.readAsText(file);
  };

  const newProject = () => {
    if (window.confirm("คุณต้องการสร้างกระดาษใหม่ใช่หรือไม่? (ข้อมูลที่ยังไม่ได้เซฟจะหายไปทั้งหมด)")) {
      const initialSheet = Array(4).fill().map(() => Array(8).fill().map(() => Array(4).fill('-')));
      const initialRowTypes = Array(4).fill('single');
      const initialRowMargins = Array(4).fill({ top: 0, bottom: 0, left: 0 });
      
      setSongName("เพลงใหม่");
      setSheetData(initialSheet);
      setRowTypes(initialRowTypes);
      setRowMargins(initialRowMargins);
      setSectionLabels({});
      setSymbols([]);
      setHeaderDetails([
        { id: 1, label: "อัตราจังหวะ", value: "๒ ชั้น" },
        { id: 2, label: "หน้าทับ", value: "สองไม้" },
        { id: 3, label: "บันไดเสียง", value: "ทางเพียงออ" },
        { id: 4, label: "ผู้บันทึก", value: "9atony" }
      ]);
      setSelectedCell([0, 0, 0]);
      setSelectionRange(null);
      setHistoryIndex(-1);
      setHistory([]);
      localStorage.removeItem('thaiMusicEditorAutoSave');
      commitChange(initialSheet, initialRowTypes, {}, [], initialRowMargins);
    }
  };

  const visualRowCount = useMemo(() => {
    return rowTypes.filter(type => type === 'single' || type === 'double-right').length;
  }, [rowTypes]);

  return (
    <MusicContext.Provider value={{ 
      currentInstrument, changeInstrument, sheetData, selectedCell, setSelectedCell, inputNote,
      layoutConfig, setLayoutConfig, headerDetails, addDetail, removeDetail, updateDetail,
      songName, setSongName, sectionLabels, addSectionLabel, updateSectionLabel, removeSectionLabel,
      addRow, removeRow, addMeasure, removeMeasure, selectionRange, setSelectionRange,
      addNoteColumn, removeNoteColumn, rowTypes, addDoubleRow, addPageBreak, visualRowCount,
      startSelection, updateSelection, endSelection, copySelection, pasteSelection, clipboardData,
      saveProject, loadProject, newProject,
      undo, redo, canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1,
      isPlaying, playbackCursor, startPlayback, stopPlayback,
      symbols, addSymbol, updateSymbol, removeSymbol, removeSymbolByCell,
      selectedSymbolId, setSelectedSymbolId,
      isOctaveMode, setIsOctaveMode,
      addTextRow, updateTextRow,
      rowMargins, updateRowMarginsList // ⭐ ส่งออกเครื่องมือจัดการระยะห่างให้ Toolbar เรียกใช้
    }}>
      {children}
    </MusicContext.Provider>
  );
};