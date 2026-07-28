import React, { useState, useEffect } from 'react';
// ⭐ ตัด storage ทิ้งไปเลย ใช้แค่ auth กับ db
import { auth, db } from '../utils/firebase'; 
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import TmeIcon from '../assets/icon.png'; 

const Samples = ({ onOpenProject }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  
  const [samples, setSamples] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // ⭐ เปลี่ยน fileUrl เป็น fileContent เพื่อเก็บเนื้อหาไฟล์แทนลิงก์
  const [formData, setFormData] = useState({
    name: '',
    category: 'เพลงพื้นฐาน',
    level: 'ง่าย',
    file: null,
    fileContent: '' 
  });

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      if (user && user.email) {
        setCurrentUserEmail(user.email);
        if (user.email === 'admin@example.com' || user.email.includes('9atony.xyz')) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

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

  const groupedSamples = samples.reduce((acc, sample) => {
    if (!acc[sample.category]) {
      acc[sample.category] = [];
    }
    acc[sample.category].push(sample);
    return acc;
  }, {});

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
    if (window.confirm(`ต้องการลบเพลง "${sample.name}" ใช่หรือไม่?`)) {
      try {
        // ⭐ ลบแค่ใน Database อย่างเดียวพอแล้ว
        await deleteDoc(doc(db, 'samples', sample.id));
        alert('ลบข้อมูลเรียบร้อยแล้ว');
      } catch (error) {
        console.error("ลบไม่สำเร็จ:", error);
        alert('เกิดข้อผิดพลาดในการลบข้อมูล');
      }
    }
  };

  const handleEdit = (e, sample) => {
    e.stopPropagation();
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

  // ⭐ ฟังก์ชันอ่านไฟล์ Text
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

      // ⭐ ถ้ามีการอัปโหลดไฟล์ใหม่ ให้อ่านไฟล์แล้วดึงเนื้อหาออกมาเป็น Text
      if (formData.file) {
        finalContent = await readFileAsText(formData.file);
      }

      const dataToSave = {
        name: formData.name,
        category: formData.category,
        level: formData.level,
        fileContent: finalContent, // เซฟเนื้อหาโน้ตเพลงลง Firestore ตรงๆ
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
      console.error("บันทึกไม่สำเร็จ:", error);
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
        // ลองแปลง Text ให้กลายเป็น JSON Object ก่อนส่ง
        const parsedContent = JSON.parse(sample.fileContent);
        
        // ส่ง ID, ข้อมูล และโหมดอ่านอย่างเดียวไปให้ Editor
        onOpenProject(sample.id, parsedContent, { readOnly: true }); 
      } catch (error) {
        console.error("แปลงไฟล์ .tme ไม่สำเร็จ (อาจไม่ใช่ JSON):", error);
        // ถ้าแปลงไม่ได้ ก็ส่งแบบ Text ดิบๆ ไปเหมือนเดิม พร้อมโหมดอ่านอย่างเดียว
        onOpenProject(sample.id, sample.fileContent, { readOnly: true });
      }
    } else {
      onOpenProject(sample.id, null, { readOnly: true });
    }
  };

  return (
    <div 
      className="max-w-6xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-12 relative"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      <div className="flex justify-between items-end mb-6 md:mb-8 px-1">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 md:mb-2">ตัวอย่างเพลง 🎵</h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium">ศึกษาและเรียนรู้จากโน้ตเพลงไทยมาตรฐานที่จัดทำไว้สมบูรณ์แล้ว</p>
        </div>
        {isAdmin && (
          <button 
            onClick={handleUploadNew}
            className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
          >
            <span>+ เพิ่มไฟล์ .tme</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-slate-500">กำลังโหลดข้อมูล...</div>
      ) : samples.length === 0 ? (
         <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">ยังไม่มีตัวอย่างเพลงในระบบ</div>
      ) : (
        Object.keys(groupedSamples).map((category, index) => (
          <div key={index} className="mb-10">
            <h3 className="text-lg font-bold text-slate-700 border-b-2 border-slate-100 pb-2 mb-4 px-1 flex items-center gap-2">
              <span className="w-2 h-6 bg-sky-400 rounded-full inline-block"></span>
              หมวดหมู่: {category}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
              {groupedSamples[category].map((sample) => (
                <div 
                  key={sample.id} 
                  onClick={() => handleOpenProject(sample)} 
                  className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-sky-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group cursor-pointer relative text-center w-full"
                >
                  
                  {isAdmin && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button 
                        onClick={(e) => handleEdit(e, sample)}
                        className="w-6 h-6 bg-white/90 backdrop-blur border border-slate-200 hover:border-sky-400 hover:text-sky-500 text-slate-500 rounded flex items-center justify-center shadow-sm"
                        title="แก้ไขข้อมูล"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, sample)}
                        className="w-6 h-6 bg-white/90 backdrop-blur border border-slate-200 hover:border-red-400 hover:text-red-500 text-slate-500 rounded flex items-center justify-center shadow-sm"
                        title="ลบ"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  )}

                  <div className="w-full h-32 md:h-40 bg-gradient-to-b from-slate-50 to-slate-100 rounded-xl mb-4 flex items-center justify-center border border-slate-200/50 group-hover:from-sky-50/50 group-hover:to-sky-100/50 transition-colors overflow-hidden">
                     <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <img src={TmeIcon} alt="File Icon" className="w-full h-full object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.15)]" />
                     </div>
                  </div>
                  <div className="w-full text-left px-1">
                    <h4 className="font-bold text-slate-900 text-sm md:text-base w-full truncate mb-1">
                      {sample.name}
                    </h4>
                    <p className="text-[11px] md:text-xs text-slate-500 font-medium mb-2 truncate">
                      {sample.category}
                    </p>
                    <div className="flex items-center">
                      <span className={`text-[10px] md:text-[11px] font-bold px-2 py-0.5 rounded-md border ${getLevelColor(sample.level)}`}>
                        {sample.level}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="bg-sky-50 px-6 py-4 border-b border-sky-100 flex justify-between items-center">
              <h3 className="font-bold text-sky-800 text-lg">
                {editingId ? 'แก้ไขข้อมูลเพลง' : 'เพิ่มไฟล์ตัวอย่างเพลง'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmitForm} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อเพลง</label>
                <input 
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">หมวดหมู่</label>
                  <input 
                    type="text" required placeholder="เช่น เพลงพื้นฐาน"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ระดับความยาก</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                  อัปโหลดไฟล์ (.tme) {editingId && <span className="text-xs text-slate-400 font-normal">(อัปโหลดใหม่เพื่อเปลี่ยนไฟล์)</span>}
                </label>
                <input 
                  type="file" accept=".tme"
                  onChange={handleFileChange}
                  required={!editingId} 
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                       <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      กำลังบันทึก...
                    </>
                  ) : (
                    "บันทึกข้อมูล"
                  )}
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