import React, { useState, useEffect } from 'react';
import { auth } from '../utils/firebase'; 

// นำเข้ารูปภาพจากโฟลเดอร์ assets/templates
import previewBlank from '../assets/templates/preview-blank.png';
import previewStandard from '../assets/templates/preview-standard.png';
import previewWorksheet from '../assets/templates/preview-worksheet.png';
import previewFormal from '../assets/templates/preview-formal.png';

const Templates = ({ onNewProject }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (user && user.email) {
      setCurrentUserEmail(user.email);
      // เปลี่ยนอีเมลตรงนี้เป็นอีเมลของคุณได้เลยครับ
      if (user.email === 'admin@example.com' || user.email.includes('9atony.xyz')) {
        setIsAdmin(true);
      }
    }
  }, []);

  const defaultTemplates = [
    { 
      id: 'blank', 
      name: 'กระดาษเปล่า', 
      desc: 'หน้ากระดาษเปล่าสำหรับเริ่มต้นเขียนโน้ตทันที', 
      borderColor: 'hover:border-slate-400',
      previewImg: previewBlank,
      defaultSongName: 'เพลงใหม่',
      detailsAlign: 'between',
      headerDetails: [] 
    },
    { 
      id: 'standard', 
      name: 'มาตรฐาน (Standard)', 
      desc: 'หัวกระดาษสำหรับโน้ตเพลงทั่วไป ระบุจังหวะ หน้าทับ และทางเสียง', 
      borderColor: 'hover:border-emerald-400',
      previewImg: previewStandard,
      defaultSongName: 'ชื่อเพลง',
      detailsAlign: 'between',
      headerDetails: [
        { id: '1', label: "อัตราจังหวะ", value: ".........." },
        { id: '2', label: "หน้าทับ", value: ".........." },
        { id: '3', label: "บันไดเสียง", value: ".........." },
        { id: '4', label: "ผู้บันทึก", value: "................" }
      ]
    },
    { 
      id: 'worksheet', 
      name: 'ใบงาน / แบบฝึกหัด', 
      desc: 'แบบฟอร์มที่มีพื้นที่จุดไข่ปลาสำหรับกรอก ชื่อ-สกุล ชั้น เลขที่ และคะแนน', 
      borderColor: 'hover:border-amber-400',
      previewImg: previewWorksheet,
      defaultSongName: 'ใบงานทฤษฎีดนตรีไทย',
      detailsAlign: 'between',
      headerDetails: [
        { id: '1', label: 'ชื่อ-สกุล', value: '................................................' },
        { id: '2', label: 'ชั้น', value: '................' },
        { id: '3', label: 'เลขที่', value: '............' },
        { id: '4', label: 'คะแนน', value: '............' }
      ]
    },
    { 
      id: 'formal', 
      name: 'เอกสารวิชาการ', 
      desc: 'หัวกระดาษแบบทางการ ระบุรายละเอียดที่มาและผู้ถ่ายทอดชัดเจน จัดวางสมดุลซ้าย-ขวา', 
      borderColor: 'hover:border-purple-400',
      previewImg: previewFormal,
      defaultSongName: 'ชื่อเพลง',
      detailsAlign: 'between',
      headerDetails: [
        { id: '1', label: "อัตราจังหวะ", value: "...................................." },
        { id: '2', label: "ผู้ประพันธ์ทำนอง", value: "...................................." },
        { id: '3', label: "หน้าทับ", value: "...................................." },
        { id: '4', label: "ผู้ถ่ายทอด", value: "...................................." },
        { id: '5', label: "ทางเสียง", value: "...................................." },
        { id: '6', label: "ผู้บันทึกโน้ต", value: "...................................." }
      ]
    }
  ];

  const [templates, setTemplates] = useState(defaultTemplates);

  const handleEdit = (e, id) => {
    e.stopPropagation();
    alert(`เตรียมเปิด Modal แก้ไขเทมเพลต ID: ${id}`);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if(window.confirm('ต้องการลบเทมเพลตนี้ใช่หรือไม่?')) {
      alert(`ลบเทมเพลต ID: ${id} เรียบร้อย (ตัวอย่าง)`);
    }
  };

  const handleCreateNew = () => {
    alert('เตรียมเปิด Modal สร้างเทมเพลตใหม่');
  };

  return (
    <div 
      className="max-w-6xl mx-auto w-full animate-fadeIn text-slate-800 pt-6 md:pt-10 px-5 md:px-8 pb-12"
      style={{ fontFamily: 'Prompt, sans-serif' }}
    >
      <div className="flex justify-between items-end mb-6 md:mb-8 px-1">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1 md:mb-2">เทมเพลต 🗂️</h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium">เริ่มต้นสร้างผลงานหรือแบบฝึกหัดอย่างรวดเร็วด้วยโครงสร้างที่เตรียมไว้ให้</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        
        {isAdmin && (
          <button 
            onClick={handleCreateNew}
            className="bg-sky-50 border-2 border-dashed border-sky-300 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:bg-sky-100 hover:border-sky-400 hover:-translate-y-1 text-center w-full min-h-[250px] shadow-sm"
          >
            <div className="w-12 h-12 rounded-full bg-white text-sky-500 flex items-center justify-center text-2xl shadow-sm">
              +
            </div>
            <div>
              <h3 className="font-bold text-sky-700 text-base">สร้างเทมเพลตใหม่</h3>
              <p className="text-xs text-sky-600/80 mt-1">กำหนดรูปแบบหัวกระดาษด้วยตัวเอง</p>
            </div>
          </button>
        )}

        {templates.map((template) => (
          <div 
            key={template.id}
            onClick={() => {
              if (onNewProject) onNewProject(template); 
            }}
            className={`relative bg-white border border-slate-200 rounded-2xl flex flex-col transition-all duration-300 shadow-sm hover:shadow-lg group ${template.borderColor} hover:-translate-y-1 text-left w-full cursor-pointer overflow-hidden p-0`}
          >
            {isAdmin && template.id !== 'blank' && (
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button 
                  onClick={(e) => handleEdit(e, template.id)}
                  className="w-7 h-7 bg-white/90 backdrop-blur border border-slate-200 hover:border-sky-400 hover:text-sky-500 text-slate-500 rounded-md flex items-center justify-center shadow-sm transition-colors"
                  title="แก้ไข"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button 
                  onClick={(e) => handleDelete(e, template.id)}
                  className="w-7 h-7 bg-white/90 backdrop-blur border border-slate-200 hover:border-red-400 hover:text-red-500 text-slate-500 rounded-md flex items-center justify-center shadow-sm transition-colors"
                  title="ลบ"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            )}

            {/* ⭐ พื้นที่รูปภาพพรีวิว (กรอบแนวนอน 16:9, ไม่ครอป, ไม่มีไอคอนบัง) */}
            <div className="w-full aspect-video bg-slate-50 relative overflow-hidden border-b border-slate-200 flex items-center justify-center">
              {template.previewImg ? (
                <img 
                  src={template.previewImg} 
                  alt={template.name} 
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" 
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase">No Preview</span>
                </div>
              )}
            </div>

            <div className="pt-6 pb-5 px-5 flex-1 flex flex-col w-full">
              <h3 className="font-bold text-slate-800 text-lg mb-1.5">{template.name}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{template.desc}</p>
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
};

export default Templates;