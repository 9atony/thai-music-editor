import React, { useContext, useState, useMemo, useEffect } from 'react';
import { MusicContext } from '../../../contexts/MusicContext';

// ฟังก์ชันช่วยหาคอลัมน์แบบแบนราบ (Flattened)
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

// ตัดช่องว่าง
const normalizeToken = (token) => {
  if (typeof token !== 'string') return token && token !== '-' ? String(token) : '-';
  const compact = token.replace(/\s+/g, '').trim();
  return compact === '' ? '-' : compact;
};

// ฟังก์ชันแยกโน้ต 1 ก้อน ออกเป็นทีละตัว
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
                        flatCol: currentCol 
                    });
                  }
              });
            }
          }
          currentCol++;
        }
      }
    }

    // ⭐ แก้ไขตรรกะการจัดเรียง (Sorting) ใหม่ให้ถูกต้องตามลำดับการอ่านโน้ต
    extracted.sort((a, b) => {
      // 1. สำคัญสุด: เรียงตามบรรทัด (จบทีละบรรทัดจากบนลงล่าง)
      if (a.r !== b.r) return a.r - b.r;
      // 2. ในบรรทัดเดียวกัน: เรียงตามคอลัมน์ (ซ้ายไปขวา)
      if (a.flatCol !== b.flatCol) return a.flatCol - b.flatCol;
      // 3. ในช่องเดียวกัน: เรียงตามลำดับจังหวะย่อย (ซับโน้ต)
      return a.subIdx - b.subIdx;
    });

    setActiveCells(extracted);
  }, [selectionLimits, sheetData, rowTypes, layoutConfig.customStyles]);

  const applyVelocityToSelection = (mode, flatValue = null) => {
    if (activeCells.length === 0) return;
    const newCustomStyles = { ...(layoutConfig.customStyles || {}) };
    const len = activeCells.length;

    activeCells.forEach((cell, idx) => {
      const existingStyle = newCustomStyles[cell.cellKey] || {};
      let finalVelocity = 100;

      if (mode === 'flat') finalVelocity = flatValue;
      else if (mode === 'crescendo') finalVelocity = len > 1 ? Math.round(40 + (60 * (idx / (len - 1)))) : 100;
      else if (mode === 'decrescendo') finalVelocity = len > 1 ? Math.round(100 - (60 * (idx / (len - 1)))) : 100;
      else if (mode === 'accent') finalVelocity = idx === 0 ? 100 : 50;
      else if (mode === 'smart') {
        const isDownbeatCell = (cell.c === 3 && cell.isLastInCell);
        let isTargetMeasure = false;
        if (downbeatMode === '1') isTargetMeasure = true;
        else if (downbeatMode === '2') isTargetMeasure = (cell.m % 2 === 1);
        else if (downbeatMode === '4') isTargetMeasure = (cell.m % 4 === 3);
        finalVelocity = (isDownbeatCell && isTargetMeasure) ? accentVol : ghostVol;
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
      <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center shrink-0 shadow-sm">
        <div>
          <h3 className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
            น้ำหนักเสียง (Velocity)
          </h3>
          <p className="text-[10px] text-emerald-600 mt-1 font-semibold">ควบคุมความดังเบารายโน้ต</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 pb-20">
        
        {/* 🎛️ 1. สถานะการคลุมดำ */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center relative overflow-hidden">
          {activeCells.length === 0 && <div className="absolute top-0 left-0 w-full h-1 bg-slate-300"></div>}
          {activeCells.length === 1 && <div className="absolute top-0 left-0 w-full h-1 bg-sky-400"></div>}
          {activeCells.length > 1 && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400"></div>}
          
          <p className="text-[11px] font-bold text-slate-700">
            {activeCells.length === 0 ? 'กำลังควบคุม: ความดังรวมทั้งกระดาษ' : 
             activeCells.length === 1 ? 'กำลังปรับแต่ง: 1 จังหวะย่อย' : 
             `กำลังปรับแต่ง: กลุ่ม ${activeCells.length} จังหวะย่อย`}
          </p>
        </div>

        {/* ⚡ 2. หมวดปรับด่วนแบบกลุ่ม (Quick Presets) */}
        <div className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-opacity ${activeCells.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
          <h4 className="text-[11px] font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2">⚡ ปรับด่วนแบบกลุ่ม</h4>
          <div className="space-y-3">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block mb-1.5">ระดับความดังพื้นฐาน</span>
              <div className="grid grid-cols-4 gap-1">
                <button onClick={() => applyVelocityToSelection('flat', 0)} className="py-1.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-[10px] font-bold rounded border border-slate-200">🔇 ปิด (0)</button>
                <button onClick={() => applyVelocityToSelection('flat', 40)} className="py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 text-[10px] font-bold rounded border border-slate-200">🔈 เบา</button>
                <button onClick={() => applyVelocityToSelection('flat', 70)} className="py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 text-[10px] font-bold rounded border border-slate-200">🔉 กลาง</button>
                <button onClick={() => applyVelocityToSelection('flat', 100)} className="py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 text-[10px] font-bold rounded border border-slate-200">🔊 ดัง</button>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block mb-1.5">ลูกเล่นความดัง (Dynamics)</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => applyVelocityToSelection('crescendo')} className="py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 text-[10px] font-bold rounded border border-slate-200">📈 ค่อยๆ ดังขึ้น</button>
                <button onClick={() => applyVelocityToSelection('decrescendo')} className="py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 text-[10px] font-bold rounded border border-slate-200">📉 ค่อยๆ เบาลง</button>
                <button onClick={() => applyVelocityToSelection('accent')} className="py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 text-[10px] font-bold rounded border border-slate-200">💥 เน้นตัวแรก</button>
                <button onClick={() => applyVelocityToSelection('flat', 100)} className="py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 text-[10px] font-bold rounded border border-slate-200">➖ เท่ากันหมด</button>
              </div>
            </div>
          </div>
        </div>

        {/* 🥁 3. หมวดเน้นจังหวะตกอัจฉริยะ (Smart Thai Downbeat) */}
        <div className={`bg-white p-4 rounded-xl border border-emerald-200 shadow-sm relative overflow-hidden transition-opacity ${activeCells.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400"></div>
          <h4 className="text-[11px] font-bold text-emerald-800 mb-3 border-b border-emerald-100 pb-2">🥁 เน้นจังหวะตกอัจฉริยะ</h4>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-2 text-center">ระยะการตกจังหวะ</label>
              <div className="grid grid-cols-3 gap-1">
                <button onClick={() => setDownbeatMode('1')} className={`py-1.5 text-[10px] font-bold rounded-md border ${downbeatMode === '1' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>1 ห้องตก</button>
                <button onClick={() => setDownbeatMode('2')} className={`py-1.5 text-[10px] font-bold rounded-md border ${downbeatMode === '2' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>2 ห้องตก</button>
                <button onClick={() => setDownbeatMode('4')} className={`py-1.5 text-[10px] font-bold rounded-md border ${downbeatMode === '4' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>4 ห้องตก</button>
              </div>
            </div>
            <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
              <label className="text-[10px] flex justify-between mb-1"><span className="font-bold text-emerald-700">ความดัง "จังหวะตก"</span><span className="font-black text-emerald-700">{accentVol}</span></label>
              <input type="range" min="0" max="100" value={accentVol} onChange={(e) => setAccentVol(parseInt(e.target.value))} className="w-full h-1.5 bg-emerald-200 rounded-lg accent-emerald-600" />
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <label className="text-[10px] flex justify-between mb-1"><span className="font-bold text-slate-600">ความดัง "ตัวทาง"</span><span className="font-black text-slate-500">{ghostVol}</span></label>
              <input type="range" min="0" max="100" value={ghostVol} onChange={(e) => setGhostVol(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-300 rounded-lg accent-slate-500" />
            </div>
            <button onClick={() => applyVelocityToSelection('smart')} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black rounded-lg shadow-md active:scale-95 flex justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> ใช้งานกับโน้ตที่เลือก
            </button>
          </div>
        </div>

        {/* 🎚️ 4. หมวดปรับละเอียดรายตัว */}
        {activeCells.length > 0 && (
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-[11px] font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2 flex justify-between items-center">
              <span>🎚️ ปรับละเอียดรายตัว</span><span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{activeCells.length} จังหวะย่อย</span>
            </h4>
            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {activeCells.map((cell) => (
                <div key={cell.cellKey} className="flex items-center gap-3 w-full">
                  <div className="w-8 h-8 shrink-0 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm relative">
                    <span className="text-[11px] font-black text-slate-700 truncate px-1">{cell.token}</span>
                    {(cell.c === 3 && cell.isLastInCell) && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white" title="จังหวะตก"></span>}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <input type="range" min="0" max="100" value={cell.velocity} onChange={(e) => handleIndividualVelocity(cell.cellKey, parseInt(e.target.value), cell.r, cell.m, cell.c, cell.subIdx)} className="w-2 h-2 bg-slate-200 rounded-lg accent-emerald-500 flex-1" />
                    <input type="number" min="0" max="100" value={cell.velocity} onChange={(e) => handleIndividualVelocity(cell.cellKey, parseInt(e.target.value) || 0, cell.r, cell.m, cell.c, cell.subIdx)} className="w-9 text-center bg-slate-50 border border-slate-200 rounded p-1 text-[10px] font-bold focus:border-emerald-400" />
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