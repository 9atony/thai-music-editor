import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebase'; 
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import TmeIcon from '../assets/icon.png'; 

const Samples = ({ onOpenProject, userProfile }) => {
  const isAdmin = userProfile?.role === 'admin';
  
  const [samples, setSamples] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ⭐ State สำหรับระบบค้นหาและฟิลเตอร์
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [selectedLevel, setSelectedLevel] = useState('ทั้งหมด');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // ⭐ State สำหรับเปิด/ปิดเมนูจุด 3 จุดของแอดมิน
  const [adminMenuOpen, setAdminMenuOpen] = useState(null); 
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'เพลงพื้นฐาน',
    level: 'ง่าย',
    file: null,
    fileContent: '' 
  });

  useEffect(() => {
    const samplesRef = collection(db, 'samples');
    const unsubscribeData = onSnapshot(samplesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSamples(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching samples:", error);
      setIsLoading(false);
    });
    return () => unsubscribeData();
  }, []);

  // ⭐ ดึงรายชื่อหมวดหมู่ทั้งหมดแบบไม่ซ้ำกัน เพื่อมาทำปุ่ม Tab
  const categories = ['ทั้งหมด', ...new Set(samples.map(s => s.category))];

  // ⭐ กรองข้อมูลตามที่ผู้ใช้ค้นหาและเลือก
  const filteredSamples = samples.filter(sample => {
    const matchSearch = sample.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory === 'ทั้งหมด' || sample.category === selectedCategory;
    const matchLevel = selectedLevel === 'ทั้งหมด' || sample.level === selectedLevel;
    return matchSearch && matchCategory && matchLevel;
  });

  const getLevelColor = (level) => {
    switch(level) {
      case 'ง่าย': return 'text-green-600 bg-green-50 border-green-200';
      case 'ปานกลาง': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'ยาก': return 'text-rose-600 bg-rose-50 border-rose-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const handleDelete = async (e, sample) => {
    e.stopPropagation();
    setAdminMenuOpen(null); // ปิดเมนู
    if (window.confirm(`ต้องการลบเพลง "${sample.name}" ใช่หรือไม่?`)) {
      try {
        await deleteDoc(doc(db, 'samples', sample.id));
        alert('ลบข้อมูลเรียบร้อยแล้ว');
      } catch (error) {
        alert('เกิดข้อผิดพลาดในการลบข้อมูล');
      }
    }
  };

  const handleEdit = (e, sample) => {
    e.stopPropagation();
    setAdminMenuOpen(null); // ปิดเมนู
    setEditingId(sample.id);
    setFormData({
      name: sample.name,
      category: sample.category,
      level: sample.level,
      file: null, 
      fileContent: sample.fileContent || '' 
    });
    setIsModalOpen(true);
  };

  const handleUploadNew = () => {
    setEditingId(null);
    setFormData({ name: '', category: 'เพลงพื้นฐาน', level: 'ง่าย', file: null, fileContent: '' });
    setIsModalOpen(true);
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let finalContent = formData.fileContent;
      if (formData.file) {
        finalContent = await readFileAsText(formData.file);
      }
      const dataToSave = {
        name: formData.name,
        category: formData.category,
        level: formData.level,
        fileContent: finalContent, 
        updatedAt: serverTimestamp()
      };
      if (editingId) {
        await updateDoc(doc(db, 'samples', editingId), dataToSave);
      } else {
        dataToSave.createdAt = serverTimestamp();
        await addDoc(collection(db, 'samples'), dataToSave);
      }
      setIsModalOpen(false);
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.tme')) {
      setFormData({ ...formData, file });
    } else {
      alert('กรุณาอัปโหลดไฟล์นามสกุล .tme เท่านั้น');
      e.target.value = null;
    }
  };

  const handleOpenProject = (sample) => {
    if (!onOpenProject) return;
    if (sample.fileContent) {
      try {
        const parsedContent = JSON.parse(sample.fileContent);
        onOpenProject(sample.id, parsedContent, { readOnly: true }); 
      } catch (error) {
        onOpenProject(sample.id, sample.fileContent, { readOnly: true });
      }
    } else {
      onOpenProject(sample.id, null, { readOnly: true });
    }
  };

  return (
    <div 
      className="max-w-6xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-12 relative min-h-screen"
      style={{ fontFamily: 'Prompt, sans-serif' }}
      onClick={() => setAdminMenuOpen(null)} // คลิกพื้นที่ว่างเพื่อปิดเมนูแอดมิน
    >
      {/* Header & Add Button */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-6 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 md:mb-2">ตัวอย่างเพลง 🎵</h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium">ศึกษาและเรียนรู้จากโน้ตเพลงไทยมาตรฐานที่จัดทำไว้สมบูรณ์แล้ว</p>
        </div>
        {isAdmin && (
          <button 
            onClick={handleUploadNew}
            className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2 shrink-0"
          >
            <span>+ เพิ่มไฟล์ .tme</span>
          </button>
        )}
      </div>

      {/* ⭐ Toolbar: Search, Filter, Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-3 items-center sticky top-4 z-30">
        
        {/* Search */}
        <div className="relative w-full md:w-64 shrink-0">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input 
            type="text" 
            placeholder="ค้นหาชื่อเพลง..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl pl-9 pr-3 py-2 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
          />
        </div>

        {/* Level Filter */}
        <div className="w-full md:w-auto shrink-0 border-l-0 md:border-l border-slate-200 md:pl-3 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">ระดับ:</span>
          <select 
            value={selectedLevel} 
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-sm rounded-xl px-2 py-2 outline-none focus:border-sky-400 cursor-pointer"
          >
            <option value="ทั้งหมด">ทั้งหมด</option>
            <option value="ง่าย">ง่าย</option>
            <option value="ปานกลาง">ปานกลาง</option>
            <option value="ยาก">ยาก</option>
          </select>
        </div>

        {/* Category Tabs */}
        <div className="flex-1 overflow-x-auto flex gap-2 pb-1 md:pb-0 w-full" style={{ scrollbarWidth: 'none' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                selectedCategory === cat 
                  ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-500 font-medium">กำลังโหลดข้อมูล...</div>
      ) : filteredSamples.length === 0 ? (
         <div className="text-center py-20 text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center gap-3">
            <span className="text-4xl">📭</span>
            <p>ไม่พบเพลงที่คุณกำลังค้นหา</p>
            {(searchQuery || selectedCategory !== 'ทั้งหมด' || selectedLevel !== 'ทั้งหมด') && (
              <button onClick={() => { setSearchQuery(''); setSelectedCategory('ทั้งหมด'); setSelectedLevel('ทั้งหมด'); }} className="text-sky-500 text-sm font-bold hover:underline">
                ล้างการค้นหา
              </button>
            )}
         </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
          {filteredSamples.map((sample) => (
            <div 
              key={sample.id} 
              onClick={() => handleOpenProject(sample)} 
              className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-sky-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer relative text-center w-full group"
            >
              
              {/* ⭐ เมนูแอดมิน (จุด 3 จุด) */}
              {isAdmin && (
                <div className="absolute top-3 right-3 z-20">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setAdminMenuOpen(adminMenuOpen === sample.id ? null : sample.id); }}
                    className="w-7 h-7 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-white shadow-sm transition-colors"
                  >
                    ⋮
                  </button>
                  
                  {/* Dropdown Menu */}
                  {adminMenuOpen === sample.id && (
                    <div className="absolute right-0 mt-1 w-28 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden flex flex-col py-1 text-sm font-medium">
                      <button 
                        onClick={(e) => handleEdit(e, sample)} 
                        className="px-3 py-2 text-left text-slate-600 hover:bg-slate-50 hover:text-sky-600 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        แก้ไข
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, sample)} 
                        className="px-3 py-2 text-left text-rose-500 hover:bg-rose-50 transition-colors flex items-center gap-2"
                      >
                         <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        ลบ
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="w-full h-32 md:h-36 bg-gradient-to-b from-slate-50 to-slate-100 rounded-xl mb-4 flex items-center justify-center border border-slate-200/50 group-hover:from-sky-50/30 group-hover:to-sky-100/30 transition-colors overflow-hidden">
                 <div className="w-16 h-16 md:w-16 md:h-16 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <img src={TmeIcon} alt="File Icon" className="w-full h-full object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.1)]" />
                 </div>
              </div>
              <div className="w-full text-left px-1">
                <h4 className="font-bold text-slate-900 text-sm md:text-sm w-full truncate mb-1">
                  {sample.name}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium mb-2 truncate">
                  {sample.category}
                </p>
                <div className="flex items-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getLevelColor(sample.level)}`}>
                    {sample.level}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal เพิ่ม/แก้ไข (เหมือนเดิม แต่ปรับสไตล์นิดหน่อย) */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-sky-50 px-6 py-4 border-b border-sky-100 flex justify-between items-center">
              <h3 className="font-bold text-sky-800 text-lg flex items-center gap-2">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
                {editingId ? 'แก้ไขข้อมูลเพลง' : 'เพิ่มไฟล์ตัวอย่างเพลง'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-lg p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmitForm} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อเพลง</label>
                <input 
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-shadow"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">หมวดหมู่</label>
                  <input 
                    type="text" required placeholder="เช่น เพลงหน้าพาทย์"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-shadow"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ระดับความยาก</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-shadow cursor-pointer"
                    value={formData.level}
                    onChange={(e) => setFormData({...formData, level: e.target.value})}
                  >
                    <option value="ง่าย">ง่าย</option>
                    <option value="ปานกลาง">ปานกลาง</option>
                    <option value="ยาก">ยาก</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  อัปโหลดไฟล์ (.tme) {editingId && <span className="text-[10px] text-slate-400 font-normal ml-1">(ไม่ต้องเลือกถ้าใช้ไฟล์เดิม)</span>}
                </label>
                <div className="border border-slate-300 border-dashed rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                  <input 
                    type="file" accept=".tme"
                    onChange={handleFileChange}
                    required={!editingId} 
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Samples;