import React, { useRef, useState, useEffect, useContext } from 'react';
import { auth, db } from '../utils/firebase'; 
import { fetchRecentProjects } from '../utils/firebase'; 
import { doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore'; 
import { MusicContext } from '../contexts/MusicContext';

const MyProjects = ({ onNewProject }) => {
  const { newProject, loadProjectFromFirebase } = useContext(MusicContext);
  const fileInputRef = useRef(null);
  
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState(""); 
  const [openMenuId, setOpenMenuId] = useState(null); 

  useEffect(() => {
    const loadProjects = async () => {
      const uid = auth.currentUser?.uid;
      if (uid) {
        const data = await fetchRecentProjects(uid);
        setProjects(data); 
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const formatTime = (timestamp) => {
    if (!timestamp?.seconds) return "ไม่ระบุเวลา";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('th-TH', { 
      year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatSize = (data) => {
    if (!data) return "0 KB";
    const bytes = new Blob([typeof data === 'string' ? data : JSON.stringify(data)]).size;
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const handleOpenProject = (project) => {
  const parsedData = {
    ...project,
    // ตรวจสอบว่า sheetData เป็น object หรือ string ก่อน parse
    sheetData: typeof project.sheetData === 'string' 
               ? JSON.parse(project.sheetData) 
               : project.sheetData
  };
  
  // เรียกฟังก์ชันจาก Context เพื่อโหลดข้อมูล
  loadProjectFromFirebase(parsedData); 
  
  // สลับหน้าไปที่ DesktopEditor
  onNewProject(); 
};

  const handleRenameProject = async (e, project) => {
    e.stopPropagation();
    setOpenMenuId(null); 
    
    const newName = window.prompt("กรอกชื่อโปรเจกต์ใหม่:", project.name || "โปรเจกต์ไม่มีชื่อ");
    
    if (newName !== null && newName.trim() !== "" && newName !== project.name) {
      try {
        await updateDoc(doc(db, 'projects', project.id), {
          name: newName.trim(),
          updatedAt: serverTimestamp() 
        });
        
        setProjects(prev => prev.map(p => 
          p.id === project.id ? { ...p, name: newName.trim(), updatedAt: { seconds: Date.now() / 1000 } } : p
        ));
      } catch (error) {
        console.error("Error renaming project:", error);
        alert("เกิดข้อผิดพลาดในการเปลี่ยนชื่อครับ");
      }
    }
  };

// แก้ไขใน handleDeleteProject ของไฟล์ MyProjects.jsx
const handleDeleteProject = async (e, projectId) => {
  e.stopPropagation(); 
  setOpenMenuId(null); 
  
  if (window.confirm("คุณต้องการลบโปรเจกต์นี้อย่างถาวรใช่หรือไม่?")) {
    try {
      const uid = auth.currentUser?.uid;
      
      // ⭐ แก้ Path ให้ตรงกับรูปที่คุณส่งมาเป๊ะๆ:
      // users > [UID] > projects > [ProjectID]
      const projectRef = doc(db, 'users', uid, 'projects', projectId);
      
      await deleteDoc(projectRef);
      
      // อัปเดต UI ให้หายไปทันที
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("เกิดข้อผิดพลาดในการลบไฟล์ครับ");
    }
  }
};

  const filteredProjects = projects.filter(p => 
    (p.name || "โปรเจกต์ไม่มีชื่อ").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentProjects = filteredProjects.slice(0, 5); 

  // เพิ่มฟังก์ชัน handleFileUpload ไว้ก่อน return (บรรทัดที่ประมาณ 80)
const handleFileUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const fileContent = JSON.parse(event.target.result);
      // โหลดข้อมูลเข้า Context และสลับหน้า
      loadProjectFromFirebase(fileContent);
      onNewProject(); 
    } catch (error) {
      console.error("อ่านไฟล์ไม่สำเร็จ:", error);
      alert("ไฟล์นี้ไม่สามารถใช้งานได้ครับ");
    }
  };
  reader.readAsText(file);
  e.target.value = null; // เคลียร์ค่า input
};

  return (

    <div className="max-w-7xl mx-auto w-full animate-fadeIn font-sans text-slate-800 flex flex-col min-h-full pb-12">
      
      {/* 1. ส่วน Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-1">โปรเจกต์ของฉัน</h2>
          <p className="text-sm text-slate-500 font-medium">จัดการไฟล์โปรเจกต์ของคุณ</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาโปรเจกต์" 
              className="w-full pl-9 pr-16 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all placeholder:text-slate-400"
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
              <span className="text-[10px] font-bold text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Ctrl + F</span>
            </div>
          </div>
          <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 shrink-0">
            <button className="p-1.5 bg-slate-100 text-slate-700 rounded-lg shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></button>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
          </div>
        </div>
      </div>

      <input 
  type="file" 
  accept=".json,.tme,.thai" 
  ref={fileInputRef} 
  style={{ display: 'none' }} 
  onChange={handleFileUpload} // ⭐ ต้องชี้ไปที่ฟังก์ชันที่เราเพิ่งแก้ด้านบน
/>

      {/* 2. ส่วน Quick Actions */}
      <div className="flex flex-wrap gap-4 mb-10">
        <button 
          onClick={() => { newProject(); onNewProject(); }}
          className="flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-sky-400 hover:shadow-sm transition-all text-left group"
        >
          <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-white shrink-0 group-hover:bg-sky-500 transition-colors shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">โปรเจกต์ใหม่</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">สร้างไฟล์เพลงใหม่</p>
          </div>
        </button>

        <button 
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-sky-400 hover:shadow-sm transition-all text-left group"
        >
          <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-600 shrink-0 group-hover:text-sky-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">เปิดไฟล์</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">เปิดไฟล์จากเครื่อง</p>
          </div>
        </button>
        
        <div className="flex-1 min-w-[200px] hidden md:block"></div>
        <div className="flex-1 min-w-[200px] hidden lg:block"></div>
      </div>

      {/* 3. ส่วน โปรเจกต์ล่าสุด (Recent Projects) */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">โปรเจกต์ล่าสุด</h3>
          <button className="text-xs font-semibold text-slate-500 hover:text-sky-500 flex items-center gap-1 transition-colors">
            ดูทั้งหมด
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {recentProjects.map((project) => (
            <button 
              key={`grid-${project.id}`} 
              onClick={() => handleOpenProject(project)}
              className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all flex flex-col group cursor-pointer relative text-left"
            >
              <div className="absolute top-3 right-3 z-20">
                <div 
                  onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === project.id ? null : project.id); }}
                  className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all p-1 bg-white hover:bg-slate-100 rounded-md"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                </div>
                {openMenuId === project.id && (
                  <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-100 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] py-1.5 z-50 animate-fadeIn">
                    <div onClick={(e) => handleRenameProject(e, project)} className="w-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">เปลี่ยนชื่อ</div>
                    <div onClick={(e) => handleDeleteProject(e, project.id)} className="w-full px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer">ลบ</div>
                  </div>
                )}
              </div>
              
              <div className="w-full h-28 bg-slate-50 rounded-xl mb-4 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50/50 transition-colors">
                 <div className="relative w-12 h-14 bg-white border border-slate-200 rounded shadow-sm flex items-center justify-center">
                    <div className="absolute top-0 right-0 w-4 h-4 bg-slate-100 border-l border-b border-slate-200 rounded-bl"></div>
                    <span className="text-[10px] font-black tracking-tighter">
                      <span className="text-slate-800">T</span><span className="text-slate-800">M</span><span className="text-yellow-500">Ξ</span>
                    </span>
                 </div>
              </div>
              
              <h4 className="font-bold text-slate-800 text-sm w-full truncate mb-1">{project.name || "โปรเจกต์ไม่มีชื่อ"}</h4>
              <p className="text-[11px] text-slate-400 font-medium mb-3">{formatTime(project.updatedAt)}</p>
              
              <div className="mt-auto w-full flex items-center justify-between text-[11px] font-medium text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span>{formatSize(project.sheetData)}</span>
              </div>
            </button>
          ))}
          {recentProjects.length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-400 text-sm font-medium border-2 border-dashed border-slate-200 rounded-2xl">
              {searchQuery ? "ไม่พบโปรเจกต์ที่ค้นหา" : "ยังไม่มีโปรเจกต์ล่าสุด"}
            </div>
          )}
        </div>
      </div>

      {/* 4. ส่วน ไฟล์ทั้งหมด (All Files) */}
      <div className="flex-1 flex flex-col min-h-[300px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">ไฟล์ทั้งหมด</h3>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              ทั้งหมด
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
              ล่าสุด
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex-1 mb-6">
          {/* ⭐ เพิ่ม overflow-y-auto เพื่อให้ตารางนี้รองรับการ scroll แยกส่วนได้ด้วย */}
          <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
            <table className="w-full text-left border-collapse relative">
              {/* ⭐ เปลี่ยนเป็น sticky top-0 ให้หัวตารางติดขอบเวลาเลื่อนลง */}
              <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur shadow-sm">
                <tr className="border-b border-slate-100">
                  <th className="py-3 px-5 text-xs font-bold text-slate-400 w-2/5">ชื่อ <svg className="inline w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg></th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-400 hidden sm:table-cell">ประเภท</th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-400">แก้ไขล่าสุด</th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-400 text-right">ขนาด</th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-400 w-10 bg-slate-50/95"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((file) => (
                  <tr 
                    key={`list-${file.id}`} 
                    onClick={() => handleOpenProject(file)}
                    className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group cursor-pointer relative"
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-8 bg-white border border-slate-200 rounded shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-center shrink-0">
                          <span className="text-[7px] font-black tracking-tighter">
                            <span className="text-slate-800">T</span><span className="text-slate-800">M</span><span className="text-yellow-500">Ξ</span>
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-700 truncate">{file.name || "โปรเจกต์ไม่มีชื่อ"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-xs font-medium text-slate-500 hidden sm:table-cell">Thai Music Editor</td>
                    <td className="py-3 px-5 text-xs font-medium text-slate-500 whitespace-nowrap">{formatTime(file.updatedAt)}</td>
                    <td className="py-3 px-5 text-xs font-medium text-slate-500 text-right whitespace-nowrap">{formatSize(file.sheetData)}</td>
                    <td className="py-3 px-5 text-right relative">
                      
                      <div className="relative inline-block z-10">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === `list-${file.id}` ? null : `list-${file.id}`); }}
                          className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all p-1 bg-white hover:bg-slate-100 rounded-md"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                        </button>
                        {openMenuId === `list-${file.id}` && (
                          <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-slate-100 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] py-1.5 z-50 animate-fadeIn">
                            <div onClick={(e) => handleRenameProject(e, file)} className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">เปลี่ยนชื่อ</div>
                            <div onClick={(e) => handleDeleteProject(e, file.id)} className="w-full text-left px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer">ลบ</div>
                          </div>
                        )}
                      </div>

                    </td>
                  </tr>
                ))}
                {filteredProjects.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400 text-sm font-medium">
                      {searchQuery ? "ไม่พบโปรเจกต์ที่ค้นหา" : "ไม่มีข้อมูลไฟล์ในระบบ"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. ส่วน Storage Status */}
      <div className="mt-auto flex flex-col md:flex-row items-center justify-between text-xs font-semibold text-slate-400 bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-sm shrink-0">
        <div className="flex items-center gap-4 mb-2 md:mb-0 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-1.5">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
             <span>ทั้งหมด {projects.length} ไฟล์</span>
          </div>
          <span>ใช้ไป 0.0 GB จาก 10 GB</span>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-full md:w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: '0%' }}></div>
          </div>
          <span className="whitespace-nowrap">เหลือ 10.0 GB</span>
        </div>
      </div>

    </div>
  );
};

export default MyProjects;