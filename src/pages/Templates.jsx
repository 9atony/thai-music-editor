import React, { useState } from 'react';
import { LayoutTemplate } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { TEMPLATE_CATALOG } from '../data/templateCatalog';

const Templates = ({ onNewProject, userProfile }) => {
  const isAdmin = userProfile?.role === 'admin';

  // ⭐ State สำหรับระบบจัดการเมนูจุด 3 จุด
  const [adminMenuOpen, setAdminMenuOpen] = useState(null);

  const [templates, setTemplates] = useState(TEMPLATE_CATALOG);

  const handleEdit = (e, id) => {
    e.stopPropagation();
    setAdminMenuOpen(null);
    alert(`เตรียมเปิด Modal แก้ไขเทมเพลต ID: ${id}`);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    setAdminMenuOpen(null);
    if(window.confirm('ต้องการลบเทมเพลตนี้ใช่หรือไม่?')) {
      alert(`ลบเทมเพลต ID: ${id} เรียบร้อย (ตัวอย่าง)`);
    }
  };

  const handleCreateNew = () => {
    alert('เตรียมเปิด Modal สร้างเทมเพลตใหม่');
  };

  // กำหนดสีของ Badge ให้ตรงกับธีมของกรอบ
  const getBadgeStyle = (id) => {
    if (id === 'standard') return 'bg-emerald-100 text-emerald-700';
    if (id === 'worksheet') return 'bg-amber-100 text-amber-700';
    if (id === 'formal') return 'bg-purple-100 text-purple-700';
    return 'bg-slate-100 text-slate-700'; // blank
  };

  return (
    <div 
      className="app-page-shell animate-fadeIn text-slate-800"
      style={{ fontFamily: 'Prompt, sans-serif' }}
      onClick={() => setAdminMenuOpen(null)} // คลิกที่ว่างเพื่อปิดเมนูแอดมิน
    >
      <PageHeader icon={LayoutTemplate} badge="Templates" title="เทมเพลต" subtitle="เริ่มต้นสร้างผลงานหรือแบบฝึกหัดอย่างรวดเร็วด้วยโครงสร้างมาตรฐาน">
        {isAdmin && (
          <button 
            onClick={handleCreateNew}
            className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2 shrink-0 w-full md:w-auto"
          >
            <span>+ สร้างเทมเพลตใหม่</span>
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 md:gap-8">
        {templates.map((template) => (
          <div 
            key={template.id}
            onClick={() => {
              if (onNewProject) onNewProject(template); 
            }}
            className={`relative bg-white border border-slate-200 rounded-2xl flex flex-col transition-all duration-300 shadow-sm hover:shadow-xl group ${template.borderColor} hover:-translate-y-1 text-left w-full cursor-pointer overflow-hidden p-0`}
          >
            
            {/* ⭐ เมนูจุด 3 จุดสำหรับ Admin (ซ่อนใน Blank) */}
            {isAdmin && template.id !== 'blank' && (
              <div className="absolute top-3 right-3 z-20">
                <button 
                  onClick={(e) => { e.stopPropagation(); setAdminMenuOpen(adminMenuOpen === template.id ? null : template.id); }}
                  className="w-8 h-8 bg-white/90 backdrop-blur-md border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white shadow-md transition-colors"
                >
                  ⋮
                </button>
                
                {/* Dropdown Menu */}
                {adminMenuOpen === template.id && (
                  <div className="absolute right-0 mt-1 w-28 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden flex flex-col py-1 text-sm font-medium">
                    <button 
                      onClick={(e) => handleEdit(e, template.id)} 
                      className="px-3 py-2 text-left text-slate-600 hover:bg-slate-50 hover:text-sky-600 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      แก้ไข
                    </button>
                    <button 
                      onClick={(e) => handleDelete(e, template.id)} 
                      className="px-3 py-2 text-left text-rose-500 hover:bg-rose-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      ลบ
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ป้ายกำกับ (Badge) สวยๆ มุมซ้ายบน */}
            <div className={`absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${getBadgeStyle(template.id)} shadow-sm backdrop-blur-sm`}>
              {template.badge}
            </div>

            {/* พื้นที่รูปภาพพรีวิว */}
            <div className="w-full aspect-video bg-slate-50/80 relative overflow-hidden border-b border-slate-100 flex items-center justify-center p-4">
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

            <div className="pt-5 pb-6 px-6 flex-1 flex flex-col w-full bg-white">
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
