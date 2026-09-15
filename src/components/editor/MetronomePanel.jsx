import React, { useContext } from 'react';
import {
  AudioLines,
  ChevronDown,
  CircleDot,
  Drum,
  Hand,
  Link2,
  Power,
  RefreshCw,
  Unlink2,
  Volume2,
} from 'lucide-react';
import { MusicContext } from '../../contexts/MusicContext';
import { initAudioContext } from '../../utils/audioEngine';
import { applyRhythmLayer, filterRhythmPatternsByLayer, RHYTHM_LAYER_OPTIONS } from '../../utils/rhythmLayer';

const cards = [
  {
    key: 'ching', label: 'ฉิ่ง', caption: 'กำหนดจังหวะฉิ่ง–ฉับ', Icon: CircleDot,
    iconClass: 'bg-emerald-100 text-emerald-600', activeClass: 'bg-emerald-500', rangeClass: 'accent-emerald-500',
  },
  {
    key: 'klong', label: 'กลองแขก', caption: 'เลือกหน้าทับของกลอง', Icon: Drum,
    iconClass: 'bg-amber-100 text-amber-600', activeClass: 'bg-amber-500', rangeClass: 'accent-amber-500',
  },
  {
    key: 'krub', label: 'กรับ', caption: 'กำหนดจังหวะกรับ', Icon: Hand,
    iconClass: 'bg-violet-100 text-violet-600', activeClass: 'bg-violet-500', rangeClass: 'accent-violet-500',
  },
];

const MetronomePanel = ({ isExpanded }) => {
  const {
    metronomeConfig,
    setMetronomeConfig,
    rhythmLibraryStatus = 'idle',
    rhythmLibraryError = '',
    reloadRhythmLibrary,
    userRole,
  } = useContext(MusicContext);

  if (!isExpanded) return null;

  const enabled = metronomeConfig.enabled === true;
  const linked = metronomeConfig.linked !== false;
  const update = (key, changes) => setMetronomeConfig((current) => ({
    ...current,
    [key]: { ...current[key], ...changes },
  }));
  const updateRhythmLayer = (layer) => setMetronomeConfig((current) => applyRhythmLayer(current, layer));
  const toggleMetronomeSound = () => {
    void initAudioContext().catch(() => {});
    setMetronomeConfig((current) => {
      if (current.enabled === true) return { ...current, enabled: false };
      const hasActiveInstrument = ['ching', 'klong', 'krub'].some((key) => current[key]?.active);
      return {
        ...current,
        enabled: true,
        ...(hasActiveInstrument ? {} : {
          ching: { ...current.ching, active: true },
          klong: { ...current.klong, active: true },
        }),
      };
    });
  };

  const libraryMessage = (() => {
    if (rhythmLibraryStatus === 'loading' || rhythmLibraryStatus === 'idle') {
      return { tone: 'blue', text: 'กำลังโหลดคลังหน้าทับ…' };
    }
    if (rhythmLibraryStatus === 'error') {
      return { tone: 'rose', text: `โหลดคลังหน้าทับไม่สำเร็จ${rhythmLibraryError ? `: ${rhythmLibraryError}` : ''}` };
    }
    if (rhythmLibraryStatus === 'empty') {
      return {
        tone: 'amber',
        text: userRole === 'admin'
          ? 'คลังหน้าทับกลางยังว่าง — เพิ่มข้อมูลได้ที่ แอดมิน › คลังจังหวะกลาง'
          : 'ยังไม่มีหน้าทับในคลังกลาง กรุณาแจ้งผู้ดูแลระบบ',
      };
    }
    return null;
  })();

  const messageClass = {
    blue: 'border-sky-200 bg-sky-50 text-sky-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  };

  return (
    <section className="border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white px-2 py-2 sm:px-4" aria-label="เครื่องประกอบจังหวะ">
      <div className="w-full overflow-x-auto pb-1 custom-scrollbar">
        <div className="min-w-[980px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[220px] items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><AudioLines size={18} /></span>
              <div>
                <h2 className="text-sm font-black text-slate-800">เครื่องประกอบจังหวะ</h2>
                <p className="text-[10px] font-medium text-slate-500">ฉิ่ง กลองแขก กรับ และหน้าทับ</p>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label="วิธีเล่นเครื่องจังหวะ">
              <button
                type="button"
                aria-pressed={linked}
                onClick={() => setMetronomeConfig((current) => ({ ...current, linked: true }))}
                className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-black transition ${linked ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}
              >
                <Link2 size={14} /> เล่นพร้อมโน้ต
              </button>
              <button
                type="button"
                aria-pressed={!linked}
                onClick={() => setMetronomeConfig((current) => ({ ...current, linked: false }))}
                className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-black transition ${!linked ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}
              >
                <Unlink2 size={14} /> เล่นวนทันที
              </button>
            </div>

            <label className="flex items-center gap-2 text-[11px] font-black text-slate-600">
              ชั้นเพลง
              <select
                value={metronomeConfig.rhythmLayer || 'all'}
                onChange={(event) => updateRhythmLayer(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-400"
                aria-label="กรองหน้าทับตามชั้นเพลง"
              >
                {RHYTHM_LAYER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="flex min-w-[170px] flex-1 items-center gap-2 text-[11px] font-black text-slate-600">
              <Volume2 size={15} className="text-indigo-500" /> เสียงรวม
              <input
                aria-label="ระดับเสียงเครื่องจังหวะรวม"
                type="range"
                min="0"
                max="100"
                value={metronomeConfig.masterVolume}
                onChange={(event) => setMetronomeConfig((current) => ({ ...current, masterVolume: Number(event.target.value) }))}
                className="h-2 min-w-20 flex-1 accent-indigo-500"
              />
              <span className="w-8 text-right tabular-nums text-indigo-600">{metronomeConfig.masterVolume}%</span>
            </label>

            <button
              type="button"
              aria-pressed={enabled}
              onClick={toggleMetronomeSound}
              className={`flex h-10 min-w-[124px] items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black shadow-sm transition active:scale-[0.98] ${enabled ? 'border-rose-500 bg-rose-500 text-white hover:bg-rose-600' : 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600'}`}
            >
              <Power size={16} /> {enabled ? 'หยุดเสียง' : 'เริ่มเสียง'}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-600">
            <span>
              <b>วิธีใช้:</b> 1) เลือกชั้นเพลง 2) เลือกหน้าทับ 3) เปิดเครื่องที่ต้องการ 4) กด “เริ่มเสียง”
              {linked ? ' แล้วกดปุ่มเล่นโน้ต ▶ ด้านบน' : ' จังหวะจะเล่นวนทันที'}
            </span>
            <button type="button" onClick={reloadRhythmLibrary} className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-black text-slate-600 hover:border-indigo-300 hover:text-indigo-600">
              <RefreshCw size={12} className={rhythmLibraryStatus === 'loading' ? 'animate-spin' : ''} /> โหลดรายการใหม่
            </button>
          </div>

          {libraryMessage && (
            <div className={`mt-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[11px] font-bold ${messageClass[libraryMessage.tone]}`} role="status">
              <span>{libraryMessage.text}</span>
              {rhythmLibraryStatus === 'error' && (
                <button type="button" onClick={reloadRhythmLibrary} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[10px] font-black shadow-sm">ลองโหลดใหม่</button>
              )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-3">
            {cards.map(({ key, label, caption, Icon, iconClass, activeClass, rangeClass }) => {
              const config = metronomeConfig[key] || { active: false, pattern: '', volume: 80 };
              const patterns = filterRhythmPatternsByLayer(metronomeConfig.rhythms?.[key], metronomeConfig.rhythmLayer);
              const isUnavailable = patterns.length === 0;
              return (
                <article key={key} className={`rounded-xl border p-3 transition ${config.active ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>{React.createElement(Icon, { size: 18 })}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-slate-800">{label}</div>
                      <div className="truncate text-[9px] font-medium text-slate-500">{caption}</div>
                    </div>
                    <button
                      type="button"
                      aria-label={`${config.active ? 'ปิด' : 'เปิด'}${label}`}
                      aria-pressed={config.active}
                      onClick={() => update(key, { active: !config.active })}
                      className={`flex h-8 min-w-[68px] items-center justify-center rounded-lg border px-2 text-[10px] font-black transition ${config.active ? `${activeClass} border-transparent text-white` : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                    >
                      {config.active ? '✓ เปิดใช้' : 'ปิดอยู่'}
                    </button>
                  </div>

                  <label className="mt-3 block text-[9px] font-black text-slate-500">หน้าทับ / รูปแบบจังหวะ</label>
                  <div className="relative mt-1">
                    <select
                      aria-label={`เลือกหน้าทับ${label}`}
                      value={config.pattern}
                      onChange={(event) => update(key, { pattern: event.target.value })}
                      disabled={isUnavailable || rhythmLibraryStatus === 'loading'}
                      className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-8 text-[11px] font-bold text-slate-700 outline-none transition hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {isUnavailable
                        ? <option value="">{rhythmLibraryStatus === 'loading' ? 'กำลังโหลดรายการ…' : 'ไม่มีหน้าทับในชั้นนี้'}</option>
                        : patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Volume2 size={14} className="shrink-0 text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-500">เสียง</span>
                    <input
                      aria-label={`ระดับเสียง${label}`}
                      type="range"
                      min="0"
                      max="100"
                      value={config.volume}
                      onChange={(event) => update(key, { volume: Number(event.target.value) })}
                      className={`h-2 min-w-0 flex-1 ${rangeClass}`}
                    />
                    <span className="w-8 text-right text-[10px] font-black tabular-nums text-slate-600">{config.volume}%</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MetronomePanel;
