import React, { useState } from 'react';
import SequenceTab from './SequenceTab';
import LabelsTab from './LabelsTab';
import TableTab from './TableTab';

const EditorSidebar = () => {
  const [activeSidePanel, setActiveSidePanel] = useState(null);

  return (
    <div className={`absolute top-0 left-0 h-full z-40 bg-white border-r border-slate-200 shadow-xl transition-transform duration-300 flex flex-col ${activeSidePanel ? 'w-[260px] translate-x-0' : 'w-[260px] -translate-x-full'}`}>
      
      {/* ================= ปุ่มเปิด/ปิด 1: ลำดับการเล่น ================= */}
      <button 
        onClick={() => setActiveSidePanel(activeSidePanel === 'sequence' ? null : 'sequence')}
        className={`absolute top-4 -right-[41px] border-y border-r border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group
          ${activeSidePanel === 'sequence' ? 'bg-sky-500 text-white border-sky-600' : 'bg-white text-slate-500 hover:text-sky-500'}`}
        title="ลำดับการเล่น"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7M15 15l5-3-5-3v6z" /></svg>
      </button>

      {/* ================= ปุ่มเปิด/ปิด 2: ป้ายกำกับ ================= */}
      <button 
        onClick={() => setActiveSidePanel(activeSidePanel === 'labels' ? null : 'labels')}
        className={`absolute top-16 -right-[41px] border-y border-r border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group
          ${activeSidePanel === 'labels' ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-white text-slate-500 hover:text-indigo-500'}`}
        title="ป้ายกำกับ"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
      </button>

      {/* ================= ปุ่มเปิด/ปิด 3: ตั้งค่าตาราง ================= */}
      <button 
        onClick={() => setActiveSidePanel(activeSidePanel === 'table' ? null : 'table')}
        className={`absolute top-28 -right-[41px] border-y border-r border-slate-200 rounded-r-xl p-2.5 shadow-sm transition-colors z-50 group
          ${activeSidePanel === 'table' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-500 hover:text-emerald-500'}`}
        title="ตั้งค่าตาราง"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      </button>

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeSidePanel === 'sequence' && <SequenceTab />}
        {activeSidePanel === 'labels' && <LabelsTab />}
        {activeSidePanel === 'table' && <TableTab />}
      </div>
    </div>
  );
};

export default EditorSidebar;