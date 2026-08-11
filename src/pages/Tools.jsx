import React, { useState } from 'react';
// Import Component เครื่องมือใหม่ของเรา (ปรับ Path ให้ตรงกับโฟลเดอร์ของคุณ)
import TunerDashboard from '../components/tools/TunerDashboard';
import RanatDictionary from '../components/tools/RanatDictionary';
import RanatGenerator from '../components/tools/RanatGenerator';

const Tools = ({ onPageChange }) => {
  // สร้าง State สำหรับจดจำว่าผู้ใช้กำลังเปิดเครื่องมือไหนอยู่ (null = หน้าเมนูหลัก)
  const [activeTool, setActiveTool] = useState(null);

  // ข้อมูลรายการเครื่องมือทั้งหมด (เหลือแค่ 3 ตัวใหม่ตามที่ต้องการ)
  const toolsList = [
    { 
      id: 'generator', 
      name: 'AI สร้างทางระนาด', 
      desc: 'แปลงทำนองหลัก (ฆ้องวงใหญ่) เป็นทางระนาดเอกอัตโนมัติ ตามระดับความยาก', 
      icon: '✨', 
      color: 'bg-indigo-50 text-indigo-500',
      borderColor: 'hover:border-indigo-400' 
    },
    { 
      id: 'dictionary', 
      name: 'พจนานุกรมทางระนาด', 
      desc: 'จัดการฐานข้อมูลทางระนาด จัดกลุ่มเลเวล และกำหนดโครงสร้างเป้าหมาย', 
      icon: '📚', 
      color: 'bg-teal-50 text-teal-500',
      borderColor: 'hover:border-teal-400' 
    },
    { 
      id: 'tuner-ai', 
      name: 'AI จูนโครงสร้าง', 
      desc: 'วิเคราะห์โครงสร้างทำนอง ตรวจสอบความถูกต้อง และจัดการ Dataset สำหรับสอนระบบ', 
      icon: '🧠', 
      color: 'bg-violet-50 text-violet-500',
      borderColor: 'hover:border-violet-400' 
    }
  ];

  const handleToolClick = (toolId) => {
    setActiveTool(toolId);
  };

  // ฟังก์ชันเรนเดอร์หน้าจอตามเครื่องมือที่เลือก
  const renderActiveTool = () => {
    switch (activeTool) {
      case 'generator':
        return <RanatGenerator />;
      case 'dictionary':
        return <RanatDictionary />;
      case 'tuner-ai':
        return <TunerDashboard />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">กำลังพัฒนาฟีเจอร์นี้</h3>
            <p className="mb-6">อดใจรออีกนิด ระบบกำลังเตรียมความพร้อมครับ</p>
            <button 
              onClick={() => setActiveTool(null)} 
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
            >
              กลับหน้ารวมเครื่องมือ
            </button>
          </div>
        );
    }
  };

  // --- กรณีที่เลือกเครื่องมือแล้ว (แสดง Component พร้อมปุ่มย้อนกลับ) ---
  if (activeTool) {
    const currentToolInfo = toolsList.find(t => t.id === activeTool);
    
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col animate-fadeIn" style={{ fontFamily: 'Prompt, sans-serif' }}>
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center shadow-sm sticky top-0 z-50">
          <button 
            onClick={() => setActiveTool(null)}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors bg-slate-50 hover:bg-slate-100 px-4 py-2 rounded-lg border border-slate-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            ย้อนกลับ
          </button>
          
          <div className="ml-5 pl-5 border-l border-slate-200 flex items-center gap-2">
            <span className="text-xl">{currentToolInfo?.icon}</span>
            <span className="text-base font-bold text-slate-800">
              {currentToolInfo?.name}
            </span>
          </div>
        </div>

        <div className="flex-1">
          {renderActiveTool()}
        </div>
      </div>
    );
  }

  // --- กรณีหน้าเมนูหลัก (โค้ดดีไซน์เดิม) ---
  return (
    <div 
      className="max-w-6xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-24 md:pb-12"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      <div className="mb-6 md:mb-8 px-1">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 md:mb-2">เครื่องมือ 🔧</h2>
        <p className="text-xs md:text-sm text-slate-500 font-medium">รวมตัวช่วยสำหรับการฝึกซ้อม สร้างสรรค์ผลงาน และประกอบการสอน</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {toolsList.map((tool) => (
          <button 
            key={tool.id}
            onClick={() => handleToolClick(tool.id)}
            className={`bg-white border border-slate-200 rounded-2xl p-5 md:p-6 flex flex-col items-start gap-4 transition-all duration-300 shadow-sm hover:shadow-md group ${tool.borderColor} hover:-translate-y-1 text-left w-full active:scale-[0.98]`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110 ${tool.color} border border-white/50 shadow-sm`}>
              {tool.icon}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg mb-1">{tool.name}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{tool.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* กล่องข้อความแนะนำ */}
      <div className="mt-8 md:mt-12 bg-sky-50 border border-sky-100 rounded-2xl p-5 md:p-6 flex items-start gap-4">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-sky-500 shrink-0 shadow-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h4 className="font-bold text-sky-800 text-sm md:text-base mb-1">ฟีเจอร์เพิ่มเติมกำลังมา!</h4>
          <p className="text-xs md:text-sm text-sky-600 font-medium">หากต้องการเครื่องมือไหนเพิ่มเติมสำหรับการจัดทำสื่อการเรียนการสอน สามารถเพิ่มเข้าไปในหมวดหมู่นี้ได้เลยครับ</p>
        </div>
      </div>
    </div>
  );
};

export default Tools;