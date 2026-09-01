import React, { useState } from 'react';
import TunerDashboard from '../components/tools/TunerDashboard';
import RanatDictionary from '../components/tools/RanatDictionary';
import RanatGenerator from '../components/tools/RanatGenerator';
import ToolWorkspace from '../components/tools/ToolWorkspace';
import MetronomeTool from '../components/tools/MetronomeTool';
import RhythmManager from '../components/tools/RhythmManager';
import {
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  BookOpenText,
  BrainCircuit,
  Crown,
  Database,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  Wrench
} from 'lucide-react';

const ACTIVE_TOOL_SESSION_KEY = 'thaiMusicEditorActiveTool';
const adminToolIds = new Set(['generator', 'dictionary', 'tuner-ai', 'rhythm-manager']);
const validToolIds = new Set(['workspace', 'metronome', ...adminToolIds]);

const Tools = ({ userProfile }) => {
  
  const userRole = userProfile?.role || 'user';
  const isAdmin = userRole === 'admin';
  const isPremium = userRole === 'premium' || isAdmin; 

  const [activeTool, setActiveToolState] = useState(() => {
    const storedTool = sessionStorage.getItem(ACTIVE_TOOL_SESSION_KEY);
    if (!validToolIds.has(storedTool)) return null;
    if (storedTool === 'workspace' && !isPremium) return null;
    if (adminToolIds.has(storedTool) && !isAdmin) return null;
    return storedTool;
  });

  const setActiveTool = (toolId) => {
    setActiveToolState(toolId);
    if (toolId) sessionStorage.setItem(ACTIVE_TOOL_SESSION_KEY, toolId);
    else sessionStorage.removeItem(ACTIVE_TOOL_SESSION_KEY);
  };
  
  const [showPremiumAlert, setShowPremiumAlert] = useState(false);

  const premiumTools = [
    { 
      id: 'workspace', 
      name: 'จัดวงดนตรี (Arranger)', 
      desc: 'เครื่องมือจัดการวงดนตรี ควบคุมไทม์ไลน์ และผูกเนื้อร้องเข้ากับโครงสร้างดนตรี', 
      Icon: SlidersHorizontal,
      iconClass: 'bg-rose-50 text-rose-600 ring-rose-100',
      accentClass: 'from-rose-500 to-orange-400',
      hoverClass: 'hover:border-rose-200 hover:shadow-rose-100/70',
      requiresPremium: true
    },
    {
      id: 'metronome',
      name: 'เครื่องประกอบจังหวะ',
      desc: 'เปิดหน้าทับฉิ่ง กลองแขก และกรับสำหรับฝึกซ้อม ปรับความเร็วและระดับเสียงได้อย่างอิสระ',
      Icon: AudioLines,
      iconClass: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
      accentClass: 'from-indigo-500 to-sky-400',
      hoverClass: 'hover:border-indigo-200 hover:shadow-indigo-100/70',
      requiresPremium: false
    }
  ];

  const adminTools = [
    { 
      id: 'generator', 
      name: 'AI สร้างทางระนาด', 
      desc: 'แปลงทำนองหลักจากฆ้องวงใหญ่เป็นทางระนาดเอกอัตโนมัติ ตามระดับความยากที่กำหนด', 
      Icon: WandSparkles,
      iconClass: 'bg-sky-50 text-sky-600',
      hoverClass: 'hover:border-sky-200 hover:shadow-sky-100/70'
    },
    { 
      id: 'dictionary', 
      name: 'พจนานุกรมทางระนาด', 
      desc: 'จัดการฐานข้อมูลวลีเพลง (Phrases) จัดกลุ่มระดับความยาก และกำหนดโครงสร้างเป้าหมาย', 
      Icon: BookOpenText,
      iconClass: 'bg-teal-50 text-teal-600',
      hoverClass: 'hover:border-teal-200 hover:shadow-teal-100/70'
    },
    { 
      id: 'tuner-ai', 
      name: 'AI จูนโครงสร้าง', 
      desc: 'วิเคราะห์โครงสร้างทำนอง ตรวจสอบความถูกต้องของสัดส่วน และจัดการ Dataset สอนระบบ', 
      Icon: BrainCircuit,
      iconClass: 'bg-violet-50 text-violet-600',
      hoverClass: 'hover:border-violet-200 hover:shadow-violet-100/70'
    },
    { 
      id: 'rhythm-manager', 
      name: 'จัดการหน้าทับจังหวะ', 
      desc: 'อัปโหลดไฟล์ .tme เพื่อนำเข้าข้อมูลจังหวะฉิ่ง กลอง กรับ เข้าสู่ระบบส่วนกลาง', 
      Icon: Database,
      iconClass: 'bg-emerald-50 text-emerald-600',
      hoverClass: 'hover:border-emerald-200 hover:shadow-emerald-100/70'
    }
  ];

  const handleToolClick = (toolId, isPremiumTool) => {
    if (isPremiumTool && !isPremium) {
      setShowPremiumAlert(true);
      return;
    }
    setActiveTool(toolId);
  };

  const renderActiveTool = () => {
    switch (activeTool) {
      case 'generator': return isAdmin ? <RanatGenerator /> : null;
      case 'dictionary': return isAdmin ? <RanatDictionary /> : null;
      case 'tuner-ai': return isAdmin ? <TunerDashboard /> : null;
      case 'workspace': return isPremium ? <ToolWorkspace onBack={() => setActiveTool(null)} /> : null;
      case 'metronome': return <MetronomeTool />;
      case 'rhythm-manager': return isAdmin ? <RhythmManager /> : null;
      default: return null;
    }
  };

  if (activeTool) {
    const currentToolInfo = [...premiumTools, ...adminTools].find(t => t.id === activeTool);
    
    return (
      <div className="min-h-screen bg-[#0c1014] flex flex-col animate-fadeIn" style={{ fontFamily: 'Prompt, sans-serif' }}>
        <div className="bg-[#11151a]/95 backdrop-blur-xl border-b border-white/10 px-4 md:px-6 py-3.5 flex items-center shadow-sm sticky top-0 z-50">
          <button 
            onClick={() => setActiveTool(null)}
            className="flex items-center gap-2 text-xs font-bold text-white/60 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10"
          >
            <ArrowLeft size={15} />
            กลับหน้ารวมเครื่องมือ
          </button>
          
          <div className="ml-4 pl-4 border-l border-white/10 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/75">
              {currentToolInfo?.Icon && React.createElement(currentToolInfo.Icon, { size: 16 })}
            </span>
            <span className="text-sm font-semibold tracking-wide text-white/90">
              {currentToolInfo?.name}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {renderActiveTool()}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="app-page-shell animate-fadeIn text-slate-800"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      <header className="relative mb-8 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white px-5 py-6 shadow-sm sm:px-7 md:px-9 md:py-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-48 h-56 w-56 rounded-full bg-sky-100/50 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/15">
              <Wrench size={25} />
            </span>
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">ศูนย์รวมเครื่องมือ</h1>
                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-indigo-600">TME Toolkit</span>
              </div>
              <p className="max-w-2xl text-xs font-medium leading-6 text-slate-500 md:text-sm">
                ตัวช่วยสำหรับการฝึกซ้อม เรียบเรียงดนตรี และจัดการคลังข้อมูลดนตรีไทยในพื้นที่เดียว
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-right">
              <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">เครื่องมือที่ใช้ได้</span>
              <span className="mt-0.5 block text-sm font-black text-slate-800">
                {premiumTools.filter((tool) => !tool.requiresPremium || isPremium).length + (isAdmin ? adminTools.length : 0)} รายการ
              </span>
            </div>
            {isAdmin && (
              <span className="inline-flex h-[54px] items-center gap-2 rounded-2xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-slate-900/10">
                <ShieldCheck size={16} className="text-emerald-400" />
                Admin
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="mb-9">
        <div className="mb-4 flex items-end justify-between px-1">
          <div>
            <div className="mb-1 flex items-center gap-2 text-indigo-600">
              <Sparkles size={15} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Featured</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 md:text-xl">เครื่องมือแนะนำ</h2>
          </div>
          <p className="hidden text-[11px] font-medium text-slate-400 sm:block">เลือกเครื่องมือเพื่อเริ่มต้นใช้งาน</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {premiumTools.map((tool) => (
            <button 
              key={tool.id}
              onClick={() => handleToolClick(tool.id, tool.requiresPremium)}
              className={`group relative flex min-h-[178px] w-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-300 sm:p-6 ${tool.hoverClass} hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.99]`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tool.accentClass}`} />
              <div className={`pointer-events-none absolute -bottom-20 -right-16 h-44 w-44 rounded-full bg-gradient-to-br opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-[0.13] ${tool.accentClass}`} />

              <div className={`mr-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset transition-transform duration-300 group-hover:scale-105 ${tool.iconClass} ${tool.requiresPremium && !isPremium ? 'grayscale' : ''}`}>
                {React.createElement(tool.Icon, { size: 24 })}
              </div>

              <div className="relative min-w-0 flex-1 pr-8">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 md:text-[17px]">{tool.name}</h3>
                  {tool.requiresPremium ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-700">
                      {isPremium ? <Crown size={10} /> : <LockKeyhole size={10} />} Premium
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700">ใช้งานได้ทันที</span>
                  )}
                </div>
                <p className="max-w-xl text-[11px] font-medium leading-5 text-slate-500 md:text-xs">{tool.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-black text-slate-700 transition-colors group-hover:text-indigo-600">
                  {tool.requiresPremium && !isPremium ? 'ดูสิทธิ์การใช้งาน' : 'เปิดเครื่องมือ'} <ArrowUpRight size={13} />
                </span>
              </div>

              <span className="absolute right-5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition-all group-hover:border-indigo-100 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                <ArrowUpRight size={16} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {isAdmin && (
        <section className="mb-10 rounded-[28px] border border-slate-200/80 bg-slate-100/55 p-4 sm:p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <ShieldCheck size={18} />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900">เครื่องมือผู้ดูแลระบบ</h2>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">จัดการ AI ฐานข้อมูล และทรัพยากรส่วนกลาง</p>
              </div>
            </div>
            <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 sm:inline-flex">Admin access</span>
          </div>
          
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {adminTools.map((tool) => (
              <button 
                key={tool.id}
                onClick={() => handleToolClick(tool.id, false)}
                className={`group relative flex min-h-[205px] w-full flex-col items-start overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-300 ${tool.hoverClass} hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.99]`}
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-200 transition-colors group-hover:bg-slate-800" />
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${tool.iconClass}`}>
                  {React.createElement(tool.Icon, { size: 21 })}
                </div>
                <div className="flex flex-1 flex-col">
                  <h3 className="mb-2 text-sm font-black text-slate-900">{tool.name}</h3>
                  <p className="text-[10px] font-medium leading-[1.65] text-slate-500 md:text-[11px]">{tool.desc}</p>
                  <span className="mt-auto flex items-center gap-1.5 pt-4 text-[9px] font-black uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-800">
                    จัดการ <ArrowUpRight size={12} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {showPremiumAlert && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl scale-100 animate-slideUp text-center relative overflow-hidden">
            
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-200/40 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-200/40 rounded-full blur-3xl"></div>

            <div className="relative z-10">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-yellow-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-amber-200">
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              </div>
              
              <h3 className="text-xl font-extrabold text-slate-800 mb-2">เฉพาะสมาชิก Premium</h3>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                เครื่องมือ <strong className="text-slate-700">จัดวงดนตรี (Arranger)</strong> สงวนสิทธิ์สำหรับสมาชิกระดับ Premium เท่านั้น สนใจอัปเกรดเพื่อปลดล็อกฟังก์ชันขั้นสูงทั้งหมดหรือไม่?
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowPremiumAlert(false)}
                  className="w-full py-3.5 font-bold text-white bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-[0.98]"
                >
                  ดูรายละเอียดการอัปเกรด
                </button>
                <button 
                  onClick={() => setShowPremiumAlert(false)} 
                  className="w-full py-3 font-bold text-slate-400 hover:text-slate-600 bg-transparent rounded-xl transition-colors active:scale-[0.98]"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Tools;
