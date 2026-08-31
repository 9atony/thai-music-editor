import React, { useContext } from 'react';
import { CircleDot, Drum, Hand, Volume2, ChevronDown, AudioLines } from 'lucide-react';
import { MusicContext } from '../../contexts/MusicContext';

const cards = [
  { key: 'ching', label: 'ฉิ่ง', caption: 'เสียงโลหะ', Icon: CircleDot, icon: 'bg-emerald-50 text-emerald-600', active: 'bg-emerald-500' },
  { key: 'klong', label: 'กลองแขก', caption: 'เสียงกลอง', Icon: Drum, icon: 'bg-amber-50 text-amber-600', active: 'bg-amber-500' },
  { key: 'krub', label: 'กรับ', caption: 'เสียงไม้', Icon: Hand, icon: 'bg-violet-50 text-violet-600', active: 'bg-violet-500' }
];

const MetronomePanel = ({ isExpanded }) => {
  const { metronomeConfig, setMetronomeConfig } = useContext(MusicContext);
  const loading = metronomeConfig.rhythms.ching.length === 0;
  const update = (key, changes) => setMetronomeConfig(prev => ({ ...prev, [key]: { ...prev[key], ...changes } }));
  if (!isExpanded) return null;

  return <section className="border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white px-2 py-2 sm:px-4" aria-label="เครื่องประกอบจังหวะ">
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 text-indigo-600"><AudioLines size={14} /></span><h3 className="text-[11px] font-black tracking-wide text-slate-700">เครื่องประกอบจังหวะ</h3></div>
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm"><Volume2 size={12} className="text-slate-400" /><span className="text-[9px] font-bold text-slate-500">รวม</span><input aria-label="ระดับเสียงรวม" type="range" min="0" max="100" value={metronomeConfig.masterVolume} onChange={e => setMetronomeConfig(prev => ({ ...prev, masterVolume: parseInt(e.target.value, 10) }))} className="h-1 w-16 accent-indigo-500" /><span className="w-6 text-right text-[9px] font-black tabular-nums text-indigo-600">{metronomeConfig.masterVolume}%</span></div>
      </div>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        {cards.map(({ key, label, caption, Icon, icon, active }) => { const c = metronomeConfig[key]; const patterns = metronomeConfig.rhythms[key]; return <div key={key} className={`rounded-xl border bg-white p-2 shadow-sm ${c.active ? 'border-slate-200' : 'border-slate-100 opacity-70'}`}>
          <div className="flex items-center gap-2"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${icon}`}><Icon size={15} /></span><div className="min-w-0 flex-1"><div className="text-[11px] font-black text-slate-700">{label}</div><div className="text-[9px] text-slate-400">{caption}</div></div><button type="button" aria-label={`${c.active ? 'ปิด' : 'เปิด'}${label}`} onClick={() => update(key, { active: !c.active })} className={`relative h-4 w-7 rounded-full ${c.active ? active : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${c.active ? 'translate-x-3.5' : 'translate-x-0.5'}`} /></button></div>
          <div className="mt-1.5 flex items-center gap-1.5 border-t border-slate-100 pt-1.5"><div className="relative min-w-0 flex-1"><select aria-label={`หน้าทับ${label}`} value={c.pattern} onChange={e => update(key, { pattern: e.target.value })} disabled={!c.active || loading} className="w-full appearance-none rounded-md border border-slate-200 bg-slate-50 py-1 pl-1.5 pr-6 text-[9px] font-bold text-slate-600 outline-none focus:border-indigo-300 disabled:opacity-60">{loading ? <option value="">กำลังโหลด...</option> : patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400" /></div><div className="flex w-[92px] items-center gap-1"><Volume2 size={11} className="text-slate-400" /><input aria-label={`ระดับเสียง${label}`} type="range" min="0" max="100" value={c.volume} onChange={e => update(key, { volume: parseInt(e.target.value, 10) })} disabled={!c.active} className="h-1 w-full accent-indigo-500" /><span className="w-5 text-right text-[9px] font-bold tabular-nums text-slate-500">{c.volume}</span></div></div>
        </div>; })}
      </div>
    </div>
  </section>;
};

export default MetronomePanel;
