import React from 'react';

const Templates = ({ onNewProject }) => {
  // ข้อมูลจำลองสำหรับเทมเพลต
  const templates = [
    { 
      id: 'blank', 
      name: 'เอกสารเปล่า', 
      desc: 'หน้ากระดาษเปล่าสำหรับเริ่มต้นใหม่', 
      icon: '📄', 
      color: 'bg-slate-100 text-slate-500',
      borderColor: 'hover:border-slate-400' 
    },
    { 
      id: 'ranat-solo', 
      name: 'เดี่ยวระนาดเอก', 
      desc: 'ตั้งค่าหน้ากระดาษสำหรับบันทึกทางเดี่ยว', 
      icon: '🎹', 
      color: 'bg-rose-50 text-rose-500',
      borderColor: 'hover:border-rose-400'
    },
    { 
      id: 'piphat', 
      name: 'วงปี่พาทย์เครื่องคู่', 
      desc: 'โครงสร้างบรรทัดสำหรับเครื่องตีและเครื่องเป่า', 
      icon: '🥁', 
      color: 'bg-amber-50 text-amber-500',
      borderColor: 'hover:border-amber-400' 
    },
    { 
      id: 'ramwong', 
      name: 'โครงสร้างรำวงมาตรฐาน', 
      desc: 'แบบฟอร์มบันทึกโน้ตและเนื้อร้อง', 
      icon: '💃', 
      color: 'bg-purple-50 text-purple-500',
      borderColor: 'hover:border-purple-400' 
    },
    { 
      id: 'theory', 
      name: 'แบบฝึกหัดทฤษฎีดนตรี', 
      desc: 'เทมเพลตสำหรับสร้างใบงานหรือข้อสอบ', 
      icon: '📝', 
      color: 'bg-blue-50 text-blue-500',
      borderColor: 'hover:border-blue-400' 
    }
  ];

  return (
    <div 
      className="max-w-6xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-12"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      <div className="mb-6 md:mb-8 px-1">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 md:mb-2">เทมเพลต 🗂️</h2>
        <p className="text-xs md:text-sm text-slate-500 font-medium">เริ่มต้นสร้างผลงานอย่างรวดเร็วด้วยโครงสร้างที่เตรียมไว้ให้</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {templates.map((template) => (
          <button 
            key={template.id}
            onClick={() => {
              if (onNewProject) onNewProject(template.id);
            }}
            className={`bg-white border border-slate-200 rounded-2xl p-5 md:p-6 flex flex-col items-start gap-4 transition-all duration-300 shadow-sm hover:shadow-md group ${template.borderColor} hover:-translate-y-1 text-left w-full`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110 ${template.color}`}>
              {template.icon}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg mb-1">{template.name}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{template.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Templates;