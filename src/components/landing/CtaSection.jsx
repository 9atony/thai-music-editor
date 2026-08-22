import React from 'react';

const CtaSection = ({ onLoginClick }) => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-3xl p-12 shadow-sm border border-blue-100/50">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
          พร้อมเริ่มสร้างสรรค์ดนตรีไทยหรือยัง?
        </h2>
        <p className="text-slate-500 mb-10 text-lg">
          เปลี่ยนเรื่องยากให้เป็นเรื่องง่าย เริ่มต้นบันทึกโน้ตเพลงของคุณได้ฟรีทันที
        </p>
        <button 
          onClick={onLoginClick}
          className="mx-auto px-10 py-4 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-bold text-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5"
        >
          เปิดใช้งาน Thai Music Editor <span>→</span>
        </button>
      </div>
    </section>
  );
};

export default CtaSection;