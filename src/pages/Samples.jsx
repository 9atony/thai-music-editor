import React from 'react';
import TmeIcon from '../assets/icon.png'; 

const Samples = ({ onOpenProject }) => {
  // ข้อมูลจำลองสำหรับตัวอย่างเพลง
  const samples = [
    { id: 's1', name: 'ลาวดวงเดือน ๒ ชั้น', category: 'เพลงพื้นฐาน', level: 'ง่าย' },
    { id: 's2', name: 'ค้างคาวกินกล้วย', category: 'เพลงเบ็ดเตล็ด', level: 'ปานกลาง' },
    { id: 's3', name: 'โหมโรงจอมสุรางค์', category: 'เพลงโหมโรง', level: 'ยาก' },
    { id: 's4', name: 'พม่าเขว', category: 'เพลงพื้นฐาน', level: 'ง่าย' },
    { id: 's5', name: 'แขกบรเทศ ๒ ชั้น', category: 'เพลงเถา', level: 'ปานกลาง' },
  ];

  const getLevelColor = (level) => {
    switch(level) {
      case 'ง่าย': return 'text-green-600 bg-green-50 border-green-200';
      case 'ปานกลาง': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'ยาก': return 'text-rose-600 bg-rose-50 border-rose-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div 
      className="max-w-6xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-12"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      <div className="mb-6 md:mb-8 px-1">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 md:mb-2">ตัวอย่างเพลง 🎵</h2>
        <p className="text-xs md:text-sm text-slate-500 font-medium">ศึกษาและเรียนรู้จากโน้ตเพลงไทยมาตรฐานที่จัดทำไว้สมบูรณ์แล้ว</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
        {samples.map((sample) => (
          <button 
            key={sample.id} 
            onClick={() => onOpenProject && onOpenProject(sample.id)}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-sky-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group cursor-pointer relative text-center w-full"
          >
            <div className="w-full h-32 md:h-40 bg-gradient-to-b from-slate-50 to-slate-100 rounded-xl mb-4 flex items-center justify-center border border-slate-200/50 group-hover:from-sky-50/50 group-hover:to-sky-100/50 transition-colors overflow-hidden">
               <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <img src={TmeIcon} alt="File Icon" className="w-full h-full object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.15)]" />
               </div>
            </div>
            <div className="w-full text-left px-1">
              <h4 className="font-bold text-slate-900 text-sm md:text-base w-full truncate mb-1">
                {sample.name}
              </h4>
              <p className="text-[11px] md:text-xs text-slate-500 font-medium mb-2 truncate">
                {sample.category}
              </p>
              <div className="flex items-center">
                <span className={`text-[10px] md:text-[11px] font-bold px-2 py-0.5 rounded-md border ${getLevelColor(sample.level)}`}>
                  {sample.level}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Samples;