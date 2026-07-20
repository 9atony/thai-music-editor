import React, { useRef, useState, useEffect, useContext } from 'react';
import { auth, db } from '../utils/firebase'; 
import { fetchRecentProjects } from '../utils/firebase'; 
import { doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore'; 
import { MusicContext } from '../contexts/MusicContext';
import TmeIcon from '../assets/icon.png';

const MyProjects = ({ onNewProject }) => {
  const { newProject, loadProjectFromFirebase } = useContext(MusicContext);
  const fileInputRef = useRef(null);
  
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState(""); 
  const [openMenuId, setOpenMenuId] = useState(null); 

  // ⭐ 1. State สำหรับระบบจัดเรียง
  const [sortOrder, setSortOrder] = useState('latest'); // 'latest', 'oldest', 'nameAsc', 'nameDesc'
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // ⭐ 2. State สำหรับป๊อปอัปเปลี่ยนชื่อ
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");

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

  // ปิดเมนูทั้งหมดเมื่อคลิกพื้นที่อื่น
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
      setIsSortMenuOpen(false);
    };
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

  const formatTimeMobile = (timestamp) => {
    if (!timestamp?.seconds) return "ไม่ระบุเวลา";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('th-TH', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
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
      sheetData: typeof project.sheetData === 'string' 
                 ? JSON.parse(project.sheetData) 
                 : project.sheetData
    };
    loadProjectFromFirebase(parsedData); 
    onNewProject(); 
  };

  // ⭐ เปลี่ยนฟังก์ชัน Rename ให้มาเปิด Modal แทน
  const openRenameModal = (e, project) => {
    e.stopPropagation();
    setOpenMenuId(null); 
    setProjectToRename(project);
    setNewProjectName(project.name || "โปรเจกต์ไม่มีชื่อ");
    setRenameModalOpen(true);
  };

  // ⭐ ฟังก์ชันบันทึกชื่อใหม่เมื่อกดตกลงใน Modal
  const confirmRename = async () => {
    if (!newProjectName.trim() || newProjectName === projectToRename.name) {
      setRenameModalOpen(false);
      return;
    }
    
    try {
      // 1. ดึง uid ออกมาใช้งาน
      const uid = auth.currentUser?.uid;
      
      // 2. แก้ไข path ให้เป็น users/{uid}/projects/{projectId} 
      // เพื่อให้ตรงกับโครงสร้างฐานข้อมูลครับ
      await updateDoc(doc(db, 'users', uid, 'projects', projectToRename.id), {
        name: newProjectName.trim(),
        updatedAt: serverTimestamp() 
      });
      
      setProjects(prev => prev.map(p => 
        p.id === projectToRename.id ? { ...p, name: newProjectName.trim(), updatedAt: { seconds: Date.now() / 1000 } } : p
      ));
      setRenameModalOpen(false);
    } catch (error) {
      console.error("Error renaming project:", error);
      alert("เกิดข้อผิดพลาดในการเปลี่ยนชื่อครับ");
    }
  };
  
  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation(); 
    setOpenMenuId(null); 
    
    if (window.confirm("คุณต้องการลบโปรเจกต์นี้อย่างถาวรใช่หรือไม่?")) {
      try {
        const uid = auth.currentUser?.uid;
        const projectRef = doc(db, 'users', uid, 'projects', projectId);
        
        await deleteDoc(projectRef);
        setProjects(prev => prev.filter(p => p.id !== projectId));
        
      } catch (error) {
        console.error("Error deleting project:", error);
        alert("เกิดข้อผิดพลาดในการลบไฟล์ครับ");
      }
    }
  };

  // ⭐ การจัดเรียง (Sorting) สำหรับ "ไฟล์ทั้งหมด"
  let displayedProjects = projects.filter(p => 
    (p.name || "โปรเจกต์ไม่มีชื่อ").toLowerCase().includes(searchQuery.toLowerCase())
  );

  displayedProjects.sort((a, b) => {
    if (sortOrder === 'latest') {
      return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
    } else if (sortOrder === 'oldest') {
      return (a.updatedAt?.seconds || 0) - (b.updatedAt?.seconds || 0);
    } else if (sortOrder === 'nameAsc') {
      return (a.name || "").localeCompare(b.name || "", 'th');
    } else if (sortOrder === 'nameDesc') {
      return (b.name || "").localeCompare(a.name || "", 'th');
    }
    return 0;
  });

  // ส่วนโปรเจกต์ล่าสุด (บังคับเรียงตามเวลาเสมอ)
  const recentProjects = [...projects]
    .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
    .slice(0, 5); 

  // เลเบลของปุ่มจัดเรียง
  const getSortLabel = () => {
    switch(sortOrder) {
      case 'latest': return 'ล่าสุด';
      case 'oldest': return 'เก่าสุด';
      case 'nameAsc': return 'ชื่อ ก - ฮ';
      case 'nameDesc': return 'ชื่อ ฮ - ก';
      default: return 'ล่าสุด';
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const fileContent = JSON.parse(event.target.result);
        loadProjectFromFirebase(fileContent);
        onNewProject(); 
      } catch (error) {
        console.error("อ่านไฟล์ไม่สำเร็จ:", error);
        alert("ไฟล์นี้ไม่สามารถใช้งานได้ครับ");
      }
    };
    reader.readAsText(file);
    e.target.value = null; 
  };

  return (
    <div 
      className="max-w-7xl mx-auto w-full animate-fadeIn text-slate-800 flex flex-col min-h-full pt-4 md:pt-10 px-5 md:px-8 pb-12"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      {/* 1. ส่วน Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
        <div className="hidden md:block">
          <h2 className="text-2xl font-extrabold text-slate-900 mb-1">โปรเจกต์ของฉัน</h2>
          <p className="text-sm text-slate-500 font-medium">จัดการไฟล์โปรเจกต์ของคุณ</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาโปรเจกต์" 
              className="w-full pl-9 pr-16 py-2.5 md:py-2 bg-white border border-slate-200 shadow-sm md:shadow-none rounded-xl text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <input type="file" accept=".json,.tme,.thai" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />

      {/* 2. ส่วน Quick Actions */}
      <div className="grid grid-cols-3 gap-3 mb-8 md:hidden">
        <button onClick={() => { newProject(); onNewProject(); }} className="bg-white rounded-2xl p-3 flex flex-col items-center justify-center gap-2 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] active:scale-95 transition-all">
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg></div>
          <span className="text-[10px] font-bold text-slate-700">โปรเจกต์ใหม่</span>
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="bg-white rounded-2xl p-3 flex flex-col items-center justify-center gap-2 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] active:scale-95 transition-all">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg></div>
          <span className="text-[10px] font-bold text-slate-700">เปิดไฟล์</span>
        </button>
        <button className="bg-white rounded-2xl p-3 flex flex-col items-center justify-center gap-2 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] active:scale-95 transition-all">
          <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <span className="text-[10px] font-bold text-slate-700">ล่าสุด</span>
        </button>
      </div>

      <div className="hidden md:flex flex-wrap gap-4 mb-10">
        <button onClick={() => { newProject(); onNewProject(); }} className="flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-sky-400 hover:shadow-sm transition-all text-left group">
          <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-white shrink-0 group-hover:bg-sky-500 transition-colors shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg></div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">โปรเจกต์ใหม่</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">สร้างไฟล์เพลงใหม่</p>
          </div>
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-sky-400 hover:shadow-sm transition-all text-left group">
          <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-600 shrink-0 group-hover:text-sky-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg></div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">เปิดไฟล์</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">เปิดไฟล์จากเครื่อง</p>
          </div>
        </button>
        <div className="flex-1 min-w-[200px] hidden md:block"></div>
      </div>

      {/* 3. ส่วน โปรเจกต์ล่าสุด */}
      <div className="mb-8 md:mb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">โปรเจกต์ล่าสุด</h3>
        </div>
        
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          {recentProjects.map((project) => (
            <button key={`grid-${project.id}`} onClick={() => handleOpenProject(project)} className="bg-white p-3.5 rounded-2xl border-2 border-slate-100 hover:border-sky-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group cursor-pointer relative text-left">
              <div className="absolute top-3 right-3 z-20">
                <div onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === project.id ? null : project.id); }} className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all p-1 bg-white hover:bg-slate-100 rounded-md">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                </div>
                {openMenuId === project.id && (
                  <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-100 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] py-1.5 z-50 animate-fadeIn">
                    <div onClick={(e) => openRenameModal(e, project)} className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">เปลี่ยนชื่อ</div>
                    <div onClick={(e) => handleDeleteProject(e, project.id)} className="w-full text-left px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer">ลบ</div>
                  </div>
                )}
              </div>
              <div className="w-4/5 mx-auto h-40 bg-gradient-to-b from-slate-50 to-slate-100 rounded-xl mb-4 flex items-center justify-center border-2 border-slate-200/50 group-hover:from-sky-50/50 group-hover:to-sky-100/50 transition-colors shadow-inner overflow-hidden">
                 <div className="w-20 h-20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <img src={TmeIcon} alt="File Icon" className="w-full h-full object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.15)]" />
                 </div>
              </div>
              <h4 className="font-bold text-slate-900 text-sm w-full truncate mb-1">{project.name || "โปรเจกต์ไม่มีชื่อ"}</h4>
              <p className="text-[11px] text-slate-500 font-medium mb-3">{formatTime(project.updatedAt)}</p>
            </button>
          ))}
        </div>

        <div className="flex md:hidden overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar -mx-5 px-5">
          {recentProjects.map((project) => (
            <div key={`hscroll-${project.id}`} className="snap-start shrink-0 w-[140px] bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col relative text-left" onClick={() => handleOpenProject(project)}>
              <div className="absolute top-2 right-2 z-20">
                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === `h-${project.id}` ? null : `h-${project.id}`); }} className="text-slate-300 p-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                </button>
                {openMenuId === `h-${project.id}` && (
                  <div className="absolute right-0 mt-1 w-28 bg-white border border-slate-100 rounded-xl shadow-lg py-1.5 z-50">
                    <div onClick={(e) => openRenameModal(e, project)} className="px-3 py-2 text-[11px] font-semibold text-slate-600">เปลี่ยนชื่อ</div>
                    <div onClick={(e) => handleDeleteProject(e, project.id)} className="px-3 py-2 text-[11px] font-semibold text-red-500">ลบ</div>
                  </div>
                )}
              </div>
              <div className="w-full h-24 bg-slate-50 rounded-xl mb-3 flex items-center justify-center border border-slate-100">
                <img src={TmeIcon} alt="File Icon" className="w-12 h-12 object-contain" />
              </div>
              <h4 className="font-bold text-slate-800 text-[11px] truncate w-[85%]">{project.name || "โปรเจกต์ไม่มีชื่อ"}</h4>
              <p className="text-[9px] text-slate-400 font-medium mt-0.5">{formatTimeMobile(project.updatedAt)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. ส่วน ไฟล์ทั้งหมด (All Files) */}
      <div className="flex-1 flex flex-col min-h-[250px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">ไฟล์ทั้งหมด</h3>
          
          {/* ⭐ เมนูจัดเรียง (Sorting Menu) */}
          <div className="relative z-30">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsSortMenuOpen(!isSortMenuOpen); setOpenMenuId(null); }}
              className="flex items-center justify-between w-auto min-w-[90px] gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 shadow-sm hover:border-slate-300 transition-colors"
            >
              {getSortLabel()}
              <svg className={`w-3 h-3 text-slate-400 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
            </button>
            
            {isSortMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-36 bg-white border border-slate-100 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] py-1.5 z-50 animate-fadeIn">
                <div onClick={() => { setSortOrder('latest'); setIsSortMenuOpen(false); }} className={`px-4 py-2 text-xs font-medium cursor-pointer transition-colors ${sortOrder === 'latest' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>ล่าสุด</div>
                <div onClick={() => { setSortOrder('oldest'); setIsSortMenuOpen(false); }} className={`px-4 py-2 text-xs font-medium cursor-pointer transition-colors ${sortOrder === 'oldest' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>เก่าสุด</div>
                <div className="h-px bg-slate-100 my-1"></div>
                <div onClick={() => { setSortOrder('nameAsc'); setIsSortMenuOpen(false); }} className={`px-4 py-2 text-xs font-medium cursor-pointer transition-colors ${sortOrder === 'nameAsc' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>ชื่อ ก - ฮ</div>
                <div onClick={() => { setSortOrder('nameDesc'); setIsSortMenuOpen(false); }} className={`px-4 py-2 text-xs font-medium cursor-pointer transition-colors ${sortOrder === 'nameDesc' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>ชื่อ ฮ - ก</div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden flex-1 mb-6">
          <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
            <table className="w-full text-left border-collapse relative">
              <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur shadow-sm">
                <tr className="border-b border-slate-100">
                  <th className="py-3 px-5 text-xs font-bold text-slate-400 w-2/5">ชื่อ</th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-400 hidden sm:table-cell">ประเภท</th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-400">แก้ไขล่าสุด</th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-400 w-10 bg-slate-50/95"></th>
                </tr>
              </thead>
              <tbody>
                {displayedProjects.map((file) => (
                  <tr key={`list-${file.id}`} onClick={() => handleOpenProject(file)} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group cursor-pointer relative">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center shrink-0">
                          <img src={TmeIcon} alt="File Icon" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-sm font-bold text-slate-700 truncate">{file.name || "โปรเจกต์ไม่มีชื่อ"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-xs font-medium text-slate-500 hidden sm:table-cell">Thai Music Editor</td>
                    <td className="py-3 px-5 text-xs font-medium text-slate-500 whitespace-nowrap">{formatTime(file.updatedAt)}</td>
                    <td className="py-3 px-5 text-right relative">
                      <div className="relative inline-block z-10">
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === `list-${file.id}` ? null : `list-${file.id}`); }} className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all p-1 bg-white hover:bg-slate-100 rounded-md">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                        </button>
                        {openMenuId === `list-${file.id}` && (
                          <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-slate-100 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] py-1.5 z-50 animate-fadeIn">
                            <div onClick={(e) => openRenameModal(e, file)} className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">เปลี่ยนชื่อ</div>
                            <div onClick={(e) => handleDeleteProject(e, file.id)} className="w-full text-left px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer">ลบ</div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile View: List Vertical */}
        <div className="flex flex-col gap-3 md:hidden mb-6">
          {displayedProjects.map((file) => (
            <div key={`mlist-${file.id}`} onClick={() => handleOpenProject(file)} className="flex items-center p-3 bg-white border border-slate-100 shadow-sm rounded-2xl active:scale-[0.98] transition-transform w-full text-left relative">
              <div className="w-12 h-14 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200/60 shrink-0 mr-3">
                <img src={TmeIcon} alt="Icon" className="w-8 h-8 object-contain drop-shadow-sm" />
              </div>
              <div className="flex-1 overflow-hidden">
                <h4 className="font-bold text-slate-800 text-sm truncate pr-4">
                  {file.name || "โปรเจกต์ไม่มีชื่อ"}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] text-slate-400 font-medium">{formatTimeMobile(file.updatedAt)}</p>
                  <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold">{formatSize(file.sheetData)}</span>
                </div>
              </div>
              <div className="relative pl-2 h-full flex items-center">
                 <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === `mlist-${file.id}` ? null : `mlist-${file.id}`); }} className="text-slate-300 p-2 -mr-2">
                   <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                 </button>
                 {openMenuId === `mlist-${file.id}` && (
                    <div className="absolute right-0 top-10 mt-1 w-28 bg-white border border-slate-100 rounded-xl shadow-lg py-1.5 z-50">
                      <div onClick={(e) => openRenameModal(e, file)} className="px-3 py-2 text-[11px] font-semibold text-slate-600">เปลี่ยนชื่อ</div>
                      <div onClick={(e) => handleDeleteProject(e, file.id)} className="px-3 py-2 text-[11px] font-semibold text-red-500">ลบ</div>
                    </div>
                 )}
              </div>
            </div>
          ))}
          {displayedProjects.length === 0 && (
            <div className="py-6 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-2xl">ไม่พบโปรเจกต์ที่ค้นหา</div>
          )}
        </div>
      </div>

      {/* 5. ส่วน Storage Status */}
      <div className="mt-auto flex flex-col items-center justify-between text-[10px] md:text-xs font-semibold text-slate-400 bg-white border border-slate-100 md:border-slate-200 rounded-xl px-4 md:px-5 py-3 shadow-sm shrink-0">
        <div className="flex items-center justify-between w-full mb-2">
          <div className="flex items-center gap-1.5">
             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
             <span>ทั้งหมด {projects.length} ไฟล์</span>
          </div>
          <span>ใช้ไป 1.28 GB จาก 10 GB</span>
        </div>
        
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: '12.8%' }}></div>
          </div>
          <span className="whitespace-nowrap text-sky-500">เหลือ 8.72 GB</span>
        </div>
      </div>

      {/* ⭐ 6. ป๊อปอัปเปลี่ยนชื่อ (Custom Rename Modal) */}
      {renameModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
           <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-slideUp">
             <h3 className="text-lg font-bold text-slate-800 mb-1">เปลี่ยนชื่อโปรเจกต์</h3>
             <p className="text-xs text-slate-500 mb-4">ตั้งชื่อที่สื่อความหมายเพื่อให้ค้นหาง่ายขึ้น</p>
             
             <input 
               type="text" 
               value={newProjectName}
               onChange={(e) => setNewProjectName(e.target.value)}
               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all text-slate-700 font-medium mb-6"
               autoFocus
               onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
             />
             
             <div className="flex gap-3">
               <button 
                 onClick={() => setRenameModalOpen(false)} 
                 className="flex-1 py-3 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
               >
                 ยกเลิก
               </button>
               <button 
                 onClick={confirmRename} 
                 className="flex-1 py-3 font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-xl transition-colors shadow-sm shadow-sky-500/30"
               >
                 บันทึก
               </button>
             </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default MyProjects;