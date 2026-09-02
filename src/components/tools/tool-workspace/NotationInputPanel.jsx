import React, { useEffect, useMemo } from 'react';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { INSTRUMENT_CONFIG } from '../../../utils/instrumentConfig';
import { formatInstrumentNote } from '../../../utils/sheetUtils';

export default function NotationInputPanel() {
  const { tracks, selectedNotationCell, setTrackInstrument, inputNotationNote, appendNotationNote, addNotationMeasures, removeNotationMeasures, setNotationHandMode, moveNotationSelection, notationSymbolTool, setNotationSymbolTool } = useWorkspace();
  const selectedTrack = tracks.find((track) => track.id === selectedNotationCell?.trackId);
  const selectedClip = selectedTrack?.clips.find((clip) => clip.id === selectedNotationCell?.clipId);
  const instrument = INSTRUMENT_CONFIG[selectedTrack?.instrumentId] || INSTRUMENT_CONFIG['ranat-ek'];
  const keys = useMemo(() => instrument?.keys || [], [instrument]);
  const measures = selectedClip?.playback?.notationMeasures || [];
  const measureCount = measures.length || Number(selectedClip?.playback?.measureCount) || 0;
  const isDoubleHand = measures.some((measure) => Array.isArray(measure.bottom));
  const hasLeftHandNotes = measures.some((measure) => measure.bottom?.some((token) => token && token !== '-'));
  const supportsDoubleHand = instrument?.type !== 'percussion';
  const disabled = !selectedClip;
  const canRemoveMeasures = measureCount > 1;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!selectedNotationCell || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      moveNotationSelection(event.key.replace('Arrow', '').toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [moveNotationSelection, selectedNotationCell]);

  const changeHandMode = (mode) => {
    if (mode === 'single' && hasLeftHandNotes && !window.confirm('เปลี่ยนเป็นแถวเดียวแล้วโน้ตมือซ้ายจะถูกลบ ต้องการดำเนินการต่อหรือไม่?')) return;
    setNotationHandMode(mode);
  };

  return (
    <section className="shrink-0 border-t border-white/10 bg-[#10151b] px-4 py-3 shadow-[0_-12px_24px_rgba(0,0,0,0.18)]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="min-w-[190px] flex-1">
          <div className="text-[11px] font-semibold text-white/90">เครื่องมือเขียนโน้ต</div>
          <div className="mt-0.5 truncate text-[10px] text-white/45">
            {selectedClip ? `${selectedTrack.name} · ${measureCount} ห้อง · ${isDoubleHand ? 'มือขวา / มือซ้าย' : 'แถวเดียว'} · กำลังเขียน${selectedNotationCell.rowIndex === 1 ? 'มือซ้าย' : isDoubleHand ? 'มือขวา' : `ช่อง ${selectedNotationCell.cellIndex + 1}`}` : 'เลือกเครื่องมือโน้ต แล้วคลิกพื้นที่ว่างเพื่อสร้างไฟล์โน้ต 1 บรรทัด (8 ห้อง)'}
          </div>
        </div>
        <select value={selectedTrack?.instrumentId || 'ranat-ek'} disabled={disabled} onChange={(event) => setTrackInstrument(selectedTrack.id, event.target.value)} className="max-w-[190px] rounded-lg border border-white/10 bg-[#0b0f14] px-2.5 py-2 text-xs text-white outline-none disabled:opacity-40" aria-label="เลือกเครื่องดนตรี">
          {Object.values(INSTRUMENT_CONFIG).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
          <button type="button" disabled={disabled} onClick={() => addNotationMeasures(1)} className="rounded-md px-3 py-1.5 text-[10px] font-semibold text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-35">+ 1 ห้อง</button>
          <button type="button" disabled={disabled} onClick={() => addNotationMeasures(8)} className="rounded-md bg-sky-400/10 px-3 py-1.5 text-[10px] font-semibold text-sky-200 hover:bg-sky-400/20 disabled:opacity-35">+ 1 บรรทัด (8 ห้อง)</button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
          <button type="button" disabled={disabled} onClick={() => setNotationSymbolTool(notationSymbolTool === 'sabat' ? null : 'sabat')} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold disabled:opacity-35 ${notationSymbolTool === 'sabat' ? 'bg-amber-400/20 text-amber-100' : 'text-white/55 hover:bg-white/10'}`} title="เลือกแล้วลากจากช่องเริ่มไปช่องสิ้นสุดเพื่อเขียนสะบัด">สะบัด</button>
          <button type="button" disabled={disabled} onClick={() => setNotationSymbolTool(notationSymbolTool === 'kro' ? null : 'kro')} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold disabled:opacity-35 ${notationSymbolTool === 'kro' ? 'bg-sky-400/20 text-sky-100' : 'text-white/55 hover:bg-white/10'}`} title="เลือกแล้วลากจากช่องเริ่มไปช่องสิ้นสุดเพื่อเขียนกรอ">กรอ (Kro)</button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
          <button type="button" disabled={disabled} onClick={() => changeHandMode('single')} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold disabled:opacity-35 ${!isDoubleHand && !disabled ? 'bg-violet-400/20 text-violet-100' : 'text-white/55 hover:bg-white/10'}`}>แถวเดียว</button>
          <button type="button" disabled={disabled || !supportsDoubleHand} onClick={() => changeHandMode('double')} title={supportsDoubleHand ? 'เพิ่มช่องเขียนมือขวาและมือซ้าย' : 'เครื่องดนตรีประเภทจังหวะไม่ใช้รูปแบบสองมือ'} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold disabled:opacity-25 ${isDoubleHand ? 'bg-violet-400/20 text-violet-100' : 'text-white/55 hover:bg-white/10'}`}>มือขวา / มือซ้าย</button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-rose-400/20 bg-rose-400/[0.05] p-1">
          <button type="button" disabled={disabled || !canRemoveMeasures} onClick={() => removeNotationMeasures(1)} className="rounded-md px-3 py-1.5 text-[10px] font-semibold text-rose-100 hover:bg-rose-400/15 disabled:opacity-30" title="ลบห้องที่กำลังเลือก">ลบ 1 ห้อง</button>
          <button type="button" disabled={disabled || !canRemoveMeasures} onClick={() => removeNotationMeasures(8)} className="rounded-md bg-rose-400/10 px-3 py-1.5 text-[10px] font-semibold text-rose-100 hover:bg-rose-400/20 disabled:opacity-30" title="ลบ 8 ห้องในบรรทัดที่กำลังเลือก">ลบ 1 บรรทัด</button>
        </div>
      </div>
      <div className={`flex gap-1.5 overflow-x-auto pb-1 ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
        <button type="button" onClick={() => inputNotationNote('-')} className="h-11 min-w-12 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 text-xs font-bold text-amber-100 transition-colors hover:bg-amber-300/20" title="ล้างโน้ตในช่องนี้">–</button>
        {keys.map((key, index) => (
          <button type="button" key={`${key.eng || key.thai}_${index}`} onContextMenu={(event) => { event.preventDefault(); inputNotationNote('-', true); }} onClick={(event) => event.shiftKey ? appendNotationNote(formatInstrumentNote(key)) : inputNotationNote(formatInstrumentNote(key))} className="h-11 min-w-11 rounded-lg border border-sky-300/20 bg-sky-300/[0.07] px-2 font-semibold text-sky-50 transition-colors hover:bg-sky-300/20 active:scale-95" title={`${formatInstrumentNote(key)} (${key.eng || ''}) · Shift+คลิกเพื่อพิมพ์ต่อในช่อง · คลิกขวาเพื่อเว้นช่อง`}>
            <span className="block text-base leading-4">{formatInstrumentNote(key)}</span>
            <span className="mt-1 block text-[8px] font-normal text-sky-100/45">{key.eng}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
