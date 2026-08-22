import React from 'react';
import { PlayCircle, Edit3, Share2 } from 'lucide-react';

const GuideSection = () => {
  return (
    <section id="guide" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
            เริ่มต้นใช้งานใน 3 ขั้นตอนง่ายๆ
          </h2>
          <p className="text-slate-500">ไม่ต้องติดตั้งโปรแกรม แค่เปิดเบราว์เซอร์ก็เริ่มสร้างสรรค์ได้เลย</p>
        </div>

        <div className="flex flex-col md:flex-row justify-center items-start gap-8 md:gap-12 relative">
          
          {/* เส้นเชื่อมระหว่างขั้นตอน (แสดงเฉพาะหน้าจอคอม) */}
          <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-slate-100 -z-10"></div>

          {/* Step 1 */}
          <div className="flex flex-col items-center text-center w-full md:w-1/3">
            <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm">
              <Edit3 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-slate-800">1. สร้างหรือนำเข้า</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              คลิก "เริ่มสร้างฟรี" เพื่อเปิดหน้ากระดาษเปล่า หรืออัปโหลดไฟล์โปรเจกต์ .tme ที่คุณมีอยู่แล้ว
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center w-full md:w-1/3">
            <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm">
              <PlayCircle className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-slate-800">2. พิมพ์และฟังเสียง</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              คลิกที่ช่องตารางเพื่อพิมพ์ตัวโน้ต เลือกเครื่องดนตรี และกดปุ่มเล่นเพื่อฟังเสียงแบบเรียลไทม์
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center w-full md:w-1/3">
            <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm">
              <Share2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-slate-800">3. บันทึกและแชร์</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              ระบบจะบันทึกอัตโนมัติบนคลาวด์ หรือคุณสามารถกดส่งออกเป็นไฟล์เพื่อแชร์ให้คนอื่นได้ทันที
            </p>
          </div>

        </div>
      </div>
    </section>
  );
};

export default GuideSection;