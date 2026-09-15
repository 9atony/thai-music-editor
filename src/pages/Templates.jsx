import React from 'react';
import { LayoutTemplate } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { TEMPLATE_CATALOG } from '../data/templateCatalog';

const Templates = ({ onNewProject }) => {
  const templates = TEMPLATE_CATALOG;

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
    >
      <PageHeader icon={LayoutTemplate} title="เทมเพลต" subtitle="เลือกเทมเพลตมาตรฐานเพื่อเริ่มเขียนโน้ตได้ทันที" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 md:gap-8">
        {templates.map((template) => (
          <div 
            key={template.id}
            onClick={() => {
              if (onNewProject) onNewProject(template); 
            }}
            className={`relative bg-white border border-slate-200 rounded-2xl flex flex-col transition-all duration-300 shadow-sm hover:shadow-xl group ${template.borderColor} hover:-translate-y-1 text-left w-full cursor-pointer overflow-hidden p-0`}
          >
            
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
