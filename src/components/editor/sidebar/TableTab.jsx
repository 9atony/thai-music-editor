import React, { useContext } from 'react';
import { MusicContext } from '../../../contexts/MusicContext';

const TableTab = () => {
  const { layoutConfig, setLayoutConfig } = useContext(MusicContext);

  const updateLayout = (key, value) => {
    setLayoutConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 animate-fadeIn">
      <div className="p-3 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center shrink-0">
        <h3 className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          ตั้งค่าตาราง
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-4">
        {/* --- ส่วนที่ 1: สัดส่วนตาราง --- */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="text-[11px] font-bold text-slate-700 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            📏 สัดส่วนตาราง
          </h4>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                <span>ความสูงห้องเพลง</span>
                <span className="font-bold text-emerald-600">{layoutConfig?.measureHeight || 50}px</span>
              </label>
              <input type="range" min="30" max="100" value={layoutConfig?.measureHeight || 50} onChange={(e) => updateLayout('measureHeight', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer" />
            </div>
            <div>
              <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                <span>ระยะห่างระหว่างบรรทัด</span>
                <span className="font-bold text-emerald-600">{layoutConfig?.rowGap || 10}px</span>
              </label>
              <input type="range" min="0" max="100" value={layoutConfig?.rowGap || 10} onChange={(e) => updateLayout('rowGap', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer" />
            </div>
          </div>
        </div>

        {/* --- ส่วนที่ 2: เส้นตาราง --- */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
            <h4 className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">✍️ เส้นตาราง</h4>
            <input type="color" value={layoutConfig?.borderColor || '#0f172a'} onChange={(e) => updateLayout('borderColor', e.target.value)} className="w-5 h-5 p-0 border-0 rounded cursor-pointer" title="สีเส้นตาราง" />
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                <span>เส้นขอบนอก</span>
                <span className="font-bold text-emerald-600">{layoutConfig?.outerBorderWidth !== undefined ? layoutConfig.outerBorderWidth : 1}px</span>
              </label>
              <input type="range" min="0" max="10" value={layoutConfig?.outerBorderWidth !== undefined ? layoutConfig.outerBorderWidth : 1} onChange={(e) => updateLayout('outerBorderWidth', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer" />
            </div>
            <div>
              <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                <span>เส้นกั้นภายในช่อง</span>
                <span className="font-bold text-emerald-600">{layoutConfig?.innerBorderWidth !== undefined ? layoutConfig.innerBorderWidth : 0}px</span>
              </label>
              <input type="range" min="0" max="10" value={layoutConfig?.innerBorderWidth !== undefined ? layoutConfig.innerBorderWidth : 0} onChange={(e) => updateLayout('innerBorderWidth', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer" />
            </div>
            <div>
              <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                <span>ความมนขอบตาราง</span>
                <span className="font-bold text-emerald-600">{layoutConfig?.borderRadius !== undefined ? layoutConfig.borderRadius : 6}px</span>
              </label>
              <input type="range" min="0" max="20" value={layoutConfig?.borderRadius !== undefined ? layoutConfig.borderRadius : 6} onChange={(e) => updateLayout('borderRadius', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer" />
            </div>
          </div>
        </div>
          
        {/* --- ส่วนที่ 3: เลข/เส้นระบุบรรทัด --- */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
            <h4 className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">🔢 เลข/เส้นระบุบรรทัด</h4>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={layoutConfig?.showRowNumber !== false} onChange={(e) => updateLayout('showRowNumber', e.target.checked)} className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer" />
                <span className="text-[10px] text-slate-500 font-bold">แสดง</span>
              </label>
              <input type="color" value={layoutConfig?.rowNumberColor || '#cbd5e1'} onChange={(e) => updateLayout('rowNumberColor', e.target.value)} className="w-5 h-5 p-0 border-0 rounded cursor-pointer disabled:opacity-50" title="สีเส้นและตัวเลข" disabled={layoutConfig?.showRowNumber === false} />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                <span>ความหนาเส้น (บรรทัดคู่)</span>
                <span className="font-bold text-emerald-600">{layoutConfig?.rowNumberWidth !== undefined ? layoutConfig.rowNumberWidth : 3}px</span>
              </label>
              <input type="range" min="1" max="10" value={layoutConfig?.rowNumberWidth !== undefined ? layoutConfig.rowNumberWidth : 3} onChange={(e) => updateLayout('rowNumberWidth', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer disabled:opacity-50" disabled={layoutConfig?.showRowNumber === false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableTab;