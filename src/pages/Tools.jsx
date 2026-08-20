import React, { useState } from 'react';
import TunerDashboard from '../components/tools/TunerDashboard';
import RanatDictionary from '../components/tools/RanatDictionary';
import RanatGenerator from '../components/tools/RanatGenerator';
import ToolWorkspace from '../components/tools/ToolWorkspace';

// ⭐ 1. รับ userProfile เข้ามาทาง Props เพื่อใช้ตรวจสอบสิทธิ์
const Tools = ({ onPageChange, userProfile }) => {
  
  // ⭐ 2. เช็กสถานะแอดมิน (เหมือนหน้า Samples)
  const isAdmin = userProfile?.role === 'admin';

  const [activeTool, setActiveTool] = useState(null);

  // ⭐ 3. แยกกลุ่มเครื่องมือ เพื่อให้จัดการสิทธิ์และแสดงผลเป็นหมวดหมู่ได้ง่าย
  
  // เครื่องมือสำหรับทุกคน
  const publicTools = [
    { 
      id: 'workspace', 
      name: 'จัดวงดนตรี (Arranger)', 
      desc: 'เครื่องมือจัดการวงดนตรี ควบคุมไทม์ไลน์ และผูกเนื้อร้องเข้ากับโครงสร้างดนตรี', 
      icon: '🎛️', 
      color: 'bg-rose-50 text-rose-600',
      borderColor: 'hover:border-rose-300 hover:ring-2 hover:ring-rose-50' 
    }
  ];

  // เครื่องมือสำหรับแอดมินเท่านั้น
  const adminTools = [
    { 
      id: 'generator', 
      name: 'AI สร้างทางระนาด', 
      desc: 'แปลงทำนองหลักจากฆ้องวงใหญ่เป็นทางระนาดเอกอัตโนมัติ ตามระดับความยากที่กำหนด', 
      icon: '✨', 
      color: 'bg-sky-50 text-sky-600',
      borderColor: 'hover:border-sky-300 hover:ring-2 hover:ring-sky-50' 
    },
    { 
      id: 'dictionary', 
      name: 'พจนานุกรมทางระนาด', 
      desc: 'จัดการฐานข้อมูลวลีเพลง (Phrases) จัดกลุ่มระดับความยาก และกำหนดโครงสร้างเป้าหมาย', 
      icon: '📚', 
      color: 'bg-teal-50 text-teal-600',
      borderColor: 'hover:border-teal-300 hover:ring-2 hover:ring-teal-50' 
    },
    { 
      id: 'tuner-ai', 
      name: 'AI จูนโครงสร้าง', 
      desc: 'วิเคราะห์โครงสร้างทำนอง ตรวจสอบความถูกต้องของสัดส่วน และจัดการ Dataset สอนระบบ', 
      icon: '🧠', 
      color: 'bg-indigo-50 text-indigo-600',
      borderColor: 'hover:border-indigo-300 hover:ring-2 hover:ring-indigo-50' 
    }
  ];

  const handleToolClick = (toolId) => {
    setActiveTool(toolId);
  };

  const renderActiveTool = () => {
    switch (activeTool) {
      case 'generator': return isAdmin ? <RanatGenerator /> : null;
      case 'dictionary': return isAdmin ? <RanatDictionary /> : null;
      case 'tuner-ai': return isAdmin ? <TunerDashboard /> : null;
      case 'workspace': return <ToolWorkspace />;
      default: return null;
    }
  };

  // --- กรณีที่เลือกเครื่องมือแล้ว (แสดง Component พร้อมปุ่มย้อนกลับ) ---
  if (activeTool) {
    const currentToolInfo = [...publicTools, ...adminTools].find(t => t.id === activeTool);
    
    return (
      <div className="min-h-screen bg-[#0c1014] flex flex-col animate-fadeIn" style={{ fontFamily: 'Prompt, sans-serif' }}>
        {/* Header สไตล์ Dark Mode ให้กลมกลืนกับ Workspace */}
        <div className="bg-[#11151a] border-b border-white/10 px-4 py-3 flex items-center shadow-sm sticky top-0 z-50">
          <button 
            onClick={() => setActiveTool(null)}
            className="flex items-center gap-2 text-[11px] font-bold text-white/60 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            กลับหน้ารวมเครื่องมือ
          </button>
          
          <div className="ml-4 pl-4 border-l border-white/10 flex items-center gap-2.5">
            <span className="text-lg leading-none">{currentToolInfo?.icon}</span>
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

  // --- กรณีหน้าเมนูหลัก (Tools Dashboard) ---
  return (
    <div 
      className="max-w-6xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-24 md:pb-12 min-h-screen"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      <div className="mb-8 md:mb-10 px-1 border-b border-slate-200 pb-6 flex items-end justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 md:mb-2 tracking-tight">เครื่องมือ 🔧</h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium">ศูนย์รวมตัวช่วยอัจฉริยะสำหรับการฝึกซ้อม สร้างสรรค์ผลงาน และจัดการข้อมูล</p>
        </div>
        {isAdmin && (
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-white text-[10px] font-bold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Admin Mode
          </span>
        )}
      </div>

      {/* หมวดหมู่: เครื่องมือทั่วไป (เห็นทุกคน) */}
      <div className="mb-10">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">General Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
          {publicTools.map((tool) => (
            <button 
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              className={`bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-start gap-4 transition-all duration-300 shadow-sm hover:shadow-md group ${tool.borderColor} text-left w-full active:scale-[0.98]`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${tool.color} border border-white/50 shadow-sm`}>
                {tool.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-[15px] mb-1.5">{tool.name}</h3>
                <p className="text-[12px] text-slate-500 font-medium leading-relaxed">{tool.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ⭐ หมวดหมู่: เครื่องมือผู้ดูแลระบบ (ซ่อนจากผู้ใช้ทั่วไป) */}
      {isAdmin && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4 px-1">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Admin Tools</h3>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {adminTools.map((tool) => (
              <button 
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                className={`bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-start gap-4 transition-all duration-300 shadow-sm hover:shadow-md group ${tool.borderColor} text-left w-full active:scale-[0.98] relative overflow-hidden`}
              >
                {/* แถบสีเล็กๆ ด้านบนเพื่อแยกให้รู้ว่าเป็นเครื่องมือพิเศษ */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800/10 group-hover:bg-sky-400/80 transition-colors"></div>
                
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${tool.color} border border-white/50 shadow-sm mt-1`}>
                  {tool.icon}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[15px] mb-1.5">{tool.name}</h3>
                  <p className="text-[12px] text-slate-500 font-medium leading-relaxed">{tool.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default Tools;