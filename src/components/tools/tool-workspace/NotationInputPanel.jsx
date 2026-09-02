import React, { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { INSTRUMENT_CONFIG } from '../../../utils/instrumentConfig';
import { formatInstrumentNote } from '../../../utils/sheetUtils';

const COMPUTER_KEYBOARD_CODES = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
  'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP',
  'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL',
];

export default function NotationInputPanel() {
  const { tracks, selectedNotationCell, setTrackInstrument, inputNotationNote, appendNotationNote, addNotationMeasures, removeNotationMeasures, setNotationHandMode, moveNotationSelection, notationSymbolTool, setNotationSymbolTool } = useWorkspace();
  const [hoveredKeyIndex, setHoveredKeyIndex] = useState(null);
  const [activeKeyIndex, setActiveKeyIndex] = useState(null);
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
  // Keep the control visible before a cell is selected as well. It stays
  // disabled until there is a clip to write into, but users can immediately
  // see where the Ranat Ek octave mode lives.
  const canUseOctavePair = instrument?.id === 'ranat-ek' && !isDoubleHand;
  const isOctavePairEnabled = canUseOctavePair && Boolean(selectedTrack?.octavePairEnabled);

  const getInputNote = (key) => {
    const note = formatInstrumentNote(key);
    return note;
  };

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

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!selectedNotationCell || disabled || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;

      if (event.code === 'Backspace' || event.code === 'Delete') {
        event.preventDefault();
        inputNotationNote('-');
        return;
      }

      const keyIndex = COMPUTER_KEYBOARD_CODES.indexOf(event.code);
      const key = keys[keyIndex];
      if (!key || event.repeat) return;
      if (isOctavePairEnabled && keyIndex < 7) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      const note = getInputNote(key);
      if (event.shiftKey) appendNotationNote(note);
      else inputNotationNote(note);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [appendNotationNote, canUseOctavePair, disabled, inputNotationNote, instrument, isOctavePairEnabled, keys, selectedNotationCell]);

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
      <div className={`relative z-0 w-full overflow-hidden ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
        <div className="overflow-x-auto pb-2 pt-1 custom-scrollbar">
          <div className="mx-auto flex w-max gap-[2px] rounded-xl border border-white/[0.08] bg-[#080c10] p-1.5 shadow-inner">
            <button
              type="button"
              onPointerDown={(event) => { event.preventDefault(); setActiveKeyIndex(-1); }}
              onPointerUp={() => setActiveKeyIndex(null)}
              onPointerLeave={() => { setActiveKeyIndex(null); setHoveredKeyIndex(null); }}
              onPointerCancel={() => { setActiveKeyIndex(null); setHoveredKeyIndex(null); }}
              onPointerEnter={() => setHoveredKeyIndex(-1)}
              onClick={() => inputNotationNote('-')}
              className={`relative h-[62px] w-14 shrink-0 rounded-b-md border border-b-[5px] border-amber-300/30 bg-amber-300/[0.07] text-amber-100 transition-all select-none ${activeKeyIndex === -1 ? 'translate-y-1 border-b-0 bg-amber-300/25' : hoveredKeyIndex === -1 ? 'bg-amber-300/15' : ''}`}
              title="ล้างโน้ตในช่องนี้"
            >
              <span className="text-xl font-bold">−</span>
            </button>
            {keys.map((key, index) => {
              const isBlocked = isOctavePairEnabled && index < 7;
              const isPairPartner = isOctavePairEnabled && ((hoveredKeyIndex !== null && index === hoveredKeyIndex - 7) || (activeKeyIndex !== null && index === activeKeyIndex - 7));
              const isHovered = hoveredKeyIndex === index || isPairPartner;
              const isActive = activeKeyIndex === index || (isPairPartner && activeKeyIndex !== null);
              let keyClass = 'relative h-[62px] w-14 shrink-0 rounded-b-md border border-b-[5px] flex flex-col items-center justify-end pb-2.5 text-sky-50 transition-all select-none ';

              if (isActive) keyClass += isOctavePairEnabled ? 'translate-y-1 border-amber-300 bg-amber-300 border-b-0 text-amber-950 ' : 'translate-y-1 border-sky-300 bg-sky-200 border-b-0 text-sky-950 ';
              else if (isHovered) keyClass += isOctavePairEnabled ? 'border-amber-400 bg-amber-100/95 text-amber-800 ' : 'border-sky-400 bg-sky-50 text-sky-700 ';
              else if (isBlocked) keyClass += 'cursor-not-allowed border-slate-700 bg-slate-800/70 text-slate-500 opacity-55 ';
              else keyClass += 'border-slate-600 bg-slate-100 text-slate-700 hover:bg-white ';

              return (
                <button
                  type="button"
                  key={`${key.eng || key.thai}_${index}`}
                  disabled={isBlocked}
                  onPointerDown={(event) => { event.preventDefault(); if (!isBlocked) setActiveKeyIndex(index); }}
                  onPointerUp={() => setActiveKeyIndex(null)}
                  onPointerLeave={() => { setActiveKeyIndex(null); setHoveredKeyIndex(null); }}
                  onPointerCancel={() => { setActiveKeyIndex(null); setHoveredKeyIndex(null); }}
                  onPointerEnter={() => { if (!isBlocked) setHoveredKeyIndex(index); }}
                  onContextMenu={(event) => { event.preventDefault(); if (!isBlocked) inputNotationNote('-'); }}
                  onClick={(event) => { if (!isBlocked) (event.shiftKey ? appendNotationNote(getInputNote(key)) : inputNotationNote(getInputNote(key))); }}
                  className={keyClass}
                  title={isBlocked
                    ? `${formatInstrumentNote(key)} (${key.eng || ''}) · ใช้ไม่ได้ในโหมดคู่ 8`
                    : `${formatInstrumentNote(key)} (${key.eng || ''}) · Shift+คลิกเพื่อพิมพ์ต่อในช่อง · คลิกขวาเพื่อล้างช่อง`}
                >
                  <span className={`absolute top-1.5 text-[9px] font-semibold uppercase tracking-wider ${isHovered || isActive ? 'opacity-75' : 'opacity-45'}`}>{key.eng}</span>
                  <span className="text-xl font-bold leading-none">{formatInstrumentNote(key)}</span>
                  <span className="mt-1 text-[8px] font-medium opacity-50">{COMPUTER_KEYBOARD_CODES[index]?.replace('Key', '').replace('Digit', '')}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
