import React, { useContext } from 'react';
import { MusicContext } from '../../contexts/MusicContext'; 

const MetronomePanel = ({ isExpanded }) => {
  const { metronomeConfig, setMetronomeConfig } = useContext(MusicContext);
  const isLoading = metronomeConfig.rhythms.ching.length === 0;

  const updateConfig = (key, changes) => {
    setMetronomeConfig(prev => ({
      ...prev,
      [key]: { ...prev[key], ...changes }
    }));
  };

  const updateMasterVol = (vol) => {
    setMetronomeConfig(prev => ({ ...prev, masterVolume: vol }));
  };

  if (!isExpanded) return null;

  return (
    <div className="bg-slate-50 border-b border-slate-200 shadow-inner px-4 py-3 animate-slideDown">
      
      <div className="flex flex-col md:flex-row items-center gap-4 w-full">
        
        {/* เครื่องดนตรี 1: ฉิ่ง */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xl">🪘</span>
            <span className="font-bold text-slate-700 text-sm">ฉิ่ง</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={metronomeConfig.ching.active} onChange={() => updateConfig('ching', { active: !metronomeConfig.ching.active })} />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
            <select 
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600 disabled:opacity-50 min-w-[100px]"
              value={metronomeConfig.ching.pattern}
              onChange={(e) => updateConfig('ching', { pattern: e.target.value })}
              disabled={!metronomeConfig.ching.active || isLoading}
            >
              {isLoading ? <option value="">กำลังโหลด...</option> : metronomeConfig.rhythms.ching.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className={`flex items-center gap-1.5 ${metronomeConfig.ching.active ? 'opacity-100' : 'opacity-40'}`}>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 10c0-1.1.9-2 2-2h1l4-4v16l-4-4H7c-1.1 0-2-.9-2-2v-4z"/></svg>
              <input type="range" min="0" max="100" value={metronomeConfig.ching.volume} onChange={(e) => updateConfig('ching', { volume: parseInt(e.target.value) })} disabled={!metronomeConfig.ching.active} className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
          </div>
        </div>

        {/* เครื่องดนตรี 2: กลองแขก */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xl">🥁</span>
            <span className="font-bold text-slate-700 text-sm">กลองแขก</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={metronomeConfig.klong.active} onChange={() => updateConfig('klong', { active: !metronomeConfig.klong.active })} />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
            <select 
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600 disabled:opacity-50 min-w-[100px]"
              value={metronomeConfig.klong.pattern}
              onChange={(e) => updateConfig('klong', { pattern: e.target.value })}
              disabled={!metronomeConfig.klong.active || isLoading}
            >
              {isLoading ? <option value="">กำลังโหลด...</option> : metronomeConfig.rhythms.klong.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className={`flex items-center gap-1.5 ${metronomeConfig.klong.active ? 'opacity-100' : 'opacity-40'}`}>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 10c0-1.1.9-2 2-2h1l4-4v16l-4-4H7c-1.1 0-2-.9-2-2v-4z"/></svg>
              <input type="range" min="0" max="100" value={metronomeConfig.klong.volume} onChange={(e) => updateConfig('klong', { volume: parseInt(e.target.value) })} disabled={!metronomeConfig.klong.active} className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
          </div>
        </div>

        {/* เครื่องดนตรี 3: กรับ */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xl">🪵</span>
            <span className="font-bold text-slate-700 text-sm">กรับ</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={metronomeConfig.krub.active} onChange={() => updateConfig('krub', { active: !metronomeConfig.krub.active })} />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
            <select 
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600 disabled:opacity-50 min-w-[100px]"
              value={metronomeConfig.krub.pattern}
              onChange={(e) => updateConfig('krub', { pattern: e.target.value })}
              disabled={!metronomeConfig.krub.active || isLoading}
            >
              {isLoading ? <option value="">กำลังโหลด...</option> : metronomeConfig.rhythms.krub.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className={`flex items-center gap-1.5 ${metronomeConfig.krub.active ? 'opacity-100' : 'opacity-40'}`}>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 10c0-1.1.9-2 2-2h1l4-4v16l-4-4H7c-1.1 0-2-.9-2-2v-4z"/></svg>
              <input type="range" min="0" max="100" value={metronomeConfig.krub.volume} onChange={(e) => updateConfig('krub', { volume: parseInt(e.target.value) })} disabled={!metronomeConfig.krub.active} className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
          </div>
        </div>

        {/* Master Volume */}
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-3 shadow-sm shrink-0">
           <span className="text-xs font-bold text-slate-600">ระดับเสียงรวม</span>
           <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 10c0-1.1.9-2 2-2h1l4-4v16l-4-4H7c-1.1 0-2-.9-2-2v-4z"/></svg>
           <input type="range" min="0" max="100" value={metronomeConfig.masterVolume} onChange={(e) => updateMasterVol(parseInt(e.target.value))} className="w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
           <span className="text-xs font-bold text-slate-500 w-6 text-right">{metronomeConfig.masterVolume}%</span>
        </div>

      </div>
    </div>
  );
};

export default MetronomePanel;