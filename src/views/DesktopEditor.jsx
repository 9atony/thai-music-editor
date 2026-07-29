import React, { useRef, useState, useEffect, useContext } from 'react';
import { useReactToPrint } from 'react-to-print';

// แก้ไข Path ให้ถอยหลัง 1 ชั้น (../) แล้วชี้ไปที่โฟลเดอร์ที่ถูกต้อง
import Navbar from '../components/layout/Navbar';
import SettingsModal from '../components/editor/SettingsModal'; 
import Keyboard from '../components/editor/Keyboard';
import Sheet from '../components/editor/Sheet';
import { MusicContext } from '../contexts/MusicContext'; 
import EditorSidebar from '../components/editor/sidebar/EditorSidebar';

function DesktopEditor({ onBack }) {
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
      
      <Navbar onPrint={handlePrint} onOpenSettings={handleOpenSettings} onBack={onBack} />

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* แผงสไลด์ด้านซ้ายที่ถูกแยกออกไป */}
        <EditorSidebar />

        {/* พื้นที่หลัก */}
        <main className="flex-1 flex flex-col bg-[#f0f4f8] overflow-hidden relative">
          <div className="flex-1 overflow-hidden p-0 flex flex-col items-center">
            <Sheet ref={componentRef} /> 
          </div>
          <Keyboard /> 
        </main>

        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      </div>
    </div>
  );
}

export default DesktopEditor;