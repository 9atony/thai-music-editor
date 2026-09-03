import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, FileMusic, X } from 'lucide-react';
import { parseStartingPitch } from '../../utils/musicXmlConverter.js';

const PRESETS = ['C4', 'Bb3', 'D4'];

const MusicXmlExportDialog = ({ isOpen, onClose, onExport }) => {
  const [startingPitch, setStartingPitch] = useState('C4');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const closeDialog = () => {
    setError('');
    onClose();
  };

  const handleExport = () => {
    try {
      const normalized = parseStartingPitch(startingPitch).name;
      onExport(normalized);
      closeDialog();
    } catch (exportError) {
      setError(exportError.message);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/45 p-3 backdrop-blur-sm sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="musicxml-export-title" className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><FileMusic size={20} aria-hidden="true" /></span>
            <div><h2 id="musicxml-export-title" className="font-black text-slate-900">แปลงเป็นโน้ตสากล</h2><p className="mt-0.5 text-xs text-slate-500">ส่งออกไฟล์ MusicXML สำหรับ MuseScore</p></div>
          </div>
          <button type="button" onClick={closeDialog} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="ปิดหน้าต่าง"><X size={18} /></button>
        </header>

        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <label htmlFor="musicxml-starting-pitch" className="text-sm font-bold text-slate-700">กำหนดเสียงของ “ด”</label>
            <p className="mt-1 text-xs leading-5 text-slate-500">ใช้รูปแบบชื่อโน้ตสากลและ octave เช่น C4, Bb3 หรือ F#4</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((preset) => <button key={preset} type="button" onClick={() => { setStartingPitch(preset); setError(''); }} className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${startingPitch === preset ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}>ด = {preset}</button>)}
            </div>
            <input id="musicxml-starting-pitch" value={startingPitch} onChange={(event) => { setStartingPitch(event.target.value); setError(''); }} className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" autoComplete="off" />
            {error && <p className="mt-2 text-xs font-semibold text-rose-600" role="alert">{error}</p>}
          </div>

          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs leading-5">การแปลงเริ่มต้นเป็นการเทียบเสียงแบบ 12-TET และอาจไม่ตรงกับระดับเสียงของวงดนตรีไทยจริงทุกกรณี</p>
          </div>
          <p className="text-xs leading-5 text-slate-500">ระบบจะสร้าง ThaiMusicXML v1.0 จากโน้ตปัจจุบันก่อน แล้วจึงแปลงเป็น MusicXML 4.0 แบบ 2/4 โดยคลี่ลำดับการเล่นตามที่กำหนดไว้</p>
        </div>

        <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={closeDialog} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200">ยกเลิก</button>
          <button type="button" onClick={handleExport} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">ดาวน์โหลด .musicxml</button>
        </footer>
      </section>
    </div>,
    document.body
  );
};

export default MusicXmlExportDialog;
