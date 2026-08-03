import React, { useContext, useState } from 'react';
import { MusicContext } from '../contexts/MusicContext';
import { auth, fetchAllProjects } from '../utils/firebase'; // 👈 นำเข้า fetchAllProjects มาใช้
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const Settings = () => {
  const { 
    layoutConfig, 
    setLayoutConfig,
    isOctaveMode,
    setIsOctaveMode,
    currentInstrument, 
    changeInstrument
  } = useContext(MusicContext);

  const [isExporting, setIsExporting] = useState(false);

  const handleVolumeChange = (e) => {
    setLayoutConfig({ ...layoutConfig, volume: parseInt(e.target.value) });
  };

  const getNotationSizeLabel = (size) => {
    if (size <= 24) return 'small';
    if (size >= 36) return 'large';
    return 'medium';
  };
  const currentSize = getNotationSizeLabel(layoutConfig.fontSize || 30);

  const handleNotationSizeChange = (sizeLabel) => {
    let newSize = 30;
    if (sizeLabel === 'small') newSize = 24;
    if (sizeLabel === 'large') newSize = 36;
    setLayoutConfig({ ...layoutConfig, fontSize: newSize });
  };

  // 💾 ฟังก์ชันดึงข้อมูลจาก Firebase และมัดรวมเป็นไฟล์ .zip
  const handleExportAllData = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("กรุณาเข้าสู่ระบบก่อนทำการดาวน์โหลดข้อมูลสำรองครับ");
      return;
    }

    setIsExporting(true);
    try {
      // 1. เรียกใช้งานฟังก์ชันที่ชี้ไปถูก Path (users/uid/projects)
      const allProjects = await fetchAllProjects(user.uid);

      if (allProjects.length === 0) {
        alert("ยังไม่มีโปรเจกต์ที่ถูกบันทึกไว้ในระบบครับ");
        setIsExporting(false);
        return;
      }

      // 2. สร้างไฟล์ Zip
      const zip = new JSZip();

      allProjects.forEach((projectData) => {
        const projectName = projectData.name || projectData.songName || "โปรเจกต์ไม่มีชื่อ";
        // กรองอักขระพิเศษออกจากชื่อไฟล์ ป้องกัน error ตอนเซฟ
        const safeName = projectName.replace(/[^a-zA-Z0-9ก-๙\s]/g, "_").trim(); 
        const fileContent = JSON.stringify(projectData, null, 2);
        
        // ยัดไฟล์ลงใน Zip
        zip.file(`${safeName}_${projectData.id.substring(0,5)}.tme`, fileContent);
      });

      // 3. ประมวลผลและสั่งดาวน์โหลด
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "ThaiMusicEditor_Backup.zip");

    } catch (error) {
      console.error("Error exporting all projects:", error);
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลจากฐานข้อมูลครับ");
    } finally {
      setIsExporting(false);
    }
  };

  const shortcuts = [
    { key: "Spacebar", desc: "เล่น / หยุดเล่นดนตรี" },
    { key: "Ctrl ขวา", desc: "ใส่เครื่องหมายพักเสียง (-) หรือขีดยาว" },
    { key: "Backspace", desc: "ลบโน้ตทีละตัว หรือ ลบสัญลักษณ์ที่เลือกอยู่" },
    { key: "Delete", desc: "ลบบรรทัดทิ้ง หรือ ลบสัญลักษณ์ที่เลือกอยู่" },
    { key: "Insert", desc: "แทรกบรรทัดใหม่ (อัจฉริยะ: แทรกเดี่ยว/คู่ ตามบรรทัดปัจจุบัน)" },
    { key: "ลูกศร ⬅️ ⬆️ ⬇️ ➡️", desc: "เลื่อนตำแหน่งเคอร์เซอร์ไปยังช่องหรือบรรทัดต่างๆ" },
    { key: "Ctrl + Z", desc: "เลิกทำ (Undo)" },
    { key: "Ctrl + Y / R", desc: "ทำซ้ำ (Redo)" },
    { key: "Ctrl + C", desc: "คัดลอก (Copy) ข้อมูลรวมถึงสัญลักษณ์" },
    { key: "Ctrl + X", desc: "ตัด (Cut) ข้อมูลรวมถึงสัญลักษณ์" },
    { key: "Ctrl + V", desc: "วาง (Paste) ข้อมูลรวมถึงสัญลักษณ์" },
  ];

  return (
    <div 
      className="max-w-4xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-24"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      <div className="mb-8 px-1">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">การตั้งค่า ⚙️</h2>
        <p className="text-sm text-slate-500 font-medium">ปรับแต่งสภาพแวดล้อมการทำงานและดูคีย์ลัดของแอป</p>
      </div>

      <div className="space-y-6">
        
        {/* 1. หมวดเสียงและการจำลอง (Audio) */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
              <span className="text-lg">🎵</span> เสียงและการเล่น
            </h3>
          </div>
          <div className="p-5 md:p-6 space-y-6">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-700">ระดับเสียงหลัก (Master Volume)</h4>
                  <p className="text-xs text-slate-500 mt-1">ปรับความดังเริ่มต้นของการบรรเลง</p>
                </div>
                <span className="text-sm font-bold text-sky-500 bg-sky-50 px-2 py-1 rounded-md">
                  {layoutConfig.volume !== undefined ? layoutConfig.volume : 100}%
                </span>
              </div>
              <input 
                type="range" min="0" max="100" 
                value={layoutConfig.volume !== undefined ? layoutConfig.volume : 100} 
                onChange={handleVolumeChange} 
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500" 
              />
            </div>
            <hr className="border-slate-100" />
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-700">โหมดเล่นคู่ 8 (Octave Mode)</h4>
                <p className="text-xs text-slate-500 mt-1">จำลองการตีเสียงคู่ขนานอัตโนมัติ (เฉพาะระนาดเอก)</p>
              </div>
              <button 
                onClick={() => setIsOctaveMode?.(!isOctaveMode)}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${isOctaveMode ? 'bg-sky-500' : 'bg-slate-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isOctaveMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
          </div>
        </section>

        {/* 2. หมวดหน้ากระดาษและตัวโน้ต (Editor) */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
              <span className="text-lg">📝</span> หน้ากระดาษและตัวโน้ต
            </h3>
          </div>
          <div className="p-5 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-700">เครื่องดนตรีปัจจุบัน</h4>
                <p className="text-xs text-slate-500 mt-1">เปลี่ยนประเภทเครื่องดนตรีสำหรับโน้ตชุดนี้</p>
              </div>
              <select 
                value={currentInstrument?.id || 'ranat-ek'}
                onChange={(e) => changeInstrument(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-sky-500 focus:border-sky-500 block w-full md:w-48 p-2.5 font-medium outline-none cursor-pointer"
              >
                <option value="ranat-ek">ระนาดเอก</option>
                <option value="khong-wong-yai">ฆ้องวงใหญ่</option>
                <option value="ranat-tum">ระนาดทุ้ม</option>
              </select>
            </div>
            <hr className="border-slate-100" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-700">ขนาดตัวอักษรโน้ตเริ่มต้น</h4>
                <p className="text-xs text-slate-500 mt-1">ปรับขนาดการแสดงผลของตัวโน้ตในตาราง</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                <button onClick={() => handleNotationSizeChange('small')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${currentSize === 'small' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>เล็ก</button>
                <button onClick={() => handleNotationSizeChange('medium')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${currentSize === 'medium' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>กลาง</button>
                <button onClick={() => handleNotationSizeChange('large')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${currentSize === 'large' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>ใหญ่</button>
              </div>
            </div>
          </div>
        </section>

        {/* 3. หมวดคีย์ลัด (Keyboard Shortcuts) */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
              <span className="text-lg">⌨️</span> คีย์ลัด (Keyboard Shortcuts)
            </h3>
          </div>
          <div className="p-5 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shortcuts.map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 gap-2 hover:bg-slate-100/50 transition-colors">
                  <span className="text-sm font-medium text-slate-600">{item.desc}</span>
                  <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-sm text-xs font-bold text-slate-700 whitespace-nowrap self-start sm:self-auto shrink-0 uppercase tracking-wide">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. หมวดการสำรองข้อมูล (Backup) */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
              <span className="text-lg">🔄</span> การสำรองข้อมูล
            </h3>
          </div>
          <div className="p-5 md:p-6 space-y-6">
            <div>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                ดาวน์โหลดโปรเจกต์ทั้งหมดที่คุณเคยสร้างไว้ในบัญชีนี้ ออกมาเป็นไฟล์ .zip เพื่อเก็บไว้สำรองในเครื่องของคุณ
              </p>
              
              <button 
                onClick={handleExportAllData}
                disabled={isExporting}
                className={`w-full md:w-auto flex items-center justify-center gap-2 py-2.5 px-6 font-bold rounded-xl transition-all active:scale-[0.98] text-sm shadow-sm ${
                  isExporting 
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                    : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังบีบอัดไฟล์...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    ดาวน์โหลดข้อมูลทั้งหมด (.zip)
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Settings;