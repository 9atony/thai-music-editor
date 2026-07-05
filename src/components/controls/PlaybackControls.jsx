import React, { useContext, useState, useRef, useEffect } from 'react';
import { MusicContext } from '../../contexts/MusicContext';

// ─── รายการฟอนต์รวม (ใช้ทั้งระบบ) ───
const FONT_OPTIONS = [
  { value: "'TH Sarabun New', sans-serif", label: 'TH Sarabun New' },
  { value: "'Sarabun', sans-serif", label: 'Sarabun' },
  { value: "'Noto Sans Thai', sans-serif", label: 'Noto Sans Thai' },
  { value: "'Prompt', sans-serif", label: 'Prompt' },
  { value: "'Kanit', sans-serif", label: 'Kanit' },
  { value: "'Mitr', sans-serif", label: 'Mitr' },
  { value: "'Mali', cursive", label: 'Mali' },
];

const TabIcon = ({ name }) => {
  const icons = {
    play: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>,
    edit: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    note: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>,
    settings: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  };
  return icons[name] || null;
};

const PlaybackControls = () => {
  const {
    rowTypes, selectedCell, selectionRange, layoutConfig, setLayoutConfig, sheetData, rowMargins, updateRowMarginsList,
    isPlaying, startPlayback, stopPlayback,
    symbols, selectedSymbolId, setSelectedSymbolId, updateSymbol, removeSymbol, removeSymbolByCell,
  } = useContext(MusicContext);

  const [activeTab, setActiveTab] = useState('play');
  const [textFontSize, setTextFontSize] = useState(16); // ตัวเก็บขนาดฟอนต์ ณ ตำแหน่งที่เคอร์เซอร์อยู่
  const savedSelection = useRef(null);
  const [showPageSetup, setShowPageSetup] = useState(false);
  const [showRowSetup, setShowRowSetup] = useState(false);

  const isTextRow = rowTypes && rowTypes[selectedCell[0]] === 'text';

  let minR = selectedCell[0];
  let maxR = selectedCell[0];
  if (selectionRange && selectionRange.start && selectionRange.end) {
      minR = Math.min(selectionRange.start[0], selectionRange.end[0]);
      maxR = Math.max(selectionRange.start[0], selectionRange.end[0]);
  }
  const currentRowMargin = rowMargins[minR] || { top: 0, bottom: 0, left: 0 };
  const activeSym = symbols.find(s => s.id === selectedSymbolId);
  const isEditingMode = !!activeSym;

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

  // ดักจับว่าคลิกที่คำไหน ให้เอาขนาดฟอนต์ของคำนั้นมาโชว์ในกล่อง Input
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
              setTextFontSize(sizeInt); // อัปเดตช่อง Input ให้ตรงกับของจริง
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

  // ⭐ เปลี่ยนขนาดฟอนต์ (แยกจัดการระหว่างคลุมดำ กับ วางเคอร์เซอร์เฉยๆ)
  const applyTextFontSize = (val) => {
    setTextFontSize(val); // เปลี่ยนเลขที่โชว์ใน Input ทันที

    if (!isTextRow || !savedSelection.current) return;

    const rIndex = selectedCell[0];
    const editor = document.getElementById(`text-row-${rIndex}`);
    const selection = window.getSelection();

    // ดึงการคลุมดำกลับมาให้พร้อม
    if (selection.rangeCount === 0) {
       selection.addRange(savedSelection.current);
    }

    const isSelectingText = !selection.isCollapsed;

    if (!isSelectingText) {
      // 1. ถ้าแค่กระพริบเคอร์เซอร์เฉยๆ (ไม่ได้คลุมดำ) ให้เปลี่ยนขนาดของทั้งบรรทัด
      setLayoutConfig({ ...layoutConfig, textFontSize: val });
    } else {
      // 2. ถ้าคลุมดำไว้ เปลี่ยนเฉพาะคำนั้น (ห้ามแก้ layoutConfig ไม่งั้นเด้ง!)
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

    // บังคับยิง Focus กลับไปที่กระดาษเพื่อให้คลุมดำไม่หลุด
    if (editor) editor.focus();
    
    // อัปเดตหน่วยความจำคลุมดำล่าสุด (บราวเซอร์มันจะรวบให้เองหลัง execCommand)
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
    } else {
      if (command === 'bold') setLayoutConfig({ ...layoutConfig, isBold: !layoutConfig.isBold });
      if (command === 'italic') setLayoutConfig({ ...layoutConfig, isItalic: !layoutConfig.isItalic });
    }
  };

  // ⭐ แก้อาการกด + หรือ - รัวๆ แล้วเด้ง (ใช้ textFontSize แทน)
  const handleFontSizeStep = (step) => {
    if (isTextRow) {
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
    if (isTextRow) applyTextFontSize(val);
    else setLayoutConfig({ ...layoutConfig, fontSize: val });
  };

  const handleUnitChange = (e) => {
    const newUnit = e.target.value;
    const oldUnit = layoutConfig.marginUnit || 'px';
    if (oldUnit === newUnit) return;
    const convert = (val) => {
      const px = oldUnit === 'cm' ? val * 37.795275 : (oldUnit === 'in' ? val * 96 : val);
      const res = newUnit === 'cm' ? px / 37.795275 : (newUnit === 'in' ? px / 96 : px);
      return Math.round(res * 100) / 100;
    };
    setLayoutConfig({
      ...layoutConfig,
      marginUnit: newUnit,
      marginTop: convert(layoutConfig.marginTop ?? 48),
      marginBottom: convert(layoutConfig.marginBottom ?? 48),
      marginLeft: convert(layoutConfig.marginLeft ?? 48),
      marginRight: convert(layoutConfig.marginRight ?? 48),
    });
  };

  const defaultFontFamily = layoutConfig.fontFamily || "'TH Sarabun New', sans-serif";

  return (
    <div className="playback-controls-container w-full bg-white border-b border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.03)] z-40 shrink-0">

      {/* ═══ แถบแท็บ ═══ */}
      <div className="flex items-center gap-1 px-4 pt-2 border-b border-slate-100">
        {[
          { id: 'play', label: '🎵 เล่นเพลง' },
          { id: 'edit', label: '✏️ แก้ไขข้อความ' },
          { id: 'note', label: '🎼 ตกแต่งโน้ต' },
          { id: 'settings', label: '⚙️ ตั้งค่ากระดาษ' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-sky-50 text-sky-700 border-t border-l border-r border-slate-200 -mb-px'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ เนื้อหาแท็บ ═══ */}
      <div className="px-6 py-3">

        {/* แท็บ 1: 🎵 เล่นเพลง */}
        {activeTab === 'play' && (
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
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
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">BPM</span>
              <input
                type="number" min="20" max="300"
                value={layoutConfig.bpm !== undefined ? layoutConfig.bpm : 80}
                onChange={handleBpmChange}
                onBlur={handleBpmBlur}
                className="w-14 text-center text-sm font-bold text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                title="ความเร็วของจังหวะ"
              />
            </div>

            <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <input
                type="range" min="0" max="100"
                value={layoutConfig.volume !== undefined ? layoutConfig.volume : 100}
                onChange={handleVolumeChange}
                className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                title="ระดับเสียง"
              />
            </div>

            {isPlaying && (
              <div className="flex items-center gap-2 text-emerald-600">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-extrabold tracking-wide">กำลังเล่น...</span>
              </div>
            )}
          </div>
        )}

        {/* แท็บ 2: ✏️ แก้ไขข้อความ */}
        {activeTab === 'edit' && (
          <div className="flex items-center gap-4 flex-wrap">
            {!isTextRow && (
              <div className="text-xs text-slate-400 italic flex items-center gap-2 py-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ใช้งานได้เฉพาะเมื่อเลือกบรรทัดข้อความ (คลิกที่บรรทัดข้อความก่อน)
              </div>
            )}

            <div className={`flex items-center gap-2 ${!isTextRow && 'opacity-40 pointer-events-none'}`}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ฟอนต์</span>
              <select
                onChange={(e) => formatText('fontName', e.target.value)}
                className="border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer"
                title="เปลี่ยนแบบอักษร (เฉพาะบรรทัดข้อความ)"
              >
                {FONT_OPTIONS.map(font => (
                  <option key={`edit-${font.value}`} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>

            <div className={`flex items-center bg-slate-50 border border-slate-300 rounded-md overflow-hidden h-[30px] ${!isTextRow && 'opacity-40 pointer-events-none'}`}>
              <button
                onMouseDown={(e) => { e.preventDefault(); handleFontSizeStep(-2); }}
                className="w-7 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-sky-600 font-black cursor-pointer select-none"
                title="ลดขนาด"
              >−</button>
              
              {/* ⭐ เปลี่ยน value ให้สะท้อนค่าที่เคอร์เซอร์จิ้มอยู่จริง (textFontSize) แทนค่าของบรรทัด */}
              <input
                type="number" min="10" max="150"
                value={isTextRow ? textFontSize : (layoutConfig.fontSize || 30)}
                onChange={handleFontSizeChange}
                className="w-12 text-center text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 p-0"
              />
              
              <button
                onMouseDown={(e) => { e.preventDefault(); handleFontSizeStep(2); }}
                className="w-7 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-sky-600 font-black cursor-pointer select-none"
                title="เพิ่มขนาด"
              >+</button>
            </div>

            <div className={`flex items-center gap-1 ${!isTextRow && 'opacity-40 pointer-events-none'}`}>
              <button onMouseDown={(e) => { e.preventDefault(); formatText('bold'); }} className="w-8 h-8 flex items-center justify-center font-bold rounded transition-colors text-slate-700 hover:bg-slate-100" title="ตัวหนา">B</button>
              <button onMouseDown={(e) => { e.preventDefault(); formatText('italic'); }} className="w-8 h-8 flex items-center justify-center italic font-serif rounded transition-colors text-slate-700 hover:bg-slate-100" title="ตัวเอียง">I</button>
              <button onMouseDown={(e) => { e.preventDefault(); formatText('underline'); }} className="w-8 h-8 flex items-center justify-center underline rounded transition-colors text-slate-700 hover:bg-slate-100" title="ขีดเส้นใต้">U</button>
            </div>

            <div className={`flex items-center gap-1 ${!isTextRow && 'opacity-40 pointer-events-none'}`}>
              <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyLeft'); }} className="w-8 h-8 flex items-center justify-center rounded transition-colors text-slate-700 hover:bg-slate-100" title="ชิดซ้าย">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg>
              </button>
              <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyCenter'); }} className="w-8 h-8 flex items-center justify-center rounded transition-colors text-slate-700 hover:bg-slate-100" title="กึ่งกลาง">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" /></svg>
              </button>
              <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyRight'); }} className="w-8 h-8 flex items-center justify-center rounded transition-colors text-slate-700 hover:bg-slate-100" title="ชิดขวา">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" /></svg>
              </button>
            </div>

            <div className={`flex items-center gap-2 ${!isTextRow && 'opacity-40 pointer-events-none'}`}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">สี</span>
              <input
                type="color"
                onChange={(e) => formatText('foreColor', e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-none p-0 bg-transparent"
                title="จิ้มเพื่อเลือกสีข้อความ"
              />
            </div>

            <div className={`flex items-center gap-2 ${!isTextRow && 'opacity-40 pointer-events-none'}`}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ระยะบรรทัด</span>
              <select
                value={layoutConfig.textLineHeight || 1.5}
                onChange={(e) => setLayoutConfig({ ...layoutConfig, textLineHeight: parseFloat(e.target.value) })}
                className="border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer"
                title="ระยะห่างบรรทัด (เฉพาะข้อความ)"
              >
                <option value="0.8">0.8 (ชิดมาก)</option>
                <option value="1">1.0 (แคบ)</option>
                <option value="1.2">1.2</option>
                <option value="1.5">1.5 (มาตรฐาน)</option>
                <option value="2">2.0 (กว้าง)</option>
              </select>
            </div>
          </div>
        )}

        {/* แท็บ 3: 🎼 ตกแต่งโน้ต */}
        {activeTab === 'note' && (
          <div className="flex items-center gap-4 flex-wrap">
            {isEditingMode && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span className="text-xs font-extrabold text-amber-600 tracking-wide">กำลังแก้ไขสัญลักษณ์</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ฟอนต์โน้ต</span>
              <select
                value={layoutConfig.noteFontFamily || defaultFontFamily}
                onChange={(e) => handleLayoutChange('noteFontFamily', e.target.value)}
                className="border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer"
              >
                {FONT_OPTIONS.map(font => (
                  <option key={`note-${font.value}`} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-slate-50 border border-slate-300 rounded-md overflow-hidden h-[30px]">
              <button
                onMouseDown={(e) => { e.preventDefault(); handleFontSizeStep(-2); }}
                className="w-7 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-sky-600 font-black cursor-pointer select-none"
                title="ลดขนาด"
              >−</button>
              <input
                type="number" min="10" max="150"
                value={layoutConfig.fontSize || 30}
                onChange={(e) => setLayoutConfig({ ...layoutConfig, fontSize: parseInt(e.target.value) })}
                className="w-12 text-center text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 p-0"
              />
              <button
                onMouseDown={(e) => { e.preventDefault(); handleFontSizeStep(2); }}
                className="w-7 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-sky-600 font-black cursor-pointer select-none"
                title="เพิ่มขนาด"
              >+</button>
            </div>

            <div className="flex items-center gap-1 bg-slate-50 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => handleLayoutChange('isBold', !layoutConfig.isBold)}
                className={`px-2.5 py-1 text-sm rounded transition-colors ${layoutConfig.isBold ? 'bg-sky-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:border-sky-300'}`}
                title="ตัวหนา"
              >B</button>
              <button
                type="button"
                onClick={() => handleLayoutChange('isItalic', !layoutConfig.isItalic)}
                className={`px-2.5 py-1 text-sm italic rounded transition-colors ${layoutConfig.isItalic ? 'bg-sky-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:border-sky-300'}`}
                title="ตัวเอียง"
              >I</button>
            </div>

            <div className="w-[1px] h-7 bg-slate-200"></div>

            {!isEditingMode && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">สัญลักษณ์</span>
                <select
                  value={layoutConfig.activeSymbol || 'sabat'}
                  onChange={(e) => handlePropChange('activeSymbol', 'type', e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer"
                >
                  <option value="sabat">สะบัด/สะเดาะ</option>
                  <option value="kro">กรอ</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">สีสัญลักษณ์</span>
              <input
                type="color"
                value={isEditingMode ? activeSym.color : (layoutConfig.symbolColor || '#1e293b')}
                onChange={(e) => handlePropChange('symbolColor', 'color', e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-none p-0 bg-transparent"
                title="เลือกสีสัญลักษณ์"
              />
            </div>

            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md overflow-hidden px-1" title="ความหนา">
              <span className="text-[10px] font-bold text-slate-400 pl-1 uppercase">หนา</span>
              <input
                type="number" min="1" max="10" step="0.5"
                value={isEditingMode ? activeSym.strokeWidth : (layoutConfig.symbolStrokeWidth || 2.5)}
                onChange={(e) => handlePropChange('strokeWidth', 'strokeWidth', parseFloat(e.target.value))}
                className="w-10 text-xs font-bold text-slate-700 bg-transparent border-none text-center focus:ring-0 p-1"
              />
            </div>

            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md overflow-hidden px-1" title="ความโค้ง">
              <span className="text-[10px] font-bold text-slate-400 pl-1 uppercase">โค้ง</span>
              <input
                type="number" min="0" max="100"
                value={isEditingMode ? activeSym.height : (layoutConfig.symbolHeight !== undefined ? layoutConfig.symbolHeight : 20)}
                onChange={(e) => handlePropChange('symbolHeight', 'height', parseInt(e.target.value))}
                className="w-10 text-xs font-bold text-slate-700 bg-transparent border-none text-center focus:ring-0 p-1"
              />
            </div>

            <button
              onClick={() => {
                if (isEditingMode) {
                  removeSymbol(selectedSymbolId);
                  setSelectedSymbolId(null);
                } else {
                  removeSymbolByCell(selectedCell);
                }
              }}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              title="ลบสัญลักษณ์"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        )}

        {/* แท็บ 4: ⚙️ ตั้งค่ากระดาษ */}
        {activeTab === 'settings' && (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ฟอนต์หัวกระดาษ</span>
              <select
                value={layoutConfig.pageFontFamily || layoutConfig.textFontFamily || defaultFontFamily}
                onChange={(e) => handleLayoutChange('pageFontFamily', e.target.value)}
                className="border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer"
              >
                {FONT_OPTIONS.map(font => (
                  <option key={`page-${font.value}`} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ฟอนต์ข้อความ</span>
              <select
                value={layoutConfig.textFontFamily || defaultFontFamily}
                onChange={(e) => handleLayoutChange('textFontFamily', e.target.value)}
                className="border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer"
              >
                {FONT_OPTIONS.map(font => (
                  <option key={`text-${font.value}`} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>

            <div className="w-[1px] h-7 bg-slate-200"></div>

            <div className="relative">
              <button
                onClick={() => { setShowRowSetup(!showRowSetup); setShowPageSetup(false); }}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-sm font-bold rounded-md transition-colors flex items-center gap-2"
              >
                ↕️ จัดระยะบรรทัด
              </button>

              {showRowSetup && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl p-4 w-72 z-50 flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-slate-800 text-sm">ระยะห่าง (เฉพาะที่คลุมดำ)</h3>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">หน่วย: px</span>
                  </div>
                  <p className="text-xs text-slate-500 italic leading-tight mb-1">
                    *ใส่ 0 เพื่อให้แนบชิด หรือใส่ค่าติดลบ (-10) เพื่อให้เกยทับขอบเขตเดิมได้
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold">ดันด้านบน (Top)</label>
                      <input
                        type="number"
                        value={currentRowMargin.top}
                        onChange={(e) => updateRowMarginsList(minR, maxR, { top: parseInt(e.target.value) || 0 })}
                        className="w-full border rounded p-1 text-sm text-center focus:ring-2 focus:ring-amber-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold">ดันด้านล่าง (Bottom)</label>
                      <input
                        type="number"
                        value={currentRowMargin.bottom}
                        onChange={(e) => updateRowMarginsList(minR, maxR, { bottom: parseInt(e.target.value) || 0 })}
                        className="w-full border rounded p-1 text-sm text-center focus:ring-2 focus:ring-amber-200 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-1">
                    <label className="text-[11px] text-slate-500 font-bold">ย่อหน้าซ้าย (Indent Left)</label>
                    <input
                      type="number"
                      value={currentRowMargin.left}
                      onChange={(e) => updateRowMarginsList(minR, maxR, { left: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded p-1 text-sm focus:ring-2 focus:ring-amber-200 focus:outline-none"
                    />
                  </div>
                  <button onClick={() => setShowRowSetup(false)} className="mt-2 w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-1.5 rounded transition-colors">
                    เสร็จสิ้น
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setShowPageSetup(!showPageSetup); setShowRowSetup(false); }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-md transition-colors flex items-center gap-2"
              >
                📄 ตั้งค่าหน้ากระดาษ
              </button>

              {showPageSetup && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl p-4 w-72 z-50 flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-slate-800 text-sm">ระยะขอบรวม</h3>
                    <select
                      value={layoutConfig.marginUnit || 'px'}
                      onChange={handleUnitChange}
                      className="text-xs border rounded bg-slate-50 py-0.5 px-1 font-bold text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-400"
                    >
                      <option value="px">Pixel (px)</option>
                      <option value="cm">Centimeter (cm)</option>
                      <option value="in">Inch (in)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold">ขอบบน</label>
                      <input type="number" step="0.1" value={layoutConfig.marginTop ?? 48} onChange={(e) => setLayoutConfig({...layoutConfig, marginTop: parseFloat(e.target.value) || 0})} className="w-full border rounded p-1 text-sm text-center focus:ring-2 focus:ring-sky-200 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold">ขอบล่าง</label>
                      <input type="number" step="0.1" value={layoutConfig.marginBottom ?? 48} onChange={(e) => setLayoutConfig({...layoutConfig, marginBottom: parseFloat(e.target.value) || 0})} className="w-full border rounded p-1 text-sm text-center focus:ring-2 focus:ring-sky-200 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold">ขอบซ้าย</label>
                      <input type="number" step="0.1" value={layoutConfig.marginLeft ?? 48} onChange={(e) => setLayoutConfig({...layoutConfig, marginLeft: parseFloat(e.target.value) || 0})} className="w-full border rounded p-1 text-sm text-center focus:ring-2 focus:ring-sky-200 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold">ขอบขวา</label>
                      <input type="number" step="0.1" value={layoutConfig.marginRight ?? 48} onChange={(e) => setLayoutConfig({...layoutConfig, marginRight: parseFloat(e.target.value) || 0})} className="w-full border rounded p-1 text-sm text-center focus:ring-2 focus:ring-sky-200 focus:outline-none" />
                    </div>
                  </div>
                  <button onClick={() => setShowPageSetup(false)} className="mt-2 w-full bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold py-1.5 rounded transition-colors">
                    ตกลง
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PlaybackControls;