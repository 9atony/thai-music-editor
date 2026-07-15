import React, { useRef, useState, useEffect, useContext } from 'react';
import { useReactToPrint } from 'react-to-print';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import PlaybackControls from '../components/controls/PlaybackControls';
import Keyboard from '../components/editor/Keyboard';
import Sheet from '../components/editor/Sheet';
import { MusicContext } from '../contexts/MusicContext'; 

// ⭐ 1. รับค่า onBack เข้ามาตรงนี้
function DesktopEditor({ onBack }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const componentRef = useRef();

  const { addTextRow } = useContext(MusicContext);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: 'Thai-Music-Note', 
  });

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault(); 
        if (addTextRow) {
          addTextRow(); 
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addTextRow]);

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 font-sans overflow-hidden">
      
      {/* ⭐ 1. เพิ่ม onBack={onBack} ส่งไปให้ Navbar */}
      <Navbar onPrint={handlePrint} onToggleSidebar={toggleSidebar} onBack={onBack} />

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar isOpen={isSidebarOpen} />
        
        <main className="flex-1 flex flex-col bg-[#f0f4f8] overflow-hidden transition-all duration-300">
        
          {/* ⭐ 2. ลบปุ่มกลับหน้าหลักอันเก่าตรงนี้ทิ้งไปเลยครับ ให้เหลือแค่ Sheet */}
          <div className="flex-1 overflow-hidden p-0 flex flex-col items-center">
            <Sheet ref={componentRef} /> 
          </div>

          <Keyboard /> 
          
        </main>

      </div>
    </div>
  );
}

export default DesktopEditor;