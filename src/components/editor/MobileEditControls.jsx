import React, { useContext, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Drum,
  AudioLines,
  FilePlus2,
  FileText,
  Keyboard,
  Maximize2,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Redo2,
  ListMusic,
  Rows3,
  Save,
  Scissors,
  Settings,
  SlidersHorizontal,
  Table2,
  Tag,
  Trash2,
  Undo2,
  Volume2,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { MusicContext } from '../../contexts/MusicContext';
import { useFeatureAccess } from '../../contexts/FeatureAccessContext';
import { INSTRUMENT_CONFIG } from '../../utils/instrumentConfig';
import {
  CUSTOM_KEYBOARD_FEATURE_ID,
  CUSTOM_KEYBOARD_MAX_KEYS,
  CUSTOM_KEYBOARD_MAX_LABEL_LENGTH,
  normalizeCustomKeyboardKeys,
  normalizeCustomText,
} from '../../utils/customKeyboard';

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

const MobileEditControls = ({ onOpenMetronome, onOpenSettings }) => {
  const { canAccess } = useFeatureAccess();
  const {
    currentInstrument,
    changeInstrument,
    selectedCell,
    selectionRange,
    inputNote,
    inputCustomText,
    appendCustomTextToCurrentCell,
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
    addDoubleRow,
    removeRow,
    addPageBreak,
    convertMeasureToText,
    addAnnotationRow,
    expandSelectedMeasures,
    layoutConfig,
    setLayoutConfig,
    intervalMode,
    setIntervalMode,
    isReduceMode,
    setIsReduceMode,
    shiftNoteObject,
    userRole,
  } = useContext(MusicContext);
  const [isExpanded, setIsExpanded] = useState(true);
  const [keyboardMode, setKeyboardMode] = useState('notes');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const [appendCustomText, setAppendCustomText] = useState(false);

  const hasCell = Array.isArray(selectedCell);
  const selectedInstrumentId = hasCell
    ? layoutConfig?.customStyles?.[`${selectedCell[0]}_${selectedCell[1]}_${selectedCell[2]}`]?.instrumentId
    : null;
  const displayInstrument = INSTRUMENT_CONFIG[selectedInstrumentId] || currentInstrument;
  const keys = displayInstrument?.keys || [];
  const canUseCustomKeyboard = canAccess(CUSTOM_KEYBOARD_FEATURE_ID, userRole);
  const activeKeyboardMode = canUseCustomKeyboard ? keyboardMode : 'notes';
  const customKeys = normalizeCustomKeyboardKeys(layoutConfig?.customKeyboardKeys);
  const canExpand = Boolean(selectionRange?.start && selectionRange?.end && !selectionRange?.labelOnly);
  const selectedLabel = hasCell
    ? `บรรทัด ${selectedCell[0] + 1} · ห้อง ${selectedCell[1] + 1} · ช่อง ${selectedCell[2] + 1}`
    : 'แตะช่องโน้ตบนกระดาษก่อน';

  const updateCustomKeys = (nextKeys) => {
    if (!canUseCustomKeyboard || isReadOnly) return;
    setLayoutConfig((current) => ({ ...current, customKeyboardKeys: normalizeCustomKeyboardKeys(nextKeys) }));
  };

  const addCustomKey = (event) => {
    event.preventDefault();
    const label = normalizeCustomText(customDraft, CUSTOM_KEYBOARD_MAX_LABEL_LENGTH);
    if (!label || customKeys.length >= CUSTOM_KEYBOARD_MAX_KEYS) return;
    let sequence = customKeys.length + 1;
    while (customKeys.some((key) => key.id === `custom-${sequence}`)) sequence += 1;
    updateCustomKeys([...customKeys, { id: `custom-${sequence}`, label }]);
    setCustomDraft('');
  };

  const insertInstrumentNote = (key) => {
    const adjustedKey = isReduceMode && shiftNoteObject ? shiftNoteObject(key, 1) : key;
    inputNote?.(formatNote(adjustedKey));
  };

  const openPanel = (callback) => {
    setIsToolsOpen(false);
    callback?.();
  };

  const openEditorPanel = (panel) => {
    setIsToolsOpen(false);
    window.dispatchEvent(new CustomEvent('tme-open-editor-panel', { detail: { panel } }));
  };

  return (
    <footer className="relative z-40 shrink-0 rounded-t-3xl border-t border-slate-200 bg-white shadow-[0_-12px_30px_rgba(15,23,42,0.15)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <button type="button" onClick={moveSelectionPrev} disabled={!hasCell} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-40" aria-label="ไปช่องก่อนหน้า">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs font-black text-slate-700">{selectedLabel}</p>
          <p className="mt-0.5 text-[9px] font-semibold text-slate-400">{displayInstrument?.name || 'เครื่องดนตรีไทย'}</p>
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
          <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <label className="flex h-12 min-w-[150px] shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-900">
              <Music2 size={18} className="shrink-0" />
              <select
                value={displayInstrument?.id || ''}
                onChange={(event) => changeInstrument?.(event.target.value)}
                disabled={isReadOnly}
                className="min-w-0 flex-1 bg-transparent outline-none"
                aria-label="เลือกเครื่องดนตรี"
              >
                {Object.values(INSTRUMENT_CONFIG).map((instrument) => (
                  <option key={instrument.id} value={instrument.id} disabled={!canAccess(`instrument:${instrument.id}`, userRole)}>{instrument.name}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setKeyboardMode('notes')} className={`flex h-12 min-w-[84px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black ${activeKeyboardMode === 'notes' ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
              <Keyboard size={17} /> โน้ต
            </button>
            {canUseCustomKeyboard && <button type="button" onClick={() => setKeyboardMode('custom')} className={`flex h-12 min-w-[88px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black ${activeKeyboardMode === 'custom' ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
              <FileText size={17} /> คำกำหนดเอง
            </button>}
            {displayInstrument?.type !== 'percussion' && <button type="button" onClick={() => setIntervalMode?.(intervalMode === '8' ? 'off' : '8')} className={`flex h-12 min-w-[82px] shrink-0 items-center justify-center rounded-xl border px-3 text-xs font-black ${intervalMode === '8' ? 'border-amber-400 bg-amber-400 text-amber-950' : 'border-slate-200 bg-white text-slate-600'}`}>
              คู่ 8 {intervalMode === '8' ? 'เปิด' : 'ปิด'}
            </button>}
            {displayInstrument?.type !== 'percussion' && <button type="button" onClick={() => setIsReduceMode?.(!isReduceMode)} className={`flex h-12 min-w-[82px] shrink-0 items-center justify-center rounded-xl border px-3 text-xs font-black ${isReduceMode ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
              ลดเสียง {isReduceMode ? 'เปิด' : 'ปิด'}
            </button>}
            <button type="button" onClick={() => setIsToolsOpen(true)} className="flex h-12 min-w-[92px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-black text-indigo-700">
              <SlidersHorizontal size={17} /> เครื่องมือ
            </button>
          </div>

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

          {activeKeyboardMode === 'notes' ? (
            <div className="flex items-stretch gap-1.5 overflow-x-auto border-t border-sky-100 bg-sky-50/70 px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button type="button" onClick={() => inputNote?.('-')} disabled={!hasCell || isReadOnly} className="flex h-[76px] min-w-[66px] shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40">
                <span className="text-2xl font-black">—</span>
                <span className="mt-1 text-[9px] font-bold">พักเสียง</span>
              </button>
              {keys.map((key, index) => (
                <button
                  key={`${key.eng}-${index}`}
                  type="button"
                  onClick={() => insertInstrumentNote(key)}
                  disabled={!hasCell || isReadOnly}
                  className="flex h-[76px] min-w-[64px] shrink-0 flex-col items-center justify-center rounded-xl border border-slate-300 border-b-4 bg-white text-slate-800 shadow-sm active:translate-y-0.5 active:border-b-2 disabled:opacity-40"
                >
                  <span className="text-[9px] font-bold text-slate-400">{key.eng}</span>
                  <span className="mt-1 text-2xl font-black leading-none">{formatNote(isReduceMode && shiftNoteObject ? shiftNoteObject(key, 1) : key)}</span>
                </button>
              ))}
              <button type="button" onClick={() => inputNote?.('BACKSPACE')} disabled={!hasCell || isReadOnly} className="flex h-[76px] min-w-[72px] shrink-0 flex-col items-center justify-center rounded-xl border border-rose-200 border-b-4 bg-rose-50 text-rose-600 shadow-sm active:translate-y-0.5 active:border-b-2 disabled:opacity-40">
                <Trash2 size={24} />
                <span className="mt-1 text-[9px] font-black">ลบโน้ต</span>
              </button>
            </div>
          ) : (
            <div className="border-t border-violet-100 bg-violet-50/70 px-3 py-2.5">
              <div className="mb-2 flex items-center gap-2">
                <form onSubmit={addCustomKey} className="flex min-w-0 flex-1 items-center gap-2">
                  <input value={customDraft} onChange={(event) => setCustomDraft(event.target.value)} maxLength={CUSTOM_KEYBOARD_MAX_LABEL_LENGTH} placeholder="พิมพ์คำสำหรับสร้างปุ่ม" disabled={isReadOnly || customKeys.length >= CUSTOM_KEYBOARD_MAX_KEYS} className="h-11 min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-3 text-sm font-semibold outline-none focus:border-violet-400" />
                  <button type="submit" disabled={!normalizeCustomText(customDraft) || isReadOnly || customKeys.length >= CUSTOM_KEYBOARD_MAX_KEYS} className="h-11 shrink-0 rounded-xl bg-violet-600 px-4 text-xs font-black text-white disabled:opacity-40">เพิ่มปุ่ม</button>
                </form>
                <button type="button" onClick={() => setAppendCustomText((current) => !current)} className={`h-11 shrink-0 rounded-xl border px-3 text-[10px] font-black ${appendCustomText ? 'border-amber-400 bg-amber-400 text-amber-950' : 'border-slate-200 bg-white text-slate-600'}`}>ต่อคำ {appendCustomText ? 'เปิด' : 'ปิด'}</button>
              </div>
              <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {customKeys.map((key) => (
                  <div key={key.id} className="flex h-[72px] min-w-[92px] shrink-0 flex-col overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
                    <button type="button" onClick={() => appendCustomText ? appendCustomTextToCurrentCell?.(key.label) : inputCustomText?.(key.label)} disabled={!hasCell || isReadOnly} className="min-h-0 flex-1 px-3 text-sm font-black text-violet-800 disabled:opacity-40">{key.label}</button>
                    <button type="button" onClick={() => updateCustomKeys(customKeys.filter((item) => item.id !== key.id))} disabled={isReadOnly} className="h-6 border-t border-violet-100 text-[9px] font-bold text-rose-500 disabled:opacity-40">ลบปุ่ม</button>
                  </div>
                ))}
                {customKeys.length === 0 && <div className="flex h-[72px] min-w-full items-center justify-center rounded-xl border border-dashed border-violet-200 bg-white px-4 text-xs font-bold text-violet-400">พิมพ์คำด้านบนแล้วกด “เพิ่มปุ่ม”</div>}
              </div>
            </div>
          )}
        </>
      )}

      {isToolsOpen && (
        <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/45" onClick={() => setIsToolsOpen(false)}>
          <section className="max-h-[78vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 shadow-2xl" onClick={(event) => event.stopPropagation()} aria-label="เครื่องมือแก้ไขมือถือ">
            <div className="mb-4 flex items-center justify-between">
              <div><h3 className="text-lg font-black text-slate-900">เครื่องมือแก้ไข</h3><p className="text-xs font-semibold text-slate-400">จัดโครงสร้างและขนาดกระดาษ</p></div>
              <button type="button" onClick={() => setIsToolsOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><X size={22} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SmallAction icon={Rows3} label="บรรทัดเดี่ยว" onClick={() => addRow?.()} disabled={isReadOnly} />
              <SmallAction icon={Rows3} label="บรรทัดคู่" onClick={() => addDoubleRow?.()} disabled={isReadOnly} />
              <SmallAction icon={Trash2} label="ลบบรรทัด" onClick={() => removeRow?.()} disabled={isReadOnly} danger />
              <SmallAction icon={FilePlus2} label="ขึ้นหน้าใหม่" onClick={() => addPageBreak?.()} disabled={isReadOnly} />
              <SmallAction icon={FileText} label="ช่องข้อความ" onClick={() => convertMeasureToText?.()} disabled={!hasCell || isReadOnly} />
              <SmallAction icon={FileText} label="คำอธิบาย" onClick={() => addAnnotationRow?.()} disabled={isReadOnly} />
              <SmallAction icon={Maximize2} label="ขยาย 4→8" onClick={() => expandSelectedMeasures?.()} disabled={!canExpand || isReadOnly} />
              <SmallAction icon={Drum} label="เครื่องจังหวะ" onClick={() => openPanel(onOpenMetronome)} />
              <SmallAction icon={Settings} label="ตั้งค่ากระดาษ" onClick={() => openPanel(onOpenSettings)} />
            </div>
            <p className="mb-2 mt-5 text-xs font-black text-slate-400">เครื่องมือแบบคอม</p>
            <div className="grid grid-cols-3 gap-2">
              <SmallAction icon={ListMusic} label="ลำดับเพลง" onClick={() => openEditorPanel('sequence')} />
              <SmallAction icon={Tag} label="ป้ายกำกับ" onClick={() => openEditorPanel('labels')} />
              <SmallAction icon={Table2} label="ตั้งค่าตาราง" onClick={() => openEditorPanel('table')} />
              <SmallAction icon={Volume2} label="น้ำหนักเสียง" onClick={() => openEditorPanel('velocity')} />
              <SmallAction icon={Waves} label="ลูกสะบัด" onClick={() => openEditorPanel('sabat')} />
              <SmallAction icon={AudioLines} label="ลูกกรอ" onClick={() => openEditorPanel('kro')} />
            </div>
            <p className="mb-2 mt-5 text-xs font-black text-slate-400">ขนาดกระดาษ</p>
            <div className="grid grid-cols-3 gap-2">
              <SmallAction icon={ZoomOut} label="ดูทั้งหน้า" onClick={() => window.dispatchEvent(new CustomEvent('tme-sheet-zoom', { detail: { value: 48 } }))} />
              <SmallAction icon={ZoomIn} label="แตะง่าย" onClick={() => window.dispatchEvent(new CustomEvent('tme-sheet-zoom', { detail: { value: 160 } }))} active />
              <SmallAction icon={ZoomIn} label="ขยายสุด" onClick={() => window.dispatchEvent(new CustomEvent('tme-sheet-zoom', { detail: { value: 200 } }))} />
            </div>
            <p className="mb-2 mt-5 text-xs font-black text-slate-400">เปลี่ยนหน้ากระดาษ</p>
            <div className="grid grid-cols-2 gap-2">
              <SmallAction icon={ChevronLeft} label="หน้าก่อนหน้า" onClick={() => { setIsToolsOpen(false); window.dispatchEvent(new CustomEvent('tme-sheet-page', { detail: { delta: -1 } })); }} />
              <SmallAction icon={ChevronRight} label="หน้าถัดไป" onClick={() => { setIsToolsOpen(false); window.dispatchEvent(new CustomEvent('tme-sheet-page', { detail: { delta: 1 } })); }} />
            </div>
          </section>
        </div>
      )}
    </footer>
  );
};

export default MobileEditControls;
