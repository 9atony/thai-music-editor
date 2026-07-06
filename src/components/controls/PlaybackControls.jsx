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

const PlaybackControls = () => {
  const {
    rowTypes, selectedCell, selectionRange, layoutConfig, setLayoutConfig, sheetData, rowMargins, updateRowMarginsList,
    isPlaying, startPlayback, stopPlayback,
    symbols, selectedSymbolId, setSelectedSymbolId, updateSymbol, removeSymbol, removeSymbolByCell,
    toolbarMode, setToolbarMode 
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
  const currentRowMargin = rowMargins[minR] || { top: 0, bottom: 0, left: 0 };
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
      if (isTextRow) {
        const rIndex = selectedCell[0];
        const el = document.getElementById(`text-row-${rIndex}`);
        if (el && sheetData[rIndex] && sheetData[rIndex][0]) {
          sheetData[rIndex][0][0] = el.innerHTML;
        }
      }
    }, 10);
  };

  const applyTextFontSize = (val) => {
    setTextFontSize(val);
    if (!isTextRow || !savedSelection.current) return;

    const rIndex = selectedCell[0];
    const editor = document.getElementById(`text-row-${rIndex}`);
    const selection = window.getSelection();

    if (selection.rangeCount === 0) {
       selection.addRange(savedSelection.current);
    }

    const isSelectingText = !selection.isCollapsed;

    if (!isSelectingText) {
      setLayoutConfig({ ...layoutConfig, textFontSize: val });
    } else {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("fontSize", false, "7");

      if (editor) {
        const fonts = editor.querySelectorAll('font[size="7"], span[style*="xxx-large"]');
        fonts.forEach(font => {
          if (font.tagName === 'FONT') font.removeAttribute("size");
          font.style.fontSize = `${val}px`;
          font.style.lineHeight = 'normal';
        });
      }
    }

    if (editor) editor.focus();
    if (selection.rangeCount > 0) {
      savedSelection.current = selection.getRangeAt(0).cloneRange();
    }
    syncFormatToState();
  };

  const formatText = (command, value = null) => {
    if (isTextRow) {
      if (!savedSelection.current) return;
      const rIndex = selectedCell[0];
      const editor = document.getElementById(`text-row-${rIndex}`);
      const selection = window.getSelection();

      if (selection.rangeCount === 0) {
         selection.addRange(savedSelection.current);
      }

      document.execCommand("styleWithCSS", false, true);
      
      if (command === 'fontName') {
         document.execCommand("fontName", false, "dummyFontX");
         if (editor) {
             const elements = editor.querySelectorAll('font[face="dummyFontX"], span[style*="dummyFontX"]');
             elements.forEach(el => {
               if (el.tagName === 'FONT') el.removeAttribute("face");
               el.style.fontFamily = value;
             });
         }
      } else {
         document.execCommand(command, false, value);
      }

      if (editor) editor.focus();
      if (selection.rangeCount > 0) {
        savedSelection.current = selection.getRangeAt(0).cloneRange();
      }
      syncFormatToState();
    }
  };

  const handleFontSizeStep = (step) => {
    if (toolbarMode === 'text') {
      const newVal = textFontSize + step; 
      if (newVal >= 10 && newVal <= 150) applyTextFontSize(newVal);
    } else {
      const newVal = (layoutConfig.fontSize || 30) + step;
      if (newVal >= 10 && newVal <= 150) setLayoutConfig({ ...layoutConfig, fontSize: newVal });
    }
  };

  const handleFontSizeChange = (e) => {
    const val = parseInt(e.target.value);
    if (isNaN(val)) return;
    if (toolbarMode === 'text') applyTextFontSize(val);
    else setLayoutConfig({ ...layoutConfig, fontSize: val });
  };

  const defaultFontFamily = layoutConfig.fontFamily || "'TH Sarabun New', sans-serif";

  const renderModeContent = () => {
    switch(toolbarMode) {
      case 'text':
        return (
          <div className="flex items-center gap-4 flex-wrap animate-fadeIn">
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">✍️ โหมดข้อความ</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ฟอนต์</span>
              <select
                onChange={(e) => formatText('fontName', e.target.value)}
                className="border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer w-28 truncate"
              >
                {FONT_OPTIONS.map(font => (
                  <option key={`edit-${font.value}`} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-slate-50 border border-slate-300 rounded-md overflow-hidden h-[30px]">
              <button onMouseDown={(e) => { e.preventDefault(); handleFontSizeStep(-2); }} className="w-7 h-full text-slate-500 hover:bg-slate-200 font-black">−</button>
              <input
                type="number" min="10" max="150"
                value={textFontSize}
                onChange={handleFontSizeChange}
                className="w-12 text-center text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 p-0"
              />
              <button onMouseDown={(e) => { e.preventDefault(); handleFontSizeStep(2); }} className="w-7 h-full text-slate-500 hover:bg-slate-200 font-black">+</button>
            </div>

            <div className="flex items-center gap-1">
              <button onMouseDown={(e) => { e.preventDefault(); formatText('bold'); }} className="w-8 h-8 flex items-center justify-center font-bold rounded transition-colors text-slate-700 hover:bg-slate-100">B</button>
              <button onMouseDown={(e) => { e.preventDefault(); formatText('italic'); }} className="w-8 h-8 flex items-center justify-center italic font-serif rounded transition-colors text-slate-700 hover:bg-slate-100">I</button>
              <button onMouseDown={(e) => { e.preventDefault(); formatText('underline'); }} className="w-8 h-8 flex items-center justify-center underline rounded transition-colors text-slate-700 hover:bg-slate-100">U</button>
            </div>

            <div className="flex items-center gap-1 border-l border-r border-slate-200 px-2">
              <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyLeft'); }} className="w-8 h-8 flex items-center justify-center rounded transition-colors text-slate-700 hover:bg-slate-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg></button>
              <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyCenter'); }} className="w-8 h-8 flex items-center justify-center rounded transition-colors text-slate-700 hover:bg-slate-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" /></svg></button>
              <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyRight'); }} className="w-8 h-8 flex items-center justify-center rounded transition-colors text-slate-700 hover:bg-slate-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" /></svg></button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">สี</span>
              <input type="color" onChange={(e) => formatText('foreColor', e.target.value)} className="w-7 h-7 rounded cursor-pointer border-none p-0 bg-transparent" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ระยะบรรทัด</span>
              <select value={layoutConfig.textLineHeight || 1.5} onChange={(e) => setLayoutConfig({ ...layoutConfig, textLineHeight: parseFloat(e.target.value) })} className="border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer">
                <option value="0.8">0.8 (ชิด)</option>
                <option value="1.0">1.0</option>
                <option value="1.5">1.5 (มาตรฐาน)</option>
                <option value="2.0">2.0 (กว้าง)</option>
              </select>
            </div>
          </div>
        );

      case 'symbol':
        return (
          <div className="flex items-center gap-4 flex-wrap animate-fadeIn">
            <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-md flex items-center gap-1">
              <span className="relative flex h-2 w-2 mr-1"><span className="animate-ping absolute h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative rounded-full h-2 w-2 bg-amber-500"></span></span>
              โหมดแก้ไขสัญลักษณ์
            </span>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">สีเส้น</span>
              <input type="color" value={activeSym?.color || '#1e293b'} onChange={(e) => handlePropChange('symbolColor', 'color', e.target.value)} className="w-7 h-7 rounded cursor-pointer border-none p-0 bg-transparent" />
            </div>

            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-1">
              <span className="text-[10px] font-bold text-slate-400 pl-1 uppercase">ความหนา</span>
              <input type="number" min="1" max="10" step="0.5" value={activeSym?.strokeWidth || 2.5} onChange={(e) => handlePropChange('strokeWidth', 'strokeWidth', parseFloat(e.target.value))} className="w-12 text-sm font-bold text-slate-700 bg-transparent border-none text-center focus:ring-0 p-1" />
            </div>

            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-1">
              <span className="text-[10px] font-bold text-slate-400 pl-1 uppercase">ความโค้ง</span>
              <input type="number" min="0" max="100" value={activeSym?.height || 20} onChange={(e) => handlePropChange('symbolHeight', 'height', parseInt(e.target.value))} className="w-12 text-sm font-bold text-slate-700 bg-transparent border-none text-center focus:ring-0 p-1" />
            </div>

            <button onClick={() => { removeSymbol(selectedSymbolId); setSelectedSymbolId(null); setToolbarMode('default'); }} className="p-2 ml-4 text-slate-400 hover:text-white hover:bg-rose-500 rounded-lg transition-colors border border-transparent hover:border-rose-600 flex items-center gap-1 text-sm font-bold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> ลบสัญลักษณ์
            </button>
          </div>
        );

      case 'default': 
      default:
        return (
          <div className="flex items-center gap-6 flex-wrap animate-fadeIn w-full">
            
            <div className="flex items-center gap-3 border-r border-slate-200 pr-6">
              <button
                onClick={isPlaying ? stopPlayback : startPlayback}
                className={`flex items-center justify-center gap-2 px-5 py-2 rounded-full font-bold shadow-sm transition-all hover:shadow-md active:scale-95 text-white ${
                  isPlaying ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {isPlaying ? (
                  <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd"/></svg> หยุดเล่น</>
                ) : (
                  <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg> เล่นดนตรี</>
                )}
              </button>

              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">BPM</span>
                <input type="number" min="20" max="300" value={layoutConfig.bpm || 80} onChange={handleBpmChange} onBlur={handleBpmBlur} className="w-14 text-center text-sm font-bold text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 p-0" />
              </div>
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                <input type="range" min="0" max="100" value={layoutConfig.volume !== undefined ? layoutConfig.volume : 100} onChange={handleVolumeChange} className="w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">🎼 เครื่องมือโน้ต</span>
              
              {/* ⭐ กล่องฟอนต์โน้ต ที่ลืมใส่รอบที่แล้วครับ! */}
              <div className="flex items-center gap-2">
                <select
                  value={layoutConfig.noteFontFamily || defaultFontFamily}
                  onChange={(e) => handleLayoutChange('noteFontFamily', e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer w-28 truncate"
                  title="เปลี่ยนฟอนต์ตัวโน้ต"
                >
                  {FONT_OPTIONS.map(font => (
                    <option key={`note-${font.value}`} value={font.value}>{font.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-md overflow-hidden h-[30px]">
                <button onMouseDown={(e) => { e.preventDefault(); handleFontSizeStep(-2); }} className="w-7 h-full text-slate-500 hover:bg-slate-200 font-black">−</button>
                <input type="number" min="10" max="150" value={layoutConfig.fontSize || 30} onChange={handleFontSizeChange} className="w-12 text-center text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 p-0" title="ขนาดตัวโน้ต" />
                <button onMouseDown={(e) => { e.preventDefault(); handleFontSizeStep(2); }} className="w-7 h-full text-slate-500 hover:bg-slate-200 font-black">+</button>
              </div>

              <div className="flex items-center gap-1 bg-slate-50 rounded-md p-0.5 border border-slate-200">
                <button onClick={() => handleLayoutChange('isBold', !layoutConfig.isBold)} className={`w-7 h-7 text-sm rounded ${layoutConfig.isBold ? 'bg-sky-600 text-white font-bold' : 'text-slate-600'}`}>B</button>
                <button onClick={() => handleLayoutChange('isItalic', !layoutConfig.isItalic)} className={`w-7 h-7 text-sm rounded italic ${layoutConfig.isItalic ? 'bg-sky-600 text-white font-bold' : 'text-slate-600'}`}>I</button>
              </div>

              <div className="flex items-center gap-2 ml-2 border-l border-slate-200 pl-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">วาดสัญลักษณ์</span>
                <select value={layoutConfig.activeSymbol || 'sabat'} onChange={(e) => handlePropChange('activeSymbol', 'type', e.target.value)} className="border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer w-28">
                  <option value="sabat">สะบัด/สะเดาะ</option>
                  <option value="kro">กรอ</option>
                </select>
                <input type="color" value={layoutConfig.symbolColor || '#1e293b'} onChange={(e) => handlePropChange('symbolColor', 'color', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent" title="สีสัญลักษณ์" />
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

      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out px-6 ${isCollapsed ? 'h-0 opacity-0 py-0' : 'h-[60px] opacity-100 py-3'}`}
      >
        <div key={toolbarMode} className="h-full flex items-center">
           {renderModeContent()}
        </div>
      </div>

    </div>
  );
};

export default PlaybackControls;