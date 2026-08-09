import React, { useContext, useState, useRef, useEffect } from 'react';
import { MusicContext } from '../../contexts/MusicContext';

const FONT_OPTIONS = [
  { value: "'TH Sarabun New', sans-serif", label: 'TH Sarabun New' },
  { value: "'Sarabun', sans-serif", label: 'Sarabun' },
  { value: "'Noto Sans Thai', sans-serif", label: 'Noto Sans Thai' },
  { value: "'Prompt', sans-serif", label: 'Prompt' },
  { value: "'Kanit', sans-serif", label: 'Kanit' },
  { value: "'Mitr', sans-serif", label: 'Mitr' },
  { value: "'Mali', cursive", label: 'Mali' },
];

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

const PlaybackControls = () => {
  const {
    rowTypes, selectedCell, selectionRange, layoutConfig, setLayoutConfig, sheetData, rowMargins, updateRowMarginsList,
    isPlaying, startPlayback, stopPlayback,
    symbols, selectedSymbolId, setSelectedSymbolId, updateSymbol, removeSymbol, removeSymbolByCell,
    toolbarMode, setToolbarMode,
    isLoopAll, setIsLoopAll,
    isLoopOne, setIsLoopOne,
    skipToPrev, skipToNext,
    setSongName, updateDetail 
  } = useContext(MusicContext);

  const [textFontSize, setTextFontSize] = useState(16);
  const savedSelection = useRef(null);
  
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isTextRow = rowTypes && rowTypes[selectedCell[0]] === 'text';

  let minR = selectedCell[0];
  let maxR = selectedCell[0];
  if (selectionRange && selectionRange.start && selectionRange.end) {
      minR = Math.min(selectionRange.start[0], selectionRange.end[0]);
      maxR = Math.max(selectionRange.start[0], selectionRange.end[0]);
  }
  const activeSym = symbols.find(s => s.id === selectedSymbolId);
  const isEditingMode = toolbarMode === 'symbol'; 

  const handleBpmChange = (e) => {
    let val = parseInt(e.target.value);
    setLayoutConfig({ ...layoutConfig, bpm: isNaN(val) ? "" : val });
  };
  const handleBpmBlur = () => {
    let val = parseInt(layoutConfig.bpm);
    if (isNaN(val) || val < 20) val = 20;
    if (val > 300) val = 300;
    setLayoutConfig({ ...layoutConfig, bpm: val });
  };
  const handleVolumeChange = (e) => {
    setLayoutConfig({ ...layoutConfig, volume: parseInt(e.target.value) });
  };
  const handlePropChange = (configKey, symKey, value) => {
    if (isEditingMode) {
      updateSymbol(selectedSymbolId, { [symKey]: value });
    } else {
      setLayoutConfig({ ...layoutConfig, [configKey]: value });
    }
  };
  const handleLayoutChange = (key, value) => {
    setLayoutConfig({ ...layoutConfig, [key]: value });
  };

  const handleNoteStyle = (styleKey, value, isToggle = false, step = 0) => {
    const hasKlum = selectionRange && selectionRange.start && selectionRange.end &&
      (selectionRange.start[0] !== selectionRange.end[0] ||
       selectionRange.start[1] !== selectionRange.end[1] ||
       selectionRange.start[2] !== selectionRange.end[2]);

    if (hasKlum) {
      const newStyles = { ...(layoutConfig.customStyles || {}) };
      const minR = Math.min(selectionRange.start[0], selectionRange.end[0]);
      const maxR = Math.max(selectionRange.start[0], selectionRange.end[0]);
      const startColVal = getFlattenedCol(sheetData[selectionRange.start[0]], rowTypes[selectionRange.start[0]], selectionRange.start[1], selectionRange.start[2]);
      const endColVal = getFlattenedCol(sheetData[selectionRange.end[0]], rowTypes[selectionRange.end[0]], selectionRange.end[1], selectionRange.end[2]);
      const minCol = Math.min(startColVal, endColVal);
      const maxCol = Math.max(startColVal, endColVal);

      let cellsToUpdate = [];
      for (let r = minR; r <= maxR; r++) {
        const rowData = sheetData[r];
        if (!rowData || rowTypes[r] === 'text' || rowTypes[r] === 'page-break') continue;
        for (let m = 0; m < rowData.length; m++) {
          if (rowTypes[r].startsWith('double') && m === 0) continue;
          for (let c = 0; c < rowData[m].length; c++) {
            const colVal = getFlattenedCol(rowData, rowTypes[r], m, c);
            if (colVal >= minCol && colVal <= maxCol) {
              cellsToUpdate.push(`${r}_${m}_${c}`);
            }
          }
        }
      }

      if (cellsToUpdate.length > 0) {
        let targetValue = value;
        if (isToggle) {
          const allHaveStyle = cellsToUpdate.every(key => newStyles[key]?.[styleKey]);
          targetValue = !allHaveStyle;
        }

        cellsToUpdate.forEach(key => {
          const currentStyle = newStyles[key] || {};
          let finalValue = targetValue;
          if (step !== 0) {
             const currentVal = currentStyle[styleKey] !== undefined ? currentStyle[styleKey] : (layoutConfig[styleKey] || 30);
             finalValue = currentVal + step;
          }
          newStyles[key] = { ...currentStyle, [styleKey]: finalValue };
        });
        setLayoutConfig({ ...layoutConfig, customStyles: newStyles });
      }
    } else {
      if (isToggle) {
        handleLayoutChange(styleKey, !layoutConfig[styleKey]);
      } else if (step !== 0) {
        const newVal = (layoutConfig[styleKey] || 30) + step;
        if (newVal >= 10 && newVal <= 150) handleLayoutChange(styleKey, newVal);
      } else {
        handleLayoutChange(styleKey, value);
      }
    }
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const node = selection.anchorNode;
        const element = node && node.nodeType === 3 ? node.parentElement : node;
        const isInsideEditor = element && element.closest && element.closest('[contenteditable="true"]');

        if (isInsideEditor) {
          savedSelection.current = selection.getRangeAt(0).cloneRange();
          const computedStyle = window.getComputedStyle(element);
          if (computedStyle && computedStyle.fontSize) {
            const sizeInt = parseInt(computedStyle.fontSize, 10);
            if (!isNaN(sizeInt) && sizeInt !== textFontSize) {
              setTextFontSize(sizeInt);
            }
          }
        }
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [textFontSize]);

  const syncFormatToState = () => {
    setTimeout(() => {
      const editor = getActiveEditor();
      if (!editor) return;

      if (isTextRow) {
        const rIndex = selectedCell[0];
        const el = document.getElementById(`text-row-${rIndex}`);
        if (el && sheetData[rIndex] && sheetData[rIndex][0]) {
          sheetData[rIndex][0][0] = el.innerHTML;
        }
      }
    }, 10);
  };

  const getActiveEditor = () => {
    if (!savedSelection.current) return null;
    let node = savedSelection.current.commonAncestorContainer;
    return node.nodeType === 3 ? node.parentElement.closest('[contenteditable="true"]') : node.closest('[contenteditable="true"]');
  };

  const handleUniversalFontSizeChange = (val, step = 0) => {
    const hasTextSelection = savedSelection.current && savedSelection.current.toString().length > 0;
    const isTextSelecting = hasTextSelection && getActiveEditor();
    
    if (toolbarMode === 'text' || isTextSelecting) {
        let finalVal = val;
        if (step !== 0) finalVal = textFontSize + step;
        if (finalVal >= 10 && finalVal <= 150) {
            setTextFontSize(finalVal);
            const editor = getActiveEditor();
            if (editor && savedSelection.current) {
                editor.focus(); 
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(savedSelection.current);
                
                document.execCommand("styleWithCSS", false, true);
                document.execCommand("fontSize", false, "7");

                const fonts = editor.querySelectorAll('font[size="7"], span[style*="xxx-large"]');
                fonts.forEach(font => {
                    if (font.tagName === 'FONT') font.removeAttribute("size");
                    font.style.fontSize = `${finalVal}px`;
                    font.style.lineHeight = 'normal';
                });
                
                if (selection.rangeCount > 0) savedSelection.current = selection.getRangeAt(0).cloneRange();
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                syncFormatToState();
            }
        }
    } else {
        handleNoteStyle('fontSize', val, false, step);
    }
  };

  const formatText = (command, value = null) => {
    const editor = getActiveEditor();
    if (!editor || !savedSelection.current) return;

    editor.focus(); 

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedSelection.current);

    document.execCommand("styleWithCSS", false, true);
    
    if (command === 'fontName') {
       document.execCommand("fontName", false, "dummyfont");
       const elements = editor.querySelectorAll('font[face="dummyfont"], span[style*="dummyfont"]');
       elements.forEach(el => {
         if (el.tagName === 'FONT') el.removeAttribute("face");
         el.style.fontFamily = value;
       });
    } else {
       document.execCommand(command, false, value);
    }

    if (selection.rangeCount > 0) savedSelection.current = selection.getRangeAt(0).cloneRange();
    
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    syncFormatToState();
  };

  const defaultFontFamily = layoutConfig.fontFamily || "'TH Sarabun New', sans-serif";

  const renderModeContent = () => {
    switch(toolbarMode) {
      case 'symbol':
        return (
          <div className="flex items-center gap-4 flex-wrap animate-fadeIn">
            <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-md flex items-center gap-1">
              <span className="relative flex h-2 w-2 mr-1"><span className="animate-ping absolute h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative rounded-full h-2 w-2 bg-amber-500"></span></span>
              โหมดแก้ไขสัญลักษณ์
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">สีเส้น</span>
              <div className="p-0.5 bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 transition-all flex items-center justify-center cursor-pointer">
                <input type="color" value={activeSym?.color || '#1e293b'} onChange={(e) => handlePropChange('symbolColor', 'color', e.target.value)} className="w-7 h-7 rounded-md cursor-pointer border-none p-0 bg-transparent" />
              </div>
            </div>
            <button onClick={() => { removeSymbol(selectedSymbolId); setSelectedSymbolId(null); setToolbarMode('default'); }} className="p-2 ml-4 text-slate-400 hover:text-white hover:bg-rose-500 rounded-lg transition-colors border border-transparent hover:border-rose-600 flex items-center gap-1 text-sm font-bold shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> ลบสัญลักษณ์
            </button>
          </div>
        );

      case 'text':
      case 'default': 
      default:
        return (
          <div className="flex items-center gap-6 animate-fadeIn w-full">
            
            <div className="flex items-center gap-1 border-r border-slate-200 pr-5 shrink-0">
              <button onClick={() => setIsLoopOne?.(!isLoopOne)} className={`p-2 rounded-lg transition-colors ${isLoopOne ? 'bg-sky-100 text-sky-600' : 'text-slate-400 hover:bg-slate-100'}`} title="วนลูปเฉพาะท่อนนี้">
                <svg className="w-5 h-5 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /><text x="12" y="15" fontSize="7" strokeWidth="0.5" fontFamily="sans-serif" fontWeight="900" textAnchor="middle" fill="currentColor">1</text></svg>
              </button>
              <button onClick={skipToPrev} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-full transition-all active:scale-90" title="ย้อนกลับ/เริ่มท่อนใหม่">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
              </button>
              <button onClick={isPlaying ? stopPlayback : startPlayback} className={`w-10 h-10 mx-1 flex items-center justify-center rounded-full text-white shadow-sm transition-transform active:scale-95 ${isPlaying ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'}`} title={isPlaying ? "หยุดเล่น" : "เล่นดนตรี"}>
                {isPlaying ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd"/></svg> : <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg>}
              </button>
              <button onClick={skipToNext} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-full transition-all active:scale-90" title="ข้ามท่อน">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
              </button>
              <button onClick={() => setIsLoopAll?.(!isLoopAll)} className={`p-2 rounded-lg transition-colors ${isLoopAll ? 'bg-sky-100 text-sky-600' : 'text-slate-400 hover:bg-slate-100'}`} title="วนลูปทั้งหมด">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 shrink-0">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider pl-1">BPM</span>
              <input type="number" min="20" max="300" value={layoutConfig.bpm || 80} onChange={handleBpmChange} onBlur={handleBpmBlur} className="w-12 text-center text-sm font-bold text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 p-0" />
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 border-r border-slate-200 pr-4 shrink-0">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
              <input type="range" min="0" max="100" value={layoutConfig.volume !== undefined ? layoutConfig.volume : 100} onChange={handleVolumeChange} className="w-16 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-1.5 rounded-md border border-sky-100 whitespace-nowrap">เครื่องมือจัดหน้า</span>
              
              <div className="flex items-center gap-2">
                <select 
                  value={layoutConfig.noteFontFamily || defaultFontFamily} 
                  onChange={(e) => {
                    const hasTextSelection = savedSelection.current && savedSelection.current.toString().length > 0;
                    if (toolbarMode === 'text' || (hasTextSelection && getActiveEditor())) {
                      formatText('fontName', e.target.value);
                    } else {
                      handleNoteStyle('noteFontFamily', e.target.value);
                    }
                  }} 
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 cursor-pointer w-32 truncate shadow-sm transition-all hover:border-slate-400"
                >
                  {FONT_OPTIONS.map(font => (<option key={`note-${font.value}`} value={font.value}>{font.label}</option>))}
                </select>
              </div>

              <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden h-[34px] shadow-sm hover:border-slate-400 transition-all shrink-0">
                <button onMouseDown={(e) => { e.preventDefault(); handleUniversalFontSizeChange(null, -2); }} className="w-8 h-full text-slate-500 hover:bg-slate-100 font-black transition-colors">−</button>
                <input 
                  type="number" min="10" max="150" 
                  value={toolbarMode === 'text' || (savedSelection.current && savedSelection.current.toString().length > 0 && getActiveEditor()) ? textFontSize : (layoutConfig.fontSize || 30)} 
                  onChange={(e) => handleUniversalFontSizeChange(parseInt(e.target.value) || 16)} 
                  className="w-10 text-center text-sm font-bold text-slate-700 bg-slate-50 border-none focus:ring-0 p-0 h-full" 
                />
                <button onMouseDown={(e) => { e.preventDefault(); handleUniversalFontSizeChange(null, 2); }} className="w-8 h-full text-slate-500 hover:bg-slate-100 font-black transition-colors">+</button>
              </div>

              <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-slate-300 shadow-sm shrink-0">
                <button 
                  onMouseDown={(e) => { 
                    e.preventDefault(); 
                    const hasTextSelection = savedSelection.current && savedSelection.current.toString().length > 0;
                    if (toolbarMode === 'text' || (hasTextSelection && getActiveEditor())) {
                      formatText('bold');
                    } else {
                      handleNoteStyle('isBold', null, true);
                    }
                  }} 
                  className={`w-7 h-7 flex items-center justify-center text-sm rounded-md transition-all ${layoutConfig.isBold && toolbarMode !== 'text' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-100 font-medium'}`}
                >B</button>
                
                <button 
                  onMouseDown={(e) => { 
                    e.preventDefault(); 
                    const hasTextSelection = savedSelection.current && savedSelection.current.toString().length > 0;
                    if (toolbarMode === 'text' || (hasTextSelection && getActiveEditor())) {
                      formatText('italic');
                    } else {
                      handleNoteStyle('isItalic', null, true);
                    }
                  }} 
                  className={`w-7 h-7 flex items-center justify-center text-sm rounded-md italic transition-all ${layoutConfig.isItalic && toolbarMode !== 'text' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-100 font-medium'}`}
                >I</button>

                <button 
                  onMouseDown={(e) => { 
                    e.preventDefault(); 
                    const hasTextSelection = savedSelection.current && savedSelection.current.toString().length > 0;
                    if (toolbarMode === 'text' || (hasTextSelection && getActiveEditor())) {
                      formatText('underline');
                    } 
                  }} 
                  className="w-7 h-7 flex items-center justify-center text-sm rounded-md underline transition-all text-slate-600 hover:bg-slate-100 font-medium"
                >U</button>
              </div>

              <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-slate-300 shadow-sm shrink-0 ml-1">
                <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyLeft'); }} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-slate-600 hover:bg-slate-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg></button>
                <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyCenter'); }} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-slate-600 hover:bg-slate-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" /></svg></button>
                <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyRight'); }} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-slate-600 hover:bg-slate-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" /></svg></button>
              </div>

              <div className="flex items-center gap-2 ml-1 border-l border-slate-200 pl-4 shrink-0">
                <select value={layoutConfig.activeSymbol || 'sabat'} onChange={(e) => handlePropChange('activeSymbol', 'type', e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 cursor-pointer w-28 shadow-sm hover:border-slate-400 transition-all">
                  <option value="sabat">สะบัด</option>
                  <option value="kro">กรอ</option>
                </select>
                
                {/* ⭐ จานสีอัจฉริยะ (เปลี่ยนได้ทั้ง โน้ต/สัญลักษณ์/ข้อความ) */}
                <div className="p-0.5 bg-white border border-slate-300 rounded-lg shadow-sm hover:border-slate-400 transition-all flex items-center justify-center cursor-pointer">
                  <input 
                    type="color" 
                    value={layoutConfig.symbolColor || '#1e293b'} 
                    onChange={(e) => {
                      const hasTextSelection = savedSelection.current && savedSelection.current.toString().length > 0;
                      
                      // 1. ถ้าอยู่ในโหมดข้อความ ให้เปลี่ยนสีตัวอักษร
                      if (toolbarMode === 'text' || (hasTextSelection && getActiveEditor())) {
                        formatText('foreColor', e.target.value);
                      } else {
                        // เช็กว่ามีการคลุมดำโน้ตอยู่หรือไม่
                        const hasKlum = selectionRange && selectionRange.start && selectionRange.end &&
                          (selectionRange.start[0] !== selectionRange.end[0] ||
                           selectionRange.start[1] !== selectionRange.end[1] ||
                           selectionRange.start[2] !== selectionRange.end[2]);
                           
                        // 2. ถ้าคลุมดำโน้ตอยู่ ให้เปลี่ยนสีโน้ต (ผ่าน handleNoteStyle)
                        if (hasKlum) {
                          handleNoteStyle('color', e.target.value);
                        } else {
                          // 3. ถ้าไม่ได้คลุมดำ ให้เปลี่ยนสีสัญลักษณ์ (ค่าดั้งเดิม)
                          handlePropChange('symbolColor', 'color', e.target.value);
                        }
                      }
                    }} 
                    className="w-7 h-7 rounded-md cursor-pointer border-none p-0 bg-transparent" 
                    title="เปลี่ยนสี (ตัวอักษร/โน้ต/สัญลักษณ์)" 
                  />
                </div>

              </div>
            </div>
            
          </div>
        );
    }
  };

  return (
    <div className="playback-controls-container relative w-full bg-white border-b border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.03)] z-40 shrink-0 font-sans transition-all duration-300">
      
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -bottom-3 right-8 bg-white border border-slate-200 shadow-sm rounded-full p-1 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all z-50 flex items-center justify-center"
        title={isCollapsed ? "กางแถบเครื่องมือ" : "ซ่อนแถบเครื่องมือ"}
      >
        <svg className={`w-4 h-4 transform transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      <div className={`overflow-x-auto overflow-y-hidden transition-all duration-300 ease-in-out px-6 ${isCollapsed ? 'h-0 opacity-0 py-0' : 'h-[60px] opacity-100 py-3'} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}>
        <div key={toolbarMode} className="h-full flex items-center min-w-max">
           {renderModeContent()}
        </div>
      </div>

    </div>
  );
};

export default PlaybackControls;