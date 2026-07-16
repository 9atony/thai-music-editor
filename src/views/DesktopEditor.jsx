import React, { useRef, useState, useEffect, useContext } from 'react';
import { useReactToPrint } from 'react-to-print';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import PlaybackControls from '../components/controls/PlaybackControls';
import Keyboard from '../components/editor/Keyboard';
import Sheet from '../components/editor/Sheet';
import { MusicContext } from '../contexts/MusicContext'; 

function DesktopEditor({ onBack }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const componentRef = useRef();

  const { addTextRow, stopPlayback } = useContext(MusicContext);

  // ⭐ 1. สร้าง Ref เพื่อจดจำฟังก์ชันหยุดเพลง ป้องกันการโดนเรียกซ้ำตอนอัปเดตหน้าจอ
  const stopPlaybackRef = useRef(stopPlayback);
  useEffect(() => {
    stopPlaybackRef.current = stopPlayback;
  }, [stopPlayback]);

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

  // ⭐ 2. ดักจับตอนที่ผู้ใช้กดออกจากหน้า Editor อย่างแท้จริง (สังเกตวงเล็บว่าง [] ด้านล่างสุด)
  useEffect(() => {
    return () => {
      // โค้ดนี้จะทำงานก็ต่อเมื่อ Component ถูกปิดหรือเปลี่ยนหน้าเท่านั้น
      if (stopPlaybackRef.current) {
        stopPlaybackRef.current(); 
      }
    };
  }, []); // <-- วงเล็บว่างนี้สำคัญมากครับ มันบอก React ว่าอย่าเรียกซ้ำ

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 font-sans overflow-hidden">
      
      <Navbar onPrint={handlePrint} onToggleSidebar={toggleSidebar} onBack={onBack} />

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar isOpen={isSidebarOpen} />
        
        <main className="flex-1 flex flex-col bg-[#f0f4f8] overflow-hidden transition-all duration-300">
        
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