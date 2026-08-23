import React, { useState, useEffect } from 'react';
import { db, upgradeUserToPremium } from '../utils/firebase'; 
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
};

const formatDate = (timestamp) => {
  if (!timestamp || !timestamp.seconds) return "ไม่ระบุ";
  const date = new Date(timestamp.seconds * 1000);
  return date.toLocaleDateString('th-TH', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// ⭐ ฟังก์ชันคำนวณเวลานับถอยหลัง (วัน/ชั่วโมง/นาที)
const calculateTimeLeft = (premiumUntil, currentTime) => {
  if (!premiumUntil) return null;
  const expirationDate = premiumUntil.toDate();
  const diffTime = expirationDate.getTime() - currentTime.getTime();

  if (diffTime <= 0) return { expired: true };

  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffTime / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diffTime / 1000 / 60) % 60);

  return { expired: false, days, hours, minutes };
};

const AdminDashboard = ({ userProfile }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [totalSystemBytes, setTotalSystemBytes] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState('latest'); 
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); 

  const [selectedUser, setSelectedUser] = useState(null);
  const [userProjects, setUserProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // ⭐ State สำหรับเก็บเวลาปัจจุบัน เพื่อทำ Live Countdown
  const [now, setNow] = useState(new Date());

  const isAdmin = userProfile?.role === 'admin';
  const SYSTEM_MAX_BYTES = 1024 * 1024 * 1024; 

  // ⭐ อัปเดตเวลาปัจจุบันทุกๆ 1 นาทีเพื่อให้นับถอยหลังแบบเรียลไทม์
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); 
    return () => clearInterval(timer);
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      let globalBytes = 0;

      const usersPromises = querySnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        const userId = userDoc.id;

        const projectsRef = collection(db, `users/${userId}/projects`);
        const projectsSnap = await getDocs(projectsRef);

        let userBytes = 0;
        projectsSnap.forEach(p => { userBytes += new Blob([JSON.stringify(p.data())]).size; });

        globalBytes += userBytes;

        return { id: userId, ...userData, storageUsed: userBytes, projectCount: projectsSnap.size };
      });

      const usersList = await Promise.all(usersPromises);
      setUsers(usersList);
      setTotalSystemBytes(globalBytes); 

    } catch (error) {
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) fetchUsers(); }, [isAdmin]);

  useEffect(() => {
    const handleClickOutside = () => setIsSortMenuOpen(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนยศผู้ใช้นี้เป็น ${newRole}?`)) return;

    setIsUpdating(true);
    try {
      if (newRole === 'premium') {
        await upgradeUserToPremium(userId, 1);
        fetchUsers(); 
      } else {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, { role: newRole });
        setUsers(users.map(user => user.id === userId ? { ...user, role: newRole } : user));
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเปลี่ยนยศ");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExtendPremium = async (userId) => {
    if (!window.confirm(`ยืนยันการต่ออายุ Premium เพิ่ม 1 เดือน?`)) return;
    setIsUpdating(true);
    try {
      await upgradeUserToPremium(userId, 1);
      fetchUsers(); 
    } catch(e) {
      alert("เกิดข้อผิดพลาดในการต่ออายุ");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenUserModal = async (user) => {
    setSelectedUser(user);
    setIsLoadingProjects(true);
    try {
      const projectsRef = collection(db, `users/${user.id}/projects`);
      const querySnapshot = await getDocs(projectsRef);
      const list = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setUserProjects(list);
    } catch (error) {
      console.error("ดึงโปรเจกต์ไม่สำเร็จ:", error);
      alert("ไม่สามารถดึงข้อมูลโปรเจกต์ของผู้ใช้คนนี้ได้");
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleDownloadProject = (project) => {
    try {
      let sheetDataParsed = project.sheetData;
      if (typeof project.sheetData === 'string') {
        try { sheetDataParsed = JSON.parse(project.sheetData); } catch(e) {}
      }

      const projectData = {
        ...project,
        sheetData: sheetDataParsed
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${project.name || 'project'}.tme`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (error) {
      console.error("ดาวน์โหลดไม่สำเร็จ:", error);
      alert("เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์");
    }
  };

  let displayedUsers = users.filter(user => {
    const role = user.role || 'user';
    const matchesTab = activeTab === 'all' || role === activeTab;

    const searchLower = searchQuery.toLowerCase();
    const name = (user.displayName || "").toLowerCase();
    const email = (user.email || "").toLowerCase();
    const id = (user.id || "").toLowerCase();
    return matchesTab && (name.includes(searchLower) || email.includes(searchLower) || id.includes(searchLower));
  });

  displayedUsers.sort((a, b) => {
    if (sortOrder === 'latest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    if (sortOrder === 'oldest') return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    if (sortOrder === 'sizeDesc') return b.storageUsed - a.storageUsed; 
    if (sortOrder === 'sizeAsc') return a.storageUsed - b.storageUsed;  
    if (sortOrder === 'nameAsc') {
      const nameA = a.displayName || a.email?.split('@')[0] || "";
      const nameB = b.displayName || b.email?.split('@')[0] || "";
      return nameA.localeCompare(nameB, 'th');
    }
    if (sortOrder === 'nameDesc') {
      const nameA = a.displayName || a.email?.split('@')[0] || "";
      const nameB = b.displayName || b.email?.split('@')[0] || "";
      return nameB.localeCompare(nameA, 'th');
    }
    return 0;
  });

  const getSortLabel = () => {
    switch(sortOrder) {
      case 'latest': return 'สมัครล่าสุด';
      case 'oldest': return 'สมัครเก่าสุด';
      case 'sizeDesc': return 'พื้นที่มากสุด';
      case 'sizeAsc': return 'พื้นที่น้อยสุด';
      case 'nameAsc': return 'ชื่อ ก - ฮ (A-Z)';
      case 'nameDesc': return 'ชื่อ ฮ - ก (Z-A)';
      default: return 'สมัครล่าสุด';
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <div className="text-6xl mb-4">⛔</div><h3 className="text-xl font-bold text-slate-800">ไม่มีสิทธิ์เข้าถึง</h3><p>หน้านี้สงวนไว้สำหรับผู้ดูแลระบบเท่านั้น</p>
      </div>
    );
  }

  const countAll = users.length;
  const countUser = users.filter(u => (u.role || 'user') === 'user').length;
  const countPremium = users.filter(u => u.role === 'premium').length;
  const countAdmin = users.filter(u => u.role === 'admin').length;

  return (
    <div className="max-w-6xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-12" style={{ fontFamily: 'Prompt, sans-serif' }}>
      <div className="mb-6 md:mb-8 px-1">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 md:mb-2">จัดการผู้ใช้งาน 🛡️</h2>
        <p className="text-xs md:text-sm text-slate-500 font-medium">ดูรายชื่อผู้ใช้งานทั้งหมด และกำหนดสิทธิ์การเข้าถึง (User, Premium, Admin)</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm mb-6 flex flex-col md:flex-row items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
        </div>
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between mb-2">
            <div><h3 className="text-lg font-bold text-slate-800">พื้นที่จัดเก็บรวมของระบบ (Firebase)</h3><p className="text-xs text-slate-500">รวมข้อมูลจากผู้ใช้ทั้งหมด {users.length} บัญชี</p></div>
            <div className="text-right"><span className="text-lg font-black text-blue-600">{formatBytes(totalSystemBytes)}</span><span className="text-xs text-slate-400 block">จาก 1 GB (โควตาฟรี)</span></div>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${(totalSystemBytes / SYSTEM_MAX_BYTES) > 0.9 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.max((totalSystemBytes / SYSTEM_MAX_BYTES) * 100, 0.5)}%` }}></div>
          </div>
        </div>
      </div>

      <div className="flex space-x-1.5 bg-slate-100/70 p-1.5 rounded-2xl mb-5 overflow-x-auto hide-scrollbar border border-slate-200/50">
        <button onClick={() => setActiveTab('all')} className={`flex-1 min-w-[100px] py-2.5 px-4 text-[13px] font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'all' ? 'bg-white text-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>ทั้งหมด ({countAll})</button>
        <button onClick={() => setActiveTab('user')} className={`flex-1 min-w-[100px] py-2.5 px-4 text-[13px] font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'user' ? 'bg-white text-sky-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>ผู้ใช้งานทั่วไป ({countUser})</button>
        <button onClick={() => setActiveTab('premium')} className={`flex-1 min-w-[100px] py-2.5 px-4 text-[13px] font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'premium' ? 'bg-white text-amber-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>พรีเมียม ({countPremium})</button>
        <button onClick={() => setActiveTab('admin')} className={`flex-1 min-w-[100px] py-2.5 px-4 text-[13px] font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'admin' ? 'bg-white text-violet-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>แอดมิน ({countAdmin})</button>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4 w-full">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ค้นหาชื่อ, อีเมล, หรือ ID..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all placeholder:text-slate-400" />
        </div>

        <div className="relative z-30 w-full md:w-auto">
          <button onClick={(e) => { e.stopPropagation(); setIsSortMenuOpen(!isSortMenuOpen); }} className="flex items-center justify-between w-full md:w-auto min-w-[160px] gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 shadow-sm hover:border-slate-300 transition-colors">
            <span className="flex items-center gap-2"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>{getSortLabel()}</span>
            <svg className={`w-4 h-4 text-slate-400 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          
          {isSortMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-100 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] py-1.5 z-50 animate-fadeIn">
              <div onClick={() => { setSortOrder('sizeDesc'); setIsSortMenuOpen(false); }} className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${sortOrder === 'sizeDesc' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>พื้นที่มากสุด</div>
              <div onClick={() => { setSortOrder('sizeAsc'); setIsSortMenuOpen(false); }} className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${sortOrder === 'sizeAsc' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>พื้นที่น้อยสุด</div>
              <div className="h-px bg-slate-100 my-1"></div>
              <div onClick={() => { setSortOrder('nameAsc'); setIsSortMenuOpen(false); }} className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${sortOrder === 'nameAsc' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>ชื่อ ก - ฮ (A-Z)</div>
              <div onClick={() => { setSortOrder('nameDesc'); setIsSortMenuOpen(false); }} className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${sortOrder === 'nameDesc' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>ชื่อ ฮ - ก (Z-A)</div>
              <div className="h-px bg-slate-100 my-1"></div>
              <div onClick={() => { setSortOrder('latest'); setIsSortMenuOpen(false); }} className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${sortOrder === 'latest' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>สมัครล่าสุด</div>
              <div onClick={() => { setSortOrder('oldest'); setIsSortMenuOpen(false); }} className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${sortOrder === 'oldest' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>สมัครเก่าสุด</div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="px-6 py-4 font-bold">ชื่อผู้ใช้ / อีเมล</th>
                <th className="px-6 py-4 font-bold">โควตา / ข้อมูลพรีเมียม</th>
                <th className="px-6 py-4 font-bold text-center">จัดการสิทธิ์</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="3" className="px-6 py-10 text-center text-slate-500 font-medium">กำลังคำนวณพื้นที่จัดเก็บ กรุณารอสักครู่...</td></tr>
              ) : displayedUsers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-10 text-center text-slate-500 font-medium">
                    {searchQuery ? `ไม่พบข้อมูลที่ตรงกับ "${searchQuery}"` : "ไม่พบข้อมูลผู้ใช้งานในหมวดหมู่นี้"}
                  </td>
                </tr>
              ) : (
                displayedUsers.map(user => {
                  const role = user.role || 'user';
                  // ⭐ คำนวณเวลาที่เหลือแบบใหม่ โดยเปรียบเทียบกับตัวแปร now ที่วิ่งตลอดเวลา
                  const timeLeft = calculateTimeLeft(user.premiumUntil, now);
                  const isExpired = timeLeft !== null && timeLeft.expired;
                  
                  let usagePercent = 0;
                  if (role === 'user') usagePercent = Math.min((user.projectCount / 10) * 100, 100);
                  if (role === 'premium') usagePercent = Math.min((user.storageUsed / (5 * 1024 * 1024)) * 100, 100);

                  return (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-sky-50/40 transition-colors">
                      <td className="px-6 py-4 cursor-pointer" onClick={() => handleOpenUserModal(user)} title="คลิกเพื่อดูไฟล์ของยูสเซอร์นี้">
                        <div className="font-bold text-slate-800 hover:text-sky-600 transition-colors flex items-center gap-1.5">
                          {user.displayName || user.email?.split('@')[0] || 'ผู้ใช้งาน'}
                          <svg className="w-3.5 h-3.5 text-sky-500 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                        <div className="text-[11px] text-sky-600 font-medium mt-1">📅 สมัครเมื่อ: {formatDate(user.createdAt)}</div>
                        <div className="text-[10px] text-slate-300 uppercase mt-0.5">ID: {user.id}</div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 w-52">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            {role === 'user' ? (
                              <><span>{user.projectCount} ไฟล์</span><span className="text-[10px] text-slate-400 font-normal">({formatBytes(user.storageUsed)})</span></>
                            ) : (
                              <><span>{formatBytes(user.storageUsed)}</span><span className="text-[10px] text-slate-400 font-normal">({user.projectCount} ไฟล์)</span></>
                            )}
                          </div>
                          
                          {role === 'user' ? (
                            <><div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${usagePercent >= 100 ? 'bg-red-500' : 'bg-sky-400'}`} style={{ width: `${Math.max(usagePercent, 1)}%` }}></div></div><div className="text-[9px] text-slate-400 text-right">จากโควตา 10 ไฟล์</div></>
                          ) : role === 'premium' ? (
                            <><div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${usagePercent >= 100 ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${Math.max(usagePercent, 1)}%` }}></div></div><div className="text-[9px] text-slate-400 text-right mb-1.5">จากโควตา 5 MB</div></>
                          ) : (
                            <div className="w-full h-1.5 bg-violet-100 rounded-full overflow-hidden mt-0.5"><div className="h-full bg-violet-400 rounded-full w-full"></div></div>
                          )}

                          {/* ⭐ ส่วนแสดงข้อมูลเวลานับถอยหลัง */}
                          {role === 'premium' && (
                            <div className="mt-1 pt-1.5 border-t border-slate-100">
                              {timeLeft !== null ? (
                                isExpired ? (
                                  <div className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    สิ้นสุดการใช้งานแล้ว
                                  </div>
                                ) : (
                                  <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    เหลือ {timeLeft.days} วัน {timeLeft.hours} ชม. {timeLeft.minutes} นาที
                                  </div>
                                )
                              ) : (
                                <div className="text-[11px] font-bold text-slate-400">ยังไม่ระบุวันหมดอายุ</div>
                              )}
                              
                              {user.premiumUntil && (
                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                  (ถึง {formatDate(user.premiumUntil)})
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center align-top" onClick={(e) => e.stopPropagation()}>
                        <select 
                          value={role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={isUpdating}
                          className={`border text-sm rounded-lg block w-full p-2.5 outline-none cursor-pointer disabled:opacity-50 transition-colors font-bold ${
                            role === 'admin' ? 'bg-violet-50 border-violet-200 text-violet-700 focus:ring-violet-500 focus:border-violet-500' :
                            role === 'premium' ? 'bg-amber-50 border-amber-200 text-amber-700 focus:ring-amber-500 focus:border-amber-500' :
                            'bg-white border-slate-300 text-slate-700 focus:ring-sky-500 focus:border-sky-500'
                          }`}
                        >
                          <option value="user">Free User (10 ไฟล์)</option>
                          <option value="premium">Premium (5 MB)</option>
                          <option value="admin">Admin (ไม่จำกัด)</option>
                        </select>

                        {role === 'premium' && (
                          <button
                            onClick={() => handleExtendPremium(user.id)}
                            disabled={isUpdating}
                            className="mt-2 text-[11px] font-bold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg w-full transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            ต่ออายุ 1 เดือน
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl scale-100 animate-slideUp flex flex-col max-h-[85vh]">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">โปรเจกต์ของ: {selectedUser.displayName || selectedUser.email}</h3>
                <p className="text-xs text-slate-400">พบทั้งหมด {userProjects.length} ไฟล์</p>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {isLoadingProjects ? (
                <div className="py-12 text-center text-slate-400 font-medium">กำลังโหลดรายการโปรเจกต์...</div>
              ) : userProjects.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium border border-dashed border-slate-200 rounded-2xl">ผู้ใช้คนนี้ยังไม่มีโปรเจกต์ในระบบ</div>
              ) : (
                userProjects.map(project => {
                  const bytes = new Blob([JSON.stringify(project)]).size;
                  return (
                    <div key={project.id} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-sky-50/50 border border-slate-100 rounded-2xl transition-all">
                      <div className="flex-1 min-w-0 mr-4">
                        <h4 className="font-bold text-slate-800 text-sm truncate">{project.name || "โปรเจกต์ไม่มีชื่อ"}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] text-slate-400">📅 แก้ไขล่าสุด: {formatDate(project.updatedAt)}</span>
                          <span className="text-[10px] bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded font-bold">{formatBytes(bytes)}</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleDownloadProject(project)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-sky-500/20 active:scale-95 shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        ดาวน์โหลด
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 text-right">
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-sm"
              >
                ปิดหน้าต่าง
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;