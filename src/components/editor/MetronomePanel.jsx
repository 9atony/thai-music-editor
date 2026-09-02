import React, { useContext } from 'react';
import { CircleDot, Drum, Hand, Volume2, ChevronDown, AudioLines, Link2, Unlink2 } from 'lucide-react';
import { MusicContext } from '../../contexts/MusicContext';

const cards = [
  { key: 'ching', label: 'ฉิ่ง', caption: 'เสียงโลหะ', Icon: CircleDot, icon: 'bg-emerald-50 text-emerald-600', active: 'bg-emerald-500' },
  { key: 'klong', label: 'กลองแขก', caption: 'เสียงกลอง', Icon: Drum, icon: 'bg-amber-50 text-amber-600', active: 'bg-amber-500' },
  { key: 'krub', label: 'กรับ', caption: 'เสียงไม้', Icon: Hand, icon: 'bg-violet-50 text-violet-600', active: 'bg-violet-500' }
];

const MetronomePanel = ({ isExpanded }) => {
  const { metronomeConfig, setMetronomeConfig } = useContext(MusicContext);
  const enabled = metronomeConfig.enabled === true;
  const update = (key, changes) => setMetronomeConfig(prev => ({ ...prev, [key]: { ...prev[key], ...changes } }));
  const toggleMetronomeSound = () => setMetronomeConfig((current) => {
    if (current.enabled === true) return { ...current, enabled: false };
    const hasActiveInstrument = ['ching', 'klong', 'krub'].some((key) => current[key]?.active);
    return {
      ...current,
      enabled: true,
      ...(hasActiveInstrument ? {} : {
        ching: { ...current.ching, active: true },
        klong: { ...current.klong, active: true }
      })
    };
  });
  const linked = metronomeConfig.linked !== false;
  if (!isExpanded) return null;

  return <section className="border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white px-2 py-2 sm:px-4" aria-label="เครื่องประกอบจังหวะ">
    <div className="w-full overflow-x-auto pb-1 custom-scrollbar">
      <div className="flex min-w-[1440px] items-center rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
        <div className="flex w-[210px] shrink-0 items-center gap-1.5 px-1.5 pr-3"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 text-indigo-600"><AudioLines size={14} /></span><span className="text-[11px] font-black tracking-wide text-slate-700">เครื่องจังหวะ</span><button type="button" aria-pressed={linked} title={linked ? 'เชื่อมจังหวะกับโน้ตบนกระดาษ' : 'เล่นจังหวะวนแยกจากโน้ต'} onClick={() => setMetronomeConfig(prev => ({ ...prev, linked: prev.linked === false }))} className={`ml-auto flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[9px] font-black shadow-sm transition-all active:scale-95 ${linked ? 'border-indigo-500 bg-indigo-500 text-white hover:bg-indigo-600' : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>{linked ? <Link2 size={12} /> : <Unlink2 size={12} />}<span>{linked ? 'LINK' : 'แยก'}</span></button></div>
        <button type="button" aria-pressed={enabled} title={enabled ? 'ปิดเสียงเครื่องประกอบจังหวะ' : 'เปิดเสียงเครื่องประกอบจังหวะ'} onClick={toggleMetronomeSound} className={`flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[9px] font-black shadow-sm transition-all active:scale-95 ${enabled ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}><Volume2 size={12} /><span>{enabled ? 'เปิดเสียง' : 'ปิดเสียง'}</span></button>
        {cards.map(({ key, label, Icon, icon, active }) => { const c = metronomeConfig[key]; const patterns = metronomeConfig.rhythms[key]; const isUnavailable = patterns.length === 0; return <div key={key} className={`flex min-w-[370px] flex-1 items-center gap-2 border-l border-slate-100 px-3 ${c.active ? '' : 'opacity-60'}`}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${icon}`}>{React.createElement(Icon, { size: 15 })}</span><span className="w-[54px] shrink-0 text-[11px] font-black text-slate-700">{label}</span><button type="button" aria-label={`${c.active ? 'ปิด' : 'เปิด'}${label}`} onClick={() => update(key, { active: !c.active })} className={`flex h-6 w-[48px] shrink-0 items-center justify-center rounded-lg border text-[9px] font-black shadow-sm transition-all active:scale-95 ${c.active ? `${active} border-transparent text-white` : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{c.active ? 'เปิด' : 'ปิด'}</button>
          <div className="relative min-w-0 flex-1"><select aria-label={`หน้าทับ${label}`} title={patterns.find(p => p.id === c.pattern)?.name || 'เลือกหน้าทับ'} value={c.pattern} onChange={e => update(key, { pattern: e.target.value })} disabled={!c.active || isUnavailable} className="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-2 pr-7 text-[11px] font-bold text-slate-700 outline-none transition hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60">{isUnavailable ? <option value="">กำลังโหลดหน้าทับ...</option> : patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" /></div>
          <div className="flex w-[76px] shrink-0 items-center gap-1"><Volume2 size={12} className="text-slate-400" /><input aria-label={`ระดับเสียง${label}`} type="range" min="0" max="100" value={c.volume} onChange={e => update(key, { volume: parseInt(e.target.value, 10) })} disabled={!c.active} className="h-1 min-w-0 flex-1 accent-indigo-500" /><span className="w-4 text-right text-[9px] font-bold tabular-nums text-slate-500">{c.volume}</span></div>
        </div>; })}
        <div className="flex w-[145px] shrink-0 items-center gap-1.5 border-l border-slate-100 px-2.5"><Volume2 size={12} className="text-indigo-500" /><span className="text-[9px] font-bold text-slate-500">รวม</span><input aria-label="ระดับเสียงรวม" type="range" min="0" max="100" value={metronomeConfig.masterVolume} onChange={e => setMetronomeConfig(prev => ({ ...prev, masterVolume: parseInt(e.target.value, 10) }))} className="h-1 min-w-0 flex-1 accent-indigo-500" /><span className="w-6 text-right text-[9px] font-black tabular-nums text-indigo-600">{metronomeConfig.masterVolume}</span></div>
      </div>
    </div>
  </section>;
};

export default MetronomePanel;
