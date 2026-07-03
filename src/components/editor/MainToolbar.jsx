import React, { useContext, useState, useRef, useEffect } from 'react';
import { MusicContext } from '../../contexts/MusicContext';

const MainToolbar = () => {
  const { rowTypes, selectedCell, selectionRange, layoutConfig, setLayoutConfig, sheetData, rowMargins, updateRowMarginsList } = useContext(MusicContext);
  
  const [textFontSize, setTextFontSize] = useState(16); 
  const savedSelection = useRef(null);
  
  const [showPageSetup, setShowPageSetup] = useState(false);
  const [showRowSetup, setShowRowSetup] = useState(false); // ⭐ State สำหรับเปิด/ปิด หน้าต่างจัดระยะบรรทัด

  const isTextRow = rowTypes && rowTypes[selectedCell[0]] === 'text';

  // คำนวณหาขอบเขตที่ผู้ใช้คลุมดำอยู่ (เพื่อนำไปปรับ Margin พร้อมกัน)
  let minR = selectedCell[0];
  let maxR = selectedCell[0];
  if (selectionRange && selectionRange.start && selectionRange.end) {
      minR = Math.min(selectionRange.start[0], selectionRange.end[0]);
      maxR = Math.max(selectionRange.start[0], selectionRange.end[0]);
  }
  // ดึงค่าของบรรทัดแรกสุดที่โดนคลุมมาโชว์เป็นค่าเริ่มต้นในกล่อง
  const currentRowMargin = rowMargins[minR] || { top: 0, bottom: 0, left: 0 };

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
    setLayoutConfig({ ...layoutConfig, textFontSize: val });
    setTextFontSize(val); 
    
    const selection = window.getSelection();
    if (savedSelection.current) {
      selection.removeAllRanges();
      selection.addRange(savedSelection.current);
    }

    document.execCommand("fontSize", false, "7");
    const fonts = document.querySelectorAll('font[size="7"]');
    fonts.forEach(font => {
      font.removeAttribute("size");
      font.style.fontSize = `${val}px`;
    });

    if (selection.rangeCount > 0) {
      savedSelection.current = selection.getRangeAt(0).cloneRange();
    }

    syncFormatToState(); 
  };

  const formatText = (command, value = null) => {
    if (isTextRow) {
      if (savedSelection.current) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedSelection.current);
      }
      document.execCommand(command, false, value);
      
      if (savedSelection.current) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          savedSelection.current = selection.getRangeAt(0).cloneRange();
        }
      }

      syncFormatToState(); 
    } else {
      if (command === 'bold') setLayoutConfig({ ...layoutConfig, isBold: !layoutConfig.isBold });
      if (command === 'italic') setLayoutConfig({ ...layoutConfig, isItalic: !layoutConfig.isItalic });
    }
  };

  const handleFontSizeChange = (e) => {
    const val = parseInt(e.target.value);
    if (isNaN(val)) return;
    if (isTextRow) applyTextFontSize(val);
    else setLayoutConfig({ ...layoutConfig, fontSize: val });
  };

  const handleFontSizeStep = (step) => {
    if (isTextRow) {
      const newVal = (layoutConfig.textFontSize || 16) + step;
      if (newVal >= 10 && newVal <= 150) applyTextFontSize(newVal);
    } else {
      const newVal = (layoutConfig.fontSize || 30) + step;
      if (newVal >= 10 && newVal <= 150) setLayoutConfig({ ...layoutConfig, fontSize: newVal });
    }
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

  return (
    <div className="w-full bg-white border-b border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.03)] px-6 py-2 flex items-center gap-6 z-40 shrink-0">
      
      <div className="flex items-center gap-2 border-r border-slate-200 pr-6">
        <select 
          onChange={(e) => formatText('fontName', e.target.value)}
          className={`border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 ${!isTextRow && 'opacity-50 cursor-not-allowed'}`}
          disabled={!isTextRow}
          title="เปลี่ยนแบบอักษร (เฉพาะบรรทัดข้อความ)"
        >
          <option value="'TH Sarabun New', sans-serif">Sarabun (มาตรฐาน)</option>
          <option value="'Kanit', sans-serif">Kanit (คณิต)</option>
          <option value="'Prompt', sans-serif">Prompt (พร้อม)</option>
          <option value="'Mitr', sans-serif">Mitr (มิตร)</option>
          <option value="'Mali', cursive">Mali (มะลิ)</option>
        </select>
        
        <div className="flex items-center bg-slate-50 border border-slate-300 rounded-md overflow-hidden h-[30px]">
          <button 
            onMouseDown={(e) => { e.preventDefault(); handleFontSizeStep(-2); }}
            className="w-7 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-sky-600 font-black cursor-pointer select-none"
            title="ลดขนาด"
          >-</button>
          <input 
            type="number" min="10" max="150" 
            value={isTextRow ? (layoutConfig.textFontSize || 16) : (layoutConfig.fontSize || 30)} 
            onChange={handleFontSizeChange}
            className="w-12 text-center text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 p-0"
          />
          <button 
            onMouseDown={(e) => { e.preventDefault(); handleFontSizeStep(2); }}
            className="w-7 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-sky-600 font-black cursor-pointer select-none"
            title="เพิ่มขนาด"
          >+</button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-r border-slate-200 pr-6">
        <button onMouseDown={(e) => { e.preventDefault(); formatText('bold'); }} className={`w-8 h-8 flex items-center justify-center font-bold rounded transition-colors ${layoutConfig.isBold && !isTextRow ? 'bg-slate-200 text-sky-700' : 'text-slate-700 hover:bg-slate-100'}`} title="ตัวหนา">B</button>
        <button onMouseDown={(e) => { e.preventDefault(); formatText('italic'); }} className={`w-8 h-8 flex items-center justify-center italic font-serif rounded transition-colors ${layoutConfig.isItalic && !isTextRow ? 'bg-slate-200 text-sky-700' : 'text-slate-700 hover:bg-slate-100'}`} title="ตัวเอียง">I</button>
        <button onMouseDown={(e) => { e.preventDefault(); formatText('underline'); }} className={`w-8 h-8 flex items-center justify-center underline rounded transition-colors ${!isTextRow ? 'opacity-30 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'}`} disabled={!isTextRow} title="ขีดเส้นใต้">U</button>
      </div>

      <div className="flex items-center gap-1 border-r border-slate-200 pr-6">
        <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyLeft'); }} className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${!isTextRow ? 'opacity-30 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'}`} disabled={!isTextRow} title="ชิดซ้าย">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg>
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyCenter'); }} className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${!isTextRow ? 'opacity-30 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'}`} disabled={!isTextRow} title="กึ่งกลาง">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" /></svg>
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); formatText('justifyRight'); }} className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${!isTextRow ? 'opacity-30 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'}`} disabled={!isTextRow} title="ชิดขวา">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" /></svg>
        </button>
      </div>

      <div className="flex items-center gap-2 border-r border-slate-200 pr-6">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Color</span>
        <input 
          type="color" 
          onChange={(e) => formatText('foreColor', e.target.value)}
          className={`w-7 h-7 rounded cursor-pointer border-none p-0 bg-transparent ${!isTextRow && 'opacity-50 cursor-not-allowed'}`}
          title="จิ้มเพื่อเลือกสีข้อความ"
          disabled={!isTextRow}
        />
        
        <select
          value={layoutConfig.textLineHeight || 1.5}
          onChange={(e) => setLayoutConfig({ ...layoutConfig, textLineHeight: parseFloat(e.target.value) })}
          className={`ml-2 border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-sky-400 ${!isTextRow && 'opacity-50 cursor-not-allowed'}`}
          disabled={!isTextRow}
          title="ระยะห่างบรรทัด (เฉพาะข้อความ)"
        >
          <option value="0.8">ห่าง 0.8 (ชิดมาก)</option>
          <option value="1">ห่าง 1.0 (แคบ)</option>
          <option value="1.2">ห่าง 1.2</option>
          <option value="1.5">ห่าง 1.5 (มาตรฐาน)</option>
          <option value="2">ห่าง 2.0 (กว้าง)</option>
        </select>
      </div>

      <div className="relative flex items-center ml-auto gap-3">
        
        {/* ⭐ ปุ่มใหม่: จัดระยะบรรทัด (รายบรรทัด/กลุ่มบรรทัด) */}
        <div className="relative">
          <button
            onClick={() => { setShowRowSetup(!showRowSetup); setShowPageSetup(false); }}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-sm font-bold rounded-md transition-colors flex items-center gap-2"
          >
            ↕️ จัดระยะบรรทัด
          </button>

          {showRowSetup && (
            <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl p-4 w-72 z-50 flex flex-col gap-3">
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

        {/* ปุ่มตั้งค่าหน้ากระดาษ (รวมศูนย์) */}
        <div className="relative">
          <button
            onClick={() => { setShowPageSetup(!showPageSetup); setShowRowSetup(false); }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-md transition-colors flex items-center gap-2"
          >
            📄 ตั้งค่าหน้ากระดาษ
          </button>

          {showPageSetup && (
            <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl p-4 w-72 z-50 flex flex-col gap-3">
              
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

    </div>
  );
};

export default MainToolbar;