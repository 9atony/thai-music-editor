import React, { useContext, useState } from 'react';
import { MusicContext } from '../contexts/MusicContext';

const Settings = () => {
  const { layoutConfig, setLayoutConfig } = useContext(MusicContext);

  // State จำลองสำหรับการตั้งค่าต่างๆ (สามารถนำไปผูกกับ Context หรือ Firebase ได้ในอนาคต)
  const [autoSave, setAutoSave] = useState(true);
  const [defaultInstrument, setDefaultInstrument] = useState('ranat-ek');
  const [tuningSystem, setTuningSystem] = useState('thai-7');
  const [notationSize, setNotationSize] = useState('medium');

  const handleVolumeChange = (e) => {
    setLayoutConfig({ ...layoutConfig, volume: parseInt(e.target.value) });
  };

  const handleExportData = () => {
    alert('กำลังเตรียมไฟล์แบคอัป... (ฟีเจอร์นี้อยู่ระหว่างการพัฒนา)');
  };

  return (
    <div 
      className="max-w-4xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-24"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      {/* Header */}
      <div className="mb-8 px-1">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">การตั้งค่า ⚙️</h2>
        <p className="text-sm text-slate-500 font-medium">ปรับแต่งสภาพแวดล้อมการเขียนโน้ตและระบบเสียงของแอป</p>
      </div>

      <div className="space-y-6">
        
        {/* 1. หมวดเสียงและการเล่น */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
              <span className="text-lg">🎵</span> เสียงและการจำลองเครื่องดนตรี
            </h3>
          </div>
          <div className="p-5 md:p-6 space-y-6">
            
            {/* ระดับเสียงหลัก */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-700">ระดับเสียงหลัก (Master Volume)</h4>
                  <p className="text-xs text-slate-500 mt-1">ปรับความดังเริ่มต้นของการเล่นเสียงทั้งหมด</p>
                </div>
                <span className="text-sm font-bold text-sky-500 bg-sky-50 px-2 py-1 rounded-md">
                  {layoutConfig.volume !== undefined ? layoutConfig.volume : 100}%
                </span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={layoutConfig.volume !== undefined ? layoutConfig.volume : 100} 
                onChange={handleVolumeChange} 
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" 
              />
            </div>

            <hr className="border-slate-100" />

            {/* ระบบจูนเสียง */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-700">ระบบจำลองระดับเสียง (Tuning)</h4>
                <p className="text-xs text-slate-500 mt-1">เลือกความห่างของเสียงให้ตรงกับมาตรฐานที่ต้องการ</p>
              </div>
              <select 
                value={tuningSystem}
                onChange={(e) => setTuningSystem(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-sky-500 focus:border-sky-500 block w-full md:w-48 p-2.5 font-medium outline-none"
              >
                <option value="thai-7">7 เสียงเท่า (ดนตรีไทย)</option>
                <option value="western">สากล (Western Equal Temperament)</option>
              </select>
            </div>

          </div>
        </section>

        {/* 2. หมวดการตั้งค่าหน้ากระดาษและเอดิเตอร์ */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
              <span className="text-lg">📝</span> หน้ากระดาษและตัวโน้ต
            </h3>
          </div>
          <div className="p-5 md:p-6 space-y-6">
            
            {/* เครื่องดนตรีเริ่มต้น */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-700">หน้ากระดาษเริ่มต้น</h4>
                <p className="text-xs text-slate-500 mt-1">ตั้งค่าฟอร์แมตกระดาษเวลาสร้างโปรเจกต์ใหม่</p>
              </div>
              <select 
                value={defaultInstrument}
                onChange={(e) => setDefaultInstrument(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-sky-500 focus:border-sky-500 block w-full md:w-48 p-2.5 font-medium outline-none"
              >
                <option value="blank">เอกสารเปล่า</option>
                <option value="ranat-ek">ระนาดเอก</option>
                <option value="khong-wong-yai">ฆ้องวงใหญ่</option>
              </select>
            </div>

            <hr className="border-slate-100" />

            {/* ขนาดตัวโน้ต */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-700">ขนาดตัวอักษรโน้ต</h4>
                <p className="text-xs text-slate-500 mt-1">ปรับขนาดการแสดงผลของตัวโน้ตในตาราง</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                <button 
                  onClick={() => setNotationSize('small')}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${notationSize === 'small' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  เล็ก
                </button>
                <button 
                  onClick={() => setNotationSize('medium')}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${notationSize === 'medium' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  กลาง
                </button>
                <button 
                  onClick={() => setNotationSize('large')}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${notationSize === 'large' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  ใหญ่
                </button>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* บันทึกอัตโนมัติ */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-700">บันทึกอัตโนมัติ (Auto-Save)</h4>
                <p className="text-xs text-slate-500 mt-1">เซฟข้อมูลลงอุปกรณ์โดยอัตโนมัติขณะแก้ไข</p>
              </div>
              <button 
                onClick={() => setAutoSave(!autoSave)}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${autoSave ? 'bg-sky-500' : 'bg-slate-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${autoSave ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

          </div>
        </section>

        {/* 3. หมวดการซิงค์และสำรองข้อมูล */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
              <span className="text-lg">🔄</span> การสำรองข้อมูล
            </h3>
          </div>
          <div className="p-5 md:p-6">
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              คุณสามารถดาวน์โหลดโปรเจกต์ทั้งหมดที่บันทึกไว้ในระบบ ออกมาเป็นไฟล์ Backup (.zip) เพื่อเก็บไว้ในเครื่องของคุณได้
            </p>
            <button 
              onClick={handleExportData}
              className="w-full md:w-auto flex items-center justify-center gap-2 py-2.5 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors active:scale-[0.98] text-sm shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              ดาวน์โหลดข้อมูลทั้งหมด
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Settings;