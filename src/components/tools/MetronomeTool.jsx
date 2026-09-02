import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  ChevronDown,
  CircleDot,
  Drum,
  Hand,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Volume2
} from 'lucide-react';
import { MusicContext } from '../../contexts/MusicContext';
import { initAudioContext } from '../../utils/audioEngine';

const instruments = [
  {
    key: 'ching',
    label: 'ฉิ่ง',
    description: 'คุมจังหวะหลักและจังหวะตก',
    Icon: CircleDot,
    iconClass: 'bg-emerald-50 text-emerald-600',
    activeClass: 'bg-emerald-500',
    rangeClass: 'accent-emerald-500'
  },
  {
    key: 'klong',
    label: 'กลองแขก',
    description: 'เพิ่มน้ำหนักและหน้าทับของเพลง',
    Icon: Drum,
    iconClass: 'bg-amber-50 text-amber-600',
    activeClass: 'bg-amber-500',
    rangeClass: 'accent-amber-500'
  },
  {
    key: 'krub',
    label: 'กรับ',
    description: 'เสริมจังหวะให้ชัดเจนขึ้น',
    Icon: Hand,
    iconClass: 'bg-violet-50 text-violet-600',
    activeClass: 'bg-violet-500',
    rangeClass: 'accent-violet-500'
  }
];

const tempoPresets = [
  { label: 'ช้า', bpm: 60 },
  { label: 'ปานกลาง', bpm: 80 },
  { label: 'เร็ว', bpm: 120 }
];

const clampBpm = (value) => Math.min(300, Math.max(20, Math.round(Number(value) || 80)));

const MetronomeTool = () => {
  const {
    metronomeConfig,
    setMetronomeConfig,
    layoutConfig,
    setLayoutConfig,
    stopPlayback
  } = useContext(MusicContext);
  const [activeStep, setActiveStep] = useState(0);
  const [tapHint, setTapHint] = useState('แตะตามจังหวะที่ต้องการ');
  const tapTimesRef = useRef([]);
  const stopPlaybackRef = useRef(stopPlayback);
  const bpm = clampBpm(layoutConfig?.bpm);
  const isRunning = metronomeConfig.linked === false;

  useEffect(() => {
    stopPlaybackRef.current?.();
    setMetronomeConfig((current) => ({ ...current, linked: true }));

    return () => {
      setMetronomeConfig((current) => ({ ...current, linked: true }));
    };
  }, [setMetronomeConfig]);

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const stepDuration = 15000 / bpm;
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % 8);
    }, stepDuration);

    return () => window.clearInterval(timer);
  }, [bpm, isRunning]);

  const setBpm = (nextBpm) => {
    const normalized = clampBpm(nextBpm);
    setLayoutConfig((current) => ({ ...current, bpm: normalized }));
  };

  const updateInstrument = (key, changes) => {
    setMetronomeConfig((current) => ({
      ...current,
      [key]: { ...current[key], ...changes }
    }));
  };

  const togglePlayback = async () => {
    await initAudioContext().catch(() => {});
    setActiveStep(0);
    setMetronomeConfig((current) => ({ ...current, linked: current.linked === false }));
  };

  const handleTapTempo = () => {
    const now = performance.now();
    const recentTaps = tapTimesRef.current.filter((time) => now - time < 2500);
    recentTaps.push(now);
    tapTimesRef.current = recentTaps.slice(-6);

    if (tapTimesRef.current.length < 2) {
      setTapHint('แตะอีกครั้ง...');
      return;
    }

    const intervals = tapTimesRef.current.slice(1).map((time, index) => time - tapTimesRef.current[index]);
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    setBpm(60000 / averageInterval);
    setTapHint(`${tapTimesRef.current.length} taps`);
  };

  const resetMixer = () => {
    setBpm(80);
    setMetronomeConfig((current) => ({
      ...current,
      linked: true,
      masterVolume: 80,
      ching: { ...current.ching, active: true, volume: 80 },
      klong: { ...current.klong, active: true, volume: 80 },
      krub: { ...current.krub, active: false, volume: 80 }
    }));
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-slate-50 text-slate-800 custom-scrollbar" style={{ fontFamily: 'Prompt, sans-serif' }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[20%] top-20 h-72 w-72 rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute bottom-0 right-[8%] h-80 w-80 rounded-full bg-sky-200/25 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col gap-5 px-4 py-5 md:px-7 md:py-7">
        <section className="grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-indigo-50/70 p-5 shadow-lg shadow-slate-200/70 md:p-7">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25">
                  <AudioLines size={24} />
                </span>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 md:text-2xl">เครื่องประกอบจังหวะ</h1>
                  <p className="mt-1 text-xs font-medium text-slate-500">ฝึกซ้อมด้วยฉิ่ง กลองแขก และกรับ</p>
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black tracking-wide ${isRunning ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                {isRunning ? 'กำลังเล่น' : 'พร้อมใช้งาน'}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="mb-5 flex h-12 items-center justify-center gap-2">
                {Array.from({ length: 8 }, (_, index) => (
                  <span
                    key={index}
                    className={`rounded-full transition-all duration-100 ${isRunning && activeStep === index ? 'h-5 w-5 bg-indigo-500 shadow-[0_0_18px_rgba(99,102,241,0.45)]' : index === 0 || index === 4 ? 'h-3 w-3 bg-slate-400' : 'h-2.5 w-2.5 bg-slate-200'}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 md:gap-5">
                <button type="button" onClick={() => setBpm(bpm - 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95" aria-label="ลดความเร็ว">
                  <Minus size={18} />
                </button>
                <label className="relative block text-center">
                  <input
                    type="number"
                    min="20"
                    max="300"
                    value={bpm}
                    onChange={(event) => setBpm(event.target.value)}
                    className="w-40 bg-transparent text-center text-6xl font-black tabular-nums tracking-tighter text-slate-900 outline-none md:w-48 md:text-7xl"
                    aria-label="ความเร็ว BPM"
                  />
                  <span className="block text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600">BPM</span>
                </label>
                <button type="button" onClick={() => setBpm(bpm + 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95" aria-label="เพิ่มความเร็ว">
                  <Plus size={18} />
                </button>
              </div>

              <input type="range" min="20" max="300" value={bpm} onChange={(event) => setBpm(event.target.value)} className="mt-7 h-2 w-full max-w-md accent-indigo-500" aria-label="ปรับความเร็วเมโทรโนม" />

              <div className="mt-6 flex w-full max-w-md items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayback}
                  className={`flex h-16 flex-1 items-center justify-center gap-3 rounded-2xl text-base font-black shadow-xl transition active:scale-[0.98] ${isRunning ? 'bg-rose-500 text-white shadow-rose-500/20 hover:bg-rose-400' : 'bg-indigo-500 text-white shadow-indigo-500/25 hover:bg-indigo-400'}`}
                >
                  {isRunning ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                  {isRunning ? 'หยุดจังหวะ' : 'เริ่มเล่น'}
                </button>
                <button type="button" onClick={handleTapTempo} className="flex h-16 w-28 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white font-black text-slate-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 active:scale-[0.98]">
                  <span className="text-sm">TAP</span>
                  <span className="mt-0.5 text-[9px] font-medium text-slate-500">{tapHint}</span>
                </button>
              </div>
            </div>
          </div>

          <aside className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">ตั้งค่าการฝึกซ้อม</h2>
                <p className="mt-1 text-[11px] font-medium text-slate-500">เลือกความเร็วเริ่มต้นที่เหมาะกับคุณ</p>
              </div>
              <button type="button" onClick={resetMixer} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" title="คืนค่าเริ่มต้น" aria-label="คืนค่าเริ่มต้น">
                <RotateCcw size={15} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {tempoPresets.map((preset) => (
                <button key={preset.bpm} type="button" onClick={() => setBpm(preset.bpm)} className={`rounded-xl border px-2 py-3 text-left transition active:scale-[0.98] ${bpm === preset.bpm ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'}`}>
                  <span className="block text-[10px] font-bold">{preset.label}</span>
                  <span className="mt-1 block text-lg font-black tabular-nums">{preset.bpm}</span>
                </button>
              ))}
            </div>

            <div className="my-5 h-px bg-slate-200" />

            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-black text-slate-700"><Volume2 size={15} className="text-indigo-600" />ระดับเสียงรวม</span>
              <span className="text-sm font-black tabular-nums text-indigo-600">{metronomeConfig.masterVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={metronomeConfig.masterVolume}
              onChange={(event) => setMetronomeConfig((current) => ({ ...current, masterVolume: Number(event.target.value) }))}
              className="h-2 w-full accent-indigo-500"
              aria-label="ระดับเสียงรวม"
            />

            <div className="mt-auto rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-[11px] font-semibold leading-5 text-indigo-700">
                เคล็ดลับ: เริ่มจากความเร็วที่เล่นได้สบาย แล้วเพิ่มครั้งละ 5 BPM เมื่อจังหวะนิ่ง
              </p>
            </div>
          </aside>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {instruments.map(({ key, label, description, Icon, iconClass, activeClass, rangeClass }) => {
            const config = metronomeConfig[key];
            const patterns = metronomeConfig.rhythms?.[key] || [];
            return (
              <article key={key} className={`rounded-3xl border bg-white p-5 shadow-sm transition ${config.active ? 'border-slate-200' : 'border-slate-200 opacity-55'}`}>
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClass}`}>{React.createElement(Icon, { size: 20 })}</span>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{label}</h3>
                      <p className="mt-0.5 text-[9px] font-medium text-slate-500">{description}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => updateInstrument(key, { active: !config.active })} className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${config.active ? activeClass : 'bg-slate-200'}`} aria-label={`${config.active ? 'ปิด' : 'เปิด'}${label}`} aria-pressed={config.active}>
                    <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${config.active ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">หน้าทับ</label>
                <div className="relative mb-5">
                  <select value={config.pattern} onChange={(event) => updateInstrument(key, { pattern: event.target.value })} disabled={!config.active || patterns.length === 0} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-xs font-bold text-slate-700 outline-none transition focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`เลือกหน้าทับ${label}`}>
                    {patterns.length === 0
                      ? <option value="">กำลังโหลดหน้าทับ...</option>
                      : patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                <div className="flex items-center gap-3">
                  <Volume2 size={14} className="shrink-0 text-slate-400" />
                  <input type="range" min="0" max="100" value={config.volume} onChange={(event) => updateInstrument(key, { volume: Number(event.target.value) })} disabled={!config.active} className={`h-2 min-w-0 flex-1 ${rangeClass}`} aria-label={`ระดับเสียง${label}`} />
                  <span className="w-9 text-right text-xs font-black tabular-nums text-slate-600">{config.volume}</span>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
};

export default MetronomeTool;
