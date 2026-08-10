import React, { useContext, useState, useMemo, useEffect } from 'react';
import { MusicContext } from '../../../contexts/MusicContext';

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

const normalizeToken = (token) => {
  if (typeof token !== 'string') return token && token !== '-' ? String(token) : '-';
  const compact = token.replace(/\s+/g, '').trim();
  return compact === '' ? '-' : compact;
};

const splitThaiNoteToken = (token) => {
  const normalized = normalizeToken(token);
  if (!normalized || normalized === '-') return [];
  const THAI_NOTE_COMBINER_PATTERN = /[ั-๎​]/;
  return Array.from(normalized).reduce((parts, char) => {
    if (char === '-' || char.trim() === '') return parts;
    if (THAI_NOTE_COMBINER_PATTERN.test(char) && parts.length > 0) {
      parts[parts.length - 1] += char;
    } else {
      parts.push(char);
    }
    return parts;
  }, []);
};

const VelocityTab = () => {
  const { sheetData, rowTypes, selectionRange, selectedCell, layoutConfig, setLayoutConfig } = useContext(MusicContext);

  const [downbeatMode, setDownbeatMode] = useState('2');
  const [accentVol, setAccentVol] = useState(100);
  const [ghostVol, setGhostVol] = useState(50);
  const [activeCells, setActiveCells] = useState([]);
  
  const [flatVol, setFlatVol] = useState(100);

  const selectionLimits = useMemo(() => {
    if (selectionRange && selectionRange.start && selectionRange.end) {
      const sr = selectionRange.start[0], sm = selectionRange.start[1], sc = selectionRange.start[2];
      const er = selectionRange.end[0], em = selectionRange.end[1], ec = selectionRange.end[2];
      const minR = Math.min(sr, er), maxR = Math.max(sr, er);
      const startCol = getFlattenedCol(sheetData[sr], rowTypes[sr], sm, sc);
      const endCol = getFlattenedCol(sheetData[er], rowTypes[er], em, ec);
      return { isRange: (sr !== er || sm !== em || sc !== ec), minR, maxR, minCol: Math.min(startCol, endCol), maxCol: Math.max(startCol, endCol) };
    } else if (selectedCell) {
      const r = selectedCell[0], m = selectedCell[1], c = selectedCell[2];
      const col = getFlattenedCol(sheetData[r], rowTypes[r], m, c);
      return { isRange: false, minR: r, maxR: r, minCol: col, maxCol: col };
    }
    return null;
  }, [selectionRange, selectedCell, sheetData, rowTypes]);

  useEffect(() => {
    if (!selectionLimits) { setActiveCells([]); return; }
    const { minR, maxR, minCol, maxCol } = selectionLimits;
    const extracted = [];
    const seenLogicalKeys = new Set();

    for (let r = minR; r <= maxR; r++) {
      if (rowTypes[r] === 'page-break' || rowTypes[r] === 'text') continue;
      let currentCol = 0;
      for (let m = 0; m < sheetData[r].length; m++) {
        if (rowTypes[r].startsWith('double') && m === 0) continue;
        for (let c = 0; c < sheetData[r][m].length; c++) {
          if (currentCol >= minCol && currentCol <= maxCol) {
            const token = normalizeToken(sheetData[r][m][c]);

            if (token !== '-') {
              const parts = splitThaiNoteToken(token);
              let counterpartParts = [];
              
              if (rowTypes[r].startsWith('double')) {
                  const counterpartR = rowTypes[r] === 'double-right' ? r + 1 : r - 1;
                  const counterpartToken = normalizeToken(sheetData[counterpartR][m][c]);
                  if (counterpartToken !== '-') counterpartParts = splitThaiNoteToken(counterpartToken);
              }

              parts.forEach((part, subIdx) => {
                  const logicalR = rowTypes[r] === 'double-left' ? r - 1 : r;
                  const logicalKey = `${logicalR}_${m}_${c}_${subIdx}`; 

                  if (!seenLogicalKeys.has(logicalKey)) {
                    seenLogicalKeys.add(logicalKey);

                    const cellKey = `${r}_${m}_${c}_${subIdx}`;
                    const fallbackKey = `${r}_${m}_${c}`; 
                    const velocity = layoutConfig.customStyles?.[cellKey]?.velocity ?? layoutConfig.customStyles?.[fallbackKey]?.velocity ?? 100;

                    let displayToken = part;
                    if (rowTypes[r].startsWith('double') && counterpartParts[subIdx]) {
                        displayToken = rowTypes[r] === 'double-right' ? `${part}/${counterpartParts[subIdx]}` : `${counterpartParts[subIdx]}/${part}`;
                    }

                    extracted.push({ 
                        r, m, c, subIdx, 
                        token: displayToken, 
                        cellKey, 
                        velocity, 
                        isLastInCell: subIdx === parts.length - 1,
                        flatCol: currentCol,
                        logicalR: logicalR 
                    });
                  }
              });
            }
          }
          currentCol++;
        }
      }
    }

    extracted.sort((a, b) => {
      if (a.logicalR !== b.logicalR) return a.logicalR - b.logicalR;
      if (a.flatCol !== b.flatCol) return a.flatCol - b.flatCol;
      return a.subIdx - b.subIdx;
    });

    setActiveCells(extracted);
  }, [selectionLimits, sheetData, rowTypes, layoutConfig.customStyles]);

  useEffect(() => {
    if (activeCells.length > 0 && activeCells[0].velocity !== undefined) {
      setFlatVol(activeCells[0].velocity);
    }
  }, [selectionLimits]);

  // ⭐ อัปเกรดฟังก์ชันให้รับ Payload การแก้ไขเข้ามาแทน state ตัวเก่า (เพื่อความ Real-time)
  const applyVelocityToSelection = (mode, val = null, smartPayload = {}) => {
    if (activeCells.length === 0) return;
    const newCustomStyles = { ...(layoutConfig.customStyles || {}) };
    const len = activeCells.length;

    const currentDMode = smartPayload.downbeatMode ?? downbeatMode;
    const currentAVol = smartPayload.accentVol ?? accentVol;
    const currentGVol = smartPayload.ghostVol ?? ghostVol;

    activeCells.forEach((cell, idx) => {
      const existingStyle = newCustomStyles[cell.cellKey] || {};
      let finalVelocity = 100;

      if (mode === 'flat') finalVelocity = val;
      else if (mode === 'crescendo') finalVelocity = len > 1 ? Math.round(40 + (60 * (idx / (len - 1)))) : 100;
      else if (mode === 'decrescendo') finalVelocity = len > 1 ? Math.round(100 - (60 * (idx / (len - 1)))) : 100;
      else if (mode === 'accent') finalVelocity = idx === len - 1 ? 100 : 50; 
      else if (mode === 'smart') {
        const isDownbeatCell = (cell.c === 3 && cell.isLastInCell);
        let isTargetMeasure = false;
        if (currentDMode === '1') isTargetMeasure = true;
        else if (currentDMode === '2') isTargetMeasure = (cell.m % 2 === 1);
        else if (currentDMode === '4') isTargetMeasure = (cell.m % 4 === 3);
        finalVelocity = (isDownbeatCell && isTargetMeasure) ? currentAVol : currentGVol;
      }

      newCustomStyles[cell.cellKey] = { ...existingStyle, velocity: finalVelocity };

      if (rowTypes[cell.r] && rowTypes[cell.r].startsWith('double')) {
          const counterpartR = rowTypes[cell.r] === 'double-right' ? cell.r + 1 : cell.r - 1;
          const counterpartKey = `${counterpartR}_${cell.m}_${cell.c}_${cell.subIdx}`;
          const counterpartStyle = newCustomStyles[counterpartKey] || {};
          newCustomStyles[counterpartKey] = { ...counterpartStyle, velocity: finalVelocity };
      }
    });
    setLayoutConfig(prev => ({ ...prev, customStyles: newCustomStyles }));
  };

  const handleIndividualVelocity = (cellKey, newVol, r, m, c, subIdx) => {
    const newCustomStyles = { ...(layoutConfig.customStyles || {}) };
    const existingStyle = newCustomStyles[cellKey] || {};
    newCustomStyles[cellKey] = { ...existingStyle, velocity: newVol };

    if (rowTypes[r] && rowTypes[r].startsWith('double')) {
        const counterpartR = rowTypes[r] === 'double-right' ? r + 1 : r - 1;
        const counterpartKey = `${counterpartR}_${m}_${c}_${subIdx}`;
        const counterpartStyle = newCustomStyles[counterpartKey] || {};
        newCustomStyles[counterpartKey] = { ...counterpartStyle, velocity: newVol };
    }
    setLayoutConfig(prev => ({ ...prev, customStyles: newCustomStyles }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 animate-fadeIn">
      {/* Header */}
      <div className="p-3 bg-white border-b border-slate-200 flex justify-between items-center shrink-0 shadow-sm z-10">
        <div>
          <h3 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" /></svg>
            ความดังโน้ต (Velocity)
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">ควบคุมระดับเสียงรายตัว / กลุ่ม</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-3 pb-24">
        
        {/* 1. สถานะการคลุมดำ */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-center relative overflow-hidden flex flex-col items-center justify-center">
          {activeCells.length === 0 && <div className="absolute top-0 left-0 w-full h-1 bg-slate-300"></div>}
          {activeCells.length === 1 && <div className="absolute top-0 left-0 w-full h-1 bg-sky-400"></div>}
          {activeCells.length > 1 && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-400"></div>}
          
          <p className="text-[11px] font-bold text-slate-700">
            {activeCells.length === 0 ? 'กำลังควบคุม: ภาพรวมทั้งโปรเจกต์' : 
             activeCells.length === 1 ? 'กำลังปรับแต่ง: 1 จังหวะย่อย' : 
             `กำลังปรับแต่ง: กลุ่ม ${activeCells.length} จังหวะย่อย`}
          </p>
        </div>

        {/* 2. หมวดปรับด่วนแบบกลุ่ม (Quick Presets) */}
        <div className={`bg-white p-3 rounded-lg border border-slate-200 shadow-sm transition-opacity ${activeCells.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
          <h4 className="text-[11px] font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            ปรับด่วนแบบกลุ่ม
          </h4>
          
          <div className="space-y-4">
            {/* Slider ปรับระดับความดังพื้นฐาน */}
            <div>
              <label className="text-[10px] text-slate-500 font-bold flex justify-between items-center mb-2">
                <span>ปรับความดังเท่ากันหมด (Flat)</span>
                <span className="text-[10px] font-black text-sky-600 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded">{flatVol}</span>
              </label>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setFlatVol(0); applyVelocityToSelection('flat', 0); }} 
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 hover:border-rose-200 shadow-sm" 
                  title="ปิดเสียง (Mute)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                </button>
                <input 
                  type="range" min="0" max="100" 
                  value={flatVol} 
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setFlatVol(val);
                    applyVelocityToSelection('flat', val);
                  }} 
                  className="flex-1 h-1.5 bg-slate-200 rounded-lg accent-sky-500 cursor-pointer" 
                />
              </div>
            </div>

            {/* ลูกเล่นความดัง (Dynamics) */}
            <div>
              <span className="text-[10px] text-slate-500 font-bold block mb-2">ลูกเล่นความดัง (Dynamics)</span>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => applyVelocityToSelection('crescendo')} className="py-2 bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-700 text-[10px] font-bold rounded border border-slate-200 hover:border-sky-300 flex justify-center items-center gap-1.5 transition-all">
                  <svg className="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  ค่อยๆ ดังขึ้น
                </button>
                <button onClick={() => applyVelocityToSelection('decrescendo')} className="py-2 bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-700 text-[10px] font-bold rounded border border-slate-200 hover:border-sky-300 flex justify-center items-center gap-1.5 transition-all">
                  <svg className="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>
                  ค่อยๆ เบาลง
                </button>
                <button onClick={() => applyVelocityToSelection('accent')} className="py-2 bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-700 text-[10px] font-bold rounded border border-slate-200 hover:border-sky-300 flex justify-center items-center gap-1.5 transition-all">
                  <svg className="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  เน้นตัวตก (ท้าย)
                </button>
                <button onClick={() => applyVelocityToSelection('flat', 100)} className="py-2 bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-700 text-[10px] font-bold rounded border border-slate-200 hover:border-sky-300 flex justify-center items-center gap-1.5 transition-all">
                  <svg className="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8h16M4 16h16" /></svg>
                  ดังเท่ากันหมด
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. หมวดเน้นจังหวะตกอัจฉริยะ (Smart Thai Downbeat) */}
        <div className={`bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden transition-opacity ${activeCells.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400"></div>
          <h4 className="text-[11px] font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
            เน้นจังหวะตกอัจฉริยะ
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-2 text-center">ระยะการตกจังหวะ</label>
              <div className="grid grid-cols-3 gap-1">
                {/* ⭐ แนบคำสั่งอัปเดตแบบ Real-time ไปที่ปุ่มเลย */}
                <button onClick={() => { setDownbeatMode('1'); applyVelocityToSelection('smart', null, { downbeatMode: '1' }); }} className={`py-1.5 text-[10px] font-bold rounded-md border transition-all ${downbeatMode === '1' ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>1 ห้องตก</button>
                <button onClick={() => { setDownbeatMode('2'); applyVelocityToSelection('smart', null, { downbeatMode: '2' }); }} className={`py-1.5 text-[10px] font-bold rounded-md border transition-all ${downbeatMode === '2' ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>2 ห้องตก</button>
                <button onClick={() => { setDownbeatMode('4'); applyVelocityToSelection('smart', null, { downbeatMode: '4' }); }} className={`py-1.5 text-[10px] font-bold rounded-md border transition-all ${downbeatMode === '4' ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>4 ห้องตก</button>
              </div>
            </div>
            
            <div className="bg-indigo-50/50 p-2.5 rounded border border-indigo-100">
              <label className="text-[10px] flex justify-between mb-1"><span className="font-bold text-indigo-700">ความดัง "จังหวะตก"</span><span className="font-black text-indigo-700">{accentVol}</span></label>
              <input 
                type="range" min="0" max="100" 
                value={accentVol} 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setAccentVol(val);
                  applyVelocityToSelection('smart', null, { accentVol: val });
                }} 
                className="w-full h-1.5 bg-indigo-200 rounded-lg accent-indigo-500 cursor-pointer" 
              />
            </div>
            
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <label className="text-[10px] flex justify-between mb-1"><span className="font-bold text-slate-600">ความดัง "ตัวทาง"</span><span className="font-black text-slate-500">{ghostVol}</span></label>
              <input 
                type="range" min="0" max="100" 
                value={ghostVol} 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setGhostVol(val);
                  applyVelocityToSelection('smart', null, { ghostVol: val });
                }} 
                className="w-full h-1.5 bg-slate-300 rounded-lg accent-slate-500 cursor-pointer" 
              />
            </div>
            {/* ❌ ตัดปุ่ม นำไปใช้ (Apply) ออกทั้งหมด */}
          </div>
        </div>

        {/* 4. หมวดปรับละเอียดรายตัว */}
        {activeCells.length > 0 && (
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <h4 className="text-[11px] font-bold text-slate-700 border-b border-slate-100 pb-2 flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                 <svg className="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                 ปรับละเอียดรายตัว
              </span>
              <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{activeCells.length} จังหวะย่อย</span>
            </h4>
            
            <div className="flex flex-col gap-2 mt-3">
              {activeCells.map((cell) => (
                <div key={cell.cellKey} className="flex items-center gap-3 w-full bg-slate-50 border border-slate-100 p-1.5 rounded-md">
                  <div className="w-7 h-7 shrink-0 bg-white border border-slate-200 rounded flex items-center justify-center shadow-sm relative">
                    <span className="text-[11px] font-black text-slate-700 truncate px-1">{cell.token}</span>
                    {(cell.c === 3 && cell.isLastInCell) && <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-400 rounded-full border border-white" title="ตำแหน่งตกจังหวะ"></span>}
                  </div>
                  <div className="flex-1 flex items-center gap-2 pr-1">
                    <input 
                      type="range" min="0" max="100" 
                      value={cell.velocity} 
                      onChange={(e) => handleIndividualVelocity(cell.cellKey, parseInt(e.target.value), cell.r, cell.m, cell.c, cell.subIdx)} 
                      className="w-2 h-2 bg-slate-200 rounded-lg accent-sky-500 flex-1 cursor-pointer" 
                    />
                    <input 
                      type="number" min="0" max="100" 
                      value={cell.velocity} 
                      onChange={(e) => handleIndividualVelocity(cell.cellKey, parseInt(e.target.value) || 0, cell.r, cell.m, cell.c, cell.subIdx)} 
                      className="w-10 text-center bg-white border border-slate-200 rounded p-1 text-[10px] font-bold focus:border-sky-400 outline-none" 
                    />
                  </div>
                </div>
              ))}
            </div>
            
          </div>
        )}

      </div>
    </div>
  );
};

export default VelocityTab;