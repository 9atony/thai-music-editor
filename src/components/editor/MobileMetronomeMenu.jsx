import React, { useContext } from 'react';
import { AudioLines, ChevronDown, CircleDot, Drum, Hand, Link2, Unlink2, Volume2, X } from 'lucide-react';
import { MusicContext } from '../../contexts/MusicContext';
import { initAudioContext } from '../../utils/audioEngine';

const instruments = [
  { key: 'ching', label: 'ฉิ่ง', Icon: CircleDot, accent: 'emerald' },
  { key: 'klong', label: 'กลองแขก', Icon: Drum, accent: 'amber' },
  { key: 'krub', label: 'กรับ', Icon: Hand, accent: 'violet' }
];

const accentClasses = {
  emerald: { icon: 'bg-emerald-100 text-emerald-600', toggle: 'bg-emerald-500', range: 'accent-emerald-500' },
  amber: { icon: 'bg-amber-100 text-amber-600', toggle: 'bg-amber-500', range: 'accent-amber-500' },
  violet: { icon: 'bg-violet-100 text-violet-600', toggle: 'bg-violet-500', range: 'accent-violet-500' }
};

const MobileMetronomeMenu = ({ isOpen, onClose }) => {
  const { metronomeConfig, setMetronomeConfig } = useContext(MusicContext);
  const enabled = metronomeConfig.enabled === true;
  const linked = metronomeConfig.linked !== false;

  const updateInstrument = (key, changes) => {
    setMetronomeConfig((current) => ({
      ...current,
      [key]: { ...current[key], ...changes }
    }));
  };

  const toggleMetronomeSound = () => {
    setMetronomeConfig((current) => {
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
  };

  const unlockAudio = () => initAudioContext().catch(() => {});

  return (
    <div className={`fixed inset-0 z-[70] flex flex-col justify-end transition-all duration-300 ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
      <button
        type="button"
        aria-label="ปิดเมนูเครื่องจังหวะ"
        className={`absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      <section
        aria-label="ตั้งค่าเครื่องประกอบจังหวะ"
        onPointerDownCapture={unlockAudio}
        onTouchStartCapture={unlockAudio}
        className={`relative flex max-h-[86vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="mx-auto mt-2 h-1.5 w-11 rounded-full bg-slate-200" />
        <header className="flex items-center justify-between border-b border-slate-100 px-5 pb-4 pt-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <AudioLines size={20} />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-800">เครื่องประกอบจังหวะ</h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-400">ฉิ่ง กลองแขก กรับ และหน้าทับ</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:scale-95" aria-label="ปิด">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 custom-scrollbar">
          <button
            type="button"
            aria-pressed={enabled}
            onClick={toggleMetronomeSound}
            className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${enabled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
          >
            <span className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${enabled ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'}`}><Volume2 size={19} /></span>
              <span><span className="block text-sm font-black text-slate-800">เสียงเครื่องประกอบจังหวะ</span><span className="mt-0.5 block text-[11px] text-slate-500">{enabled ? 'เปิดเสียงอยู่' : 'ปิดเสียงอยู่'}</span></span>
            </span>
            <span className={`ml-3 flex h-7 w-12 items-center rounded-full p-1 transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} /></span>
          </button>
          <button
            type="button"
            aria-pressed={linked}
            onClick={() => setMetronomeConfig((current) => ({ ...current, linked: current.linked === false }))}
            className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${linked ? 'border-indigo-200 bg-indigo-50' : 'border-amber-200 bg-amber-50'}`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${linked ? 'bg-indigo-500 text-white' : 'bg-amber-500 text-white'}`}>
                {linked ? <Link2 size={19} /> : <Unlink2 size={19} />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-slate-800">{linked ? 'LINK กับโน้ต' : 'เล่นวนอิสระ'}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{linked ? 'จังหวะเริ่มและหยุดพร้อมโน้ตบนกระดาษ' : 'เครื่องจังหวะเล่นแยกจากปุ่มเล่นโน้ต'}</span>
              </span>
            </span>
            <span className={`ml-3 flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${linked ? 'bg-indigo-500' : 'bg-slate-300'}`}>
              <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${linked ? 'translate-x-5' : 'translate-x-0'}`} />
            </span>
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-black text-slate-700"><Volume2 size={15} className="text-indigo-500" />ระดับเสียงรวม</span>
              <span className="text-xs font-black tabular-nums text-indigo-600">{metronomeConfig.masterVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={metronomeConfig.masterVolume}
              onChange={(event) => setMetronomeConfig((current) => ({ ...current, masterVolume: Number(event.target.value) }))}
              className="h-2 w-full accent-indigo-500"
              aria-label="ระดับเสียงเครื่องจังหวะรวม"
            />
          </div>

          {instruments.map(({ key, label, Icon, accent }) => {
            const config = metronomeConfig[key];
            const patterns = metronomeConfig.rhythms?.[key] || [];
            const colors = accentClasses[accent];
            return (
              <article key={key} className={`rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition ${config.active ? '' : 'opacity-65'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors.icon}`}>{React.createElement(Icon, { size: 18 })}</span>
                    <div>
                      <div className="text-sm font-black text-slate-800">{label}</div>
                      <div className="text-[10px] font-medium text-slate-400">{config.active ? 'กำลังใช้งาน' : 'ปิดเสียงอยู่'}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateInstrument(key, { active: !config.active })}
                    className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${config.active ? colors.toggle : 'bg-slate-300'}`}
                    aria-label={`${config.active ? 'ปิด' : 'เปิด'}${label}`}
                    aria-pressed={config.active}
                  >
                    <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${config.active ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-400">หน้าทับที่เลือก</label>
                <div className="relative mb-3">
                  <select
                    value={config.pattern}
                    onChange={(event) => updateInstrument(key, { pattern: event.target.value })}
                    disabled={!config.active || patterns.length === 0}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                    aria-label={`เลือกหน้าทับ${label}`}
                  >
                    {patterns.length === 0
                      ? <option value="">กำลังโหลดหน้าทับ...</option>
                      : patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                <div className="flex items-center gap-3">
                  <Volume2 size={15} className="shrink-0 text-slate-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.volume}
                    onChange={(event) => updateInstrument(key, { volume: Number(event.target.value) })}
                    disabled={!config.active}
                    className={`h-2 min-w-0 flex-1 ${colors.range}`}
                    aria-label={`ระดับเสียง${label}`}
                  />
                  <span className="w-9 text-right text-xs font-black tabular-nums text-slate-600">{config.volume}%</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default MobileMetronomeMenu;
