import React, { useState } from 'react';
import TunerDashboard from '../components/tools/TunerDashboard';
import RanatDictionary from '../components/tools/RanatDictionary';
import RanatGenerator from '../components/tools/RanatGenerator';
import ToolWorkspace from '../components/tools/ToolWorkspace';

const Tools = ({ onPageChange, userProfile }) => {
  
  const userRole = userProfile?.role || 'user';
  const isAdmin = userRole === 'admin';
  const isPremium = userRole === 'premium' || isAdmin; 

  const [activeTool, setActiveTool] = useState(null);
  
  // ⭐ State ควบคุมการแสดง Modal แจ้งเตือน Premium
  const [showPremiumAlert, setShowPremiumAlert] = useState(false);

  const premiumTools = [
    { 
      id: 'workspace', 
      name: 'จัดวงดนตรี (Arranger)', 
      desc: 'เครื่องมือจัดการวงดนตรี ควบคุมไทม์ไลน์ และผูกเนื้อร้องเข้ากับโครงสร้างดนตรี', 
      icon: '🎛️', 
      color: 'bg-rose-50 text-rose-600',
      borderColor: 'hover:border-rose-300 hover:ring-2 hover:ring-rose-50' 
    }
  ];

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

  const handleToolClick = (toolId, isPremiumTool) => {
    // ⭐ ถ้าเป็นเครื่องมือ Premium แต่คนกดไม่ใช่ Premium ให้โชว์ Modal แทน alert
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
      case 'workspace': return isPremium ? <ToolWorkspace /> : null;
      default: return null;
    }
  };

  if (activeTool) {
    const currentToolInfo = [...premiumTools, ...adminTools].find(t => t.id === activeTool);
    
    return (
      <div className="min-h-screen bg-[#0c1014] flex flex-col animate-fadeIn" style={{ fontFamily: 'Prompt, sans-serif' }}>
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

  return (
    <div 
      className="max-w-6xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-24 md:pb-12 min-h-screen relative"
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

      <div className="mb-10">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">Premium Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
          {premiumTools.map((tool) => (
            <button 
              key={tool.id}
              onClick={() => handleToolClick(tool.id, true)}
              className={`bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-start gap-4 transition-all duration-300 shadow-sm relative group w-full text-left
                ${isPremium ? `${tool.borderColor} hover:shadow-md active:scale-[0.98]` : 'opacity-80 hover:bg-slate-50 cursor-pointer'}
              `}
            >
              {!isPremium && (
                <div className="absolute top-4 right-4 text-slate-300 text-lg group-hover:text-amber-500 transition-colors">
                  🔒
                </div>
              )}
              
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform duration-300 border border-white/50 shadow-sm 
                ${isPremium ? `${tool.color} group-hover:scale-110 group-hover:-rotate-3` : 'bg-slate-100 text-slate-400 grayscale'}
              `}>
                {tool.icon}
              </div>
              <div>
                <h3 className={`font-bold text-[15px] mb-1.5 ${isPremium ? 'text-slate-800' : 'text-slate-500'}`}>
                  {tool.name}
                </h3>
                <p className="text-[12px] text-slate-500 font-medium leading-relaxed">{tool.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

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
                onClick={() => handleToolClick(tool.id, false)}
                className={`bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-start gap-4 transition-all duration-300 shadow-sm hover:shadow-md group ${tool.borderColor} text-left w-full active:scale-[0.98] relative overflow-hidden`}
              >
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

      {/* ⭐ Modal แจ้งเตือน Premium */}
      {showPremiumAlert && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl scale-100 animate-slideUp text-center relative overflow-hidden">
            
            {/* แสงวิบวับตกแต่งพื้นหลัง */}
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