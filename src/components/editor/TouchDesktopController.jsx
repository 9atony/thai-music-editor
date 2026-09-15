import React, { useContext, useState } from 'react';
import {
  AlignJustify,
  AudioLines,
  ChevronLeft,
  ClipboardPaste,
  Columns3,
  Copy,
  Download,
  Drum,
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  Keyboard as KeyboardIcon,
  ListMusic,
  Maximize2,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Redo2,
  Repeat,
  Repeat1,
  Rows3,
  Save,
  Scissors,
  Settings,
  SkipBack,
  SkipForward,
  Table2,
  Tag,
  Trash2,
  Undo2,
  Upload,
  Volume2,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { MusicContext } from '../../contexts/MusicContext';
import { useFeatureAccess } from '../../contexts/FeatureAccessContext';

const tabs = [
  { id: 'quick', label: 'ใช้งานด่วน' },
  { id: 'edit', label: 'แก้ไข' },
  { id: 'tools', label: 'เครื่องมือ' },
  { id: 'files', label: 'ไฟล์' },
];

const ActionButton = ({ icon: Icon, label, hint, onClick, disabled = false, tone = 'slate', danger = false, children }) => {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  };
  const className = `flex min-h-[92px] w-full items-center gap-4 rounded-2xl border-2 px-5 text-left shadow-sm transition active:scale-[0.98] ${
    disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60' : danger ? tones.rose : tones[tone]
  }`;

  const content = (
    <>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
        {Icon && <Icon size={30} strokeWidth={2.2} aria-hidden="true" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-black leading-tight">{label}</span>
        {hint && <span className="mt-1 block text-sm font-semibold opacity-70">{hint}</span>}
      </span>
    </>
  );

  if (children) {
    return <label className={`${className} cursor-pointer`}>{content}{children}</label>;
  }

  return <button type="button" onClick={onClick} disabled={disabled} className={className}>{content}</button>;
};

const ValueControl = ({ label, value, min, max, step = 1, onChange, suffix = '' }) => (
  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <span className="text-xl font-black text-slate-800">{label}</span>
      <span className="rounded-xl bg-white px-4 py-2 text-xl font-black text-sky-700 shadow-sm">{value}{suffix}</span>
    </div>
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-3xl font-black text-slate-700 active:bg-slate-100" aria-label={`ลด${label}`}>−</button>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-4 min-w-0 flex-1 cursor-pointer accent-sky-600" aria-label={label} />
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-3xl font-black text-slate-700 active:bg-slate-100" aria-label={`เพิ่ม${label}`}>+</button>
    </div>
  </div>
);

const TouchDesktopController = ({ isOpen, onClose, onOpenSettings, onPrint, onBack, onOpenEditorPanel }) => {
  const { canAccess } = useFeatureAccess();
  const {
    isPlaying,
    togglePlay,
    skipToPrev,
    skipToNext,
    isLoopAll,
    setIsLoopAll,
    isLoopOne,
    setIsLoopOne,
    layoutConfig,
    setLayoutConfig,
    setIsTempoTrackOpen,
    undo,
    redo,
    canUndo,
    canRedo,
    saveProject,
    newProject,
    loadProject,
    importThaiMusicXml,
    exportThaiMusicXml,
    stopPlayback,
    userRole,
    isReadOnly,
    selectedCell,
    selectionRange,
    copySelection,
    pasteSelection,
    cutSelection,
    inputNote,
    addRow,
    addDoubleRow,
    removeRow,
    addMeasure,
    removeMeasure,
    addNoteColumn,
    removeNoteColumn,
    addPageBreak,
    convertMeasureToText,
    addAnnotationRow,
    expandSelectedMeasures,
  } = useContext(MusicContext);
  const [activeTab, setActiveTab] = useState('quick');

  if (!isOpen) return null;

  const closeAndRun = (action) => {
    onClose();
    window.setTimeout(action, 0);
  };
  const dispatch = (name, detail) => window.dispatchEvent(detail ? new CustomEvent(name, { detail }) : new Event(name));
  const setZoom = (value) => dispatch('tme-sheet-zoom', { value });
  const changeZoom = (delta) => dispatch('tme-sheet-zoom', { delta });
  const hasSelection = Boolean(selectedCell || selectionRange?.start);
  const canExpand = Boolean(selectionRange?.start && selectionRange?.end && !selectionRange?.labelOnly);

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-[2px]" onClick={onClose}>
      <section
        className="flex max-h-[82vh] w-[min(960px,calc(100vw-24px))] flex-col overflow-hidden rounded-t-[36px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        aria-label="ศูนย์ควบคุมมือถือ"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-7 py-5">
          <div>
            <h2 className="text-3xl font-black text-slate-900">ศูนย์ควบคุมมือถือ</h2>
            <p className="mt-1 text-base font-semibold text-slate-500">ปุ่มใหญ่สำหรับโหมดเว็บไซต์เดสก์ท็อป</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:bg-slate-200" aria-label="ปิดศูนย์ควบคุม">
            <X size={34} strokeWidth={2.4} />
          </button>
        </header>

        <nav className="grid shrink-0 grid-cols-4 gap-2 border-b border-slate-200 bg-white px-5 py-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-14 rounded-xl px-3 text-base font-black transition ${activeTab === tab.id ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="overflow-y-auto overscroll-contain p-5 pb-8">
          {activeTab === 'quick' && (
            <>
              <p className="mb-3 text-base font-bold text-slate-500">ควบคุมหลัก</p>
              <div className="grid grid-cols-2 gap-4">
                <ActionButton icon={isPlaying ? Pause : Play} label={isPlaying ? 'หยุดเล่น' : 'เล่นเพลง'} hint="เริ่มหรือหยุดเสียง" onClick={togglePlay} tone="emerald" />
                <ActionButton icon={KeyboardIcon} label="คีย์บอร์ดโน้ต" hint="เปิดแป้นโน้ตด้านล่าง" onClick={() => closeAndRun(() => dispatch('tme-open-keyboard'))} tone="sky" />
                <ActionButton icon={Undo2} label="ย้อนกลับ" hint="Undo" onClick={undo} disabled={!canUndo || isReadOnly} />
                <ActionButton icon={Redo2} label="ทำซ้ำ" hint="Redo" onClick={redo} disabled={!canRedo || isReadOnly} />
                <ActionButton icon={Drum} label="เครื่องประกอบ" hint="จังหวะ ฉิ่ง กลอง และกรับ" onClick={() => closeAndRun(() => dispatch('tme-open-metronome'))} tone="amber" />
                <ActionButton icon={Settings} label="ตั้งค่าโปรเจกต์" hint="ข้อมูลเพลงและหน้ากระดาษ" onClick={() => closeAndRun(onOpenSettings)} />
                <ActionButton icon={Save} label="บันทึกไฟล์" hint="ดาวน์โหลดไฟล์ .tme" onClick={saveProject} tone="sky" />
                {canAccess('export-pdf', userRole) && <ActionButton icon={FileDown} label="ส่งออก PDF" hint="หยุดเสียงแล้วสร้าง PDF" onClick={() => closeAndRun(() => { stopPlayback(); onPrint(); })} tone="violet" />}
              </div>

              <p className="mb-3 mt-7 text-base font-bold text-slate-500">การเล่นแบบคอม</p>
              <div className="grid grid-cols-2 gap-4">
                <ActionButton icon={SkipBack} label="ท่อนก่อนหน้า" onClick={skipToPrev} />
                <ActionButton icon={SkipForward} label="ท่อนถัดไป" onClick={skipToNext} />
                <ActionButton icon={Repeat1} label="วนท่อนนี้" hint={isLoopOne ? 'เปิดอยู่' : 'ปิดอยู่'} onClick={() => setIsLoopOne?.(!isLoopOne)} tone={isLoopOne ? 'sky' : 'slate'} />
                <ActionButton icon={Repeat} label="วนทั้งเพลง" hint={isLoopAll ? 'เปิดอยู่' : 'ปิดอยู่'} onClick={() => setIsLoopAll?.(!isLoopAll)} tone={isLoopAll ? 'sky' : 'slate'} />
              </div>
              <div className="mt-4 grid gap-4">
                <ValueControl label="ความเร็ว" value={Number(layoutConfig?.bpm) || 80} min={20} max={300} step={5} suffix=" BPM" onChange={(bpm) => setLayoutConfig((current) => ({ ...current, bpm }))} />
                <ValueControl label="ความดัง" value={Number(layoutConfig?.volume ?? 100)} min={0} max={100} step={5} suffix="%" onChange={(volume) => setLayoutConfig((current) => ({ ...current, volume }))} />
                <ActionButton icon={AudioLines} label="กำหนดความเร็วรายช่วง" hint="เปิดเส้นความเร็วบนคีย์บอร์ด" onClick={() => closeAndRun(() => { dispatch('tme-open-keyboard'); setIsTempoTrackOpen(true); })} tone="amber" />
              </div>

              <p className="mb-3 mt-7 text-base font-bold text-slate-500">ขนาดกระดาษสำหรับแตะ</p>
              <div className="grid grid-cols-2 gap-4">
                <ActionButton icon={Maximize2} label="ดูทั้งหน้า" hint="ซูม 80%" onClick={() => setZoom(80)} />
                <ActionButton icon={ZoomIn} label="โหมดแตะง่าย" hint="ซูม 160% แล้วเลื่อนกระดาษ" onClick={() => setZoom(160)} tone="sky" />
                <ActionButton icon={ZoomOut} label="ย่อทีละ 10%" onClick={() => changeZoom(-10)} />
                <ActionButton icon={ZoomIn} label="ขยายทีละ 10%" onClick={() => changeZoom(10)} />
              </div>
              <p className="mt-4 rounded-2xl bg-sky-50 px-5 py-4 text-base font-semibold leading-relaxed text-sky-800">เวลาจะแก้โน้ต ให้กด “โหมดแตะง่าย” แล้วลากกระดาษซ้าย–ขวาเพื่อเลือกช่อง จากนั้นเปิดคีย์บอร์ดโน้ต</p>
            </>
          )}

          {activeTab === 'edit' && (
            <>
              <p className="mb-3 text-base font-bold text-slate-500">แก้ไขสิ่งที่เลือกอยู่บนกระดาษ</p>
              <div className="grid grid-cols-2 gap-4">
                <ActionButton icon={Copy} label="คัดลอก" onClick={copySelection} disabled={!hasSelection || isReadOnly} tone="violet" />
                <ActionButton icon={Scissors} label="ตัด" onClick={cutSelection} disabled={!hasSelection || isReadOnly} tone="violet" />
                <ActionButton icon={ClipboardPaste} label="วาง" onClick={pasteSelection} disabled={!selectedCell || isReadOnly} tone="violet" />
                <ActionButton icon={Trash2} label="ลบโน้ต" onClick={() => inputNote('BACKSPACE')} disabled={!selectedCell || isReadOnly} danger />
                <ActionButton icon={Columns3} label="เพิ่มจังหวะ" onClick={addNoteColumn} disabled={isReadOnly} tone="sky" />
                <ActionButton icon={Columns3} label="ลบจังหวะ" onClick={removeNoteColumn} disabled={isReadOnly} danger />
                <ActionButton icon={Plus} label="เพิ่มห้อง" onClick={addMeasure} disabled={isReadOnly} tone="emerald" />
                <ActionButton icon={Minus} label="ลบห้อง" onClick={removeMeasure} disabled={isReadOnly} danger />
                <ActionButton icon={Rows3} label="เพิ่มบรรทัด" onClick={addRow} disabled={isReadOnly} tone="violet" />
                <ActionButton icon={Rows3} label="เพิ่มบรรทัดคู่" onClick={addDoubleRow} disabled={isReadOnly} tone="violet" />
                <ActionButton icon={Trash2} label="ลบบรรทัด" onClick={removeRow} disabled={isReadOnly} danger />
                <ActionButton icon={FilePlus2} label="ขึ้นหน้าใหม่" onClick={addPageBreak} disabled={isReadOnly} />
                <ActionButton icon={FileText} label="ช่องพิมพ์ข้อความ" onClick={convertMeasureToText} disabled={!selectedCell || isReadOnly} />
                <ActionButton icon={AlignJustify} label="เพิ่มคำอธิบาย" onClick={addAnnotationRow} disabled={isReadOnly} tone="amber" />
                <ActionButton icon={Maximize2} label="ขยาย 4 เป็น 8 ช่อง" onClick={expandSelectedMeasures} disabled={!canExpand || isReadOnly} tone="violet" />
              </div>
            </>
          )}

          {activeTab === 'tools' && (
            <>
              <p className="mb-3 text-base font-bold text-slate-500">เปิดเครื่องมือด้านข้างด้วยปุ่มขนาดใหญ่</p>
              <div className="grid grid-cols-2 gap-4">
                <ActionButton icon={KeyboardIcon} label="คีย์บอร์ดโน้ต" onClick={() => closeAndRun(() => dispatch('tme-open-keyboard'))} tone="sky" />
                <ActionButton icon={Drum} label="เครื่องประกอบจังหวะ" onClick={() => closeAndRun(() => dispatch('tme-open-metronome'))} tone="amber" />
                <ActionButton icon={Settings} label="ตั้งค่าหลัก" onClick={() => closeAndRun(onOpenSettings)} />
                <ActionButton icon={ListMusic} label="ลำดับเพลง" onClick={() => onOpenEditorPanel('sequence')} tone="violet" />
                <ActionButton icon={Tag} label="ป้ายกำกับ" onClick={() => onOpenEditorPanel('labels')} tone="amber" />
                <ActionButton icon={Table2} label="ตั้งค่าตาราง" onClick={() => onOpenEditorPanel('table')} />
                <ActionButton icon={Volume2} label="น้ำหนักเสียง" onClick={() => onOpenEditorPanel('velocity')} tone="sky" />
                <ActionButton icon={Waves} label="ลูกสะบัด" onClick={() => onOpenEditorPanel('sabat')} tone="violet" />
                <ActionButton icon={AudioLines} label="ลูกกรอ" onClick={() => onOpenEditorPanel('kro')} tone="emerald" />
              </div>
            </>
          )}

          {activeTab === 'files' && (
            <>
              <p className="mb-3 text-base font-bold text-slate-500">จัดการโปรเจกต์และส่งออก</p>
              <div className="grid grid-cols-2 gap-4">
                <ActionButton icon={FilePlus2} label="โปรเจกต์ใหม่" hint="เริ่มกระดาษใหม่" onClick={() => closeAndRun(newProject)} />
                <ActionButton icon={FolderOpen} label="เปิดไฟล์ .tme" hint="เลือกไฟล์จากมือถือ" tone="sky">
                  <input type="file" accept=".thai,.tme,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) closeAndRun(() => loadProject(file)); event.target.value = ''; }} />
                </ActionButton>
                <ActionButton icon={Upload} label="นำเข้า TXML" hint="ThaiMusicXML" tone="emerald">
                  <input type="file" accept=".txml,application/xml,text/xml" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) closeAndRun(() => importThaiMusicXml(file)); event.target.value = ''; }} />
                </ActionButton>
                {canAccess('export-txml', userRole) && <ActionButton icon={Download} label="ส่งออก TXML" onClick={exportThaiMusicXml} tone="emerald" />}
                {canAccess('export-musicxml', userRole) && <ActionButton icon={Music2} label="โน้ตสากล MusicXML" onClick={() => closeAndRun(() => dispatch('tme-open-musicxml-export'))} tone="violet" />}
                <ActionButton icon={Save} label="บันทึก .tme" onClick={saveProject} tone="sky" />
                {canAccess('export-pdf', userRole) && <ActionButton icon={FileDown} label="ส่งออก PDF" onClick={() => closeAndRun(() => { stopPlayback(); onPrint(); })} tone="violet" />}
                <ActionButton icon={ChevronLeft} label="กลับหน้าโปรเจกต์" onClick={() => closeAndRun(onBack)} />
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default TouchDesktopController;
