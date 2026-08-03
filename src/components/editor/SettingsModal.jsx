import React, { useContext, useState } from 'react';
import { MusicContext } from '../../contexts/MusicContext';
import { INSTRUMENT_CONFIG } from '../../utils/instrumentConfig';

const SettingsModal = ({ isOpen, onClose }) => {
  const { 
    currentInstrument, changeInstrument, 
    layoutConfig, setLayoutConfig,
    headerDetails, addDetail, removeDetail, updateDetail
  } = useContext(MusicContext);
  
  const [activeTab, setActiveTab] = useState('info');

  if (!isOpen) return null;

  const updateLayout = (key, value) => {
    setLayoutConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleUnitChange = (e) => {
    const newUnit = e.target.value;
    const oldUnit = layoutConfig.marginUnit || 'px';
    if (oldUnit === newUnit) return;
    const convert = (val) => {
      const px = oldUnit === 'cm' ? val * 37.795275 : (oldUnit === 'in' ? val * 96 : val);
      const res = newUnit === 'cm' ? px / 37.795275 : (newUnit === 'in' ? px / 96 : px);
      return Math.round(res * 100) / 100;
    };
    setLayoutConfig({
      ...layoutConfig,
      marginUnit: newUnit,
      marginTop: convert(layoutConfig.marginTop ?? 48),
      marginBottom: convert(layoutConfig.marginBottom ?? 48),
      marginLeft: convert(layoutConfig.marginLeft ?? 48),
      marginRight: convert(layoutConfig.marginRight ?? 48),
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5 text-slate-800">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <h2 className="text-lg font-bold">การตั้งค่าโปรเจกต์</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 gap-2 border-b border-slate-200 bg-white">
          {[
            { 
              id: 'info', 
              label: 'ข้อมูลโปรเจกต์', 
              icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            },
            { 
              id: 'style', 
              label: 'ตั้งค่ากระดาษ', 
              icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
            }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
                activeTab === tab.id ? 'border-sky-500 text-sky-600 bg-sky-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className={activeTab === tab.id ? 'text-sky-500' : 'text-slate-400'}>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#f8fafd]">
          
          {/* ข้อมูลโปรเจกต์ */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <section>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                  เครื่องดนตรีหลัก
                </label>
                <select 
                  value={currentInstrument.id}
                  onChange={(e) => changeInstrument(e.target.value)}
                  className="w-full p-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 font-bold transition-all"
                >
                  {Object.values(INSTRUMENT_CONFIG).map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </section>

              <section>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  รายละเอียดเพิ่มเติม (มุมขวาบน)
                </label>
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
                  <div className="space-y-2">
                    {headerDetails.map((detail) => (
                      <div key={detail.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-md border border-slate-100 group relative">
                        <button onClick={() => removeDetail(detail.id)} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-10">✕</button>
                        <input type="text" value={detail.label} onChange={(e) => updateDetail(detail.id, 'label', e.target.value)} className="w-1/3 text-xs font-bold text-slate-500 bg-transparent focus:text-sky-600 outline-none" placeholder="หัวข้อ" />
                        <span className="text-slate-300">:</span>
                        <input type="text" value={detail.value} onChange={(e) => updateDetail(detail.id, 'value', e.target.value)} className="w-2/3 text-sm text-slate-700 bg-transparent outline-none" placeholder="รายละเอียด" />
                      </div>
                    ))}
                    <button onClick={addDetail} className="w-full py-2 border border-dashed border-slate-300 rounded-md text-sm text-slate-500 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50 transition-all font-semibold flex justify-center items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      เพิ่มข้อมูล
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ตั้งค่ากระดาษ */}
          {activeTab === 'style' && (
            <div className="space-y-6">
              <section className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    ระยะขอบกระดาษ
                  </label>
                  <select value={layoutConfig.marginUnit || 'px'} onChange={handleUnitChange} className="text-xs border border-slate-200 rounded-md bg-slate-50 py-1 px-2 font-bold text-sky-600 focus:outline-none focus:border-sky-300">
                    <option value="px">พิกเซล (px)</option>
                    <option value="cm">เซนติเมตร (cm)</option>
                    <option value="in">นิ้ว (in)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {['Top', 'Bottom', 'Left', 'Right'].map((pos) => (
                    <div key={pos}>
                      <label className="text-xs text-slate-500 font-bold mb-1 block">ขอบ{pos === 'Top' ? 'บน' : pos === 'Bottom' ? 'ล่าง' : pos === 'Left' ? 'ซ้าย' : 'ขวา'}</label>
                      <input type="number" step="0.1" value={layoutConfig[`margin${pos}`] ?? 48} onChange={(e) => updateLayout(`margin${pos}`, parseFloat(e.target.value) || 0)} className="w-full border border-slate-200 rounded-md p-2 text-sm text-center focus:ring-2 focus:ring-sky-200 focus:outline-none" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg transition-colors shadow-sm">
            เสร็จสิ้น
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;