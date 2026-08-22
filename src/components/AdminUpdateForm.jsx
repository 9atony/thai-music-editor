import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebase'; 
import { collection, addDoc, Timestamp, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';

const AdminUpdateForm = ({ onClose, onUpdateSuccess }) => {
  // ควบคุมว่ากำลังเปิดหน้า "สร้าง" หรือ "ประวัติ"
  const [activeTab, setActiveTab] = useState('create'); 
  
  // State สำหรับฟอร์มสร้าง
  const [title, setTitle] = useState('');
  const [type, setType] = useState('news');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State สำหรับประวัติ
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // ดึงข้อมูลประวัติเมื่อสลับมาแท็บ history
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const q = query(collection(db, "updates"), orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      const historyData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistory(historyData);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus('กำลังโพสต์...');

    try {
      await addDoc(collection(db, "updates"), {
        title: title,
        type: type,
        content: content,
        date: Timestamp.fromDate(new Date()),
      });
      setStatus('โพสต์สำเร็จ!');
      setTitle('');
      setContent('');
      
      if (onUpdateSuccess) onUpdateSuccess();

      setTimeout(() => {
          setStatus('');
          onClose(); 
      }, 1500); 

    } catch (error) {
      console.error("Error adding document: ", error);
      setStatus('เกิดข้อผิดพลาดในการโพสต์');
    } finally {
        setIsSubmitting(false);
    }
  };

  // ฟังก์ชันลบประกาศ
  const handleDelete = async (id) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบประกาศนี้?")) return;
    try {
      await deleteDoc(doc(db, "updates", id));
      setHistory(history.filter(item => item.id !== id)); // ลบออกจากหน้าจอ
      if (onUpdateSuccess) onUpdateSuccess(); // อัปเดตหน้า Home ด้วย
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("เกิดข้อผิดพลาดในการลบ");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden animate-scaleUp flex flex-col max-h-[90vh]">
        
        {/* ส่วนหัว และปุ่มปิด */}
        <div className="px-8 pt-8 pb-4 flex justify-between items-center bg-white z-10">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <span className="text-sky-500">🛠️</span> ระบบจัดการอัปเดต
            </h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">✕</button>
        </div>

        {/* ระบบ Tab (สร้าง / ประวัติ) */}
        <div className="px-8 flex gap-4 border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('create')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'create' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            สร้างประกาศใหม่
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            ประวัติการโพสต์
          </button>
        </div>
        
        {/* พื้นที่แสดงเนื้อหา (Scroll ได้) */}
        <div className="p-8 overflow-y-auto">
          {activeTab === 'create' ? (
            /* ================= แท็บ 1: ฟอร์มสร้างประกาศ ================= */
            <div className="animate-fadeIn">
              {status && (
                <div className={`p-4 rounded-xl mb-6 text-sm font-semibold text-center ${status.includes('สำเร็จ') ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                  {status}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">หัวข้อประกาศ</label>
                  <input 
                    type="text" 
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                    placeholder="เช่น อัปเดตเวอร์ชัน 1.1.0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">ประเภทอัปเดต</label>
                  <select 
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="news">ประกาศทั่วไป (สีฟ้า)</option>
                    <option value="feature">ฟีเจอร์ใหม่ (สีเขียว)</option>
                    <option value="bug">แก้ไขบัค (สีแดง)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">รายละเอียด (พิมพ์ - เพื่อทำจุดไข่ปลา)</label>
                  <textarea 
                    required
                    rows="5"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-all resize-none"
                    placeholder="- เพิ่มเครื่องดนตรีใหม่&#10;- แก้ไขปัญหาจังหวะกระตุก"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 text-white font-bold py-4 px-4 rounded-xl hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-70 flex justify-center items-center"
                >
                  {isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'เผยแพร่ประกาศ 🚀'}
                </button>
              </form>
            </div>
          ) : (
            /* ================= แท็บ 2: ประวัติการโพสต์ ================= */
            <div className="animate-fadeIn space-y-4">
              {isLoadingHistory ? (
                <div className="text-center py-10 text-slate-500 font-medium">กำลังโหลดข้อมูลประวัติ...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-medium bg-slate-50 rounded-2xl border border-slate-100">
                  ยังไม่มีประวัติการประกาศอัปเดต
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start gap-4 hover:border-sky-300 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.type === 'feature' ? 'bg-emerald-100 text-emerald-700' : 
                          item.type === 'bug' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          {item.type === 'feature' ? 'ฟีเจอร์' : item.type === 'bug' ? 'แก้บัค' : 'ประกาศ'}
                        </span>
                        <h4 className="font-bold text-slate-800">{item.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">
                        {item.date?.toDate().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {item.content}
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors shrink-0"
                    >
                      ลบโพสต์
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUpdateForm;