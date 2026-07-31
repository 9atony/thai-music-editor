import React, { useContext, forwardRef, useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { MusicContext } from '../../contexts/MusicContext';

// ==========================================
// 1. Helper Functions (ฟังก์ชันช่วยเหลือ)
// ==========================================
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

const getVisualIndexForCalc = (rowIndex, types) => {
  let count = 0;
  for (let i = 0; i <= rowIndex; i++) {
    if (types[i] === 'single' || types[i] === 'double-right') count++;
  }
  return count > 0 ? count - 1 : 0;
};

const getMarginPx = (val, unit) => {
  if (unit === 'cm') return val * 37.795275;
  if (unit === 'in') return val * 96;
  return val;
};

// ==========================================
// 2. Main Component
// ==========================================
const Sheet = forwardRef((props, ref) => {
  // --- Contexts ---
  const { 
    sheetData, selectedCell, setSelectedCell, layoutConfig, 
    headerDetails, songName, setSongName, updateDetail,      
    sectionLabels, updateSectionLabel, rowTypes,
    startSelection, updateSelection, endSelection, selectionRange,
    playbackCursor, isPlaying, symbols = [], addSymbol, removeSymbol,
    selectedSymbolId, setSelectedSymbolId, updateTextRow,
    removeRow, addTextRow, rowMargins, updateRowMarginsList,
    setToolbarMode, stopPlayback
  } = useContext(MusicContext);

  // --- States & Refs ---
  const [pageSvgPaths, setPageSvgPaths] = useState({});
  const [zoom, setZoom] = useState(100);
  const [editingSongName, setEditingSongName] = useState(false);
  const [editingDetailId, setEditingDetailId] = useState(null);
  const [editingDetailField, setEditingDetailField] = useState(null);
  const [editingLabelId, setEditingLabelId] = useState(null);

  const editLabelRef = useRef("");
  const initialSongNameRef = useRef("");
  const initialDetailLabelRef = useRef("");
  const initialDetailValueRef = useRef("");

  // --- Fonts Setup ---
  const defaultFontFamily = layoutConfig.fontFamily || "'TH Sarabun New', sans-serif";
  const noteFontFamily = layoutConfig.noteFontFamily || defaultFontFamily;
  const textFontFamily = layoutConfig.textFontFamily || defaultFontFamily;
  const pageFontFamily = layoutConfig.pageFontFamily || textFontFamily;

  // ==========================================
  // 3. Global Event Listeners (Watchdog)
  // ==========================================
  useEffect(() => {
    const handleMouseUpGlobal = () => {
      if (endSelection) endSelection();
    };
    
    const handleMouseDownGlobal = (e) => {
      const isToolbar = e.target.closest('.playback-controls-container');
      if (isToolbar) return; 
      
      if (editingSongName) {
         const songEditor = document.getElementById('song-name-editor');
         if (songEditor && !songEditor.contains(e.target)) {
            setSongName(songEditor.innerHTML); 
            setEditingSongName(false);
         }
      }
      
      if (editingDetailId) {
         const activeDetail = document.querySelector(`div[data-id="${editingDetailId}"]`);
         if (activeDetail && !activeDetail.contains(e.target)) {
            const field = activeDetail.getAttribute('data-field');
            updateDetail(editingDetailId, field, activeDetail.innerHTML); 
            setEditingDetailId(null);
            setEditingDetailField(null);
         }
      }
    };

    window.addEventListener('mouseup', handleMouseUpGlobal);
    // ⭐ ใส่ true เพื่อให้ทำงานแบบ Capture Phase (ดักจับก่อนโดน StopPropagation)
    window.addEventListener('mousedown', handleMouseDownGlobal, true); 
    return () => {
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('mousedown', handleMouseDownGlobal, true);
    };
  }, [endSelection, editingSongName, editingDetailId, setSongName, updateDetail]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.closest('[contenteditable="true"]')) return;
      if (e.key === 'Enter') {
        const [r, m, c] = selectedCell;
        if (m === 0 && c === 0) { e.preventDefault(); addTextRow(true); }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedCell, addTextRow]);

  useEffect(() => {
    const [r] = selectedCell;
    if (rowTypes[r] === 'text') {
      setToolbarMode('text'); 
      setTimeout(() => {
        const textEl = document.getElementById(`text-row-${r}`);
        if (textEl) {
          const sel = window.getSelection();
          if (!textEl.contains(sel.anchorNode)) {
            textEl.focus();
            if (document.createRange) {
              const range = document.createRange();
              range.selectNodeContents(textEl);
              range.collapse(false); 
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }
      }, 10); 
    } else {
      setToolbarMode('default'); 
    }
  }, [selectedCell[0], rowTypes, setToolbarMode]);

  useEffect(() => {
    if (selectedSymbolId) setToolbarMode('symbol');
  }, [selectedSymbolId, setToolbarMode]);

  // ==========================================
  // 4. Render Calculations (จัดหน้ากระดาษ)
  // ==========================================
  const displayRowNumbers = useMemo(() => {
    let currentNumber = 0;
    return rowTypes.map(type => {
      if (type === 'single' || type === 'double-right') {
        currentNumber++;
        return currentNumber;
      }
      return ''; 
    });
  }, [rowTypes]);

  const pages = useMemo(() => {
    const A4_HEIGHT_PX = 1122; 
    const mUnit = layoutConfig.marginUnit || 'px';
    const mTopPx = getMarginPx(layoutConfig.marginTop ?? 48, mUnit);
    const mBotPx = getMarginPx(layoutConfig.marginBottom ?? 48, mUnit);
    const PAGE_PADDING = mTopPx + mBotPx;
    const FOOTER_SPACE = 20;   
    
    const headerLines = layoutConfig.detailsAlign === 'between' ? Math.ceil(headerDetails.length / 2) : headerDetails.length;
    const headerHeight = 40 + (layoutConfig.songNameSize * 1.5) + (headerLines * 25);

    const calculatedPages = [];
    let currentRows = [];
    let currentUsedHeight = 0;
    let isFirstPage = true;

    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      const rType = rowTypes[i];
      const headerSpace = isFirstPage ? headerHeight : 0;
      const rMarginTop = rowMargins[i]?.top || 0;
      const rMarginBot = rowMargins[i]?.bottom || 0;
      
      if (rType === 'page-break') {
        if (currentRows.length > 0) {
          calculatedPages.push({ rows: currentRows, startIndex: i - currentRows.length });
          currentRows = []; currentUsedHeight = 0; isFirstPage = false;
        }
        currentRows.push(row);
        continue;
      }

      if (rType === 'text') {
        let textValue = (row && row[0] && typeof row[0][0] === 'string') ? row[0][0] : '';
        const breakCount = (textValue.match(/<br\s*\/?>/gi) || []).length;
        const divCount = (textValue.match(/<div/gi) || []).length;
        const pCount = (textValue.match(/<p/gi) || []).length;
        const totalLines = Math.max(1, 1 + breakCount + divCount + pCount);

        const textLineHeight = layoutConfig.textLineHeight || 1.5;
        const baseLineHeight = Math.max(20, (layoutConfig.textFontSize || 16) * textLineHeight);
        const textRowHeight = (baseLineHeight * totalLines) + rMarginTop + rMarginBot; 
        
        if ((currentUsedHeight + textRowHeight + headerSpace + PAGE_PADDING + FOOTER_SPACE > A4_HEIGHT_PX) && currentRows.length > 0) {
          calculatedPages.push({ rows: currentRows, startIndex: i - currentRows.length });
          currentRows = [row]; currentUsedHeight = textRowHeight; isFirstPage = false;
        } else {
          currentRows.push(row); currentUsedHeight += textRowHeight;
        }
        continue;
      }

      const isDoubleRight = rType === 'double-right';
      const isDoubleLeft = rType === 'double-left';
      const isDouble = isDoubleRight || isDoubleLeft;
      const colsPerLine = isDouble ? 9 : 8; 
      const visualLines = Math.ceil(row.length / colsPerLine); 
      
      const gridHeight = (layoutConfig.measureHeight * visualLines) + (layoutConfig.rowGap * (visualLines - 1));
      const pb = isDoubleRight ? 0 : layoutConfig.rowGap; 
      const actualRowHeight = gridHeight + pb + rMarginTop + rMarginBot;
      let combinedHeight = actualRowHeight;
      
      if (isDoubleRight && i + 1 < sheetData.length && rowTypes[i + 1] === 'double-left') {
         const nextRow = sheetData[i + 1];
         const nextVisualLines = Math.ceil(nextRow.length / 9);
         const nextGridHeight = (layoutConfig.measureHeight * nextVisualLines) + (layoutConfig.rowGap * (nextVisualLines - 1));
         const nextRMarginTop = rowMargins[i+1]?.top || 0;
         const nextRMarginBot = rowMargins[i+1]?.bottom || 0;
         combinedHeight += nextGridHeight + layoutConfig.rowGap + nextRMarginTop + nextRMarginBot;
      }

      if (rType !== 'double-left' && (currentUsedHeight + combinedHeight + headerSpace + PAGE_PADDING + FOOTER_SPACE > A4_HEIGHT_PX) && currentRows.length > 0) {
        calculatedPages.push({ rows: currentRows, startIndex: i - currentRows.length });
        currentRows = [row]; currentUsedHeight = actualRowHeight; isFirstPage = false;
      } else {
        currentRows.push(row); currentUsedHeight += actualRowHeight;
      }
    }

    if (currentRows.length > 0) {
      calculatedPages.push({ rows: currentRows, startIndex: sheetData.length - currentRows.length });
    }
    return calculatedPages;
  }, [sheetData, layoutConfig, headerDetails, rowTypes, sectionLabels, rowMargins]);

  // ==========================================
  // 5. Symbol & SVG Calculations
  // ==========================================
  const calculatePaths = useCallback(() => {
    const newPagePaths = {};
    const scale = zoom / 100;

    symbols.forEach(sym => {
      const isKro = sym.type === 'kro';

      if (isKro && sym.start[0] !== sym.end[0]) {
        const color = sym.color || '#3b82f6';
        const strokeW = sym.strokeWidth || 2.5;

        for (let r = sym.start[0]; r <= sym.end[0]; r++) {
          const pageIndex = pages.findIndex(p => r >= p.startIndex && r < p.startIndex + p.rows.length);
          if (pageIndex === -1) continue;

          const rowStartCell = (r === sym.start[0]) ? sym.start : [r, 0, 0];
          const rowEndCell = (r === sym.end[0]) ? sym.end : [r, sheetData[r].length - 1, sheetData[r][sheetData[r].length - 1].length - 1];

          const startEl = document.getElementById(`note-${rowStartCell[0]}-${rowStartCell[1]}-${rowStartCell[2]}`);
          const endEl = document.getElementById(`note-${rowEndCell[0]}-${rowEndCell[1]}-${rowEndCell[2]}`);

          if (startEl && endEl) {
            const pageEl = document.getElementById(`page-${pageIndex}`);
            const pRect = pageEl.getBoundingClientRect();
            const sRect = startEl.getBoundingClientRect();
            const eRect = endEl.getBoundingClientRect();

            const x1 = (sRect.left - pRect.left + (sRect.width / 2)) / scale;
            const y1 = (sRect.top - pRect.top) / scale + 30; 
            const x2 = (eRect.left - pRect.left + (eRect.width / 2)) / scale;
            const y2 = (eRect.top - pRect.top) / scale + 30;

            const d = `M ${x1} ${y1} L ${x2} ${y2}`;
            if (!newPagePaths[pageIndex]) newPagePaths[pageIndex] = [];
            newPagePaths[pageIndex].push({ id: `${sym.id}-${r}`, type: 'kro', d, color, strokeW });
          }
        }
      } else {
        const startEl = document.getElementById(`note-${sym.start[0]}-${sym.start[1]}-${sym.start[2]}`);
        const endEl = document.getElementById(`note-${sym.end[0]}-${sym.end[1]}-${sym.end[2]}`);

        if (startEl && endEl) {
          const pageIndex = pages.findIndex(p => sym.start[0] >= p.startIndex && sym.start[0] < p.startIndex + p.rows.length);
          if (pageIndex !== -1) {
            const pageEl = document.getElementById(`page-${pageIndex}`);
            const pRect = pageEl.getBoundingClientRect();
            const sRect = startEl.getBoundingClientRect();
            const eRect = endEl.getBoundingClientRect();

            const x1 = (sRect.left - pRect.left + (sRect.width / 2)) / scale;
            const y1 = (sRect.top - pRect.top) / scale + 4;
            const x2 = (eRect.left - pRect.left + (eRect.width / 2)) / scale;
            const y2 = (eRect.top - pRect.top) / scale + 4;
            
            let d = "";
            const color = sym.color || layoutConfig.symbolColor || '#1e293b';
            const strokeW = sym.strokeWidth || layoutConfig.symbolStrokeWidth || 2.5;

            if (isKro) {
                d = `M ${x1} ${y1 + 30} L ${x2} ${y2 + 30}`;
            } else {
                const baseHeight = sym.height ?? 20;
                const height = baseHeight + Math.abs(x2 - x1) * 0.15;
                d = `M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.25} ${y1 - height}, ${x2 - (x2 - x1) * 0.25} ${y2 - height}, ${x2} ${y2}`;
            }

            if (!newPagePaths[pageIndex]) newPagePaths[pageIndex] = [];
            newPagePaths[pageIndex].push({ id: sym.id, type: sym.type, d, color, strokeW });
          }
        }
      }
    });
    setPageSvgPaths(newPagePaths);
  }, [symbols, layoutConfig, pages, zoom, sheetData]); 

  useEffect(() => {
    if (playbackCursor !== null) return; 
    const timerId = setTimeout(() => { calculatePaths(); }, 150); 
    return () => clearTimeout(timerId); 
  }, [calculatePaths, sheetData, rowTypes, headerDetails, zoom, playbackCursor]); 

  useEffect(() => {
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(calculatePaths, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [calculatePaths]);

  useEffect(() => {
    const handleBeforePrint = () => {
      const container = document.getElementById('sheet-scroll-container');
      if (container) { container.style.display = 'block'; container.style.width = '100%'; calculatePaths(); }
    };
    const handleAfterPrint = () => {
      const container = document.getElementById('sheet-scroll-container');
      if (container) { container.style.display = ''; container.style.width = ''; calculatePaths(); }
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [calculatePaths]);

  // ==========================================
  // 6. UI Interaction Handlers
  // ==========================================
  const handleRightClick = (e, rIndex, mIndex, cIndex) => {
    e.preventDefault(); 
    const existingSymbol = symbols.find(s => 
      (s.start[0] === rIndex && s.start[1] === mIndex && s.start[2] === cIndex) ||
      (s.end[0] === rIndex && s.end[1] === mIndex && s.end[2] === cIndex)
    );

    if (existingSymbol) {
      if (removeSymbol) removeSymbol(existingSymbol.id);
    } 
    else if (selectedCell && (selectedCell[0] !== rIndex || selectedCell[1] !== mIndex || selectedCell[2] !== cIndex)) {
      if (addSymbol) {
         const symType = layoutConfig.activeSymbol || 'sabat'; 
         addSymbol(symType, selectedCell, [rIndex, mIndex, cIndex], {
             color: symType === 'kro' ? '#3b82f6' : (layoutConfig.symbolColor || '#1e293b'),
             strokeWidth: layoutConfig.symbolStrokeWidth || 2.5,
             height: layoutConfig.symbolHeight !== undefined ? layoutConfig.symbolHeight : 20
         });
      }
    }
  };
  
  const renderSheetNote = (note, rIndex, mIndex, cIndex) => {
    if (note === '-') return <span>-</span>;
    const customStyle = layoutConfig.customStyles?.[`${rIndex}_${mIndex}_${cIndex}`] || {};
    const isBold = customStyle.isBold !== undefined ? customStyle.isBold : layoutConfig.isBold;
    const isItalic = customStyle.isItalic !== undefined ? customStyle.isItalic : layoutConfig.isItalic;
    const cellFontFamily = customStyle.noteFontFamily || noteFontFamily;

    return (
      <span 
        className={`leading-none inline-block ${isBold ? 'font-bold' : 'font-normal'} ${isItalic ? 'italic' : ''}`} 
        style={{ fontFamily: cellFontFamily, paddingTop: '0.1em', paddingBottom: '0.1em' }}
      >
        {note}
      </span>
    );
  };

  const renderSectionLabels = (visualIndex, rowType) => {
    const labels = sectionLabels[visualIndex];
    if (!labels || labels.length === 0) return null;
    
    return labels.map((label) => {
      if (!label.text && editingLabelId !== label.id) return null;
      if (rowType === 'double-right' && label.position.includes('bottom')) return null;
      if (rowType === 'double-left' && label.position.includes('top')) return null;

      let positionStyle = { 
        position: 'absolute', fontSize: `${label.fontSize}px`, color: '#0f172a', 
        whiteSpace: 'nowrap', zIndex: 20, lineHeight: 1, fontFamily: noteFontFamily 
      };
      const labelOffset = label.offsetY !== undefined ? label.offsetY : 6;
      
      if (label.position.includes('top')) { 
        positionStyle.bottom = '100%'; positionStyle.marginBottom = `${labelOffset}px`; 
      } else { 
        positionStyle.top = '100%'; positionStyle.marginTop = `${labelOffset}px`; 
      }
      
      if (label.position.includes('left')) positionStyle.left = '0'; 
      else if (label.position.includes('center')) { positionStyle.left = '50%'; positionStyle.transform = 'translateX(-50%)'; } 
      else if (label.position.includes('right')) positionStyle.right = '0'; 
      
      const isEditing = editingLabelId === label.id;

      return (
        <div key={label.id} style={positionStyle} className="tracking-wide">
          {isEditing ? (
            <div
              contentEditable
              suppressContentEditableWarning
              autoFocus
              onMouseDown={(e) => e.stopPropagation()} 
              onFocus={(e) => {
                editLabelRef.current = e.target.innerHTML;
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(e.target);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }}
              onInput={(e) => { editLabelRef.current = e.target.innerHTML; }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold', false, null); editLabelRef.current = e.target.innerHTML; }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic', false, null); editLabelRef.current = e.target.innerHTML; }
              }}
              dangerouslySetInnerHTML={{ __html: label.text }}
              className="outline-none border-b border-sky-400 bg-white/80 px-1 min-w-[40px] rounded shadow-sm"
              style={{ fontSize: 'inherit', fontFamily: 'inherit' }}
            />
          ) : (
            <div
              onDoubleClick={(e) => { 
                e.stopPropagation(); 
                if (setToolbarMode) setToolbarMode('text');
                setEditingLabelId(label.id); 
              }}
              onMouseDown={(e) => e.stopPropagation()}
              dangerouslySetInnerHTML={{ __html: label.text || 'ป้ายกำกับ' }}
              className="cursor-text hover:bg-slate-100/50 rounded px-1 transition-colors print:hover:bg-transparent min-w-[20px]"
              title="ดับเบิลคลิกเพื่อแก้ไขป้ายกำกับ"
            />
          )}
        </div>
      );
    });
  };

  const selectionLimits = useMemo(() => {
    if (!selectionRange || !selectionRange.start || !selectionRange.end) return { min: -1, max: -1 };
    return {
      min: Math.min(selectionRange.start[0], selectionRange.end[0]),
      max: Math.max(selectionRange.start[0], selectionRange.end[0])
    };
  }, [selectionRange]);

  // ==========================================
  // 7. Main Rendering
  // ==========================================
  return (
    <div 
      className="relative w-full h-full flex flex-col flex-1 min-h-0 bg-slate-50/50"
      onMouseDown={() => {
        if (setToolbarMode) setToolbarMode('default');
        if (setSelectedSymbolId) setSelectedSymbolId(null);
      }}
    >
      <style>
        {`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            html, body, #root {
              width: 100% !important; height: auto !important; margin: 0 !important;
              padding: 0 !important; background: white !important; overflow: visible !important;
            }
            * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
            #sheet-scroll-container {
              display: block !important; width: 100% !important; max-width: 100% !important;
              padding: 0 !important; margin: 0 !important; overflow: visible !important; transform: none !important;
            }
            .print-page { 
              display: block !important; width: 100% !important; min-width: 100% !important; max-width: 100% !important;
              height: 297mm !important; min-height: 297mm !important; max-height: 297mm !important;
              margin: 0 auto !important; box-shadow: none !important;
              border: none !important; page-break-inside: avoid !important; page-break-after: always !important; 
              break-after: page !important; zoom: 1 !important; 
            }
            .print-page:last-child { page-break-after: auto !important; break-after: auto !important; }
            .print-hidden { display: none !important; }
          }
          .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 10px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid #f8fafc; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}
      </style>

      {/* Zoom Controls */}
      <div className={`absolute bottom-8 right-8 z-[60] flex flex-col items-center backdrop-blur-md border border-slate-200 shadow-xl rounded-xl overflow-hidden print:hidden transition-all duration-300 group ${isPlaying ? 'bg-slate-50/90' : 'bg-white/90 hover:shadow-2xl'}`}>
        <button
          onClick={() => !isPlaying && setZoom(z => Math.min(200, z + 10))}
          className={`p-2.5 w-full flex justify-center transition-colors ${isPlaying ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-sky-600 hover:bg-sky-50 active:bg-sky-100'}`}
          title={isPlaying ? "ล็อคการซูมชั่วคราวขณะเล่นเพลง" : "ขยาย (Zoom In)"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
        </button>
        <div
          onClick={() => !isPlaying && setZoom(100)}
          className={`px-2 py-1.5 text-[11px] font-black w-full text-center border-y border-slate-100 transition-colors select-none ${isPlaying ? 'text-slate-300 bg-slate-50 cursor-not-allowed' : 'text-sky-700 bg-slate-50/80 cursor-pointer hover:bg-slate-100'}`}
          title={isPlaying ? "ล็อคการซูมชั่วคราวขณะเล่นเพลง" : "คืนค่าเดิม (Reset Zoom)"}
        >
          {zoom}%
        </div>
        <button
          onClick={() => !isPlaying && setZoom(z => Math.max(30, z - 10))}
          className={`p-2.5 w-full flex justify-center transition-colors ${isPlaying ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-sky-600 hover:bg-sky-50 active:bg-sky-100'}`}
          title={isPlaying ? "ล็อคการซูมชั่วคราวขณะเล่นเพลง" : "ย่อ (Zoom Out)"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/></svg>
        </button>
      </div>

      {/* Main Sheet Container */}
      <div 
        ref={ref}
        id="sheet-scroll-container"
        className="flex overflow-x-auto pb-10 pt-6 w-full max-w-full custom-scrollbar select-none print:block print:overflow-visible print:p-0 relative"
        style={{ paddingLeft: `max(1rem, calc(50% - ${105 * (zoom / 100)}mm))`, paddingRight: `max(1rem, calc(50% - ${105 * (zoom / 100)}mm))` }}
      >
        <div className="flex gap-12 snap-x h-max print:block" style={{ zoom: `${zoom}%` }}>
          {pages.map((page, pIndex) => (
            <div 
              key={pIndex} 
              id={`page-${pIndex}`} 
              className="print-page relative bg-white w-[210mm] min-w-[210mm] h-[297mm] min-h-[297mm] shadow-xl border border-slate-200 flex flex-col text-slate-800 shrink-0 snap-center print:shadow-none print:border-none print:m-0 transition-shadow hover:shadow-2xl" 
              style={{ 
                fontFamily: pageFontFamily, 
                boxSizing: 'border-box',
                paddingTop: `${getMarginPx(layoutConfig.marginTop ?? 48, layoutConfig.marginUnit || 'px')}px`,
                paddingBottom: `${getMarginPx(layoutConfig.marginBottom ?? 48, layoutConfig.marginUnit || 'px')}px`,
                paddingLeft: `${getMarginPx(layoutConfig.marginLeft ?? 48, layoutConfig.marginUnit || 'px')}px`,
                paddingRight: `${getMarginPx(layoutConfig.marginRight ?? 48, layoutConfig.marginUnit || 'px')}px`,
              }}
            >
              
              {/* SVG Layer for Symbols */}
              <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-30 print:z-30 print:w-full print:max-w-full">
                {(pageSvgPaths[pIndex] || []).map(p => {
                  const isSelected = p.id === selectedSymbolId;
                  const isKro = p.type === 'kro';
                  return (
                    <g key={p.id}>
                      <path 
                        d={p.d} fill="none" stroke="transparent" strokeWidth="20" 
                        className={`pointer-events-auto cursor-pointer ${isKro ? 'print:hidden' : 'print:pointer-events-none'}`}
                        onMouseDown={(e) => { e.stopPropagation(); if (setSelectedSymbolId) setSelectedSymbolId(p.id); }}
                      />
                      {isSelected && <path d={p.d} fill="none" stroke="#f59e0b" strokeWidth={p.strokeW + 4} strokeLinecap="round" opacity="0.4" className="pointer-events-none print:hidden" />}
                      <path 
                        d={p.d} fill="none" stroke={isSelected ? '#d97706' : (isKro ? '#3b82f6' : p.color)} 
                        strokeWidth={p.strokeW} strokeLinecap="round" strokeDasharray={isKro ? "6, 4" : "none"} 
                        className={`pointer-events-none drop-shadow-sm transition-all duration-200 ${isKro ? 'print:hidden' : ''}`} 
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Page Header (Only on first page) */}
              {pIndex === 0 && (
                <div className="text-center border-b-2 border-slate-900 pb-4 mb-6 shrink-0 relative z-10 print:border-b-2 print:border-slate-900">
                  
                  {/* Song Name Editor */}
                  {editingSongName ? (
                     <div
                        id="song-name-editor"
                        contentEditable
                        suppressContentEditableWarning
                        autoFocus
                        onMouseDown={(e) => e.stopPropagation()}
                        onFocus={(e) => {
                          const range = document.createRange();
                          const sel = window.getSelection();
                          range.selectNodeContents(e.target);
                          range.collapse(false);
                          sel.removeAllRanges();
                          sel.addRange(range);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); setSongName(e.target.innerHTML); setEditingSongName(false); }
                          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold', false, null); }
                          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic', false, null); }
                        }}
                        onInput={(e) => {
                          // ⭐ แก้ไขจุดที่บั๊ก! ให้บันทึกค่าลงตัวแปรชื่อเพลง แทนชื่อหัวข้อ
                          initialSongNameRef.current = e.target.innerHTML;
                        }}
                        dangerouslySetInnerHTML={{ __html: initialSongNameRef.current }}
                        className="font-bold mb-4 uppercase tracking-tight text-center bg-white/90 border-b-2 border-sky-400 outline-none w-full px-2 min-h-[1.5em] shadow-sm rounded"
                        style={{ fontSize: `${layoutConfig.songNameSize}px`, fontFamily: pageFontFamily }}
                     />
                  ) : (
                    <h1 
                      className="font-bold mb-4 uppercase tracking-tight cursor-text hover:bg-slate-100/50 rounded transition-colors print:hover:bg-transparent min-h-[1.5em]" 
                      style={{ fontSize: `${layoutConfig.songNameSize}px`, fontFamily: pageFontFamily }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (setToolbarMode) setToolbarMode('text');
                        initialSongNameRef.current = songName || ''; 
                        setEditingSongName(true);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      dangerouslySetInnerHTML={{ __html: songName || 'ชื่อเพลง' }}
                      title="ดับเบิลคลิกเพื่อแก้ไขชื่อเพลง (คลุมดำแล้วเปลี่ยนฟอนต์/ขนาดเฉพาะคำได้)"
                    />
                  )}

                  {/* Header Details */}
                  <div className={`grid gap-x-12 gap-y-1 px-4 ${layoutConfig.detailsAlign === 'between' ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ fontSize: `${layoutConfig.authorSize}px`, textAlign: layoutConfig.detailsAlign === 'between' ? 'left' : layoutConfig.detailsAlign, fontFamily: textFontFamily }}>
                    {headerDetails.map((detail, index) => (
                      <div key={detail.id} className={layoutConfig.detailsAlign === 'between' && index % 2 !== 0 ? "text-right" : ""}>
                        
                        {/* Detail Label */}
                        {editingDetailId === detail.id && editingDetailField === 'label' ? (
                          <div
                            id="detail-editor"
                            data-id={detail.id}
                            data-field="label"
                            contentEditable
                            suppressContentEditableWarning
                            autoFocus
                            onMouseDown={(e) => e.stopPropagation()}
                            onFocus={(e) => {
                              const range = document.createRange();
                              const sel = window.getSelection();
                              range.selectNodeContents(e.target);
                              range.collapse(false);
                              sel.removeAllRanges();
                              sel.addRange(range);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); updateDetail(detail.id, 'label', e.target.innerHTML); setEditingDetailId(null); setEditingDetailField(null); }
                              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold', false, null); }
                              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic', false, null); }
                            }}
                            onInput={(e) => { initialDetailLabelRef.current = e.target.innerHTML; }}
                            dangerouslySetInnerHTML={{ __html: initialDetailLabelRef.current }}
                            className="inline-block font-bold bg-white/90 border-b border-sky-400 outline-none min-w-[50px] px-1 rounded shadow-sm"
                          />
                        ) : (
                          <>
                            <span 
                              className="font-bold cursor-text hover:bg-slate-100/50 rounded px-1 transition-colors print:hover:bg-transparent"
                              onDoubleClick={(e) => { 
                                e.stopPropagation(); 
                                if (setToolbarMode) setToolbarMode('text'); 
                                initialDetailLabelRef.current = detail.label || ''; 
                                setEditingDetailId(detail.id); 
                                setEditingDetailField('label'); 
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              dangerouslySetInnerHTML={{ __html: detail.label }}
                              title="ดับเบิลคลิกเพื่อแก้ไขหัวข้อ"
                            />
                            <span className="font-bold">:</span>
                          </>
                        )}
                        
                        {' '}

                        {/* Detail Value */}
                        {editingDetailId === detail.id && editingDetailField === 'value' ? (
                          <div
                            id="detail-editor"
                            data-id={detail.id}
                            data-field="value"
                            contentEditable
                            suppressContentEditableWarning
                            autoFocus
                            onMouseDown={(e) => e.stopPropagation()}
                            onFocus={(e) => {
                              const range = document.createRange();
                              const sel = window.getSelection();
                              range.selectNodeContents(e.target);
                              range.collapse(false);
                              sel.removeAllRanges();
                              sel.addRange(range);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); updateDetail(detail.id, 'value', e.target.innerHTML); setEditingDetailId(null); setEditingDetailField(null); }
                              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold', false, null); }
                              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic', false, null); }
                            }}
                            onInput={(e) => { initialDetailValueRef.current = e.target.innerHTML; }}
                            dangerouslySetInnerHTML={{ __html: initialDetailValueRef.current }}
                            className="inline-block bg-white/90 border-b border-sky-400 outline-none min-w-[100px] px-1 rounded shadow-sm"
                          />
                        ) : (
                          <span 
                            className="cursor-text hover:bg-slate-100/50 rounded px-1 transition-colors print:hover:bg-transparent"
                            onDoubleClick={(e) => { 
                              e.stopPropagation(); 
                              if (setToolbarMode) setToolbarMode('text'); 
                              initialDetailValueRef.current = detail.value || ''; 
                              setEditingDetailId(detail.id); 
                              setEditingDetailField('value'); 
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            dangerouslySetInnerHTML={{ __html: detail.value || '...' }}
                            title="ดับเบิลคลิกเพื่อแก้ไขข้อมูล"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rows Rendering */}
              <div className="flex flex-col w-full pb-12 print:pb-[15mm] h-full relative">
                {page.rows.map((row, localIndex) => {
                  const rIndex = page.startIndex + localIndex;
                  const rType = rowTypes[rIndex];
                  const isCursor = selectedCell[0] === rIndex;
                  
                  const rMarginTop = rowMargins[rIndex]?.top || 0;
                  const rMarginBot = rowMargins[rIndex]?.bottom || 0;
                  const rIndent = rowMargins[rIndex]?.left || 0;

                  if (rType === 'page-break') {
                     return (
                       <div key={rIndex} className="w-full flex flex-col items-center justify-center my-1">
                         <div
                           onMouseDown={(e) => {
                              e.stopPropagation(); 
                              if(setSelectedSymbolId) setSelectedSymbolId(null);
                              setSelectedCell([rIndex, 0, 0]);
                              if (setToolbarMode) setToolbarMode('default');
                           }}
                           className={`flex items-center w-full py-2 cursor-pointer print-hidden select-none transition-all ${isCursor ? 'bg-indigo-50 ring-2 ring-indigo-400 rounded-md' : 'hover:bg-slate-50'}`}
                         >
                            <div className="w-full border-t-2 border-dashed border-slate-300"></div>
                         </div>
                       </div>
                     );
                  }

                  if (rType === 'text') {
                    let textValue = (row && row[0] && typeof row[0][0] === 'string') ? row[0][0] : '';
                    return (
                      <div 
                        key={rIndex} 
                        className="w-full flex items-center my-1 relative group print:my-1"
                        style={{ 
                          marginTop: `${rMarginTop}px`, marginBottom: `${rMarginBot}px`, 
                          paddingLeft: `calc(1rem + ${rIndent}px)`, paddingRight: '1rem',
                          zIndex: (rMarginTop < 0 || rMarginBot < 0) ? 20 : 10 
                        }}
                      >
                        <div
  id={`text-row-${rIndex}`} 
  contentEditable
  suppressContentEditableWarning
  onMouseDown={(e) => e.stopPropagation()}
  onMouseUp={(e) => {
    e.stopPropagation();
    if (selectedCell[0] !== rIndex) setSelectedCell([rIndex, 0, 0]); 
    if (setSelectedSymbolId) setSelectedSymbolId(null);
    if (setToolbarMode) setToolbarMode('text');
  }}
  onClick={(e) => e.stopPropagation()}
  // 1. เซฟค่าชั่วคราวตอนพิมพ์ (ป้องกันเคอร์เซอร์เด้ง)
                          // เซฟแบบเงียบๆ ป้องกันเคอร์เซอร์เด้ง
                          onInput={(e) => {
                            if (sheetData[rIndex] && sheetData[rIndex][0]) {
                              sheetData[rIndex][0][0] = e.target.innerHTML;
                            }
                          }}
                          // ❌ ลบ onKeyUp ทิ้งไปแล้ว ❌

                          // เซฟจริงจังเข้าหน้าจอเมื่อคลิกออก
                          onBlur={(e) => {
                            const isToolbar = e.relatedTarget && e.relatedTarget.closest('.playback-controls-container');
                            if (isToolbar) return; 
                            if (updateTextRow) updateTextRow(rIndex, e.target.innerHTML);
                          }}
                          onKeyDown={(e) => {
                            if (isPlaying) stopPlayback();

                            // ⭐ ระบบ Enter อัจฉริยะ (ทับของเดิมเลยครับ)
                            if (e.key === 'Enter') {
                              const pageEl = e.target.closest('.print-page');
                              if (pageEl) {
                                 const pageRect = pageEl.getBoundingClientRect();
                                 const divRect = e.target.getBoundingClientRect();
                                 // เรดาร์กะระยะขอบล่าง (เว้นที่ไว้ 120px)
                                 const threshold = 120 * (zoom / 100); 
                                 
                                 // 🚨 ถ้ากล่องข้อความยาวจนชิดขอบล่างกระดาษแล้ว
                                 if (divRect.bottom > pageRect.bottom - threshold) {
                                    e.preventDefault();
                                    e.target.blur(); // เซฟเนื้อหาแผ่นนี้
                                    if (addTextRow) addTextRow(false); // ขึ้นกล่องใหม่/หน้าใหม่ให้ทันที!
                                    return;
                                 }
                              }
                              
                              // ✅ ถ้ากระดาษยังเหลือ: สับบรรทัด ณ "จุดที่เคอร์เซอร์อยู่" พอดีเป๊ะ
                              e.preventDefault();
                              document.execCommand('insertLineBreak');
                              
                              // บันทึกเงียบๆ ไม่ให้ React รีเฟรชจนเคอร์เซอร์เด้งหนี
                              if (sheetData[rIndex] && sheetData[rIndex][0]) {
                                sheetData[rIndex][0][0] = e.target.innerHTML;
                              }
                              return;
                            }

                            if (e.key === 'Tab') {
                              e.preventDefault(); document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
                              return;
                            }
                            
                            if (e.key === 'Backspace') {
                              let isAtStart = false;
                              const sel = window.getSelection();
                              if (sel.rangeCount > 0) {
                                 const range = sel.getRangeAt(0);
                                 const preCaretRange = range.cloneRange();
                                 preCaretRange.selectNodeContents(e.target);
                                 preCaretRange.setEnd(range.startContainer, range.startOffset);
                                 
                                 const tempDiv = document.createElement('div');
                                 tempDiv.appendChild(preCaretRange.cloneContents());
                                 if (tempDiv.textContent.length === 0 && !tempDiv.innerHTML.includes('<br>')) isAtStart = true;
                              }

                              if (isAtStart) {
                                  e.preventDefault(); 
                                  const htmlContent = e.target.innerHTML;
                                  const isEmpty = e.target.textContent.trim() === '' && !htmlContent.includes('<img');
                                  
                                  if (isEmpty || htmlContent === '<br>') {
                                      if (removeRow) removeRow();
                                  } else if (rIndex > 0 && rowTypes[rIndex - 1] === 'text') {
                                      const prevText = sheetData[rIndex - 1][0][0];
                                      sheetData[rIndex - 1][0][0] = prevText + htmlContent; 
                                      if (removeRow) removeRow(); 
                                      
                                      setTimeout(() => {
                                          setSelectedCell([rIndex - 1, 0, 0]);
                                          const prevEl = document.getElementById(`text-row-${rIndex - 1}`);
                                          if (prevEl) {
                                              prevEl.focus();
                                              const newSel = window.getSelection();
                                              const newRange = document.createRange();
                                              newRange.selectNodeContents(prevEl);
                                              newRange.collapse(false); 
                                              newSel.removeAllRanges();
                                              newSel.addRange(newRange);
                                          }
                                      }, 50);
                                  }
                                  return;
                              }
                            } else if (e.key === 'Delete') {
                              if (e.target.textContent.trim() === '' || e.target.innerHTML === '<br>') {
                                 e.preventDefault(); if (removeRow) removeRow();
                              }
                            }
                          }}
                          dangerouslySetInnerHTML={{ __html: textValue }}
                          className="w-full outline-none text-slate-800 cursor-text bg-transparent min-h-[24px]"
                          style={{ fontSize: `${layoutConfig.textFontSize || 16}px`, fontFamily: textFontFamily, lineHeight: layoutConfig.textLineHeight || 1.5 }}
                        />
                      </div>
                    );
                  }

                  const isDoubleRight = rType === 'double-right';
                  const isDoubleLeft = rType === 'double-left';
                  const isDouble = isDoubleRight || isDoubleLeft;
                  const pb = isDoubleRight ? 0 : layoutConfig.rowGap;

                  let visualRowNumber = displayRowNumbers[rIndex];
                  if (isDoubleLeft && rIndex > 0) visualRowNumber = displayRowNumbers[rIndex - 1]; 
                  const visualIndex = visualRowNumber !== '' && visualRowNumber != null ? visualRowNumber - 1 : null;                  
                  
                  return (
                    <div 
                      key={rIndex} 
                      className="flex flex-col w-full relative transition-colors" 
                      style={{ 
                        paddingBottom: `${pb}px`, marginTop: `${rMarginTop}px`, marginBottom: `${rMarginBot}px`,
                        paddingLeft: `calc(1rem + ${rIndent}px)`, paddingRight: '1rem',
                        zIndex: (rMarginTop < 0 || rMarginBot < 0) ? 20 : 1 
                      }}
                    >     
                      <div className="relative w-full">
                        
                        {(displayRowNumbers[rIndex] !== '' && layoutConfig?.showRowNumber !== false) && (
                          <div 
                            className={`absolute -left-8 -translate-y-1/2 text-[12px] font-bold print-hidden select-none ${isDoubleRight ? 'top-full' : 'top-1/2'}`} 
                            style={{ fontFamily: textFontFamily, color: layoutConfig?.rowNumberColor || '#cbd5e1' }}
                          >
                            {displayRowNumbers[rIndex]}
                          </div>
                        )}

                        {(isDoubleRight && layoutConfig?.showRowNumber !== false) && (
                          <div 
                            className="absolute top-0 border-l border-t border-b print:border-slate-400"
                            style={{
                              left: '-10px', width: '6px', height: `${layoutConfig.measureHeight * 2}px`,
                              borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', zIndex: 10,
                              borderColor: layoutConfig?.rowNumberColor || '#cbd5e1',
                              borderWidth: `${layoutConfig?.rowNumberWidth ?? 3}px 0 ${layoutConfig?.rowNumberWidth ?? 3}px ${layoutConfig?.rowNumberWidth ?? 3}px`
                            }}
                          />
                        )}

                        {visualIndex !== null && renderSectionLabels(visualIndex, rType)}

                        <div 
                          className="grid w-full" 
                          style={{ 
                            rowGap: `${layoutConfig.rowGap}px`,
                            gridTemplateColumns: isDouble ? '65px repeat(8, minmax(0, 1fr))' : 'repeat(8, minmax(0, 1fr))'
                          }}
                        >
                          {row.map((measure, mIndex) => {
                            const isLabelMeasure = isDouble && mIndex === 0;
                            const colsPerLine = isDouble ? 9 : 8;
                            const isFirstInLine = mIndex % colsPerLine === 0;
                            const isLastInLine = mIndex % colsPerLine === colsPerLine - 1 || mIndex === row.length - 1;

                            return (
                              <div 
                                key={mIndex} 
                                className="grid bg-white relative h-full w-full" 
                                style={{ 
                                  gridTemplateColumns: isLabelMeasure ? '1fr' : `repeat(${measure.length}, minmax(0, 1fr))`,
                                  height: `${layoutConfig.measureHeight}px`,
                                  borderTop: `${layoutConfig.outerBorderWidth ?? 1}px solid ${layoutConfig.borderColor || '#0f172a'}`,
                                  borderBottom: isDoubleRight ? 'none' : `${layoutConfig.outerBorderWidth ?? 1}px solid ${layoutConfig.borderColor || '#0f172a'}`,
                                  borderRight: `${layoutConfig.outerBorderWidth ?? 1}px solid ${layoutConfig.borderColor || '#0f172a'}`,
                                  borderLeft: isFirstInLine ? `${layoutConfig.outerBorderWidth ?? 1}px solid ${layoutConfig.borderColor || '#0f172a'}` : 'none',
                                  borderTopLeftRadius: (isFirstInLine && !isDoubleLeft) ? `${layoutConfig.borderRadius}px` : 0,
                                  borderBottomLeftRadius: (isFirstInLine && !isDoubleRight) ? `${layoutConfig.borderRadius}px` : 0,
                                  borderTopRightRadius: (isLastInLine && !isDoubleLeft) ? `${layoutConfig.borderRadius}px` : 0,
                                  borderBottomRightRadius: (isLastInLine && !isDoubleRight) ? `${layoutConfig.borderRadius}px` : 0,
                                  backgroundColor: isLabelMeasure ? '#f8fafc' : 'white',
                                }}
                              >
                                {isLabelMeasure ? (
                                  <div className="flex items-center justify-center w-full h-full text-[13px] font-bold text-slate-700 tracking-wide select-none" style={{ fontFamily: noteFontFamily }}>
                                    {measure[0]}
                                  </div>
                                ) : (
                                  measure.map((note, cIndex) => {
                                    let isInRange = false;
                                    let minR = -1, maxR = -1, minCol = -1, maxCol = -1;
                                    if (selectionRange && selectionRange.start && selectionRange.end) {
                                      minR = Math.min(selectionRange.start[0], selectionRange.end[0]); maxR = Math.max(selectionRange.start[0], selectionRange.end[0]);
                                      const startColVal = getFlattenedCol(sheetData[selectionRange.start[0]] || [], rowTypes[selectionRange.start[0]], selectionRange.start[1], selectionRange.start[2]);
                                      const endColVal = getFlattenedCol(sheetData[selectionRange.end[0]] || [], rowTypes[selectionRange.end[0]], selectionRange.end[1], selectionRange.end[2]);
                                      minCol = Math.min(startColVal, endColVal); maxCol = Math.max(startColVal, endColVal);
                                    }

                                    if (selectionRange && rIndex >= minR && rIndex <= maxR) {
                                        const currentCol = getFlattenedCol(row, rType, mIndex, cIndex);
                                        if (currentCol >= minCol && currentCol <= maxCol) isInRange = true;
                                    }

                                    const isCursorExact = selectedCell[0] === rIndex && selectedCell[1] === mIndex && selectedCell[2] === cIndex;
                                    let isPlayingNow = false;
                                    if (playbackCursor) {
                                      if (playbackCursor[0] === rIndex && playbackCursor[1] === mIndex && playbackCursor[2] === cIndex) isPlayingNow = true;
                                      if (rowTypes[playbackCursor[0]] === 'double-right' && rIndex === playbackCursor[0] + 1 && playbackCursor[1] === mIndex && playbackCursor[2] === cIndex) isPlayingNow = true;
                                    }
                                    
                                    let cellBgClass = 'hover:bg-sky-50 print:bg-transparent';
                                    if (isPlayingNow) cellBgClass = 'bg-emerald-200 ring-2 ring-inset ring-emerald-500 z-20 print:bg-transparent print:ring-0 transform scale-[1.02] transition-transform';
                                    else if (isInRange) cellBgClass = 'bg-sky-200 print:bg-transparent';
                                    else if (isCursorExact) cellBgClass = 'bg-yellow-100 ring-2 ring-inset ring-blue-400 z-10 print:bg-transparent print:ring-0';
                                    if (isCursorExact && isInRange && !isPlayingNow) cellBgClass = 'bg-sky-300 ring-2 ring-inset ring-blue-500 z-10 print:bg-transparent print:ring-0';

                                    const cellCustomStyle = layoutConfig.customStyles?.[`${rIndex}_${mIndex}_${cIndex}`] || {};
                                    const cellFontSize = cellCustomStyle.fontSize || layoutConfig.fontSize || 30;

                                    return (
                                      <div 
                                        id={`note-${rIndex}-${mIndex}-${cIndex}`}
                                        key={cIndex} 
                                        onMouseDown={(e) => {
                                          e.stopPropagation(); 
                                          if (setSelectedSymbolId) setSelectedSymbolId(null);
                                          if (e.button !== 2) startSelection(rIndex, mIndex, cIndex);
                                          if (setToolbarMode) setToolbarMode('default');
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseEnter={() => updateSelection(rIndex, mIndex, cIndex)}
                                        onContextMenu={(e) => handleRightClick(e, rIndex, mIndex, cIndex)}
                                        className={`flex items-center justify-center cursor-crosshair transition-all ${cellBgClass}`} 
                                        style={{ 
                                          fontSize: `${cellFontSize}px`, fontFamily: cellCustomStyle.noteFontFamily || noteFontFamily,
                                          borderRight: (cIndex < measure.length - 1 && layoutConfig.innerBorderWidth > 0) ? `${layoutConfig.innerBorderWidth}px solid ${layoutConfig.borderColor}66` : 'none' 
                                        }}
                                      >
                                        {renderSheetNote(note, rIndex, mIndex, cIndex)}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="absolute bottom-[20px] left-0 right-0 border-t border-slate-200 text-center text-slate-400 text-[12px] print:text-slate-500 z-20 bg-transparent pt-2 mx-12" style={{ fontFamily: textFontFamily }}>
                <p>Thai Music Editor - หน้า {pIndex + 1} / {pages.length}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default Sheet;