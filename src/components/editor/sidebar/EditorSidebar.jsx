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

  return (
    <div className={`absolute top-0 left-0 h-full z-40 bg-white border-r border-slate-200 shadow-xl transition-transform duration-300 flex flex-col ${activeSidePanel ? 'w-[280px] translate-x-0' : 'w-[280px] -translate-x-full'}`}>
      
      {/* ================= ปุ่มเปิด/ปิด ================= */}
      <div className="absolute top-4 -right-[41px] flex flex-col gap-2">
        <button 
          onClick={() => setActiveSidePanel(activeSidePanel === 'sequence' ? null : 'sequence')}
          className={`border border-l-0 border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group
            ${activeSidePanel === 'sequence' ? 'bg-sky-500 text-white border-sky-600' : 'bg-white text-slate-500 hover:text-sky-500'}`}
          title="ลำดับการเล่น"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h7M15 15l5-3-5-3v6z" /></svg>
        </button>

        <button 
          onClick={() => setActiveSidePanel(activeSidePanel === 'labels' ? null : 'labels')}
          className={`border border-l-0 border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group
            ${activeSidePanel === 'labels' ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-white text-slate-500 hover:text-indigo-500'}`}
          title="ป้ายกำกับ"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
        </button>

        <button 
          onClick={() => setActiveSidePanel(activeSidePanel === 'table' ? null : 'table')}
          className={`border border-l-0 border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group
            ${activeSidePanel === 'table' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-500 hover:text-emerald-500'}`}
          title="ตั้งค่าตาราง"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>

        {/* ⭐ 2. เพิ่มปุ่มแท็บน้ำหนักเสียง (Velocity) โดยใช้สีเขียวมิ้นต์ (Teal) และเว้นระยะห่างแยกหมวดหมู่ */}
        <button 
          onClick={() => setActiveSidePanel(activeSidePanel === 'velocity' ? null : 'velocity')}
          className={`border border-l-0 border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group mt-4
            ${activeSidePanel === 'velocity' ? 'bg-teal-500 text-white border-teal-600' : 'bg-white text-slate-500 hover:text-teal-500'}`}
          title="น้ำหนักเสียง (Velocity)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
        </button>

        {/* ปุ่มลูกสะบัด */}
        <button 
          onClick={() => setActiveSidePanel(activeSidePanel === 'sabat' ? null : 'sabat')}
          className={`border border-l-0 border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group mt-4
            ${activeSidePanel === 'sabat' ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-500 hover:text-amber-500'}`}
          title="ตั้งค่าลูกสะบัด"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8c4-4 8 8 16 0M4 8c0 4 8 0 16 0" /></svg>
        </button>

        {/* ปุ่มลูกกรอ */}
        <button 
          onClick={() => setActiveSidePanel(activeSidePanel === 'kro' ? null : 'kro')}
          className={`border border-l-0 border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group
            ${activeSidePanel === 'kro' ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-slate-500 hover:text-blue-500'}`}
          title="ตั้งค่าลูกกรอ"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12h16M4 12l2-2m-2 2l2 2m14-2l-2-2m2 2l-2 2" /></svg>
        </button>
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