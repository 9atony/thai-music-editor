import React, { useRef, useState, useEffect, useContext } from 'react';
import { useReactToPrint } from 'react-to-print';
import Navbar from '../components/layout/Navbar';
import SettingsModal from '../components/editor/SettingsModal'; // ⭐ เรียกใช้ Modal แทน Sidebar
import Keyboard from '../components/editor/Keyboard';
import Sheet from '../components/editor/Sheet';
import { MusicContext } from '../contexts/MusicContext'; 

function DesktopEditor({ onBack }) {
  // ⭐ เปลี่ยน State จากเปิด/ปิด Sidebar เป็นเปิด/ปิด Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const componentRef = useRef();

  const { addTextRow, stopPlayback } = useContext(MusicContext);

  const stopPlaybackRef = useRef(stopPlayback);
  useEffect(() => {
    stopPlaybackRef.current = stopPlayback;
  }, [stopPlayback]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: 'Thai-Music-Note', 
  });

  // ⭐ ฟังก์ชันสำหรับเปิด Popup (จะส่งไปให้ Navbar เรียกใช้)
  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
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

  useEffect(() => {
    return () => {
      if (stopPlaybackRef.current) {
        stopPlaybackRef.current(); 
      }
    };
  }, []); 

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 font-sans overflow-hidden">
      
      {/* ⭐ ส่ง onOpenSettings แทน onToggleSidebar */}
      <Navbar onPrint={handlePrint} onOpenSettings={handleOpenSettings} onBack={onBack} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* ⭐ เอา Sidebar ออกไปแล้ว */}
        
        <main className="flex-1 flex flex-col bg-[#f0f4f8] overflow-hidden transition-all duration-300">
          <div className="flex-1 overflow-hidden p-0 flex flex-col items-center">
            <Sheet ref={componentRef} /> 
          </div>
          <Keyboard /> 
        </main>

        {/* ⭐ วาง Popup ตั้งค่าไว้ตรงนี้ */}
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      </div>
    </div>
  );
}

export default DesktopEditor;