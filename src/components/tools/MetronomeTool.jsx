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
  Timer,
  Volume2
} from 'lucide-react';
import { MusicContext } from '../../contexts/MusicContext';
import { initAudioContext } from '../../utils/audioEngine';
import { applyRhythmLayer, filterRhythmPatternsByLayer, RHYTHM_LAYER_OPTIONS } from '../../utils/rhythmLayer';

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
const clampDuration = (value) => Math.min(3600, Math.max(1, Math.round(Number(value) || 1)));

const speedTrainerPresets = [
  { label: '5 นาที', seconds: 300 },
  { label: '10 นาที', seconds: 600 },
  { label: '20 นาที', seconds: 1200 },
  { label: '30 นาที', seconds: 1800 },
  { label: '1 ชั่วโมง', seconds: 3600 }
];

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
  const [trainerStartBpm, setTrainerStartBpm] = useState(80);
  const [trainerEndBpm, setTrainerEndBpm] = useState(120);
  const [trainerDuration, setTrainerDuration] = useState(5);
  const [trainerUnit, setTrainerUnit] = useState('minutes');
  const [isTraining, setIsTraining] = useState(false);
  const tapTimesRef = useRef([]);
  const stopPlaybackRef = useRef(stopPlayback);
  const trainingPlanRef = useRef(null);
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

  useEffect(() => {
    if (!isTraining || !trainingPlanRef.current) return undefined;

    const updateTrainingTempo = () => {
      const plan = trainingPlanRef.current;
      const elapsed = Date.now() - plan.startedAt;
      const progress = Math.min(1, elapsed / plan.durationMs);
      const nextBpm = Math.round(plan.startBpm + ((plan.endBpm - plan.startBpm) * progress));
      setLayoutConfig((current) => current.bpm === nextBpm ? current : { ...current, bpm: nextBpm });

      if (progress >= 1) {
        setIsTraining(false);
        trainingPlanRef.current = null;
        setMetronomeConfig((current) => ({ ...current, linked: true }));
      }
    };

    updateTrainingTempo();
    const timer = window.setInterval(updateTrainingTempo, 250);
    return () => window.clearInterval(timer);
  }, [isTraining, setLayoutConfig, setMetronomeConfig]);

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

  const updateRhythmLayer = (layer) => {
    setMetronomeConfig((current) => applyRhythmLayer(current, layer));
  };

  const togglePlayback = async () => {
    await initAudioContext().catch(() => {});
    if (isRunning && isTraining) {
      setIsTraining(false);
      trainingPlanRef.current = null;
    }
    setActiveStep(0);
    setMetronomeConfig((current) => {
      const shouldStart = current.linked !== false;
      return {
        ...current,
        // หน้าเครื่องประกอบใช้โหมดเล่นแยกจากโน้ต จึงต้องเปิด enabled
        // พร้อมกันด้วย มิฉะนั้น scheduler จะไม่สั่งเสียงหน้าทับเลย
        enabled: shouldStart,
        linked: !shouldStart
      };
    });
  };

  const getTrainerSeconds = () => clampDuration(trainerDuration) * (trainerUnit === 'minutes' ? 60 : 1);

  const applyTrainerPreset = (seconds) => {
    setTrainerDuration(seconds % 60 === 0 ? seconds / 60 : seconds);
    setTrainerUnit(seconds % 60 === 0 ? 'minutes' : 'seconds');
  };

  const startSpeedTrainer = async () => {
    const startBpm = clampBpm(trainerStartBpm);
    const endBpm = clampBpm(trainerEndBpm);
    const durationMs = getTrainerSeconds() * 1000;
    await initAudioContext().catch(() => {});
    setBpm(startBpm);
    trainingPlanRef.current = { startBpm, endBpm, durationMs, startedAt: Date.now() };
    setActiveStep(0);
    setIsTraining(true);
    setMetronomeConfig((current) => ({ ...current, enabled: true, linked: false }));
  };

  const stopSpeedTrainer = () => {
    setIsTraining(false);
    trainingPlanRef.current = null;
    setMetronomeConfig((current) => ({ ...current, linked: true }));
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
    setIsTraining(false);
    trainingPlanRef.current = null;
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

      <main className="relative mx-auto flex min-h-full w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:px-5 md:px-7 md:py-4">
        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-hidden rounded-[22px] border border-slate-200/90 bg-gradient-to-br from-white via-white to-indigo-50/70 p-4 shadow-lg shadow-slate-200/60 md:rounded-[24px] md:p-5">
            <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                  <AudioLines size={24} />
                </span>
                <div>
                  <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-indigo-500">Practice studio</p>
                  <h1 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl md:text-2xl">เครื่องประกอบจังหวะ</h1>
                  <p className="mt-1 text-[11px] font-medium text-slate-500 sm:text-xs">ฝึกซ้อมด้วยฉิ่ง กลองแขก และกรับ</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[9px] font-black tracking-wide sm:px-3 sm:text-[10px] ${isRunning ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                {isRunning ? 'กำลังเล่น' : 'พร้อมใช้งาน'}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="mb-2 flex h-7 items-center justify-center gap-2">
                {Array.from({ length: 8 }, (_, index) => (
                  <span
                    key={index}
                    className={`rounded-full transition-all duration-100 ${isRunning && activeStep === index ? 'h-5 w-5 bg-indigo-500 shadow-[0_0_18px_rgba(99,102,241,0.45)]' : index === 0 || index === 4 ? 'h-3 w-3 bg-slate-400' : 'h-2.5 w-2.5 bg-slate-200'}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 sm:gap-4">
                <button type="button" onClick={() => setBpm(bpm - 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 sm:h-12 sm:w-12" aria-label="ลดความเร็ว">
                  <Minus size={18} />
                </button>
                <label className="relative block text-center">
                  <input
                    type="number"
                    min="20"
                    max="300"
                    value={bpm}
                    onChange={(event) => setBpm(event.target.value)}
                    className="w-32 bg-transparent text-center text-5xl font-black tabular-nums tracking-tighter text-slate-900 outline-none sm:w-40 sm:text-6xl"
                    aria-label="ความเร็ว BPM"
                  />
                  <span className="block text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600">BPM</span>
                </label>
                <button type="button" onClick={() => setBpm(bpm + 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 sm:h-12 sm:w-12" aria-label="เพิ่มความเร็ว">
                  <Plus size={18} />
                </button>
              </div>

              <div className="mt-3 w-full max-w-lg">
                <div className="mb-1 flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400"><span>20 BPM</span><span>300 BPM</span></div>
                <input type="range" min="20" max="300" value={bpm} onChange={(event) => setBpm(event.target.value)} className="h-2 w-full accent-indigo-500" aria-label="ปรับความเร็วเมโทรโนม" />
              </div>

              <div className="mt-3 flex w-full max-w-lg items-center gap-2.5">
                <button
                  type="button"
                  onClick={togglePlayback}
                  className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-black shadow-lg transition active:scale-[0.98] ${isRunning ? 'bg-rose-500 text-white shadow-rose-500/20 hover:bg-rose-400' : 'bg-indigo-500 text-white shadow-indigo-500/25 hover:bg-indigo-400'}`}
                >
                  {isRunning ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                  {isRunning ? 'หยุดจังหวะ' : 'เริ่มเล่น'}
                </button>
                <button type="button" onClick={handleTapTempo} className="flex h-12 w-24 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white font-black text-slate-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 active:scale-[0.98]">
                  <span className="text-sm">TAP</span>
                  <span className="mt-0.5 text-[9px] font-medium text-slate-500">{tapHint}</span>
                </button>
              </div>
            </div>
          </div>

          <aside className="flex flex-col rounded-[22px] border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 md:rounded-[24px]">
            <div className="mb-3 flex items-center justify-between">
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

            <div className="my-4 h-px bg-slate-200" />

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

            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <p className="text-[11px] font-semibold leading-5 text-indigo-700">
                เคล็ดลับ: เริ่มจากความเร็วที่เล่นได้สบาย แล้วเพิ่มครั้งละ 5 BPM เมื่อจังหวะนิ่ง
              </p>
            </div>
          </aside>
        </section>

        <section className="overflow-hidden rounded-[22px] border border-emerald-100 bg-white shadow-lg shadow-emerald-950/5 md:rounded-[24px]">
          <div className="flex flex-col gap-3 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 md:flex-row md:items-center md:gap-4">
            <div className="flex items-center gap-3 md:w-44 md:shrink-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"><Timer size={21} /></span>
              <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600">Guided practice</p><h2 className="mt-0.5 text-base font-black text-slate-900">Speed Trainer</h2>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">ไล่ความเร็วอัตโนมัติ</p>
              {isTraining && <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">กำลังฝึกซ้อม</span>}</div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-2 min-[480px]:grid-cols-3">
              <label className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">เริ่มต้น (BPM)</span>
                <input type="number" min="20" max="300" value={trainerStartBpm} onChange={(event) => setTrainerStartBpm(clampBpm(event.target.value))} disabled={isTraining} className="mt-0.5 w-full bg-transparent text-xl font-black tabular-nums text-slate-900 outline-none disabled:text-slate-400" />
              </label>
              <label className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">จบที่ (BPM)</span>
                <input type="number" min="20" max="300" value={trainerEndBpm} onChange={(event) => setTrainerEndBpm(clampBpm(event.target.value))} disabled={isTraining} className="mt-0.5 w-full bg-transparent text-xl font-black tabular-nums text-slate-900 outline-none disabled:text-slate-400" />
              </label>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">ระยะเวลา</span>
                <div className="mt-1 flex items-center gap-2">
                  <input type="number" min="1" max={trainerUnit === 'minutes' ? 60 : 3600} value={trainerDuration} onChange={(event) => setTrainerDuration(clampDuration(event.target.value))} disabled={isTraining} className="min-w-0 flex-1 bg-transparent text-xl font-black tabular-nums text-slate-900 outline-none disabled:text-slate-400" />
                  <select value={trainerUnit} onChange={(event) => setTrainerUnit(event.target.value)} disabled={isTraining} className="hidden rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600 outline-none disabled:text-slate-400 sm:block"><option value="minutes">นาที</option><option value="seconds">วินาที</option></select>
                </div>
                <select value={trainerUnit} onChange={(event) => setTrainerUnit(event.target.value)} disabled={isTraining} className="mt-1.5 w-full rounded-md bg-slate-100 px-1.5 py-1 text-[9px] font-black text-slate-600 outline-none disabled:text-slate-400 sm:hidden"><option value="minutes">นาที</option><option value="seconds">วินาที</option></select>
              </div>
            </div>

            <div className="flex gap-2 md:w-28 md:flex-col">
              <button type="button" onClick={isTraining ? stopSpeedTrainer : startSpeedTrainer} className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-black text-white shadow-md transition active:scale-[0.98] ${isTraining ? 'bg-rose-500 shadow-rose-500/20 hover:bg-rose-400' : 'bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-400'}`}>
                {isTraining ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}{isTraining ? 'หยุด' : 'เริ่มฝึก'}
              </button>
              <span className="flex h-8 flex-1 items-center justify-center rounded-lg border border-emerald-100 bg-white px-2 text-center text-[9px] font-bold text-emerald-700">{getTrainerSeconds() < 60 ? `${getTrainerSeconds()} วินาที` : `${getTrainerSeconds() / 60} นาที`}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 border-t border-emerald-100 bg-white px-4 py-2">
            <span className="mr-1 text-[9px] font-black uppercase tracking-wider text-slate-400">พรีเซ็ต</span>
            {speedTrainerPresets.map((preset) => <button key={preset.seconds} type="button" onClick={() => applyTrainerPreset(preset.seconds)} disabled={isTraining} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{preset.label}</button>)}
          </div>
        </section>

        <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm md:rounded-[24px]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">กรองหน้าทับตามชั้นเพลง</h2>
              <p className="mt-1 text-[11px] font-medium text-slate-500">ใช้กับฉิ่ง กลองแขก และกรับพร้อมกัน</p>
            </div>
            <select value={metronomeConfig.rhythmLayer || 'all'} onChange={(event) => updateRhythmLayer(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 outline-none focus:border-indigo-400 sm:w-auto sm:min-w-44" aria-label="กรองหน้าทับตามชั้นเพลง">
              {RHYTHM_LAYER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-3">
          {instruments.map(({ key, label, description, Icon, iconClass, activeClass, rangeClass }) => {
            const config = metronomeConfig[key];
            const patterns = filterRhythmPatternsByLayer(metronomeConfig.rhythms?.[key], metronomeConfig.rhythmLayer);
            return (
              <article key={key} className={`rounded-2xl border bg-slate-50/50 p-4 transition ${config.active ? 'border-slate-200 hover:border-slate-300 hover:bg-white hover:shadow-sm' : 'border-slate-200 opacity-55'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClass}`}>{React.createElement(Icon, { size: 20 })}</span>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{label}</h3>
                      <p className="mt-0.5 text-[9px] font-medium text-slate-500">{description}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => updateInstrument(key, { active: !config.active })} className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${config.active ? activeClass : 'bg-slate-200'}`} aria-label={`${config.active ? 'ปิด' : 'เปิด'}${label}`} aria-pressed={config.active}>
                    <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${config.active ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">หน้าทับ</label>
                <div className="relative mb-3">
                  <select value={config.pattern} onChange={(event) => updateInstrument(key, { pattern: event.target.value })} disabled={!config.active || patterns.length === 0} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-xs font-bold text-slate-700 outline-none transition focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`เลือกหน้าทับ${label}`}>
                    {patterns.length === 0
                      ? <option value="">ไม่พบหน้าทับในชั้นที่เลือก</option>
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
          </div>
        </section>
      </main>
    </div>
  );
};

export default MetronomeTool;
