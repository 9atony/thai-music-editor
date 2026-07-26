import React, { useContext, useState } from 'react';
import { MusicContext } from '../../contexts/MusicContext';
import { INSTRUMENT_CONFIG } from '../../utils/instrumentConfig';

const SettingsModal = ({ isOpen, onClose }) => {
  const { 
    currentInstrument, changeInstrument, 
    layoutConfig, setLayoutConfig,
    headerDetails, addDetail, removeDetail, updateDetail,
    songName, setSongName
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">⚙️ การตั้งค่าโปรเจกต์</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs - ลบแท็บป้ายกำกับออกเหลือแค่ 2 แท็บ */}
        <div className="flex px-6 pt-4 gap-2 border-b border-slate-200 bg-white">
          {[
            { id: 'info', label: 'ข้อมูลโปรเจกต์', icon: '📄' },
            { id: 'style', label: 'ตั้งค่ากระดาษ', icon: '⚙️' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
                activeTab === tab.id ? 'border-sky-500 text-sky-600 bg-sky-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#f8fafd]">
          
          {/* ข้อมูลโปรเจกต์ */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <section>
                <label className="text-sm font-bold text-slate-700 block mb-2">🎹 เครื่องดนตรีหลัก</label>
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
                <label className="text-sm font-bold text-slate-700 block mb-2">📝 หัวกระดาษ (ชื่อเพลง)</label>
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
                  <input 
                    type="text" value={songName} onChange={(e) => setSongName(e.target.value)}
                    className="w-full p-2 text-sm text-sky-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-sky-400 font-bold text-center"
                    placeholder="พิมพ์ชื่อเพลงที่นี่..."
                  />
                  <div>
                    <label className="text-xs text-slate-500 flex justify-between mb-1.5">
                      <span>ขนาดอักษร</span>
                      <span className="font-bold text-sky-600">{layoutConfig.songNameSize}px</span>
                    </label>
                    <input type="range" min="20" max="100" value={layoutConfig.songNameSize} onChange={(e) => updateLayout('songNameSize', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-sky-500 cursor-pointer" />
                  </div>
                </div>
              </section>

              <section>
                <label className="text-sm font-bold text-slate-700 block mb-2">📌 รายละเอียดเพิ่มเติม (มุมขวาบน)</label>
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
                    <button onClick={addDetail} className="w-full py-2 border border-dashed border-slate-300 rounded-md text-sm text-slate-500 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50 transition-all font-semibold">
                      + เพิ่มข้อมูล
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
                  <label className="text-sm font-bold text-slate-700">📄 ระยะขอบกระดาษ</label>
                  <select value={layoutConfig.marginUnit || 'px'} onChange={handleUnitChange} className="text-xs border rounded bg-slate-50 py-1 px-2 font-bold text-sky-600 focus:outline-none">
                    <option value="px">Pixel (px)</option>
                    <option value="cm">Centimeter</option>
                    <option value="in">Inch</option>
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

              <section className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
                <label className="text-sm font-bold text-slate-700 block border-b border-slate-100 pb-2">📏 สัดส่วนตาราง</label>
                <div>
                  <label className="text-xs text-slate-500 flex justify-between mb-1.5"><span>ความสูงห้องเพลง</span><span className="font-bold text-sky-600">{layoutConfig.measureHeight}px</span></label>
                  <input type="range" min="30" max="100" value={layoutConfig.measureHeight} onChange={(e) => updateLayout('measureHeight', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-sky-500 cursor-pointer" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 flex justify-between mb-1.5"><span>ระยะห่างระหว่างบรรทัด</span><span className="font-bold text-sky-600">{layoutConfig.rowGap}px</span></label>
                  <input type="range" min="0" max="100" value={layoutConfig.rowGap} onChange={(e) => updateLayout('rowGap', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg accent-sky-500 cursor-pointer" />
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