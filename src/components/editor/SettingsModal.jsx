import React, { useContext, useState } from 'react';
import { MusicContext } from '../../contexts/MusicContext';
import { INSTRUMENT_CONFIG } from '../../utils/instrumentConfig';
import { useFeatureAccess } from '../../contexts/FeatureAccessContext';

const SettingsModal = ({ isOpen, onClose }) => {
  const { canAccess } = useFeatureAccess();
  const { 
    currentInstrument, changeInstrument, 
    songName, setSongName,
    layoutConfig, setLayoutConfig,
    headerDetails, addDetail, removeDetail, updateDetail, userRole, isReadOnly
  } = useContext(MusicContext);
  
  const [activeTab, setActiveTab] = useState('info');

  const getPlainText = (value = '') => {
    const temp = document.createElement('div');
    temp.innerHTML = String(value ?? '');
    return temp.textContent || temp.innerText || '';
  };

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
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity sm:items-center sm:p-4">
      <div className="touch-project-settings flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-fade-in-up sm:max-h-[85vh] sm:rounded-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5 text-slate-800">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <h2 className="text-lg font-bold">การตั้งค่าโปรเจกต์</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 pt-3 sm:gap-2 sm:px-6 sm:pt-4">
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
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold transition-all sm:px-4 sm:text-sm ${
                activeTab === tab.id ? 'border-sky-500 text-sky-600 bg-sky-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className={activeTab === tab.id ? 'text-sky-500' : 'text-slate-400'}>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[#f8fafd] p-4 sm:p-6">
          
          {/* ข้อมูลโปรเจกต์ */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <section>
                <label htmlFor="project-song-name" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg>
                  ชื่อเพลง / ชื่อโปรเจกต์
                </label>
                <input
                  id="project-song-name"
                  type="text"
                  value={getPlainText(songName)}
                  onChange={(event) => setSongName(event.target.value)}
                  disabled={isReadOnly}
                  maxLength={160}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-400"
                  placeholder="พิมพ์ชื่อเพลง"
                />
                <p className="mt-1.5 text-[10px] font-medium text-slate-400">ชื่อนี้จะแสดงบนหัวกระดาษและใช้เป็นชื่อโปรเจกต์</p>
              </section>

              <section>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                  เครื่องดนตรีหลัก
                </label>
                <select 
                  value={currentInstrument.id}
                  onChange={(e) => {
                    if (canAccess(`instrument:${e.target.value}`, userRole)) changeInstrument(e.target.value);
                  }}
                  className="w-full p-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 font-bold transition-all"
                >
                  {Object.values(INSTRUMENT_CONFIG).map((inst) => (
                    <option key={inst.id} value={inst.id} disabled={!canAccess(`instrument:${inst.id}`, userRole)}>{inst.name}{canAccess(`instrument:${inst.id}`, userRole) ? '' : ' (ล็อก)'}</option>
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
                      <div key={detail.id} className="group relative flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-3 pr-12 sm:flex-row sm:items-center sm:gap-2 sm:p-2 sm:pr-8">
                        <button type="button" onClick={() => removeDetail(detail.id)} disabled={isReadOnly} className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-xs font-black text-white opacity-100 transition-opacity disabled:opacity-40 sm:-right-2 sm:-top-2 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100" aria-label="ลบรายละเอียด">✕</button>
                        <input type="text" value={detail.label} onChange={(e) => updateDetail(detail.id, 'label', e.target.value)} disabled={isReadOnly} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 outline-none focus:border-sky-400 focus:text-sky-600 disabled:bg-slate-100 sm:h-auto sm:w-1/3 sm:border-0 sm:bg-transparent sm:px-0" placeholder="หัวข้อ" />
                        <span className="hidden text-slate-300 sm:inline">:</span>
                        <input type="text" value={detail.value} onChange={(e) => updateDetail(detail.id, 'value', e.target.value)} disabled={isReadOnly} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 disabled:bg-slate-100 sm:h-auto sm:w-2/3 sm:border-0 sm:bg-transparent sm:px-0" placeholder="รายละเอียด" />
                      </div>
                    ))}
                    <button type="button" onClick={addDetail} disabled={isReadOnly} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-sm font-semibold text-slate-500 transition-all hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600 disabled:bg-slate-100 disabled:text-slate-300">
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
                <div className="border-t border-slate-100 pt-4">
                  <label className="text-xs text-slate-500 font-bold mb-1.5 flex items-center justify-between">
                    <span>ระยะห่างก่อนเส้นคั่น</span>
                    <span className="font-bold text-sky-600">{layoutConfig.headerBottomSpacing ?? 8}px</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="48"
                    value={layoutConfig.headerBottomSpacing ?? 8}
                    onChange={(e) => updateLayout('headerBottomSpacing', parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg accent-sky-500 cursor-pointer"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">ลดค่าเพื่อเลื่อนเส้นขึ้นและให้บรรทัดเพลงด้านล่างถดขึ้น</p>
                </div>
              </section>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6 sm:py-4">
          <button type="button" onClick={onClose} className="min-h-11 w-full rounded-xl bg-sky-500 px-6 py-2 font-bold text-white shadow-sm transition-colors hover:bg-sky-600 sm:w-auto">
            เสร็จสิ้น
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
