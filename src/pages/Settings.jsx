import React, { useContext, useState } from 'react';
import { MusicContext } from '../contexts/MusicContext';
import { logoutUser } from '../utils/firebase';

const Settings = () => {
  const { layoutConfig, setLayoutConfig } = useContext(MusicContext);
  // ⭐ เพิ่ม State สำหรับควบคุมการเปิด/ปิด Popup ออกจากระบบ
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleVolumeChange = (e) => {
    setLayoutConfig({ ...layoutConfig, volume: parseInt(e.target.value) });
  };

  // ⭐ เปลี่ยนฟังก์ชันให้ออกจากระบบทันทีเมื่อกด "ยืนยัน" ใน Popup
  const handleLogoutConfirm = async () => {
    try {
      await logoutUser();
      window.location.href = '/login'; 
    } catch (error) {
      console.error("ออกจากระบบไม่สำเร็จ:", error);
    }
  };

  return (
    <div 
      className="max-w-4xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-24"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">การตั้งค่า</h2>
        <p className="text-sm text-slate-500 font-medium">ปรับแต่งการใช้งาน Thai Music Editor ในแบบของคุณ</p>
      </div>

      <div className="space-y-6">
        
        {/* 1. หมวดการแสดงผล */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <span className="text-lg">🎨</span> การแสดงผลและหน้าตา
            </h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-700">ธีมแอปพลิเคชัน</h4>
                <p className="text-xs text-slate-500 mt-1">เลือกโหมดสว่างหรือโหมดมืด (อยู่ระหว่างพัฒนา)</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button className="px-4 py-1.5 text-sm font-bold bg-white text-slate-800 rounded-md shadow-sm">สว่าง</button>
                <button className="px-4 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">มืด</button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. หมวดเสียงและการเล่น */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <span className="text-lg">🎵</span> เสียงและการเล่น
            </h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-700">ระดับเสียงหลัก (Master Volume)</h4>
                  <p className="text-xs text-slate-500 mt-1">ปรับความดังเริ่มต้นของเครื่องดนตรีทั้งหมด</p>
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
          </div>
        </section>

        {/* 3. หมวดบัญชีผู้ใช้ (เฉพาะมือถือ) */}
        <section className="md:hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <span className="text-lg">👤</span> บัญชีของฉัน
            </h3>
          </div>
          <div className="p-6">
            {/* ⭐ เปลี่ยนจากการเรียกฟังก์ชันตรงๆ เป็นการสั่งเปิด Popup แทน */}
            <button 
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-colors active:scale-[0.98]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              ออกจากระบบ
            </button>
          </div>
        </section>
      </div>

      {/* ⭐ ระบบ UI Popup ยืนยันการออกจากระบบ */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl scale-100 animate-slideUp text-center">
            
            {/* ไอคอนเตือนสีแดง */}
            <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-2">ออกจากระบบ</h3>
            <p className="text-sm text-slate-500 mb-6">คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ? <br className="hidden md:block" />คุณจะต้องเข้าสู่ระบบใหม่ในครั้งถัดไป</p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors active:scale-[0.98]"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleLogoutConfirm}
                className="flex-1 py-3 font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-all shadow-md shadow-rose-500/20 active:scale-[0.98]"
              >
                ยืนยัน
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;