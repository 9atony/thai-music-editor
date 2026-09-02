import React, { useState, useContext, useEffect } from 'react';
import { MusicContext } from '../../../contexts/MusicContext';
import SequenceTab from './SequenceTab';
import LabelsTab from './LabelsTab';
import TableTab from './TableTab';
import SabatTab from './SabatTab';
import KroTab from './KroTab';
// ⭐ 1. นำเข้าไฟล์แท็บใหม่ที่เพิ่งสร้าง
import VelocityTab from './VelocityTab'; 

const EditorSidebar = () => {
  const { selectedSymbolId, symbols } = useContext(MusicContext);
  const [activeSidePanel, setActiveSidePanel] = useState(null);

  // เช็กว่ากำลังเลือกสัญลักษณ์อะไรอยู่ เพื่อเปิดแถบให้ตรงกันอัตโนมัติ
  useEffect(() => {
    if (selectedSymbolId) {
      const sym = symbols.find(s => s.id === selectedSymbolId);
      if (sym) {
        if (sym.type === 'sabat') setActiveSidePanel('sabat');
        else if (sym.type === 'kro') setActiveSidePanel('kro');
      }
    }
  }, [selectedSymbolId, symbols]);

  // ตัวรับสัญญาณ: ถ้ามีใครสั่ง 'tme-open-labels-tab' ให้เปิดแท็บป้ายกำกับทันที!
  useEffect(() => {
    const handleOpenLabels = () => setActiveSidePanel('labels');
    window.addEventListener('tme-open-labels-tab', handleOpenLabels);
    return () => window.removeEventListener('tme-open-labels-tab', handleOpenLabels);
  }, []);

  const panels = [
    {
      id: 'sequence', label: 'ลำดับการเล่น', icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M4 6h16M4 12h16M4 18h7M15 15l5-3-5-3v6z" /></svg>,
    },
    {
      id: 'labels', label: 'ป้ายกำกับ', icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
    },
    {
      id: 'table', label: 'ตั้งค่าตาราง', icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    },
    {
      id: 'velocity', label: 'น้ำหนักเสียง', separator: true, icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>,
    },
    {
      id: 'sabat', label: 'ตั้งค่าลูกสะบัด', separator: true, icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M4 8c4-4 8 8 16 0M4 8c0 4 8 0 16 0" /></svg>,
    },
    {
      id: 'kro', label: 'ตั้งค่าลูกกรอ', icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M4 12h16M4 12l2-2m-2 2l2 2m14-2l-2-2m2 2l-2 2" /></svg>,
    },
  ];

  return (
    <div className={`editor-tool-sidebar absolute top-0 left-0 z-40 flex h-full flex-col border-r border-slate-200 bg-slate-50 shadow-[12px_0_32px_rgba(15,23,42,0.12)] transition-transform duration-300 ${activeSidePanel ? 'w-[304px] translate-x-0' : 'w-[304px] -translate-x-full'}`} style={{ fontFamily: 'Prompt, Sarabun, sans-serif' }}>
      <style>{`
        .editor-tool-sidebar .tool-tab-root { background: #f8fafc; }
        .editor-tool-sidebar .tool-tab-header { min-height: 64px; padding: 14px 16px !important; background: rgba(255,255,255,.96) !important; border-color: #e2e8f0 !important; box-shadow: 0 1px 0 rgba(15,23,42,.03) !important; }
        .editor-tool-sidebar .tool-tab-header h3 { color: #0f172a !important; font-size: 13px !important; font-weight: 800 !important; letter-spacing: -.01em; }
        .editor-tool-sidebar .tool-tab-header h3 svg { color: #0ea5e9 !important; }
        .editor-tool-sidebar .tool-tab-header p { color: #64748b !important; font-size: 10px !important; font-weight: 500 !important; }
        .editor-tool-sidebar .tool-tab-body { padding: 14px !important; gap: 12px !important; }
        .editor-tool-sidebar .tool-tab-card { border-radius: 14px !important; border-color: #e2e8f0 !important; box-shadow: 0 1px 2px rgba(15,23,42,.04) !important; }
        .editor-tool-sidebar .tool-tab-body h4 { font-size: 11px !important; font-weight: 800 !important; color: #334155 !important; }
        .editor-tool-sidebar .tool-tab-body label { font-size: 11px !important; }
      `}</style>
      
      {/* ================= ปุ่มเปิด/ปิด ================= */}
      <div className="absolute top-3 -right-[44px] z-50 flex flex-col gap-1.5">
        {panels.map((panel) => (
          <button
            key={panel.id}
            type="button"
            onClick={() => setActiveSidePanel(activeSidePanel === panel.id ? null : panel.id)}
            aria-label={panel.label}
            aria-pressed={activeSidePanel === panel.id}
            title={panel.label}
            className={`flex h-10 w-11 items-center justify-center rounded-r-xl border border-l-0 shadow-sm transition-all ${panel.separator ? 'mt-2.5' : ''} ${activeSidePanel === panel.id ? 'border-sky-600 bg-sky-500 text-white shadow-sky-200' : 'border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600'}`}
          >
            {panel.icon}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeSidePanel === 'sequence' && <SequenceTab />}
        {activeSidePanel === 'labels' && <LabelsTab />}
        {activeSidePanel === 'table' && <TableTab />}
        {/* ⭐ 3. ฝัง Component ของแท็บเสียง */}
        {activeSidePanel === 'velocity' && <VelocityTab />}
        {activeSidePanel === 'sabat' && <SabatTab />}
        {activeSidePanel === 'kro' && <KroTab />}
      </div>
    </div>
  );
};

export default EditorSidebar;
