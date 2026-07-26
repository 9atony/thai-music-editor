import React from 'react';

const Tools = ({ onPageChange }) => {
  // ข้อมูลรายการเครื่องมือต่างๆ
  const toolsList = [
    { 
      id: 'metronome', 
      name: 'เมโทรนอม (ฉิ่ง-ฉาบ)', 
      desc: 'เครื่องให้จังหวะเสียงเครื่องดนตรีไทย ปรับอัตราจังหวะ (BPM) ได้', 
      icon: '⏱️', 
      color: 'bg-emerald-50 text-emerald-500',
      borderColor: 'hover:border-emerald-400' 
    },
    { 
      id: 'tuner', 
      name: 'เครื่องเทียบเสียง', 
      desc: 'จูนเนอร์สำหรับตั้งเสียงเครื่องดนตรีไทย (ระบบ 7 เสียงเท่า)', 
      icon: '🪕', 
      color: 'bg-amber-50 text-amber-500',
      borderColor: 'hover:border-amber-400'
    },
    { 
      id: 'theory-board', 
      name: 'กระดานทฤษฎีดนตรี', 
      desc: 'ตารางเทียบเสียงและสัดส่วนโน้ต สำหรับใช้ประกอบการอธิบายเนื้อหาพื้นฐาน', 
      icon: '📝', 
      color: 'bg-blue-50 text-blue-500',
      borderColor: 'hover:border-blue-400' 
    },
    { 
      id: 'virtual-instrument', 
      name: 'เครื่องดนตรีจำลอง', 
      desc: 'แป้นจำลองเสียงระนาดเอกและฆ้องวงใหญ่ สำหรับทบทวนเสียงเมื่อไม่มีเครื่องดนตรีจริง', 
      icon: '🎹', 
      color: 'bg-rose-50 text-rose-500',
      borderColor: 'hover:border-rose-400' 
    }
  ];

  const handleToolClick = (toolId) => {
    // อนาคตสามารถใส่ Logic เพื่อเปิดหน้าต่างเครื่องมือนั้นๆ หรือสลับ Component ได้
    console.log(`เปิดเครื่องมือ: ${toolId}`);
    alert(`กำลังพัฒนาฟีเจอร์: ${toolId}`);
  };

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

      {/* กล่องข้อความแนะนำ (Optional) */}
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