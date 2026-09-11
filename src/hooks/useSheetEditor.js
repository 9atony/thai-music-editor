import { expandFourNoteMeasures } from '../utils/expandFourNoteMeasures.js';
import { useState, useRef, useEffect } from 'react';
import {
  getFlattenedCol, normalizeCellToken, splitThaiNoteToken, getIntervalPair,
  shiftNoteString, createDefaultSheetData, createDefaultRowTypes, createDefaultRowMargins,
  normalizeNathapRowData, hasNathapLeadingLabel
} from '../utils/sheetUtils.js';
import { INSTRUMENT_CONFIG } from '../utils/instrumentConfig.js';
import { insertMeasureWithLogicalRowSplit } from '../utils/sheetRowSplit.js';

export const useSheetEditor = ({
  isReadOnlyRef,
  currentInstrument,
  intervalModeRef,
  isReduceModeRef,
  layoutConfigRef,
  isPlayingRef,
  stopPlayback,
  onPreviewToken,
  onRowIndexMap,
  onLayoutConfigRestore
}) => {
  const [sheetData, setSheetData] = useState(createDefaultSheetData);
  const [rowTypes, setRowTypes] = useState(createDefaultRowTypes);
  const [rowMargins, setRowMargins] = useState(() => createDefaultRowMargins());
  const [sectionLabels, setSectionLabels] = useState({});
  const [symbols, setSymbols] = useState([]);
  const [selectedCell, setSelectedCell] = useState([0, 1, 0]);
  const [selectionRange, setSelectionRange] = useState(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [clipboardData, setClipboardData] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const selectedCellRef = useRef(selectedCell);
  useEffect(() => { selectedCellRef.current = selectedCell; }, [selectedCell]);

  const getCellInstrumentId = (row, meas, cell) => (
    layoutConfigRef.current.customStyles?.[`${row}_${meas}_${cell}`]?.instrumentId || null
  );

  const resetSheetState = () => {
    const defaultSheet = createDefaultSheetData();
    const defaultTypes = createDefaultRowTypes();
    const defaultMargins = createDefaultRowMargins(defaultSheet.length);

    setSheetData(defaultSheet);
    setRowTypes(defaultTypes);
    setRowMargins(defaultMargins);
    setSectionLabels({});
    setSymbols([]);
    setSelectedCell([0, 1, 0]);
    setSelectionRange(null);
    setHistory([]);
    setHistoryIndex(-1);

    return { defaultSheet, defaultTypes, defaultMargins };
  };

  const createInsertedRowIndexMap = (insertIndex, count) => new Map(
    sheetData.map((_, rowIndex) => [rowIndex, rowIndex < insertIndex ? rowIndex : rowIndex + count])
  );
  const createRemovedRowIndexMap = (removeIndex, count) => new Map(
    sheetData.flatMap((_, rowIndex) => {
      if (rowIndex >= removeIndex && rowIndex < removeIndex + count) return [];
      return [[rowIndex, rowIndex < removeIndex ? rowIndex : rowIndex - count]];
    })
  );

  const commitChange = (newSheetData, newRowTypes, newSectionLabels, newSymbols, newRowMargins, rowIndexMap = null, styleCopies = [], tempoTrackSnapshot = layoutConfigRef.current.tempoTrack || [], positionMapper = null) => {
    setSheetData(newSheetData);
    if (newRowTypes) setRowTypes(newRowTypes);
    if (newSectionLabels) setSectionLabels(newSectionLabels);
    if (newSymbols) setSymbols(newSymbols);
    if (newRowMargins) setRowMargins(newRowMargins);
    const remappedTempoTrack = rowIndexMap ? onRowIndexMap?.(rowIndexMap, styleCopies, positionMapper) : null;
    
    const snapshot = {
      sheetData: newSheetData.map(row => row.map(meas => [...meas])),
      rowTypes: newRowTypes ? [...newRowTypes] : [...rowTypes],
      sectionLabels: newSectionLabels ? JSON.parse(JSON.stringify(newSectionLabels)) : JSON.parse(JSON.stringify(sectionLabels)),
      symbols: newSymbols ? [...newSymbols] : [...symbols],
      rowMargins: newRowMargins ? JSON.parse(JSON.stringify(newRowMargins)) : JSON.parse(JSON.stringify(rowMargins)),
      tempoTrack: JSON.parse(JSON.stringify(remappedTempoTrack || tempoTrackSnapshot || []))
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
      onLayoutConfigRestore?.(prev.tempoTrack || []);
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
      onLayoutConfigRestore?.(next.tempoTrack || []);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const updateCellToken = (row, meas, cell, token, options = {}) => {
    if (isReadOnlyRef.current) return;
    if (rowTypes[row] === 'page-break' || rowTypes[row] === 'text' || (rowTypes[row].startsWith('double') && meas === 0) || (meas === 0 && hasNathapLeadingLabel(sheetData[row], rowTypes[row]))) return;

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
    if (options.preview !== false && normalizedToken !== '-' && onPreviewToken) {
      onPreviewToken(normalizedToken, options.volume ?? (layoutConfigRef.current.volume ?? 100), getCellInstrumentId(row, meas, cell));
    }
  };

  const moveSelectionToAdjacentCell = (direction = 'next') => {
    if (!selectedCell) return;
    let [row, meas, cell] = selectedCell;
    const isNext = direction !== 'prev';

    if (isNext) {
      if (cell < sheetData[row][meas].length - 1) cell += 1;
      else if (meas < sheetData[row].length - 1) { meas += 1; if ((rowTypes[row].startsWith('double') || hasNathapLeadingLabel(sheetData[row], rowTypes[row])) && meas === 0) meas = 1; cell = 0; }
      else {
        let nextR = row + 1;
        while (nextR < sheetData.length && (rowTypes[nextR] === 'page-break' || rowTypes[nextR] === 'text')) nextR++;
        if (nextR >= sheetData.length) return;
        row = nextR; meas = (rowTypes[row].startsWith('double') || hasNathapLeadingLabel(sheetData[row], rowTypes[row])) ? 1 : 0; cell = 0;
      }
    } else {
      if (cell > 0) cell -= 1;
      else if (meas > ((rowTypes[row].startsWith('double') || hasNathapLeadingLabel(sheetData[row], rowTypes[row])) ? 1 : 0)) { meas -= 1; cell = sheetData[row][meas].length - 1; }
      else {
        let prevR = row - 1;
        while (prevR >= 0 && (rowTypes[prevR] === 'page-break' || rowTypes[prevR] === 'text')) prevR--;
        if (prevR < 0) return;
        row = prevR; meas = sheetData[row].length - 1;
        if ((rowTypes[row].startsWith('double') || hasNathapLeadingLabel(sheetData[row], rowTypes[row])) && meas === 0) meas = 1;
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
    if (rowTypes[row] === 'page-break' || rowTypes[row] === 'text' || (rowTypes[row].startsWith('double') && meas === 0) || (meas === 0 && hasNathapLeadingLabel(sheetData[row], rowTypes[row]))) return;

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
    if (options.preview !== false && mergedToken !== '-' && onPreviewToken) {
      onPreviewToken(mergedToken, options.volume ?? (layoutConfigRef.current.volume ?? 100), getCellInstrumentId(row, meas, cell));
    }
    if (options.moveNext) setTimeout(() => moveSelectionToAdjacentCell('next'), 0);
  };

  const trimCurrentCellToken = () => {
    if (isReadOnlyRef.current || !selectedCell) return;
    const [row, meas, cell] = selectedCell;
    if (rowTypes[row] === 'page-break' || rowTypes[row] === 'text' || (rowTypes[row].startsWith('double') && meas === 0) || (meas === 0 && hasNathapLeadingLabel(sheetData[row], rowTypes[row]))) return;

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
        if (normalizedToken !== '-' && onPreviewToken) {
          const [previewRow, previewMeasure, previewCell] = selectedCell;
          onPreviewToken(normalizedToken, layoutConfigRef.current.volume ?? 100, getCellInstrumentId(previewRow, previewMeasure, previewCell));
        }
        commitChange(newData); setSelectionRange(null);
        return;
    }

    setSelectionRange(null);
    const [row, meas, cell] = selectedCell;
    if (rowTypes[row] === 'page-break' || rowTypes[row] === 'text' || (rowTypes[row].startsWith('double') && meas === 0) || (meas === 0 && hasNathapLeadingLabel(sheetData[row], rowTypes[row]))) return;

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

      if (normalizedToken !== '-' && onPreviewToken) {
        onPreviewToken(normalizedToken, layoutConfigRef.current.volume ?? 100, getCellInstrumentId(row, meas, cell));
      }
      commitChange(newData);
      if (cell < sheetData[row][meas].length - 1) setSelectedCell([row, meas, cell + 1]);
      else if (meas < sheetData[row].length - 1) setSelectedCell([row, meas + 1, 0]);
      else {
          let nextR = row + 1; while (nextR < sheetData.length && (rowTypes[nextR] === 'page-break' || rowTypes[nextR] === 'text')) nextR++;
          if (nextR < sheetData.length) setSelectedCell([nextR, (rowTypes[nextR].startsWith('double') || hasNathapLeadingLabel(sheetData[nextR], rowTypes[nextR])) ? 1 : 0, 0]);
      }
    }
  };

  const startSelection = (r, m, c) => { setIsDragging(true); setDragStart([r, m, c]); setSelectionRange({ start: [r, m, c], end: [r, m, c] }); setSelectedCell([r, m, c]); };
  const updateSelection = (r, m, c) => { if (isDragging && dragStart) setSelectionRange({ start: dragStart, end: [r, m, c] }); };
  const startRowLabelSelection = (r) => {
    setIsDragging(true);
    setDragStart([r, 0, 0]);
    setSelectionRange({ start: [r, 0, 0], end: [r, 0, 0], includeRowLabels: true, labelOnly: true });
    setSelectedCell([r, 0, 0]);
  };
  const updateRowLabelSelection = (r) => {
    if (!isDragging || !dragStart) return;
    setSelectionRange({ start: [dragStart[0], 0, 0], end: [r, 0, 0], includeRowLabels: true, labelOnly: true });
  };
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
    setClipboardData(payload); 

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
    let payload = clipboardData; 
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && parsed.type === 'TME_CLIPBOARD') payload = parsed.data; 
      }
    } catch (err) {}

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
    if (isReadOnlyRef.current || !selectionRange) return; 
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
          if (currentCol >= minCol && currentCol <= maxCol) newData[r][m][c] = '-'; 
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

  const addRow = (insertAtTop = null, targetCell = null, options = {}) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef?.current) stopPlayback(); 
    setSelectionRange(null); 
    
    const [rIdx, mIdx] = Array.isArray(targetCell) ? targetCell : selectedCell;
    let insertIdx;
    let isFirstHalf = false;

    const isTextAnchor = rowTypes[rIdx] === 'text';
    if (isTextAnchor) {
      insertIdx = rIdx + 1;
    } else if (rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1;
    } else {
      const currentMeasureCount = sheetData[rIdx]?.length || 8;
      isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (mIdx < Math.ceil(currentMeasureCount / 2));
      insertIdx = isFirstHalf ? rIdx : rIdx + 1;

      if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1; 
      else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1; 

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
    const requestedMeasureCount = Number.isInteger(options.measureCount) ? Math.max(1, options.measureCount) : null;
    const sourceSingleMeasures = rowTypes[rIdx] === 'single' ? sheetData[rIdx] : [];
    const blankSingleRow = requestedMeasureCount
      ? Array.from({ length: requestedMeasureCount }, (_, index) => {
          const source = sourceSingleMeasures[Math.min(index, sourceSingleMeasures.length - 1)];
          const marker = source?.[0];
          const cellCount = source && marker !== '@HIDDEN' && !(typeof marker === 'string' && marker.startsWith('@TEXT_SPAN_'))
            ? Math.max(1, source.length)
            : 4;
          return Array(cellCount).fill('-');
        })
      : targetCell && rowTypes[rIdx] === 'single'
        ? sheetData[rIdx].map((measure) => Array(Math.max(1, measure.length)).fill('-'))
        : Array(8).fill().map(() => Array(4).fill('-'));
    newData.splice(insertIdx, 0, blankSingleRow);
    newRowTypes.splice(insertIdx, 0, 'single');
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }); 

    const newSymbols = symbols.map(sym => ({
      ...sym,
      start: [sym.start[0] >= insertIdx ? sym.start[0] + 1 : sym.start[0], sym.start[1], sym.start[2]],
      end: [sym.end[0] >= insertIdx ? sym.end[0] + 1 : sym.end[0], sym.end[1], sym.end[2]]
    }));

    const styleCopies = targetCell && rowTypes[rIdx] === 'single'
      ? [{ sourceRow: rIdx, targetRow: insertIdx }]
      : [];
    commitChange(newData, newRowTypes, newSectionLabels, newSymbols, newRowMargins, createInsertedRowIndexMap(insertIdx, 1), styleCopies);
    
    if (isTextAnchor || rowTypes[rIdx] === 'page-break') setSelectedCell([insertIdx, 0, 0]);
    else if (isFirstHalf) setSelectedCell([insertIdx + 1, 0, 0]); 
  };

  const addDoubleRow = (insertAtTop = null, targetCell = null, options = {}) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef?.current) stopPlayback(); 
    setSelectionRange(null); 
    
    const [rIdx, mIdx] = Array.isArray(targetCell) ? targetCell : selectedCell;
    let insertIdx;
    let isFirstHalf = false;

    const isTextAnchor = rowTypes[rIdx] === 'text';
    if (isTextAnchor) {
      insertIdx = rIdx + 1;
    } else if (rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1;
    } else {
      const currentMeasureCount = sheetData[rIdx]?.length || (rowTypes[rIdx]?.startsWith('double') ? 9 : 8);
      isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (mIdx < Math.ceil(currentMeasureCount / 2));
      insertIdx = isFirstHalf ? rIdx : rIdx + 1;
      
      if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
      else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

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

    const sourceRightRow = rowTypes[rIdx] === 'double-left' ? rIdx - 1 : rIdx;
    const makeBlankHandRow = (sourceRow, label) => [
      [label],
      ...sheetData[sourceRow].slice(1).map((measure) => Array(Math.max(1, measure.length)).fill('-'))
    ];
    const requestedMeasureCount = Number.isInteger(options.measureCount) ? Math.max(1, options.measureCount) : null;
    const makeRequestedHandRow = (sourceRow, label) => {
      const sourceMeasures = sheetData[sourceRow]?.slice(1) || [];
      return [
        [label],
        ...Array.from({ length: requestedMeasureCount }, (_, index) => {
          const source = sourceMeasures[Math.min(index, sourceMeasures.length - 1)];
          const marker = source?.[0];
          const cellCount = source && marker !== '@HIDDEN' && !(typeof marker === 'string' && marker.startsWith('@TEXT_SPAN_'))
            ? Math.max(1, source.length)
            : 4;
          return Array(cellCount).fill('-');
        })
      ];
    };
    const blankRightRow = requestedMeasureCount
      ? makeRequestedHandRow(sourceRightRow, 'มือขวา')
      : targetCell && rowTypes[sourceRightRow] === 'double-right'
        ? makeBlankHandRow(sourceRightRow, 'มือขวา')
        : [['มือขวา'], ...Array(8).fill().map(() => Array(4).fill('-'))];
    const blankLeftRow = requestedMeasureCount
      ? makeRequestedHandRow(sourceRightRow + 1, 'มือซ้าย')
      : targetCell && rowTypes[sourceRightRow + 1] === 'double-left'
        ? makeBlankHandRow(sourceRightRow + 1, 'มือซ้าย')
        : [['มือซ้าย'], ...Array(8).fill().map(() => Array(4).fill('-'))];

    const newData = [...sheetData], newRowTypes = [...rowTypes], newRowMargins = [...rowMargins];
    newData.splice(insertIdx, 0, blankRightRow, blankLeftRow);
    newRowTypes.splice(insertIdx, 0, 'double-right', 'double-left');
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }, { top: 0, bottom: 0, left: 0 }); 

    const newSymbols = symbols.map(sym => ({
      ...sym,
      start: [sym.start[0] >= insertIdx ? sym.start[0] + 2 : sym.start[0], sym.start[1], sym.start[2]],
      end: [sym.end[0] >= insertIdx ? sym.end[0] + 2 : sym.end[0], sym.end[1], sym.end[2]]
    }));

    const styleCopies = targetCell && rowTypes[sourceRightRow] === 'double-right'
      ? [
          { sourceRow: sourceRightRow, targetRow: insertIdx },
          { sourceRow: sourceRightRow + 1, targetRow: insertIdx + 1 }
        ]
      : [];
    commitChange(newData, newRowTypes, newSectionLabels, newSymbols, newRowMargins, createInsertedRowIndexMap(insertIdx, 2), styleCopies);
    
    if (isTextAnchor || rowTypes[rIdx] === 'page-break') setSelectedCell([insertIdx, 0, 0]);
    else if (isFirstHalf) setSelectedCell([insertIdx + 2, 0, 0]); 
  };

  const addPageBreak = (insertAtTop = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef?.current) stopPlayback(); 
    setSelectionRange(null);
    
    const [rIdx, mIdx] = selectedCell;
    let insertIdx;

    if (rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1;
    } else {
      insertIdx = rIdx + 1;
      if (rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;
      while (insertIdx < rowTypes.length && (rowTypes[insertIdx] === 'annotation' || rowTypes[insertIdx] === 'nathap')) insertIdx += 1;
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
    commitChange(newData, newRowTypes, { ...sectionLabels }, newSymbols, newRowMargins, createInsertedRowIndexMap(insertIdx, 1));
    setSelectedCell([insertIdx, 0, 0]);
  };

  const addTextRow = (insertAtTop = null, options = {}) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef?.current) stopPlayback(); 
    setSelectionRange(null);
    
    const [selectedRowIndex, selectedMeasureIndex] = selectedCell;
    const rIdx = Number.isInteger(options.sourceRowIndex) ? options.sourceRowIndex : selectedRowIndex;
    const mIdx = rIdx === selectedRowIndex ? selectedMeasureIndex : 0;
    let insertIdx;

    if (rowTypes[rIdx] === 'text') {
      // A text cursor always inserts the next editable row directly below it.
      insertIdx = rIdx + 1;
    } else if (rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1;
    } else {
      const isDouble = rowTypes[rIdx]?.startsWith('double');
      const isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (isDouble ? mIdx < 5 : mIdx < 4);
      insertIdx = isFirstHalf ? rIdx : rIdx + 1;
      
      if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
      else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

      if (!isFirstHalf) {
        while (insertIdx < rowTypes.length && (rowTypes[insertIdx] === 'annotation' || rowTypes[insertIdx] === 'nathap')) insertIdx += 1;
      }
    }

    const newData = [...sheetData], newRowTypes = [...rowTypes], newRowMargins = [...rowMargins];
    if (typeof options.sourceText === 'string' && rowTypes[rIdx] === 'text') {
      newData[rIdx] = [[options.sourceText]];
    }
    newData.splice(insertIdx, 0, [[""]]); 
    newRowTypes.splice(insertIdx, 0, 'text');
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }); 

    const newSymbols = symbols.map(sym => ({
      ...sym,
      start: [sym.start[0] >= insertIdx ? sym.start[0] + 1 : sym.start[0], sym.start[1], sym.start[2]],
      end: [sym.end[0] >= insertIdx ? sym.end[0] + 1 : sym.end[0], sym.end[1], sym.end[2]]
    }));
    commitChange(newData, newRowTypes, { ...sectionLabels }, newSymbols, newRowMargins, createInsertedRowIndexMap(insertIdx, 1));
    setTimeout(() => { setSelectedCell([insertIdx, 0, 0]); }, 10);
    return insertIdx;
  };

  const updateTextRow = (rIndex, text, options = {}) => {
    if (isReadOnlyRef.current) return;
    if (options.preview) {
      setSheetData((currentData) => {
        if (!currentData[rIndex] || currentData[rIndex][0]?.[0] === text) return currentData;
        const nextData = [...currentData];
        nextData[rIndex] = [[text]];
        return nextData;
      });
      return;
    }

    const newData = [...sheetData];
    newData[rIndex] = [[text]];
    commitChange(newData);
  };

  const addAnnotationRow = (insertAtTop = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef?.current) stopPlayback(); 
    setSelectionRange(null);
    
    const [rIdx,  mIdx] = selectedCell;
    let insertIdx;

    if (rowTypes[rIdx] === 'text') {
      insertIdx = rIdx + 1;
    } else if (rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1;
    } else {
      const isDouble = rowTypes[rIdx]?.startsWith('double');
      const isFirstHalf = typeof insertAtTop === 'boolean' ? insertAtTop : (isDouble ? mIdx < 5 : mIdx < 4);
      insertIdx = isFirstHalf ? rIdx : rIdx + 1;
      
      if (isFirstHalf && rowTypes[insertIdx] === 'double-left' && rowTypes[insertIdx - 1] === 'double-right') insertIdx -= 1;
      else if (!isFirstHalf && rowTypes[insertIdx - 1] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;

      if (!isFirstHalf) {
        while (insertIdx < rowTypes.length && (rowTypes[insertIdx] === 'annotation' || rowTypes[insertIdx] === 'nathap')) insertIdx += 1;
      }
    }

    const newData = [...sheetData], newRowTypes = [...rowTypes], newRowMargins = [...rowMargins];
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
    commitChange(newData, newRowTypes, { ...sectionLabels }, newSymbols, newRowMargins, createInsertedRowIndexMap(insertIdx, 1));
    setTimeout(() => { setSelectedCell([insertIdx, 0, 0]); }, 10);
  };

  const addNathapRow = (targetCell = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef?.current) stopPlayback(); 
    setSelectionRange(null);
    
    const [rIdx] = Array.isArray(targetCell) ? targetCell : selectedCell;
    let insertIdx;
    const isTextAnchor = rowTypes[rIdx] === 'text';

    let parentRIdx = rIdx;
    while (parentRIdx >= 0 && (rowTypes[parentRIdx] === 'annotation' || rowTypes[parentRIdx] === 'nathap' || rowTypes[parentRIdx] === 'text')) {
      parentRIdx--;
    }
    const isUnderDouble = !isTextAnchor && parentRIdx >= 0 && rowTypes[parentRIdx]?.startsWith('double');

    if (Array.isArray(targetCell)) {
      insertIdx = rowTypes[rIdx] === 'double-right' && rowTypes[rIdx + 1] === 'double-left'
        ? rIdx + 2
        : rIdx + 1;
    } else if (isTextAnchor || rowTypes[rIdx] === 'page-break') {
      insertIdx = rIdx + 1;
    } else {
      insertIdx = parentRIdx + 1;
      if (parentRIdx >= 0 && rowTypes[parentRIdx] === 'double-right' && rowTypes[insertIdx] === 'double-left') insertIdx += 1;
      while (insertIdx < rowTypes.length && (rowTypes[insertIdx] === 'annotation' || rowTypes[insertIdx] === 'nathap')) insertIdx += 1;
    }

    const newData = [...sheetData], newRowTypes = [...rowTypes], newRowMargins = [...rowMargins];
    const sourceParentRow = rowTypes[parentRIdx] === 'double-left' ? parentRIdx - 1 : parentRIdx;
    const sourceMeasures = isTextAnchor
      ? Array.from({ length: 8 }, () => Array(4).fill('-'))
      : isUnderDouble
      ? (sheetData[sourceParentRow]?.slice(1) || [])
      : (sheetData[sourceParentRow] || []);
    const blankMeasures = sourceMeasures.map((measure) => {
      const marker = measure?.[0];
      const cellCount = marker !== '@HIDDEN' && !(typeof marker === 'string' && marker.startsWith('@TEXT_SPAN_'))
        ? Math.max(1, measure.length)
        : 4;
      return Array(cellCount).fill('-');
    });

    if (isUnderDouble) newData.splice(insertIdx, 0, [[''], ...blankMeasures]);
    else newData.splice(insertIdx, 0, blankMeasures);
    
    newRowTypes.splice(insertIdx, 0, 'nathap'); 
    newRowMargins.splice(insertIdx, 0, { top: 0, bottom: 0, left: 0 }); 

    const newSymbols = symbols.map(sym => ({
      ...sym,
      start: [sym.start[0] >= insertIdx ? sym.start[0] + 1 : sym.start[0], sym.start[1], sym.start[2]],
      end: [sym.end[0] >= insertIdx ? sym.end[0] + 1 : sym.end[0], sym.end[1], sym.end[2]]
    }));
    
    commitChange(newData, newRowTypes, { ...sectionLabels }, newSymbols, newRowMargins, createInsertedRowIndexMap(insertIdx, 1));
    setTimeout(() => { setSelectedCell([insertIdx, isUnderDouble ? 1 : 0, 0]); }, 10);
  };
  
  const removeRow = (targetIdx = null) => {
    if (isReadOnlyRef.current) return;
    if (isPlayingRef?.current) stopPlayback();
    setSelectionRange(null); 
    
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

    commitChange(newData, newRowTypes, newSectionLabels, newSymbols, newRowMargins, createRemovedRowIndexMap(startIndex, deleteCount));
    let nextRow = startIndex >= newData.length ? newData.length - 1 : startIndex;
    setSelectedCell([nextRow, (newRowTypes[nextRow].startsWith('double') || hasNathapLeadingLabel(newData[nextRow], newRowTypes[nextRow])) ? 1 : 0, 0]);
  };

  const removeMeasure = () => {
    if (isReadOnlyRef.current) return;

    let isBlockSelection = false;
    let minR, maxR, minM, maxM;

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

    const newData = sheetData.map(row => row.map(meas => [...meas]));

    const getParentRowIndex = (rowIndex) => {
      let parentRowIndex = rowIndex;
      while (parentRowIndex >= 0 && ['annotation', 'nathap', 'text'].includes(rowTypes[parentRowIndex])) parentRowIndex--;
      if (rowTypes[parentRowIndex] === 'double-left') parentRowIndex--;
      return parentRowIndex;
    };

    const removeMeasuresFromGroup = (parentRowIndex, measureIndex, requestedCount = 1) => {
      const parentType = rowTypes[parentRowIndex];
      if (!newData[parentRowIndex] || (parentType !== 'single' && parentType !== 'double-right')) return 0;

      const minimumLength = parentType === 'double-right' ? 2 : 1;
      const parentCanRemove = measureIndex < newData[parentRowIndex].length;
      const removableCount = parentCanRemove
        ? Math.min(requestedCount, newData[parentRowIndex].length - minimumLength)
        : 0;

      if (removableCount > 0) {
        newData[parentRowIndex].splice(measureIndex, removableCount);
        if (parentType === 'double-right' && newData[parentRowIndex + 1]) {
          newData[parentRowIndex + 1].splice(measureIndex, removableCount);
        }
      }

      const firstRelatedRow = parentRowIndex + (parentType === 'double-right' ? 2 : 1);
      const parentLastMeasureIndex = newData[parentRowIndex].length - 1;
      const isExtraMeasure = !parentCanRemove && measureIndex > parentLastMeasureIndex;
      let removedExtraMeasure = false;
      for (let relatedRowIndex = firstRelatedRow; relatedRowIndex < rowTypes.length; relatedRowIndex++) {
        const relatedType = rowTypes[relatedRowIndex];
        if (relatedType === 'page-break' || relatedType === 'single' || relatedType === 'double-right' || relatedType === 'double-left') break;
        if (relatedType !== 'nathap' || !newData[relatedRowIndex]) continue;

        const relatedMinimumLength = hasNathapLeadingLabel(newData[relatedRowIndex], relatedType) ? 2 : 1;
        const requestedRelatedCount = removableCount || (isExtraMeasure ? requestedCount : 0);
        const relatedRemovableCount = Math.min(requestedRelatedCount, newData[relatedRowIndex].length - relatedMinimumLength);
        if (relatedRemovableCount > 0 && measureIndex < newData[relatedRowIndex].length) {
          newData[relatedRowIndex].splice(measureIndex, relatedRemovableCount);
          removedExtraMeasure = true;
        }
      }

      return removableCount || (removedExtraMeasure ? 1 : 0);
    };

    if (isBlockSelection) {
      const processedParents = new Set();
      for (let r = minR; r <= maxR; r++) {
        if (!['single', 'double-right', 'double-left', 'nathap'].includes(rowTypes[r])) continue;
        const parentRowIndex = getParentRowIndex(r);
        if (processedParents.has(parentRowIndex)) continue;
        processedParents.add(parentRowIndex);

        const actualMinM = rowTypes[parentRowIndex] === 'double-right' ? Math.max(1, minM) : minM;
        if (actualMinM <= maxM) removeMeasuresFromGroup(parentRowIndex, actualMinM, maxM - actualMinM + 1);
      }
      
      commitChange(newData);
      setSelectionRange(null);
      setSelectedCell([minR, Math.min(minM, newData[minR].length - 1), 0]);

    } else {
      setSelectionRange(null); 
      const [rowIdx, measIdx] = selectedCell;
      if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text' || (rowTypes[rowIdx].startsWith('double') && measIdx === 0) || (measIdx === 0 && hasNathapLeadingLabel(sheetData[rowIdx], rowTypes[rowIdx]))) return;
      
      const parentRowIndex = getParentRowIndex(rowIdx);
      if (removeMeasuresFromGroup(parentRowIndex, measIdx) > 0) {
        commitChange(newData);
        if (measIdx >= newData[rowIdx].length) setSelectedCell([rowIdx, newData[rowIdx].length - 1, 0]);
      }
    }
  };

  const expandSelectedMeasures = () => {
    if (isReadOnlyRef.current || !selectionRange?.start || !selectionRange?.end || selectionRange.labelOnly) return;
    const newData = expandFourNoteMeasures(sheetData, rowTypes, selectionRange);
    if (newData === sheetData) return;
    if (isPlayingRef?.current) stopPlayback?.();
    commitChange(newData);
    setSelectionRange(null);
  };

  const addNoteColumn = () => {
    if (isReadOnlyRef.current) return;
    setSelectionRange(null); 
    const [rowIdx, measIdx, cellIdx] = selectedCell;
    if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text' || (rowTypes[rowIdx].startsWith('double') && measIdx === 0) || (measIdx === 0 && hasNathapLeadingLabel(sheetData[rowIdx], rowTypes[rowIdx]))) return;
    const newData = [...sheetData]; newData[rowIdx][measIdx].splice(cellIdx + 1, 0, '-');
    commitChange(newData);
  };

  const removeNoteColumn = () => {
    if (isReadOnlyRef.current) return;
    setSelectionRange(null); 
    const [rowIdx, measIdx, cellIdx] = selectedCell;
    if (rowTypes[rowIdx] === 'page-break' || rowTypes[rowIdx] === 'text' || (rowTypes[rowIdx].startsWith('double') && measIdx === 0) || (measIdx === 0 && hasNathapLeadingLabel(sheetData[rowIdx], rowTypes[rowIdx]))) return;
    if (sheetData[rowIdx][measIdx].length > 1) {
      const newData = [...sheetData]; newData[rowIdx][measIdx].splice(cellIdx, 1);
      commitChange(newData);
      if (cellIdx >= newData[rowIdx][measIdx].length) setSelectedCell([rowIdx, measIdx, newData[rowIdx][measIdx].length - 1]);
    }
  };

  const addMeasure = (targetCell = null) => {
    if (isReadOnlyRef.current) return;
    const result = insertMeasureWithLogicalRowSplit({
      sheetData,
      rowTypes,
      rowMargins,
      sectionLabels,
      symbols,
      targetCell: Array.isArray(targetCell) ? targetCell : selectedCell
    });
    if (!result) return;

    setSelectionRange(null);
    commitChange(
      result.sheetData,
      result.rowTypes,
      result.sectionLabels,
      result.symbols,
      result.rowMargins,
      result.rowIndexMap,
      [],
      layoutConfigRef.current.tempoTrack || [],
      result.mapPosition
    );
    setSelectedCell(result.selectedCell);
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
    if ((rowTypes[targetR].startsWith('double') || hasNathapLeadingLabel(sheetData[targetR], rowTypes[targetR])) && minM === 0) return;

    let expanded = true;
    while (expanded) {
      expanded = false;
      for (let m = 0; m < sheetData[targetR].length; m++) {
        const marker = sheetData[targetR][m]?.[0];
        if (typeof marker !== 'string' || !marker.startsWith('@TEXT_SPAN_')) continue;
        const existingSpan = Math.max(1, parseInt(marker.split('_')[2], 10) || 1);
        const existingEnd = Math.min(sheetData[targetR].length - 1, m + existingSpan - 1);
        if (m <= maxM && existingEnd >= minM) {
          const nextMin = Math.min(minM, m);
          const nextMax = Math.max(maxM, existingEnd);
          if (nextMin !== minM || nextMax !== maxM) expanded = true;
          minM = nextMin;
          maxM = nextMax;
        }
      }
    }

    const existingText = sheetData[targetR]
      .slice(minM, maxM + 1)
      .filter((measure) => typeof measure?.[0] === 'string' && measure[0].startsWith('@TEXT_SPAN_'))
      .map((measure) => measure[1] || '')
      .filter((text) => String(text).trim() !== '')
      .join(' ');
    const span = maxM - minM + 1;
    newData[targetR][minM] = [`@TEXT_SPAN_${span}`, existingText];
    for (let m = minM + 1; m <= maxM; m++) newData[targetR][m] = ['@HIDDEN'];
    
    commitChange(newData);
    setSelectionRange(null);
  };

  const updateMeasureText = (r, m, text) => {
    if (isReadOnlyRef.current) return;
    const newData = [...sheetData];
    if (!newData[r] || !newData[r][m]) return;

    if (typeof newData[r][m][0] === 'string' && newData[r][m][0].startsWith('@TEXT_SPAN_')) {
      newData[r][m][1] = text;
    } else {
      newData[r][m][0] = text;
    }
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

  const addSymbol = (type, start, end, options = {}) => {
    if (isReadOnlyRef.current) return; 
    const newSymbols = [...symbols, { id: Date.now(), type, start, end, ...options }];
    commitChange(sheetData, rowTypes, sectionLabels, newSymbols);
  };
  
  const updateSymbol = (id, updates) => { if (isReadOnlyRef.current) return; commitChange(sheetData, rowTypes, sectionLabels, symbols.map(s => s.id === id ? { ...s, ...updates } : s)); };

  const updateSymbols = (matcher, updates) => {
    if (isReadOnlyRef.current) return;
    commitChange(sheetData, rowTypes, sectionLabels, symbols.map(symbol => matcher(symbol) ? { ...symbol, ...updates } : symbol));
  };
  
  const removeSymbol = (id) => { if (isReadOnlyRef.current) return; commitChange(sheetData, rowTypes, sectionLabels, symbols.filter(s => s.id !== id)); };
  
  const removeSymbolByCell = (cell) => {
    if (isReadOnlyRef.current || !cell) return;
    const newSymbols = symbols.filter(s => !(s.start[0] === cell[0] && s.start[1] === cell[1] && s.start[2] === cell[2]) && !(s.end[0] === cell[0] && s.end[1] === cell[1] && s.end[2] === cell[2]));
    if (newSymbols.length !== symbols.length) commitChange(sheetData, rowTypes, sectionLabels, newSymbols);
  };

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

  return {
    sheetData, setSheetData, rowTypes, setRowTypes, rowMargins, setRowMargins,
    sectionLabels, setSectionLabels, symbols, setSymbols,
    selectedCell, setSelectedCell, selectionRange, setSelectionRange, selectedCellRef,
    clipboardData, setClipboardData, isDragging, setIsDragging, dragStart, setDragStart,
    history, historyIndex, setHistory, setHistoryIndex, commitChange, undo, redo,
    resetSheetState, updateCellToken, appendNoteToCurrentCell, trimCurrentCellToken,
    inputNote, moveSelectionNext, moveSelectionPrev, moveSelectionToAdjacentCell,
    startSelection, updateSelection, startRowLabelSelection, updateRowLabelSelection, endSelection, copySelection, pasteSelection, cutSelection,
    addRow, addDoubleRow, addPageBreak, addTextRow, updateTextRow, addAnnotationRow, addNathapRow, removeRow,
    addMeasure, removeMeasure, addNoteColumn, removeNoteColumn, expandSelectedMeasures, convertMeasureToText, updateMeasureText,
    addSectionLabel, updateSectionLabel, removeSectionLabel,
    addSymbol, updateSymbol, updateSymbols, removeSymbol, removeSymbolByCell, updateRowMarginsList
  };
};
