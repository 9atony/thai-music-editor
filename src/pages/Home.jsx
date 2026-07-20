import React, { useState, useEffect, useContext, useRef } from 'react';
import { auth, db } from '../utils/firebase'; 
import { fetchRecentProjects } from '../utils/firebase'; 
import { MusicContext } from '../contexts/MusicContext';
import TmeIcon from '../assets/icon.png'; 

const Home = ({ onNewProject }) => { 
  const { newProject, loadProjectFromFirebase } = useContext(MusicContext);
  const [recentProjects, setRecentProjects] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadProjects = async () => {
      const uid = auth.currentUser?.uid;
      if (uid) {
        const data = await fetchRecentProjects(uid);
        setRecentProjects(data); 
      }
    };
    loadProjects();
  }, []);

  // ฟังก์ชันจัดรูปแบบเวลา (ดึงมาจาก MyProjects)
  const formatTime = (timestamp) => {
    if (!timestamp?.seconds) return "ไม่ระบุเวลา";
    const date = new Date(timestamp.seconds * 1000);
    // ทำแบบย่อให้เหมาะกับมือถือ
    return date.toLocaleDateString('th-TH', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // ฟังก์ชันจัดรูปแบบขนาดไฟล์ (ดึงมาจาก MyProjects)
  const formatSize = (data) => {
    if (!data) return "0 KB";
    const bytes = new Blob([typeof data === 'string' ? data : JSON.stringify(data)]).size;
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        const parsedData = {
          ...jsonData,
          sheetData: typeof jsonData.sheetData === 'string' 
                     ? JSON.parse(jsonData.sheetData) 
                     : jsonData.sheetData
        };
        loadProjectFromFirebase(parsedData); 
        onNewProject(); 
      } catch (error) {
        console.error("Error parsing project file:", error);
        alert("ไฟล์โปรเจกต์ไม่ถูกต้องหรือไม่สามารถเปิดได้ครับ");
      }
    };
    reader.readAsText(file);
    e.target.value = null; 
  };

  const handleOpenProject = (project) => {
    const parsedData = {
      ...project,
      sheetData: typeof project.sheetData === 'string' 
                 ? JSON.parse(project.sheetData) 
                 : project.sheetData
    };
    loadProjectFromFirebase(parsedData); 
    onNewProject(); 
  };

  return (
    <div 
      className="max-w-6xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-12"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      
      {/* ส่วนหัวต้อนรับ */}
      <div className="mb-6 md:mb-8 px-1">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 md:mb-2">ยินดีต้อนรับกลับมา 👋</h2>
        <p className="text-xs md:text-sm text-slate-500 font-medium">ใช้งาน Thai Music Editor อย่างสร้างสรรค์ในทุกจังหวะของคุณ</p>
      </div>

      {/* Input ซ่อนสำหรับเลือกไฟล์ */}
      <input 
        type="file" 
        accept=".json, .thai, .tme" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileUpload} 
      />

      {/* ⭐ 1. Quick Actions: บนมือถือเป็น 3 คอลัมน์เล็กๆ กล่องสี่เหลี่ยม / คอมเป็นแนวยาว */}
      <div className="grid grid-cols-3 md:grid-cols-3 gap-3 md:gap-6 mb-8 md:mb-12">
        <button 
          onClick={() => { newProject(); onNewProject(); }}
          className="bg-white border border-slate-100 md:border-slate-200 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center md:items-start gap-3 md:gap-5 hover:border-blue-400 hover:shadow-md transition-all text-center md:text-left shadow-sm md:shadow-none group"
        >
          <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center transition-colors">
            <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-[11px] md:text-lg leading-tight md:leading-normal">สร้างโปรเจกต์ใหม่</h3>
            <p className="text-sm text-slate-400 font-medium mt-0.5 hidden md:block">เริ่มต้นสร้างไฟล์เพลงใหม่</p>
          </div>
        </button>

        <button 
          onClick={() => fileInputRef.current?.click()} 
          className="bg-white border border-slate-100 md:border-slate-200 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center md:items-start gap-3 md:gap-5 hover:border-amber-400 hover:shadow-md transition-all text-center md:text-left shadow-sm md:shadow-none group"
        >
          <div className="w-12 h-12 md:w-14 md:h-14 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center transition-colors">
            <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-[11px] md:text-lg leading-tight md:leading-normal">เปิดโปรเจกต์</h3>
            <p className="text-sm text-slate-400 font-medium mt-0.5 hidden md:block">เปิดไฟล์ที่บันทึกไว้</p>
          </div>
        </button>

        <button 
          onClick={() => document.getElementById('recent-projects-section')?.scrollIntoView({ behavior: 'smooth' })}
          className="bg-white border border-slate-100 md:border-slate-200 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center md:items-start gap-3 md:gap-5 hover:border-purple-400 hover:shadow-md transition-all text-center md:text-left shadow-sm md:shadow-none group"
        >
          <div className="w-12 h-12 md:w-14 md:h-14 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center transition-colors">
            <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-[11px] md:text-lg leading-tight md:leading-normal">โปรเจกต์ล่าสุด</h3>
            <p className="text-sm text-slate-400 font-medium mt-0.5 hidden md:block">เปิดดูไฟล์ล่าสุดของคุณ</p>
          </div>
        </button>
      </div>

      {/* ส่วนโปรเจกต์ล่าสุด */}
      <div id="recent-projects-section" className="mb-12 scroll-mt-8">
        <div className="flex items-center justify-between mb-4 md:mb-5 px-1">
          <h3 className="text-base md:text-lg font-bold text-slate-800">โปรเจกต์ล่าสุด</h3>
          <button className="text-[11px] md:text-sm font-semibold text-slate-500 hover:text-sky-500 flex items-center gap-1 transition-colors">
            ดูทั้งหมด
            <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        
        {/* ⭐ 2. มุมมอง Desktop (Grid View): ซ่อนในมือถือ */}
        <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-6 gap-5">
          {recentProjects.map((project) => (
            <button 
              key={`grid-${project.id}`} 
              className="bg-white p-3.5 rounded-2xl border-2 border-slate-100 hover:border-sky-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group cursor-pointer relative text-center"
              onClick={() => handleOpenProject(project)}
            >
              <div className="w-4/5 mx-auto h-40 bg-gradient-to-b from-slate-50 to-slate-100 rounded-xl mb-4 flex items-center justify-center border-2 border-slate-200/50 group-hover:from-sky-50/50 group-hover:to-sky-100/50 transition-colors shadow-inner overflow-hidden">
                 <div className="w-20 h-20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <img src={TmeIcon} alt="File Icon" className="w-full h-full object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.15)]" />
                 </div>
              </div>
              <div className="w-full">
                <h4 className="font-bold text-slate-900 text-sm w-full truncate mb-1">
                  {project.name || "โปรเจกต์ไม่มีชื่อ"}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {project.updatedAt?.seconds ? new Date(project.updatedAt.seconds * 1000).toLocaleDateString('th-TH') : "ไม่มีข้อมูล"}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* ⭐ 3. มุมมอง Mobile (List View): แสดงเฉพาะในมือถือ */}
        <div className="flex flex-col gap-3 md:hidden">
          {recentProjects.map((project) => (
            <button 
              key={`list-${project.id}`}
              onClick={() => handleOpenProject(project)}
              className="flex items-center p-3 bg-white border border-slate-100 shadow-sm rounded-2xl active:scale-[0.98] transition-transform w-full text-left"
            >
              <div className="w-12 h-14 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200/60 shrink-0 mr-3">
                <img src={TmeIcon} alt="Icon" className="w-8 h-8 object-contain drop-shadow-sm" />
              </div>
              <div className="flex-1 overflow-hidden">
                <h4 className="font-bold text-slate-800 text-sm truncate w-[90%]">
                  {project.name || "โปรเจกต์ไม่มีชื่อ"}
                </h4>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  แก้ไขล่าสุด {formatTime(project.updatedAt)}
                </p>
              </div>
              <div className="flex flex-col items-end justify-between h-full pl-2">
                <div className="text-slate-300 p-1">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                </div>
                <span className="text-[9px] font-bold text-slate-400 mb-0.5">{formatSize(project.sheetData)}</span>
              </div>
            </button>
          ))}
          {recentProjects.length === 0 && (
             <div className="py-6 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-2xl">
               ยังไม่มีโปรเจกต์ล่าสุด
             </div>
          )}
        </div>

      </div>

      {/* แถวล่างสุด */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        <div className="lg:col-span-3 bg-white border border-slate-100 md:border-slate-200 shadow-sm md:shadow-none rounded-3xl p-6 md:p-8 flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-0.5 md:mb-1">Thai Music Editor</h3>
            <p className="text-xs md:text-sm font-semibold text-slate-400 mb-3 md:mb-4">เวอร์ชัน 1.0.0</p>
            <button className="text-xs md:text-sm font-bold text-sky-500 hover:text-sky-600 flex items-center gap-1">
              ดูรายละเอียดการอัปเดต
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="w-1/2 h-full absolute right-0 top-0 bg-gradient-to-l from-slate-50 to-transparent flex items-center justify-end pr-4 md:pr-8 pointer-events-none">
             <div className="text-5xl md:text-6xl opacity-20">🎵</div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;