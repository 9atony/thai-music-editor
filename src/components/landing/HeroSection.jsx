import React from 'react';
import { CheckCircle2, Cloud, Lock } from 'lucide-react';
// import รูปเข้ามา (สมมติว่าคุณเซฟรูปไว้ใน assets ชื่อ hero-mockup.png)
import mockupImage from '../../assets/hero-mockup.png';

const HeroSection = ({ onLoginClick }) => {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
        
        {/* Left Text */}
        <div className="w-full lg:w-1/2 space-y-8 z-10">
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-slate-900 tracking-tight">
            สร้างสรรค์<br />
            <span className="text-amber-500 drop-shadow-sm">ดนตรีไทย</span><br />
            ได้ทุกที่ ทุกอุปกรณ์
          </h1>
          <p className="text-lg text-slate-600 max-w-lg leading-relaxed">
            Thai Music Editor คือเครื่องมือสร้าง แก้ไข และจัดการโน้ตดนตรีไทย ออกแบบมาเพื่อการเรียนรู้ การสอน และการสร้างสรรค์ดนตรีไทยยุคใหม่
          </p>
          
          <div className="flex pt-2">
            {/* ปุ่มหลักปุ่มเดียว เน้นๆ */}
            <button 
              onClick={onLoginClick}
              className="group px-8 py-4 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-semibold flex items-center gap-2 transition-all duration-300 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:scale-95 text-lg"
            >
              เริ่มสร้างฟรีเลย 
              <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
            </button>
          </div>

          {/* จุดเด่นสั้นๆ */}
          <div className="flex flex-wrap gap-x-8 gap-y-4 pt-8 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="font-medium text-slate-700">ใช้งานง่าย</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-50 text-amber-600">
                <Cloud className="w-5 h-5" />
              </div>
              <span className="font-medium text-slate-700">ไม่ต้องติดตั้ง</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-50 text-green-600">
                <Lock className="w-5 h-5" />
              </div>
              <span className="font-medium text-slate-700">ปลอดภัยบนคลาวด์</span>
            </div>
          </div>
        </div>
{/* Right Mockup */}
        <div className="w-full lg:w-1/2 relative mt-8 lg:mt-0">
          {/* เปลี่ยน aspect-video เป็น aspect-auto เพื่อปล่อยให้สูงตามรูปจริง */}
          <div className="aspect-auto bg-transparent flex items-center justify-center relative overflow-hidden transition-transform duration-700 hover:scale-[1.02]">
             {/* ใส่รูปภาพตรงนี้ และใช้ object-contain */}
             <img 
               src={mockupImage} 
               alt="Thai Music Editor Interface" 
               className="w-full h-auto object-contain drop-shadow-2xl" 
             />
          </div>
          
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400/10 rounded-full blur-3xl -z-10"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl -z-10"></div>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;