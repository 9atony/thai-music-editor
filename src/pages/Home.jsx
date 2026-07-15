import React, { useState, useEffect, useContext, useRef } from 'react';
import { auth, db } from '../utils/firebase'; 
import { fetchRecentProjects } from '../utils/firebase'; 
import { MusicContext } from '../contexts/MusicContext';
import TmeIcon from '../assets/icon.png'; 


const Home = ({ onNewProject }) => { 
  const { newProject, loadProjectFromFirebase } = useContext(MusicContext);
  
  const [recentProjects, setRecentProjects] = useState([]);
  
  // ⭐ สร้าง Ref สำหรับเรียกหน้าต่างเลือกไฟล์
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

  // ⭐ ฟังก์ชันสำหรับอ่านไฟล์เมื่อผู้ใช้กดเลือกไฟล์จากในเครื่อง
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        
        // แปลงข้อมูล sheetData เพื่อเตรียมส่งเข้า Editor
        const parsedData = {
          ...jsonData,
          sheetData: typeof jsonData.sheetData === 'string' 
                     ? JSON.parse(jsonData.sheetData) 
                     : jsonData.sheetData
        };
        
        loadProjectFromFirebase(parsedData); // ส่งข้อมูลเข้า Context
        onNewProject(); // สลับหน้าไปที่ DesktopEditor
      } catch (error) {
        console.error("Error parsing project file:", error);
        alert("ไฟล์โปรเจกต์ไม่ถูกต้องหรือไม่สามารถเปิดได้ครับ");
      }
    };
    reader.readAsText(file);
    
    // เคลียร์ค่า input เพื่อให้สามารถกดเลือกไฟล์เดิมซ้ำได้ในอนาคต
    e.target.value = null; 
  };

  return (
    <div className="max-w-6xl mx-auto w-full animate-fadeIn font-sans text-slate-800 pb-12">
      
      {/* ส่วนหัวต้อนรับ */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">ยินดีต้อนรับกลับมา</h2>
        <p className="text-slate-500 font-medium">ใช้งาน Thai Music Editor อย่างสร้างสรรค์ในทุกจังหวะของคุณ</p>
      </div>

      {/* ⭐ Input ซ่อนสำหรับเลือกไฟล์ */}
      <input 
        type="file" 
        accept=".json, .thai, .tme" // กำหนดให้เลือกได้เฉพาะไฟล์ json
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileUpload} 
      />

      {/* 3 ปุ่มการกระทำหลัก */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* กล่องสร้างโปรเจกต์ใหม่ */}
        <button 
          onClick={() => {
            newProject();    
            onNewProject();  
          }}
          className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-5 hover:border-sky-400 hover:shadow-[0_4px_20px_rgba(14,165,233,0.1)] transition-all text-left group"
        >
          <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-500 transition-colors">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">สร้างโปรเจกต์ใหม่</h3>
            <p className="text-sm text-slate-400 font-medium mt-0.5">เริ่มต้นสร้างไฟล์เพลงใหม่</p>
          </div>
        </button>

        {/* ⭐ กล่องเปิดโปรเจกต์ (สั่งคลิกที่ Input ซ่อน) */}
        <button 
          onClick={() => fileInputRef.current?.click()} 
          className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-5 hover:border-sky-400 hover:shadow-[0_4px_20px_rgba(14,165,233,0.1)] transition-all text-left group"
        >
          <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-500 transition-colors">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">เปิดโปรเจกต์</h3>
            <p className="text-sm text-slate-400 font-medium mt-0.5">เปิดไฟล์ที่บันทึกไว้</p>
          </div>
        </button>

        {/* ⭐ กล่องโปรเจกต์ล่าสุด (สั่งเลื่อนจอไปยังไอดี recent-projects-section) */}
        <button 
          onClick={() => document.getElementById('recent-projects-section')?.scrollIntoView({ behavior: 'smooth' })}
          className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-5 hover:border-sky-400 hover:shadow-[0_4px_20px_rgba(14,165,233,0.1)] transition-all text-left group"
        >
          <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-500 transition-colors">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">โปรเจกต์ล่าสุด</h3>
            <p className="text-sm text-slate-400 font-medium mt-0.5">เปิดดูไฟล์ล่าสุดของคุณ</p>
          </div>
        </button>
      </div>

      {/* ⭐ เพิ่มไอดี recent-projects-section ให้ส่วนนี้เพื่อให้ปุ่มด้านบนเลื่อนลงมาหาได้ */}
      <div id="recent-projects-section" className="mb-12 scroll-mt-8">
        <div className="flex items-center justify-between mb-5 px-1">
          <h3 className="text-lg font-bold text-slate-800">โปรเจกต์ล่าสุด</h3>
          <button className="text-sm font-semibold text-slate-500 hover:text-sky-500 flex items-center gap-1 transition-colors">
            ดูทั้งหมด
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {recentProjects.map((project) => (
            <button 
              key={project.id} 
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-2"
              onClick={() => {
                const parsedData = {
                  ...project,
                  sheetData: typeof project.sheetData === 'string' 
                             ? JSON.parse(project.sheetData) 
                             : project.sheetData
                };
                
                loadProjectFromFirebase(parsedData); 
                onNewProject(); 
              }}
            >
              <div className="w-12 h-12 flex items-center justify-center">
                <img src={TmeIcon} alt="File Icon" className="w-full h-full object-contain" />
              </div>
              
              <div className="w-full">
                <h4 className="font-bold text-slate-700 text-sm truncate">
                  {project.name || "โปรเจกต์ไม่มีชื่อ"}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  แก้ไขล่าสุด: {project.updatedAt?.seconds 
                    ? new Date(project.updatedAt.seconds * 1000).toLocaleDateString('th-TH') 
                    : "ไม่มีข้อมูลเวลา"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* แถวล่างสุด */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-8 flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold text-slate-800 mb-1">Thai Music Editor</h3>
            <p className="text-sm font-semibold text-slate-400 mb-4">เวอร์ชัน 1.0.0</p>
            <button className="text-sm font-bold text-sky-500 hover:text-sky-600 flex items-center gap-1">
              ดูรายละเอียดการอัปเดต
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="w-1/2 h-full absolute right-0 top-0 bg-gradient-to-l from-slate-50 to-transparent flex items-center justify-end pr-8 pointer-events-none">
             <div className="text-6xl opacity-20">🎵</div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-50/50 border border-slate-200 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">เริ่มต้นใช้งาน</h3>
            <button className="text-xs font-bold text-sky-500 hover:underline">ดูทั้งหมด</button>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { label: 'แนะนำการใช้งานเบื้องต้น', icon: '▶️' },
              { label: 'พื้นฐานการเขียนโน้ตเพลงไทย', icon: '📖' },
              { label: 'เครื่องดนตรีและสัญลักษณ์', icon: '🎺' },
              { label: 'คำถามที่พบบ่อย', icon: '❔' }
            ].map((item, i) => (
              <button key={i} className="flex items-center justify-between w-full p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all group">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm grayscale group-hover:grayscale-0 transition-all">{item.icon}</span>
                  <span className="font-semibold text-sm text-slate-600 group-hover:text-slate-800">{item.label}</span>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </button>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

export default Home;