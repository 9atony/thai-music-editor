import React, { useContext, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Minus,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Scissors,
  Trash2,
  Undo2,
} from 'lucide-react';
import { MusicContext } from '../../contexts/MusicContext';

const formatNote = (key) => {
  const octaveMatch = key.eng?.match(/\d+/);
  if (!octaveMatch) return key.thai;
  const octave = Number(octaveMatch[0]);
  if (octave >= 5) return `${key.thai}\u0E4D`;
  if (octave === 2) return `${key.thai}\u0E3A\u200B`;
  if (octave === 3) return `${key.thai}\u0E3A`;
  return key.thai;
};

const SmallAction = ({ icon: Icon, label, onClick, disabled = false, active = false, danger = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex min-h-14 min-w-[66px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-3 text-[10px] font-black transition active:scale-95 ${
      disabled
        ? 'border-slate-200 bg-slate-100 text-slate-300'
        : danger
          ? 'border-rose-200 bg-rose-50 text-rose-600'
          : active
            ? 'border-sky-500 bg-sky-500 text-white'
            : 'border-slate-200 bg-white text-slate-600'
    }`}
  >
    {React.createElement(Icon, { size: 19, strokeWidth: 2.4 })}
    <span>{label}</span>
  </button>
);

const MobileEditControls = () => {
  const {
    currentInstrument,
    selectedCell,
    inputNote,
    moveSelectionPrev,
    moveSelectionNext,
    undo,
    redo,
    canUndo,
    canRedo,
    saveProject,
    isPlaying,
    togglePlay,
    isReadOnly,
    copySelection,
    cutSelection,
    pasteSelection,
    addNoteColumn,
    removeNoteColumn,
    addMeasure,
    removeMeasure,
    addRow,
  } = useContext(MusicContext);
  const [isExpanded, setIsExpanded] = useState(true);

  const hasCell = Array.isArray(selectedCell);
  const keys = currentInstrument?.keys || [];
  const selectedLabel = hasCell
    ? `บรรทัด ${selectedCell[0] + 1} · ห้อง ${selectedCell[1] + 1} · ช่อง ${selectedCell[2] + 1}`
    : 'แตะช่องโน้ตบนกระดาษก่อน';

  return (
    <footer className="relative z-40 shrink-0 rounded-t-3xl border-t border-slate-200 bg-white shadow-[0_-12px_30px_rgba(15,23,42,0.15)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <button type="button" onClick={moveSelectionPrev} disabled={!hasCell} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-40" aria-label="ไปช่องก่อนหน้า">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs font-black text-slate-700">{selectedLabel}</p>
          <p className="mt-0.5 text-[9px] font-semibold text-slate-400">{currentInstrument?.name || 'เครื่องดนตรีไทย'}</p>
        </div>
        <button type="button" onClick={moveSelectionNext} disabled={!hasCell} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-40" aria-label="ไปช่องถัดไป">
          <ChevronRight size={22} />
        </button>
        <button type="button" onClick={() => setIsExpanded((expanded) => !expanded)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600" aria-label={isExpanded ? 'ย่อคีย์บอร์ด' : 'เปิดคีย์บอร์ด'} aria-expanded={isExpanded}>
          <ChevronDown size={22} className={`transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {isExpanded && (
        <>
          <div className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <SmallAction icon={Undo2} label="ย้อนกลับ" onClick={undo} disabled={!canUndo || isReadOnly} />
            <SmallAction icon={Redo2} label="ทำซ้ำ" onClick={redo} disabled={!canRedo || isReadOnly} />
            <SmallAction icon={isPlaying ? Pause : Play} label={isPlaying ? 'หยุด' : 'เล่น'} onClick={togglePlay} active={isPlaying} />
            <SmallAction icon={Save} label="บันทึก" onClick={saveProject} />
            <SmallAction icon={Copy} label="คัดลอก" onClick={copySelection} disabled={!hasCell || isReadOnly} />
            <SmallAction icon={Scissors} label="ตัด" onClick={cutSelection} disabled={!hasCell || isReadOnly} />
            <SmallAction icon={ClipboardPaste} label="วาง" onClick={pasteSelection} disabled={!hasCell || isReadOnly} />
            <SmallAction icon={Plus} label="เพิ่มจังหวะ" onClick={addNoteColumn} disabled={!hasCell || isReadOnly} />
            <SmallAction icon={Minus} label="ลบจังหวะ" onClick={removeNoteColumn} disabled={!hasCell || isReadOnly} danger />
            <SmallAction icon={Plus} label="เพิ่มห้อง" onClick={addMeasure} disabled={!hasCell || isReadOnly} />
            <SmallAction icon={Minus} label="ลบห้อง" onClick={removeMeasure} disabled={!hasCell || isReadOnly} danger />
            <SmallAction icon={Plus} label="เพิ่มบรรทัด" onClick={addRow} disabled={!hasCell || isReadOnly} />
          </div>

          <div className="flex items-stretch gap-1.5 overflow-x-auto border-t border-sky-100 bg-sky-50/70 px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" onClick={() => inputNote?.('-')} disabled={!hasCell || isReadOnly} className="flex h-[76px] min-w-[66px] shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40">
              <span className="text-2xl font-black">—</span>
              <span className="mt-1 text-[9px] font-bold">พักเสียง</span>
            </button>
            {keys.map((key, index) => (
              <button
                key={`${key.eng}-${index}`}
                type="button"
                onClick={() => inputNote?.(formatNote(key))}
                disabled={!hasCell || isReadOnly}
                className="flex h-[76px] min-w-[64px] shrink-0 flex-col items-center justify-center rounded-xl border border-slate-300 border-b-4 bg-white text-slate-800 shadow-sm active:translate-y-0.5 active:border-b-2 disabled:opacity-40"
              >
                <span className="text-[9px] font-bold text-slate-400">{key.eng}</span>
                <span className="mt-1 text-2xl font-black leading-none">{formatNote(key)}</span>
              </button>
            ))}
            <button type="button" onClick={() => inputNote?.('BACKSPACE')} disabled={!hasCell || isReadOnly} className="flex h-[76px] min-w-[72px] shrink-0 flex-col items-center justify-center rounded-xl border border-rose-200 border-b-4 bg-rose-50 text-rose-600 shadow-sm active:translate-y-0.5 active:border-b-2 disabled:opacity-40">
              <Trash2 size={24} />
              <span className="mt-1 text-[9px] font-black">ลบโน้ต</span>
            </button>
          </div>
        </>
      )}
    </footer>
  );
};

export default MobileEditControls;
