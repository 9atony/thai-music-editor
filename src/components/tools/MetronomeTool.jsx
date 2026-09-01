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
    iconClass: 'bg-emerald-400/15 text-emerald-300',
    activeClass: 'bg-emerald-400',
    rangeClass: 'accent-emerald-400'
  },
  {
    key: 'klong',
    label: 'กลองแขก',
    description: 'เพิ่มน้ำหนักและหน้าทับของเพลง',
    Icon: Drum,
    iconClass: 'bg-amber-400/15 text-amber-300',
    activeClass: 'bg-amber-400',
    rangeClass: 'accent-amber-400'
  },
  {
    key: 'krub',
    label: 'กรับ',
    description: 'เสริมจังหวะให้ชัดเจนขึ้น',
    Icon: Hand,
    iconClass: 'bg-violet-400/15 text-violet-300',
    activeClass: 'bg-violet-400',
    rangeClass: 'accent-violet-400'
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
    <div className="h-full min-h-0 overflow-y-auto bg-[#0b0f17] text-white custom-scrollbar" style={{ fontFamily: 'Prompt, sans-serif' }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[20%] top-20 h-72 w-72 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-[8%] h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col gap-5 px-4 py-5 md:px-7 md:py-7">
        <section className="grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#171d2a] to-[#10151f] p-5 shadow-2xl shadow-black/20 md:p-7">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25">
                  <AudioLines size={24} />
                </span>
                <div>
                  <h1 className="text-xl font-black tracking-tight md:text-2xl">เครื่องประกอบจังหวะ</h1>
                  <p className="mt-1 text-xs font-medium text-white/45">ฝึกซ้อมด้วยฉิ่ง กลองแขก และกรับ</p>
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black tracking-wide ${isRunning ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/5 text-white/40'}`}>
                {isRunning ? 'กำลังเล่น' : 'พร้อมใช้งาน'}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="mb-5 flex h-12 items-center justify-center gap-2">
                {Array.from({ length: 8 }, (_, index) => (
                  <span
                    key={index}
                    className={`rounded-full transition-all duration-100 ${isRunning && activeStep === index ? 'h-5 w-5 bg-indigo-400 shadow-[0_0_24px_rgba(129,140,248,0.9)]' : index === 0 || index === 4 ? 'h-3 w-3 bg-white/35' : 'h-2.5 w-2.5 bg-white/15'}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 md:gap-5">
                <button type="button" onClick={() => setBpm(bpm - 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white active:scale-95" aria-label="ลดความเร็ว">
                  <Minus size={18} />
                </button>
                <label className="relative block text-center">
                  <input
                    type="number"
                    min="20"
                    max="300"
                    value={bpm}
                    onChange={(event) => setBpm(event.target.value)}
                    className="w-40 bg-transparent text-center text-6xl font-black tabular-nums tracking-tighter text-white outline-none md:w-48 md:text-7xl"
                    aria-label="ความเร็ว BPM"
                  />
                  <span className="block text-[11px] font-black uppercase tracking-[0.3em] text-indigo-300">BPM</span>
                </label>
                <button type="button" onClick={() => setBpm(bpm + 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white active:scale-95" aria-label="เพิ่มความเร็ว">
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
                <button type="button" onClick={handleTapTempo} className="flex h-16 w-28 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-black transition hover:bg-white/10 active:scale-[0.98]">
                  <span className="text-sm">TAP</span>
                  <span className="mt-0.5 text-[9px] font-medium text-white/35">{tapHint}</span>
                </button>
              </div>
            </div>
          </div>

          <aside className="flex flex-col rounded-[28px] border border-white/10 bg-[#121823] p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black">ตั้งค่าการฝึกซ้อม</h2>
                <p className="mt-1 text-[11px] font-medium text-white/40">เลือกความเร็วเริ่มต้นที่เหมาะกับคุณ</p>
              </div>
              <button type="button" onClick={resetMixer} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition hover:text-white" title="คืนค่าเริ่มต้น" aria-label="คืนค่าเริ่มต้น">
                <RotateCcw size={15} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {tempoPresets.map((preset) => (
                <button key={preset.bpm} type="button" onClick={() => setBpm(preset.bpm)} className={`rounded-xl border px-2 py-3 text-left transition active:scale-[0.98] ${bpm === preset.bpm ? 'border-indigo-400/50 bg-indigo-400/15 text-indigo-200' : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.07]'}`}>
                  <span className="block text-[10px] font-bold">{preset.label}</span>
                  <span className="mt-1 block text-lg font-black tabular-nums">{preset.bpm}</span>
                </button>
              ))}
            </div>

            <div className="my-5 h-px bg-white/10" />

            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-black text-white/70"><Volume2 size={15} className="text-indigo-300" />ระดับเสียงรวม</span>
              <span className="text-sm font-black tabular-nums text-indigo-300">{metronomeConfig.masterVolume}%</span>
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

            <div className="mt-auto rounded-2xl border border-indigo-400/10 bg-indigo-400/[0.06] p-4">
              <p className="text-[11px] font-semibold leading-5 text-indigo-100/60">
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
              <article key={key} className={`rounded-3xl border bg-[#121823] p-5 transition ${config.active ? 'border-white/10' : 'border-white/5 opacity-55'}`}>
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClass}`}>{React.createElement(Icon, { size: 20 })}</span>
                    <div>
                      <h3 className="text-sm font-black">{label}</h3>
                      <p className="mt-0.5 text-[9px] font-medium text-white/35">{description}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => updateInstrument(key, { active: !config.active })} className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${config.active ? activeClass : 'bg-white/15'}`} aria-label={`${config.active ? 'ปิด' : 'เปิด'}${label}`} aria-pressed={config.active}>
                    <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${config.active ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-white/30">หน้าทับ</label>
                <div className="relative mb-5">
                  <select value={config.pattern} onChange={(event) => updateInstrument(key, { pattern: event.target.value })} disabled={!config.active || patterns.length === 0} className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 pr-9 text-xs font-bold text-white/75 outline-none transition focus:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`เลือกหน้าทับ${label}`}>
                    {patterns.length === 0
                      ? <option value="" className="bg-slate-900">กำลังโหลดหน้าทับ...</option>
                      : patterns.map((pattern) => <option key={pattern.id} value={pattern.id} className="bg-slate-900">{pattern.name}</option>)}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
                </div>

                <div className="flex items-center gap-3">
                  <Volume2 size={14} className="shrink-0 text-white/30" />
                  <input type="range" min="0" max="100" value={config.volume} onChange={(event) => updateInstrument(key, { volume: Number(event.target.value) })} disabled={!config.active} className={`h-2 min-w-0 flex-1 ${rangeClass}`} aria-label={`ระดับเสียง${label}`} />
                  <span className="w-9 text-right text-xs font-black tabular-nums text-white/55">{config.volume}</span>
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
