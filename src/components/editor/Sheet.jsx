import React, { useContext, forwardRef, useMemo, useEffect, useState, useCallback } from 'react';
import { MusicContext } from '../../contexts/MusicContext';

const getFlattenedCol = (row, rType, targetM, targetC) => {
  if (!row) return 0;
  let col = 0;
  for (let m = 0; m < row.length; m++) {
    if (rType && rType.startsWith('double') && m === 0) continue;
    if (m === targetM) return col + targetC;
    col += row[m].length;
  }
  return col;
};

const Sheet = forwardRef((props, ref) => {
  const { 
    sheetData, 
    selectedCell, 
    setSelectedCell, 
    layoutConfig, 
    headerDetails, 
    songName, 
    sectionLabels,
    rowTypes,
    startSelection, updateSelection, endSelection, selectionRange,
    playbackCursor,
    isPlaying, // ⭐ ดึงสถานะการเล่นเพลงมาเพื่อเอาไว้ล็อคปุ่ม
    symbols = [], addSymbol, removeSymbol,
    selectedSymbolId, setSelectedSymbolId 
  } = useContext(MusicContext);

  const [pageSvgPaths, setPageSvgPaths] = useState({});
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const handleMouseUpGlobal = () => {
      if (endSelection) endSelection();
    };
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, [endSelection]);

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
    const PAGE_PADDING = 64;   
    const FOOTER_SPACE = 50;   
    const headerHeight = 40 + (layoutConfig.songNameSize * 1.5) + (headerDetails.length * 25);

    const calculatedPages = [];
    let currentRows = [];
    let currentUsedHeight = 0;
    let isFirstPage = true;

    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      const rType = rowTypes[i];
      const headerSpace = isFirstPage ? headerHeight : 0;
      
      if (rType === 'page-break') {
        if (currentRows.length > 0) {
          calculatedPages.push({ rows: currentRows, startIndex: i - currentRows.length });
          currentRows = [];
          currentUsedHeight = 0;
          isFirstPage = false;
        }
        currentRows.push(row);
        continue;
      }

      const isDoubleRight = rType === 'double-right';
      const isDoubleLeft = rType === 'double-left';
      const isDouble = isDoubleRight || isDoubleLeft;
      
      const colsPerLine = isDouble ? 9 : 8; 
      const visualLines = Math.ceil(row.length / colsPerLine); 
      
      const gridHeight = (layoutConfig.measureHeight * visualLines) + (layoutConfig.rowGap * (visualLines - 1));
      const pb = isDoubleRight ? 0 : layoutConfig.rowGap; 
      const actualRowHeight = gridHeight + pb;

      let combinedHeight = actualRowHeight;
      
      if (isDoubleRight && i + 1 < sheetData.length && rowTypes[i + 1] === 'double-left') {
         const nextRow = sheetData[i + 1];
         const nextVisualLines = Math.ceil(nextRow.length / 9);
         const nextGridHeight = (layoutConfig.measureHeight * nextVisualLines) + (layoutConfig.rowGap * (nextVisualLines - 1));
         const nextPb = layoutConfig.rowGap;
         const nextActualRowHeight = nextGridHeight + nextPb;
         combinedHeight += nextActualRowHeight;
      }

      if (rType !== 'double-left' && (currentUsedHeight + combinedHeight + headerSpace + PAGE_PADDING + FOOTER_SPACE > A4_HEIGHT_PX) && currentRows.length > 0) {
        calculatedPages.push({ rows: currentRows, startIndex: i - currentRows.length });
        currentRows = [row];
        currentUsedHeight = actualRowHeight; 
        isFirstPage = false;
      } else {
        currentRows.push(row);
        currentUsedHeight += actualRowHeight;
      }
    }

    if (currentRows.length > 0) {
      calculatedPages.push({ rows: currentRows, startIndex: sheetData.length - currentRows.length });
    }
    return calculatedPages;
  }, [sheetData, layoutConfig, headerDetails, rowTypes]);

  const calculatePaths = useCallback(() => {
    const newPagePaths = {};
    const scale = zoom / 100;

    symbols.forEach(sym => {
      const startEl = document.getElementById(`note-${sym.start[0]}-${sym.start[1]}-${sym.start[2]}`);
      const endEl = document.getElementById(`note-${sym.end[0]}-${sym.end[1]}-${sym.end[2]}`);

      if (startEl && endEl) {
        const pageIndex = pages.findIndex(p => sym.start[0] >= p.startIndex && sym.start[0] < p.startIndex + p.rows.length);
        
        if (pageIndex !== -1) {
          const pageEl = document.getElementById(`page-${pageIndex}`);
          if (pageEl) {
            const pRect = pageEl.getBoundingClientRect(); 
            const sRect = startEl.getBoundingClientRect(); 
            const eRect = endEl.getBoundingClientRect();   

            const yOffset = 4;
            const x1 = (sRect.left - pRect.left + (sRect.width / 2)) / scale;
            const y1 = (sRect.top - pRect.top) / scale + yOffset;

            const x2 = (eRect.left - pRect.left + (eRect.width / 2)) / scale;
            const y2 = (eRect.top - pRect.top) / scale + yOffset;

            let d = "";
            const dx = x2 - x1;
            const dy = y2 - y1;

            if (dx === 0 && dy === 0) return;

            const color = sym.color || layoutConfig.symbolColor || '#1e293b';
            const strokeW = sym.strokeWidth || layoutConfig.symbolStrokeWidth || 2.5;
            const baseHeight = sym.height !== undefined ? sym.height : (layoutConfig.symbolHeight !== undefined ? layoutConfig.symbolHeight : 20);

            if (Math.abs(dy) < 20) {
              const height = baseHeight + Math.abs(dx) * 0.15;
              d = `M ${x1} ${y1} C ${x1 + dx * 0.25} ${y1 - height}, ${x2 - dx * 0.25} ${y2 - height}, ${x2} ${y2}`;
            } else if (dy < 0) {
              const ctrlX1 = x1 - (baseHeight + 15);
              const ctrlY1 = y1 - (baseHeight + 20);
              const ctrlX2 = x2 - (baseHeight);
              const ctrlY2 = y2 - (baseHeight);
              d = `M ${x1} ${y1} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${x2} ${y2}`;
            } else {
              const ctrlX1 = x1 + (baseHeight + 10);
              const ctrlY1 = y1 + (baseHeight + 10);
              const ctrlX2 = x2 + (baseHeight);
              const ctrlY2 = y2 - 10;
              d = `M ${x1} ${y1} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${x2} ${y2}`;
            }

            if (!newPagePaths[pageIndex]) newPagePaths[pageIndex] = [];
            newPagePaths[pageIndex].push({ id: sym.id, d, color, strokeW });
          }
        }
      }
    });

    setPageSvgPaths(newPagePaths);
  }, [symbols, layoutConfig, pages, zoom]);

  useEffect(() => {
    if (playbackCursor !== null) return; 

    const timerId = setTimeout(() => {
      calculatePaths();
    }, 150); 

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
      if (container) {
        container.style.display = 'block'; 
        container.style.width = '100%';
        calculatePaths(); 
      }
    };
    const handleAfterPrint = () => {
      const container = document.getElementById('sheet-scroll-container');
      if (container) {
        container.style.display = ''; 
        container.style.width = '';
        calculatePaths();
      }
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [calculatePaths]);

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
         addSymbol(
           layoutConfig.activeSymbol || 'sabat', 
           selectedCell, 
           [rIndex, mIndex, cIndex],
           {
             color: layoutConfig.symbolColor || '#1e293b',
             strokeWidth: layoutConfig.symbolStrokeWidth || 2.5,
             height: layoutConfig.symbolHeight !== undefined ? layoutConfig.symbolHeight : 20
           }
         );
      }
    }
  };

  const renderSheetNote = (note) => {
    if (note === '-') return <span>-</span>;
    return (
      <span 
        className={`leading-none inline-block ${layoutConfig.isBold ? 'font-bold' : 'font-normal'} ${layoutConfig.isItalic ? 'italic' : ''}`} 
        style={{ fontFamily: "'TH Sarabun New', sans-serif", paddingTop: '0.1em', paddingBottom: '0.1em' }}
      >
        {note}
      </span>
    );
  };

  const renderSectionLabels = (visualIndex, rowType) => {
    const labels = sectionLabels[visualIndex];
    if (!labels || labels.length === 0) return null;
    
    return labels.map((label) => {
      if (!label.text) return null;

      if (rowType === 'double-right' && label.position.includes('bottom')) return null;
      if (rowType === 'double-left' && label.position.includes('top')) return null;

      let positionStyle = { position: 'absolute', fontWeight: label.isBold ? 'bold' : 'normal', fontSize: `${label.fontSize}px`, color: '#0f172a', whiteSpace: 'nowrap', zIndex: 20, lineHeight: 1 };
      
      const labelOffset = label.offsetY !== undefined ? label.offsetY : 6;
      
      if (label.position.includes('top')) { 
        positionStyle.bottom = '100%'; 
        positionStyle.marginBottom = `${labelOffset}px`; 
      } else { 
        positionStyle.top = '100%'; 
        positionStyle.marginTop = `${labelOffset}px`; 
      }
      
      if (label.position.includes('left')) { 
        positionStyle.left = '0'; 
      } else if (label.position.includes('center')) { 
        positionStyle.left = '50%'; 
        positionStyle.transform = 'translateX(-50%)'; 
      } else if (label.position.includes('right')) { 
        positionStyle.right = '0'; 
      }
      
      return <div key={label.id} style={positionStyle} className="font-sans tracking-wide">{label.text}</div>;
    });
  };

  let minR = -1, maxR = -1, minCol = -1, maxCol = -1;
  if (selectionRange && selectionRange.start && selectionRange.end) {
     const sr = selectionRange.start[0];
     const sm = selectionRange.start[1];
     const sc = selectionRange.start[2];
     const er = selectionRange.end[0];
     const em = selectionRange.end[1];
     const ec = selectionRange.end[2];

     minR = Math.min(sr, er);
     maxR = Math.max(sr, er);

     const startRowData = sheetData[sr] || [];
     const endRowData = sheetData[er] || [];

     const startCol = getFlattenedCol(startRowData, rowTypes[sr], sm, sc);
     const endCol = getFlattenedCol(endRowData, rowTypes[er], em, ec);

     minCol = Math.min(startCol, endCol);
     maxCol = Math.max(startCol, endCol);
  }

  return (
    <div className="relative w-full h-full flex flex-col flex-1 min-h-0 bg-slate-50/50">
      
      <style>
        {`
          @media print {
            @page { 
              size: A4 portrait; 
              margin: 0; 
            }
            html, body, #root {
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              overflow: visible !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            #sheet-scroll-container {
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important; 
              margin: 0 !important;
              overflow: visible !important;
              transform: none !important;
            }
            .print-page { 
              display: block !important;
              width: 100% !important;
              min-width: 100% !important;
              max-width: 100% !important;
              height: 297mm !important; 
              min-height: 297mm !important;
              max-height: 297mm !important;
              margin: 0 auto !important;
              padding: 15mm 15mm 10mm 15mm !important; 
              box-shadow: none !important;
              border: none !important;
              page-break-inside: avoid !important;
              page-break-after: always !important; 
              break-after: page !important; 
              zoom: 1 !important; 
            }
            .print-page:last-child { 
              page-break-after: auto !important; 
              break-after: auto !important; 
            }
            .print-hidden { display: none !important; }
          }
          .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 10px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid #f8fafc; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}
      </style>

      {/* ⭐ ระบบล็อคปุ่ม Zoom อัตโนมัติเมื่อเพลงเล่นอยู่ */}
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

      <div 
        ref={ref}
        id="sheet-scroll-container"
        className="flex overflow-x-auto pb-10 pt-6 w-full max-w-full custom-scrollbar select-none print:block print:overflow-visible print:p-0 relative"
        style={{ paddingLeft: `max(1rem, calc(50% - ${105 * (zoom / 100)}mm))`, paddingRight: `max(1rem, calc(50% - ${105 * (zoom / 100)}mm))` }}
      >
        <div className="flex gap-12 snap-x h-max print:block" style={{ zoom: `${zoom}%` }}>
          {pages.map((page, pIndex) => (
            <div key={pIndex} id={`page-${pIndex}`} className="print-page relative bg-white w-[210mm] min-w-[210mm] h-[297mm] min-h-[297mm] shadow-xl border border-slate-200 pt-12 px-12 pb-4 flex flex-col text-slate-800 shrink-0 snap-center print:shadow-none print:border-none print:m-0 print:pt-[15mm] print:px-[15mm] print:pb-[10mm] transition-shadow hover:shadow-2xl" style={{ fontFamily: "'TH Sarabun New', sans-serif", boxSizing: 'border-box' }}>
              
              <svg 
                className="absolute top-0 left-0 w-full h-full pointer-events-none z-30 print:z-30 print:w-full print:max-w-full" 
              >
                {(pageSvgPaths[pIndex] || []).map(p => {
                  const isSelected = p.id === selectedSymbolId;
                  return (
                    <g key={p.id}>
                      <path 
                        d={p.d} fill="none" stroke="transparent" strokeWidth="20" 
                        className="pointer-events-auto cursor-pointer print:pointer-events-none"
                        onMouseDown={(e) => { 
                          e.stopPropagation(); 
                          if (setSelectedSymbolId) setSelectedSymbolId(p.id); 
                        }}
                      />
                      {isSelected && (
                        <path 
                          d={p.d} fill="none" stroke="#f59e0b" strokeWidth={p.strokeW + 4} strokeLinecap="round" 
                          opacity="0.4" className="pointer-events-none print:hidden"
                        />
                      )}
                      <path 
                        d={p.d} fill="none" stroke={isSelected ? '#d97706' : p.color} strokeWidth={p.strokeW} strokeLinecap="round" 
                        className="pointer-events-none drop-shadow-sm transition-all duration-200"
                      />
                    </g>
                  );
                })}
              </svg>

              {pIndex === 0 && (
                <div className="text-center border-b-2 border-slate-900 pb-4 mb-6 shrink-0 relative z-10">
                  <h1 className="font-bold mb-4 uppercase tracking-tight" style={{ fontSize: `${layoutConfig.songNameSize}px` }}>{songName}</h1>
                  <div className={`grid gap-x-12 gap-y-1 px-4 ${layoutConfig.detailsAlign === 'between' ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ fontSize: `${layoutConfig.authorSize}px`, textAlign: layoutConfig.detailsAlign === 'between' ? 'left' : layoutConfig.detailsAlign }}>
                    {headerDetails.map((detail, index) => (
                      <div key={detail.id} className={layoutConfig.detailsAlign === 'between' && index % 2 !== 0 ? "text-right" : ""}><span className="font-bold">{detail.label}:</span> {detail.value}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col w-full pb-12 print:pb-[15mm]">
                {page.rows.map((row, localIndex) => {
                  const rIndex = page.startIndex + localIndex;
                  const rType = rowTypes[rIndex];
                  const isCursor = selectedCell[0] === rIndex;

                  if (rType === 'page-break') {
                     return (
                       <div key={rIndex} className="w-full flex flex-col items-center justify-center my-1">
                         <div
                           onClick={(e) => {
                              e.stopPropagation();
                              if(setSelectedSymbolId) setSelectedSymbolId(null);
                              setSelectedCell([rIndex, 0, 0]);
                           }}
                           className={`flex items-center w-full py-2 cursor-pointer print-hidden select-none transition-all ${isCursor ? 'bg-indigo-50 ring-2 ring-indigo-400 rounded-md' : 'hover:bg-slate-50'}`}
                         >
                            <div className="w-full border-t-2 border-dashed border-slate-300"></div>
                         </div>
                       </div>
                     );
                  }

                  const isDoubleRight = rType === 'double-right';
                  const isDoubleLeft = rType === 'double-left';
                  const isDouble = isDoubleRight || isDoubleLeft;
                  const pb = isDoubleRight ? 0 : layoutConfig.rowGap;

                  let visualRowNumber = displayRowNumbers[rIndex];
                  if (isDoubleLeft && rIndex > 0) {
                    visualRowNumber = displayRowNumbers[rIndex - 1]; 
                  }
                  const visualIndex = visualRowNumber !== '' && visualRowNumber != null ? visualRowNumber - 1 : null;

                  return (
                    <div key={rIndex} className="flex flex-col w-full" style={{ paddingBottom: `${pb}px` }}>
                      <div className="relative w-full">
                        
                        {displayRowNumbers[rIndex] !== '' && (
                          <div className={`absolute -left-8 -translate-y-1/2 text-slate-300 font-sans text-[12px] font-bold print-hidden select-none ${isDoubleRight ? 'top-full' : 'top-1/2'}`}>
                            {displayRowNumbers[rIndex]}
                          </div>
                        )}

                        {isDoubleRight && (
                          <div 
                            className="absolute top-0 border-l-[3px] border-t-[3px] border-b-[3px] border-slate-300 print:border-slate-400"
                            style={{
                              left: '-10px', width: '6px', height: `${layoutConfig.measureHeight * 2}px`,
                              borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', zIndex: 10
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
                                  borderTop: `${layoutConfig.borderWidth}px solid ${layoutConfig.borderColor}`,
                                  borderBottom: isDoubleRight ? 'none' : `${layoutConfig.borderWidth}px solid ${layoutConfig.borderColor}`,
                                  borderRight: `${layoutConfig.borderWidth}px solid ${layoutConfig.borderColor}`,
                                  borderLeft: isFirstInLine ? `${layoutConfig.borderWidth}px solid ${layoutConfig.borderColor}` : 'none',
                                  borderTopLeftRadius: (isFirstInLine && !isDoubleLeft) ? `${layoutConfig.borderRadius}px` : 0,
                                  borderBottomLeftRadius: (isFirstInLine && !isDoubleRight) ? `${layoutConfig.borderRadius}px` : 0,
                                  borderTopRightRadius: (isLastInLine && !isDoubleLeft) ? `${layoutConfig.borderRadius}px` : 0,
                                  borderBottomRightRadius: (isLastInLine && !isDoubleRight) ? `${layoutConfig.borderRadius}px` : 0,
                                  backgroundColor: isLabelMeasure ? '#f8fafc' : 'white',
                                }}
                              >
                                {isLabelMeasure ? (
                                  <div className="flex items-center justify-center w-full h-full text-[13px] font-bold text-slate-700 tracking-wide select-none">
                                    {measure[0]}
                                  </div>
                                ) : (
                                  measure.map((note, cIndex) => {
                                    let isInRange = false;
                                    if (selectionRange && rIndex >= minR && rIndex <= maxR) {
                                        const currentCol = getFlattenedCol(row, rType, mIndex, cIndex);
                                        if (currentCol >= minCol && currentCol <= maxCol) {
                                            isInRange = true;
                                        }
                                    }

                                    const isCursorExact = selectedCell[0] === rIndex && selectedCell[1] === mIndex && selectedCell[2] === cIndex;
                                    
                                    let isPlayingNow = false;
                                    if (playbackCursor) {
                                      if (playbackCursor[0] === rIndex && playbackCursor[1] === mIndex && playbackCursor[2] === cIndex) {
                                        isPlayingNow = true;
                                      }
                                      if (rowTypes[playbackCursor[0]] === 'double-right' && rIndex === playbackCursor[0] + 1 && playbackCursor[1] === mIndex && playbackCursor[2] === cIndex) {
                                        isPlayingNow = true;
                                      }
                                    }
                                    
                                    let cellBgClass = 'hover:bg-sky-50 print:bg-transparent';
                                    
                                    if (isPlayingNow) {
                                      cellBgClass = 'bg-emerald-200 ring-2 ring-inset ring-emerald-500 z-20 print:bg-transparent print:ring-0 transform scale-[1.02] transition-transform';
                                    } else if (isInRange) {
                                      cellBgClass = 'bg-sky-200 print:bg-transparent';
                                    } else if (isCursorExact) {
                                      cellBgClass = 'bg-yellow-100 ring-2 ring-inset ring-blue-400 z-10 print:bg-transparent print:ring-0';
                                    }

                                    if (isCursorExact && isInRange && !isPlayingNow) {
                                      cellBgClass = 'bg-sky-300 ring-2 ring-inset ring-blue-500 z-10 print:bg-transparent print:ring-0';
                                    }

                                    return (
                                      <div 
                                        id={`note-${rIndex}-${mIndex}-${cIndex}`}
                                        key={cIndex} 
                                        onMouseDown={(e) => {
                                          if (setSelectedSymbolId) setSelectedSymbolId(null);
                                          if (e.button !== 2) startSelection(rIndex, mIndex, cIndex);
                                        }}
                                        onMouseEnter={() => updateSelection(rIndex, mIndex, cIndex)}
                                        onContextMenu={(e) => handleRightClick(e, rIndex, mIndex, cIndex)}
                                        className={`flex items-center justify-center cursor-crosshair transition-all ${cellBgClass}`} 
                                        style={{ 
                                          fontSize: `${layoutConfig.fontSize}px`,
                                          borderRight: (cIndex < measure.length - 1 && layoutConfig.innerBorderWidth > 0) ? `${layoutConfig.innerBorderWidth}px solid ${layoutConfig.borderColor}66` : 'none' 
                                        }}
                                      >
                                        {renderSheetNote(note)}
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

              <div className="absolute bottom-[20px] print:bottom-[10mm] left-12 right-12 print:left-[15mm] print:right-[15mm] pt-2 border-t border-slate-200 text-center text-slate-400 text-[12px] print:text-slate-500 z-20 bg-white">
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