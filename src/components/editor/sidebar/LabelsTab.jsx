import React, { useContext, useRef, useEffect, useState } from 'react';
import { MusicContext } from '../../../contexts/MusicContext';

const FONT_OPTIONS = [
  { value: "'TH Sarabun New', sans-serif", label: 'TH Sarabun New' },
  { value: "'Sarabun', sans-serif", label: 'Sarabun' },
  { value: "'Noto Sans Thai', sans-serif", label: 'Noto Sans Thai' },
  { value: "'Prompt', sans-serif", label: 'Prompt' },
  { value: "'Kanit', sans-serif", label: 'Kanit' },
  { value: "'Mitr', sans-serif", label: 'Mitr' },
  { value: "'Mali', cursive", label: 'Mali' },
];

// ⭐ คอมโพเนนต์กล่องข้อความแบบ "กันเคอร์เซอร์เด้ง" (Bulletproof Editor)
const LabelEditorBox = ({ label, visualIndex, saveSelection, updateSectionLabel }) => {
  const editorRef = useRef(null);

  // กฎเหล็ก: อัปเดตข้อความจากระบบ "เฉพาะ" ตอนที่ผู้ใช้ไม่ได้คลิกอยู่ในกล่องนี้เท่านั้น
  useEffect(() => {
    const el = editorRef.current;
    if (el && document.activeElement !== el) {
      if (el.innerHTML !== (label.text || '')) {
        el.innerHTML = label.text || '';
      }
    }
  }, [label.text]);

  return (
    <div
      id={`label-editor-${label.id}`}
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onMouseUp={() => saveSelection(label.id)}
      onKeyUp={() => saveSelection(label.id)}
      onMouseLeave={() => saveSelection(label.id)}
      onBlur={(e) => {
        saveSelection(label.id);
        // เซฟเข้า Context เมื่อผู้ใช้เลิกพิมพ์และกดคลิกออกไปที่อื่น
        if (e.target.innerHTML !== (label.text || '')) {
          updateSectionLabel(visualIndex, label.id, { text: e.target.innerHTML });
        }
      }}
      className="p-2.5 min-h-[50px] text-sm outline-none bg-white font-sans text-slate-800 leading-normal label-editor-box"
      data-placeholder="พิมพ์ข้อความที่นี่..."
    />
  );
};

const LabelsTab = () => {
  const { 
    selectedCell, sectionLabels, addSectionLabel, 
    updateSectionLabel, removeSectionLabel, rowTypes 
  } = useContext(MusicContext);

  const currentRow = selectedCell ? selectedCell[0] : 0;
  const getVisualRowNumber = (rowIndex) => {
    if (!rowTypes) return 1;
    let count = 0;
    for (let i = 0; i <= rowIndex; i++) {
      if (rowTypes[i] === 'single' || rowTypes[i] === 'double-right') count++;
    }
    return count;
  };
  const visualRowNumber = getVisualRowNumber(currentRow);
  const visualIndex = visualRowNumber > 0 ? visualRowNumber - 1 : 0; 
  const currentLabels = sectionLabels ? (sectionLabels[visualIndex] || []) : [];

  const savedSelections = useRef({});
  const [activeFormats, setActiveFormats] = useState({});

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      
      const node = sel.anchorNode;
      if (!node) return;

      const editor = node.nodeType === 3 
        ? node.parentElement.closest('[id^="label-editor-"]') 
        : (node.closest ? node.closest('[id^="label-editor-"]') : null);
        
      if (editor && document.activeElement === editor) {
        const labelId = editor.id.replace('label-editor-', '');
        savedSelections.current[labelId] = sel.getRangeAt(0).cloneRange();

        const element = node.nodeType === 3 ? node.parentElement : node;
        const computedStyle = window.getComputedStyle(element);
        
        setActiveFormats(prev => ({
          ...prev,
          [labelId]: {
            fontFamily: computedStyle.fontFamily,
            fontSize: parseInt(computedStyle.fontSize, 10) || 16
          }
        }));
      }
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const execFormat = (command, value = null, labelId) => {
    const editor = document.getElementById(`label-editor-${labelId}`);
    if (!editor) return;

    editor.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();

    let rangeToApply = savedSelections.current[labelId];

    if (!rangeToApply || rangeToApply.collapsed) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      sel.addRange(range);
    } else {
      sel.addRange(rangeToApply);
    }

    document.execCommand('styleWithCSS', false, true);
    
    if (command === 'fontSize') {
        document.execCommand('fontSize', false, "7");
        const fonts = editor.querySelectorAll('font[size="7"], span[style*="xxx-large"]');
        fonts.forEach(font => {
            if (font.tagName === 'FONT') font.removeAttribute("size");
            font.style.fontSize = `${value}px`;
            font.style.lineHeight = 'normal';
        });
    } else if (command === 'fontName') {
         document.execCommand("fontName", false, "dummyfont");
         const elements = editor.querySelectorAll('font[face="dummyfont"], span[style*="dummyfont"]');
         elements.forEach(el => {
             if (el.tagName === 'FONT') el.removeAttribute("face");
             el.style.fontFamily = value;
         });
    } else {
        document.execCommand(command, false, value);
    }

    // เซฟการเปลี่ยนแปลงกลับไป
    updateSectionLabel(visualIndex, labelId, { text: editor.innerHTML });

    setActiveFormats(prev => ({
       ...prev,
       [labelId]: {
          ...prev[labelId],
          ...(command === 'fontName' ? { fontFamily: value } : {}),
          ...(command === 'fontSize' ? { fontSize: value } : {})
       }
    }));

    if (sel.rangeCount > 0) {
      savedSelections.current[labelId] = sel.getRangeAt(0).cloneRange();
    }
  };

  const getActiveFontValue = (labelId) => {
    const currentRawFont = activeFormats[labelId]?.fontFamily || "";
    const matched = FONT_OPTIONS.find(f => currentRawFont.includes(f.label));
    return matched ? matched.value : "";
  };

  const saveSelection = (labelId) => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      savedSelections.current[labelId] = sel.getRangeAt(0).cloneRange();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 animate-fadeIn">
      {/* ⭐ เติม CSS ให้ข้อความ Placeholder ทำงานได้สมบูรณ์ */}
      <style>{`
        .label-editor-box:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          display: block;
        }
      `}</style>

      {/* Header */}
      <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center shrink-0 shadow-sm">
        <h3 className="text-xs font-black text-indigo-800 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
          จัดการป้ายกำกับ
        </h3>
        <span className="text-[10px] font-bold text-indigo-500 bg-white px-2 py-1 rounded border border-indigo-200">
          บรรทัด {visualRowNumber}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-4">
        <button 
          onClick={() => addSectionLabel(visualIndex)} 
          className="w-full mb-1 py-2.5 text-[11px] font-bold text-white bg-indigo-500 border border-indigo-600 rounded-lg hover:bg-indigo-600 transition-all shadow-sm flex items-center justify-center gap-1 active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          สร้างป้ายกำกับใหม่
        </button>

        {currentLabels.map((label) => {
          const currentSize = activeFormats[label.id]?.fontSize || label.fontSize || 18;
          
          return (
            <div key={label.id} className="bg-white rounded-xl border border-slate-200 shadow-sm relative group overflow-hidden">
              
              <button 
                onClick={() => removeSectionLabel(visualIndex, label.id)} 
                className="absolute top-1.5 right-1.5 bg-white border border-slate-200 text-rose-500 hover:bg-rose-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm"
                title="ลบป้ายกำกับ"
              >✕</button>
              
              <div className="bg-slate-50 border-b border-slate-200 p-2 pb-0">
                <span className="text-[10px] font-bold text-slate-500 mb-2 block">1. แก้ไขและตกแต่งข้อความ <span className="font-normal text-slate-400">(คลุมดำเพื่อเน้นคำ)</span></span>
                
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-inner mb-3">
                  
                  {/* แถบเครื่องมือ UI */}
                  <div className="bg-slate-100/80 border-b border-slate-200 p-1.5 flex flex-col gap-1.5">
                    
                    <div className="relative bg-white border border-slate-300 rounded shadow-sm hover:border-indigo-400 transition-colors">
                      <select 
                        value={getActiveFontValue(label.id)}
                        onChange={e => execFormat('fontName', e.target.value, label.id)}
                        className="w-full text-[11px] font-semibold bg-transparent px-2 py-1.5 outline-none cursor-pointer appearance-none text-slate-700"
                      >
                        <option value="" disabled>เลือกฟอนต์...</option>
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex bg-white border border-slate-300 rounded overflow-hidden shadow-sm shrink-0">
                        <button 
                          onMouseDown={e => { e.preventDefault(); execFormat('fontSize', Math.max(10, currentSize - 2), label.id); }} 
                          className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >−</button>
                        <div className="w-9 h-7 flex items-center justify-center text-[11px] font-bold text-slate-700 border-x border-slate-200">
                          {currentSize}
                        </div>
                        <button 
                          onMouseDown={e => { e.preventDefault(); execFormat('fontSize', Math.min(100, currentSize + 2), label.id); }} 
                          className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >+</button>
                      </div>
                      
                      <div className="flex bg-white border border-slate-300 rounded overflow-hidden shadow-sm shrink-0">
                        <button onMouseDown={e => { e.preventDefault(); execFormat('bold', null, label.id); }} className="w-7 h-7 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 border-r border-slate-200 transition-colors" title="ตัวหนา">B</button>
                        <button onMouseDown={e => { e.preventDefault(); execFormat('italic', null, label.id); }} className="w-7 h-7 flex items-center justify-center italic font-serif text-slate-700 hover:bg-slate-100 border-r border-slate-200 transition-colors" title="ตัวเอียง">I</button>
                        <button 
                          onMouseDown={e => { e.preventDefault(); execFormat('underline', null, label.id); }} 
                          className="w-7 h-7 flex items-center justify-center underline font-serif text-slate-700 hover:bg-slate-100 border-r border-slate-200 transition-colors" 
                          title="ขีดเส้นใต้"
                        >U</button>
                        <div className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 relative cursor-pointer transition-colors" title="สีตัวอักษร">
                          <input type="color" onInput={e => execFormat('foreColor', e.target.value, label.id)} className="w-4 h-4 p-0 border-0 rounded cursor-pointer bg-transparent" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* ⭐ ใช้คอมโพเนนต์กันเคอร์เซอร์เด้ง */}
                  <LabelEditorBox 
                    label={label} 
                    visualIndex={visualIndex} 
                    saveSelection={saveSelection} 
                    updateSectionLabel={updateSectionLabel} 
                  />
                </div>
              </div>

              {/* 📏 หมวดการจัดวาง */}
              <div className="p-3 bg-white">
                <span className="text-[10px] font-bold text-slate-500 mb-3 block">2. การจัดวางป้ายกำกับ (ทั้งกล่อง)</span>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-600">ขยับตำแหน่งแนวตั้ง</span>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{label.offsetY !== undefined ? label.offsetY : 6} px</span>
                  </div>
                  <input 
                    type="range" min="-50" max="100" 
                    value={label.offsetY !== undefined ? label.offsetY : 6} 
                    onChange={(e) => updateSectionLabel(visualIndex, label.id, { offsetY: parseInt(e.target.value) })} 
                    className="w-full h-1.5 bg-slate-200 rounded-lg accent-indigo-500 cursor-pointer" 
                  />
                </div>

                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <label className="text-[10px] font-bold text-slate-500 block mb-2 text-center">ชิดมุมกระดาษ</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'top-left', name: 'บนซ้าย' }, { id: 'top-center', name: 'บนกลาง' }, { id: 'top-right', name: 'บนขวา' },
                      { id: 'bottom-left', name: 'ล่างซ้าย' }, { id: 'bottom-center', name: 'ล่างกลาง' }, { id: 'bottom-right', name: 'ล่างขวา' }
                    ].map((pos) => (
                      <button 
                        key={pos.id}
                        onClick={() => updateSectionLabel(visualIndex, label.id, { position: pos.id })} 
                        className={`py-1.5 text-[10px] rounded-md transition-all border shadow-sm ${label.position === pos.id ? 'bg-indigo-100 text-indigo-700 font-black border-indigo-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                      >
                        {pos.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
        
        {currentLabels.length === 0 && (
          <div className="text-center py-10 flex flex-col items-center border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
            <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            <span className="text-[11px] font-bold text-slate-400">ยังไม่มีป้ายกำกับ</span>
            <span className="text-[10px] text-slate-400 mt-1">กดปุ่มสีม่วงด้านบนเพื่อสร้าง</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabelsTab;