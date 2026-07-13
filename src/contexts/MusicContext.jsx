import React, { createContext, useState, useMemo, useEffect, useRef } from 'react';
import { INSTRUMENT_CONFIG } from '../utils/instrumentConfig';
import { preloadSounds, playNote, initAudioContext } from '../utils/audioEngine'; 

export const MusicContext = createContext();

const getVisualIndex = (rowIndex, rowTypesArray) => {
  let vIdx = 0;
  for (let i = 0; i < rowIndex; i++) {
    if (rowTypesArray[i] === 'single' || rowTypesArray[i] === 'double-right') {
      vIdx++;
    }
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

export const MusicProvider = ({ children }) => {
  const [currentInstrument, setCurrentInstrument] = useState(INSTRUMENT_CONFIG["khong-wong-yai"] || INSTRUMENT_CONFIG["ranat-ek"]);
  const [sheetData, setSheetData] = useState(Array(4).fill().map(() => Array(8).fill().map(() => Array(4).fill('-'))));
  const [rowTypes, setRowTypes] = useState(Array(4).fill('single'));
  const [rowMargins, setRowMargins] = useState(Array(4).fill({ top: 0, bottom: 0, left: 0 }));
  const [selectedCell, setSelectedCell] = useState([0, 0, 0]);
  const [songName, setSongName] = useState("เพลงลาวดวงเดือน");
  const [sectionLabels, setSectionLabels] = useState({});
  const [selectionRange, setSelectionRange] = useState(null); 
  const [symbols, setSymbols] = useState([]); 
  const [selectedSymbolId, setSelectedSymbolId] = useState(null);
  const [isOctaveMode, setIsOctaveMode] = useState(false);
  const [toolbarMode, setToolbarMode] = useState('default');

  const [playbackSequence, setPlaybackSequence] = useState([]); 
  const [activeSequenceIdx, setActiveSequenceIdx] = useState(0); 
  const [activeLoop, setActiveLoop] = useState(1); 
  
  const [isLoopAll, setIsLoopAll] = useState(false);
  // ⭐ ฟีเจอร์วนลูปท่อนเดียว (Loop One)
  const [isLoopOne, setIsLoopOne] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [clipboardData, setClipboardData] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoaded, setIsLoaded] = useState(false);

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
  
  const [layoutConfig, setLayoutConfig] = useState({
    fontSize: 30, isBold: false, isItalic: false, measureHeight: 48,
    rowGap: 32, songNameSize: 48, authorSize: 16, detailsAlign: 'between',
    borderWidth: 2, innerBorderWidth: 1, borderColor: '#1e293b', borderRadius: 0,
    bpm: 80, volume: 100, activeSymbol: 'sabat', symbolColor: '#1e293b',
    symbolStrokeWidth: 2.5, symbolHeight: 20, marginTop: 48, marginBottom: 48, marginLeft: 48, marginRight: 48,
    marginUnit: 'px', textLineHeight: 1.5, textFontSize: 16
  });

  const layoutConfigRef = useRef(layoutConfig);
  const isPlayingRef = useRef(false);
  const sheetDataRef = useRef(sheetData);
  const rowTypesRef = useRef(rowTypes);
  const symbolsRef = useRef(symbols);
  const isOctaveModeRef = useRef(isOctaveMode); 
  const sectionLabelsRef = useRef(sectionLabels);
  const playbackSequenceRef = useRef(playbackSequence);
  const activeSequenceIdxRef = useRef(0);
  const activeLoopRef = useRef(1);
  const isLoopAllRef = useRef(isLoopAll); 
  const isLoopOneRef = useRef(isLoopOne); 
  const sheetMapRef = useRef([]);

  useEffect(() => { layoutConfigRef.current = layoutConfig; }, [layoutConfig]);
  useEffect(() => { sheetDataRef.current = sheetData; }, [sheetData]);
  useEffect(() => { rowTypesRef.current = rowTypes; }, [rowTypes]);
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]); 
  useEffect(() => { isOctaveModeRef.current = isOctaveMode; }, [isOctaveMode]); 
  useEffect(() => { sectionLabelsRef.current = sectionLabels; }, [sectionLabels]);
  useEffect(() => { playbackSequenceRef.current = playbackSequence; }, [playbackSequence]);
  useEffect(() => { isLoopAllRef.current = isLoopAll; }, [isLoopAll]);
  useEffect(() => { isLoopOneRef.current = isLoopOne; }, [isLoopOne]);

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
        if (l.text && !l.text.includes('กลับต้น') && l.text.trim() !== '') {
          labels.add(l.text.trim());
        }
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
      const triggerPlaybackNote = (noteStr, vol, options = {}) => {
          if (!noteStr || noteStr === '-') return;
          const { bypassOctaveLayer = false } = options;
          playNote(currentInstrument.id, noteStr, vol);
          if (!bypassOctaveLayer && isOctaveModeRef.current && currentInstrument.id === 'ranat-ek') {
              const preferredDirection = getPreferredOctaveDirection(currentInstrument, noteStr);
              const octavePairNote = getOctavePairNote(currentInstrument, noteStr, preferredDirection);
              if (octavePairNote && octavePairNote !== noteStr) playNote(currentInstrument.id, octavePairNote, vol);
          }
      };

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
                      const preferredDirection = getPreferredOctaveDirection(currentInstrument, noteA);
                      const noteB = getOctavePairNote(currentInstrument, noteA, preferredDirection) || getOctavePairNote(currentInstrument, noteA, preferredDirection === 'down' ? 'up' : 'down') || noteA;
                      const kroIntervalMs = 65; 
                      let isNoteA = true;
                      window.kroInterval = setInterval(() => {
                          triggerPlaybackNote(isNoteA ? noteA : noteB, layoutConfigRef.current.volume ?? 100, { bypassOctaveLayer: true });
                          isNoteA = !isNoteA;
                      }, kroIntervalMs);
                      effectTimersRef.current.push(setTimeout(() => { clearInterval(window.kroInterval); window.kroInterval = null; }, timeUntilEnd));
                  }
              } else {
                  const intervalMs = Math.floor(msPerCell * 0.40); 
                  events.reverse().forEach((colNotes, revIdx) => {
                      const playTime = timeUntilEnd - (revIdx * intervalMs);
                      let vol = layoutConfigRef.current.volume ?? 100;
                      if (revIdx > 0) vol = Math.max(0, vol * (1 - (revIdx * 0.15)));
                      colNotes.forEach(n => {
                          if (playTime >= 0) effectTimersRef.current.push(setTimeout(() => { triggerPlaybackNote(n, vol); }, playTime));
                          else triggerPlaybackNote(n, vol);
                      });
                  });
              }
          });
      });

      if (currentRowTypes[r] === 'double-right') {
        const rightCellId = getCellId(r, m, c);
        const leftCellId = getCellId(r + 1, m, c);
        if (!mutedCellsRef.current.has(rightCellId)) triggerPlaybackNote(currentSheetData[r][m][c], layoutConfigRef.current.volume ?? 100);
        if (!mutedCellsRef.current.has(leftCellId)) triggerPlaybackNote(currentSheetData[r + 1] ? currentSheetData[r + 1][m][c] : '-', layoutConfigRef.current.volume ?? 100);
      } else {
        if (!mutedCellsRef.current.has(getCellId(r, m, c))) triggerPlaybackNote(currentSheetData[r][m][c], layoutConfigRef.current.volume ?? 100);
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
    const startCol = getFlattenedCol(sheetData[sr], rowTypes[sr], sm, sc), endCol = getFlattenedCol(sheetData[er], rowTypes[er], em, ec);
    const minCol = Math.min(startCol, endCol), maxCol = Math.max(startCol, endCol);

    const copiedBlock = [];
    for (let r = minR; r <= maxR; r++) {
      if (rowTypes[r] === 'page-break' || rowTypes[r] === 'text') continue;
      const rowData = []; let currentCol = 0;
      for (let m = 0; m < sheetData[r].length; m++) {
        if (rowTypes[r].startsWith('double') && m === 0) continue;
        for (let c = 0; c < sheetData[r][m].length; c++) {
          if (currentCol >= minCol && currentCol <= maxCol) rowData.push(sheetData[r][m][c]);
          currentCol++;
        }
      }
      if (rowData.length > 0) copiedBlock.push(rowData);
    }
    setClipboardData(copiedBlock); setSelectionRange(null); 
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
       if (typeof rowToPaste === 'string' || !Array.isArray(rowToPaste)) { setClipboardData([]); return; }
       let colIndex = 0, pasteIndex = 0;
       for (let meas = 0; meas < newData[i].length; meas++) {
          if (rowTypes[i].startsWith('double') && meas === 0) continue;
          for (let cell = 0; cell < newData[i][meas].length; cell++) {
             if (colIndex >= startCol && pasteIndex < rowToPaste.length) { newData[i][meas][cell] = rowToPaste[pasteIndex]; lastValidCursor = [i, meas, cell]; pasteIndex++; }
             colIndex++;
          }
       }
       currentDataRow++;
    }
    commitChange(newData); setSelectedCell(lastValidCursor);
  };

  const cutSelection = () => {
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
    commitChange(newData);
    setSelectionRange(null); 
  };

  const inputNote = (note) => {
    const newData = [...sheetData];
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

        for (let r = minR; r <= maxR; r++) {
          if (rowTypes[r] === 'page-break' || rowTypes[r] === 'text') continue; 
          let currentCol = 0;
          for (let m = 0; m < sheetData[r].length; m++) {
            if (rowTypes[r].startsWith('double') && m === 0) continue;
            for (let c = 0; c < sheetData[r][m].length; c++) {
              if (currentCol >= minCol && currentCol <= maxCol) newData[r][m][c] = note === 'BACKSPACE' ? '-' : note;
              currentCol++;
            }
          }
        }
        if (note !== 'BACKSPACE' && note !== '-') playNote(currentInstrument.id, note, layoutConfig.volume ?? 100);
        commitChange(newData); setSelectionRange(null);
        return;
    }

    setSelectionRange(null); 
    const [row, meas, cell] = selectedCell;
    if (rowTypes[row] === 'page-break' || rowTypes[row] === 'text' || (rowTypes[row].startsWith('double') && meas === 0)) return;

    if (note === 'BACKSPACE') {
      newData[row][meas][cell] = '-';
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
      newData[row][meas][cell] = note;
      playNote(currentInstrument.id, note, layoutConfig.volume ?? 100);
      commitChange(newData);
      if (cell < sheetData[row][meas].length - 1) setSelectedCell([row, meas, cell + 1]);
      else if (meas < sheetData[row].length - 1) setSelectedCell([row, meas + 1, 0]);
      else {
          let nextR = row + 1; while (nextR < sheetData.length && (rowTypes[nextR] === 'page-break' || rowTypes[nextR] === 'text')) nextR++;
          if (nextR < sheetData.length) setSelectedCell([nextR, rowTypes[nextR].startsWith('double') ? 1 : 0, 0]);
      }
    }
  };

  const addRow = () => { 
    setSelectionRange(null); 
    const isFirstHalf = selectedCell[1] < 4;
    let insertIdx = isFirstHalf ? selectedCell[0] : selectedCell[0] + 1;

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

  const addDoubleRow = (insertAtTop = false) => {
    setSelectionRange(null); 
    let insertIdx = insertAtTop ? selectedCell[0] : selectedCell[0] + 1;
    if (insertAtTop && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
    else if (!insertAtTop && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

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

  const addPageBreak = (insertAtTop = false) => {
    setSelectionRange(null);
    let insertIdx = insertAtTop ? selectedCell[0] : selectedCell[0] + 1;
    if (insertAtTop && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
    else if (!insertAtTop && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

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

  const addTextRow = (insertAtTop = false) => {
    setSelectionRange(null);
    let insertIdx = insertAtTop ? selectedCell[0] : selectedCell[0] + 1;
    if (insertAtTop && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
    else if (!insertAtTop && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

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

  const updateTextRow = (rIndex, text) => { const newData = [...sheetData]; newData[rIndex] = [[text]]; setSheetData(newData); };

  const removeRow = () => {
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

  const addNoteColumn = () => {
    setSelectionRange(null); 
    const [rowIdx, measIdx, cellIdx] = selectedCell;
    if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text' || (rowTypes[rowIdx].startsWith('double') && measIdx === 0)) return; 
    const newData = [...sheetData]; newData[rowIdx][measIdx].splice(cellIdx + 1, 0, '-');
    commitChange(newData);
  };

  const removeNoteColumn = () => {
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

  const addSectionLabel = (visualIndex) => commitChange(sheetData, rowTypes, { ...sectionLabels, [visualIndex]: [...(sectionLabels[visualIndex] || []), { id: Date.now(), text: "ท่อน ", position: 'top-left', fontSize: 18, isBold: true, offsetY: 6 }] });
  const updateSectionLabel = (visualIndex, labelId, updates) => commitChange(sheetData, rowTypes, { ...sectionLabels, [visualIndex]: (sectionLabels[visualIndex] || []).map(l => l.id === labelId ? { ...l, ...updates } : l) });
  const removeSectionLabel = (visualIndex, labelId) => {
    const newState = { ...sectionLabels }, filtered = (sectionLabels[visualIndex] || []).filter(l => l.id !== labelId);
    if (filtered.length > 0) newState[visualIndex] = filtered; else delete newState[visualIndex];
    commitChange(sheetData, rowTypes, newState);
  };

  const saveProject = () => {
    const projectData = { songName, sheetData, rowTypes, sectionLabels, symbols, layoutConfig, headerDetails, currentInstrument: currentInstrument.id, rowMargins, playbackSequence };
    const url = URL.createObjectURL(new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${songName || 'my-song'}.tme`; a.click(); URL.revokeObjectURL(url);
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
        if (data.currentInstrument && INSTRUMENT_CONFIG[data.currentInstrument]) setCurrentInstrument(INSTRUMENT_CONFIG[data.currentInstrument]);
        const loadedMargins = data.rowMargins || Array(data.sheetData?.length || 4).fill({ top: 0, bottom: 0, left: 0 });
        setRowMargins(loadedMargins);
        setSelectedCell([0, 0, 0]); setSelectionRange(null);
        commitChange(data.sheetData, data.rowTypes, data.sectionLabels, data.symbols, loadedMargins);
      } catch (error) { alert("ไฟล์ไม่ถูกต้อง หรือไฟล์เสียหายครับ!"); }
    };
    reader.readAsText(file);
  };

  const newProject = () => {
    if (window.confirm("คุณต้องการสร้างกระดาษใหม่ใช่หรือไม่? (ข้อมูลที่ยังไม่ได้เซฟจะหายไปทั้งหมด)")) {
      const initSheet = Array(4).fill().map(() => Array(8).fill().map(() => Array(4).fill('-'))), initType = Array(4).fill('single'), initMar = Array(4).fill({ top: 0, bottom: 0, left: 0 });
      setSongName("เพลงใหม่"); setSheetData(initSheet); setRowTypes(initType); setRowMargins(initMar); setSectionLabels({}); setSymbols([]);
      setHeaderDetails([{ id: 1, label: "อัตราจังหวะ", value: "๒ ชั้น" }, { id: 2, label: "หน้าทับ", value: "สองไม้" }, { id: 3, label: "บันไดเสียง", value: "ทางเพียงออ" }, { id: 4, label: "ผู้บันทึก", value: "9atony" }]);
      setSelectedCell([0, 0, 0]); setSelectionRange(null); setHistoryIndex(-1); setHistory([]); localStorage.removeItem('thaiMusicEditorAutoSave');
      commitChange(initSheet, initType, {}, [], initMar);
    }
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
        if (sheetSections.length > 0) sheetSections[sheetSections.length - 1].endRow = lastValidRow;
        sheetSections.push({ label: validLabels[0].text.trim(), startRow: r, endRow: currentSheetData.length - 1 });
        lastProcessedVIdx = vIdx;
      }
      lastValidRow = r;
      if (currentRowTypes[r] === 'double-right') lastValidRow = r + 1;
    }
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

  // ⭐ useEffect ชุดที่ถูกต้อง วางไว้ที่นี่
  // ⭐ useEffect ชุดที่ถูกต้อง (แก้ไขเพิ่ม Spacebar)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      const isEditable = e.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      
      if (isEditable) return; 

      // ⭐ เพิ่มการดักจับปุ่ม Spacebar ตรงนี้ครับ
      if (e.code === 'Space') {
        e.preventDefault(); // บล็อกไม่ให้หน้าเว็บเลื่อนลง
        togglePlay();       // สลับสถานะ เล่น/หยุดเพลง
        return;             // จบการทำงานรอบนี้
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') { e.preventDefault(); undo(); } 
        else if (e.code === 'KeyR' || e.code === 'KeyY') { e.preventDefault(); redo(); } 
        else if (e.code === 'KeyC') { e.preventDefault(); copySelection(); }
        else if (e.code === 'KeyV') { e.preventDefault(); pasteSelection(); }
        else if (e.code === 'KeyX') { e.preventDefault(); cutSelection(); }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    
  // ⭐ สำคัญมาก: อย่าลืมเพิ่ม togglePlay ในอาร์เรย์วงเล็บเหลี่ยมด้านล่างนี้ด้วยครับ
  }, [undo, redo, copySelection, pasteSelection, cutSelection, togglePlay]);

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
        if (data.currentInstrument && INSTRUMENT_CONFIG[data.currentInstrument]) setCurrentInstrument(INSTRUMENT_CONFIG[data.currentInstrument]);
        if (data.playbackSequence) setPlaybackSequence(data.playbackSequence);
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
    const projectData = { songName, sheetData, rowTypes, sectionLabels, symbols, layoutConfig, headerDetails, currentInstrument: currentInstrument.id, rowMargins, playbackSequence };
    localStorage.setItem('thaiMusicEditorAutoSave', JSON.stringify(projectData));
  }, [isLoaded, songName, sheetData, rowTypes, sectionLabels, symbols, layoutConfig, headerDetails, currentInstrument, rowMargins, playbackSequence]);

  const updateRowMarginsList = (arg1, arg2, arg3) => {
    const newRowMargins = [...rowMargins];
    if (Array.isArray(arg1)) {
      arg1.forEach(update => { newRowMargins[update.index] = { ...(newRowMargins[update.index] || { top: 0, bottom: 0, left: 0 }), ...update.changes }; });
    } else {
      for (let i = arg1; i <= arg2; i++) { newRowMargins[i] = { ...(newRowMargins[i] || { top: 0, bottom: 0, left: 0 }), ...arg3 }; }
    }
    commitChange(sheetData, rowTypes, sectionLabels, symbols, newRowMargins);
  };

  const addSymbol = (type, start, end, options = {}) => {
    const newSymbols = [...symbols, { id: Date.now(), type, start, end, ...options }];
    commitChange(sheetData, rowTypes, sectionLabels, newSymbols);
  };
  const updateSymbol = (id, updates) => commitChange(sheetData, rowTypes, sectionLabels, symbols.map(s => s.id === id ? { ...s, ...updates } : s));
  const removeSymbol = (id) => commitChange(sheetData, rowTypes, sectionLabels, symbols.filter(s => s.id !== id));
  const removeSymbolByCell = (cell) => {
    if (!cell) return;
    const newSymbols = symbols.filter(s => !(s.start[0] === cell[0] && s.start[1] === cell[1] && s.start[2] === cell[2]) && !(s.end[0] === cell[0] && s.end[1] === cell[1] && s.end[2] === cell[2]));
    if (newSymbols.length !== symbols.length) commitChange(sheetData, rowTypes, sectionLabels, newSymbols);
  };

  const addDetail = () => setHeaderDetails([...headerDetails, { id: headerDetails.length > 0 ? Math.max(...headerDetails.map(d => d.id)) + 1 : 1, label: "หัวข้อใหม่", value: "ระบุข้อมูล" }]);
  const removeDetail = (id) => setHeaderDetails(headerDetails.filter(detail => detail.id !== id));
  const updateDetail = (id, key, newValue) => setHeaderDetails(headerDetails.map(detail => detail.id === id ? { ...detail, [key]: newValue } : detail));
  const changeInstrument = (instrumentId) => setCurrentInstrument(INSTRUMENT_CONFIG[instrumentId]);

  return (
    <MusicContext.Provider value={{ 
      currentInstrument, changeInstrument, sheetData, selectedCell, setSelectedCell, inputNote,
      layoutConfig, setLayoutConfig, headerDetails, addDetail, removeDetail, updateDetail,
      songName, setSongName, sectionLabels, addSectionLabel, updateSectionLabel, removeSectionLabel,
      addRow, removeRow, addMeasure, removeMeasure, selectionRange, setSelectionRange,
      addNoteColumn, removeNoteColumn, rowTypes, addDoubleRow, addPageBreak, visualRowCount,
      startSelection, updateSelection, endSelection, copySelection, pasteSelection, cutSelection, clipboardData,
      saveProject, loadProject, newProject,
      undo, redo, canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1,
      isPlaying, playbackCursor, startPlayback, stopPlayback, togglePlay,
      symbols, addSymbol, updateSymbol, removeSymbol, removeSymbolByCell,
      selectedSymbolId, setSelectedSymbolId,
      isOctaveMode, setIsOctaveMode,
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
      availableSections
    }}>
      {children}
    </MusicContext.Provider>
  );
};