import React, { useRef, useState, useEffect, useContext } from 'react';
import { useReactToPrint } from 'react-to-print';

// แก้ไข Path ให้ถอยหลัง 1 ชั้น (../) แล้วชี้ไปที่โฟลเดอร์ที่ถูกต้อง
import Navbar from '../components/layout/Navbar';
import SettingsModal from '../components/editor/SettingsModal'; 
import Keyboard from '../components/editor/Keyboard';
import Sheet from '../components/editor/Sheet';
import { MusicContext } from '../contexts/MusicContext'; 
import EditorSidebar from '../components/editor/sidebar/EditorSidebar';
import TouchDesktopController from '../components/editor/TouchDesktopController';
import { markEditorUsable } from '../utils/devPerformance';

const isTouchPortraitDevice = () => {
  if (typeof window === 'undefined') return false;
  const hasTouch = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
  const isPortrait = window.screen.height >= window.screen.width || window.matchMedia('(orientation: portrait)').matches;
  return hasTouch && isPortrait;
};

function DesktopEditor({ onBack }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTouchPortrait, setIsTouchPortrait] = useState(isTouchPortraitDevice);
  const [isTouchToolsOpen, setIsTouchToolsOpen] = useState(false);
  const componentRef = useRef();
  
  const { addTextRow, stopPlayback, isPlaying, togglePlay } = useContext(MusicContext);

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

  useEffect(() => markEditorUsable('desktop'), []);

  useEffect(() => {
    const detectTouchPortrait = () => setIsTouchPortrait(isTouchPortraitDevice());
    window.addEventListener('resize', detectTouchPortrait);
    window.addEventListener('orientationchange', detectTouchPortrait);
    return () => {
      window.removeEventListener('resize', detectTouchPortrait);
      window.removeEventListener('orientationchange', detectTouchPortrait);
    };
  }, []);

  const openEditorPanel = (panel) => {
    window.dispatchEvent(new CustomEvent('tme-open-editor-panel', { detail: { panel } }));
    setIsTouchToolsOpen(false);
  };

  return (
    <div id="music-editor-root" className={`h-screen w-full flex flex-col bg-slate-100 font-sans overflow-hidden ${isTouchPortrait ? 'touch-desktop-editor' : ''}`}>
      {isTouchPortrait && <style>{`
        .touch-desktop-editor .editor-tool-sidebar {
          width: min(820px, calc(100vw - 72px)) !important;
        }
        .touch-desktop-editor .editor-tool-sidebar > div.absolute {
          display: none !important;
        }
        .touch-desktop-editor .editor-tool-sidebar .tool-tab-header {
          min-height: 92px !important;
          padding: 20px 24px !important;
        }
        .touch-desktop-editor .editor-tool-sidebar .tool-tab-header h3 {
          font-size: 22px !important;
        }
        .touch-desktop-editor .editor-tool-sidebar .tool-tab-header p,
        .touch-desktop-editor .editor-tool-sidebar .tool-tab-body label,
        .touch-desktop-editor .editor-tool-sidebar .tool-tab-body h4 {
          font-size: 18px !important;
        }
        .touch-desktop-editor .editor-tool-sidebar .tool-tab-body {
          padding: 22px !important;
          gap: 18px !important;
        }
        .touch-desktop-editor .editor-tool-sidebar .tool-tab-body button,
        .touch-desktop-editor .editor-tool-sidebar .tool-tab-body input,
        .touch-desktop-editor .editor-tool-sidebar .tool-tab-body select {
          min-height: 58px;
          font-size: 18px !important;
        }
        .touch-desktop-editor .touch-project-settings {
          width: min(900px, calc(100vw - 48px)) !important;
          max-width: none !important;
          max-height: 82vh !important;
        }
        .touch-desktop-editor .touch-project-settings button,
        .touch-desktop-editor .touch-project-settings input,
        .touch-desktop-editor .touch-project-settings select,
        .touch-desktop-editor .touch-project-settings textarea {
          min-height: 52px;
          font-size: 17px !important;
        }
        .touch-desktop-editor .playback-controls-container button {
          min-height: 50px;
          min-width: 50px;
        }
        .touch-desktop-editor .playback-controls-container input:not([type="range"]),
        .touch-desktop-editor .playback-controls-container select {
          min-height: 50px;
          font-size: 17px !important;
        }
        .touch-desktop-editor .playback-controls-container > div:last-child {
          height: 82px !important;
          padding-top: 15px !important;
          padding-bottom: 15px !important;
        }
        .touch-desktop-editor .editor-keyboard [id^="kbd-key-"] {
          min-width: 72px !important;
          min-height: 92px !important;
        }
      `}</style>}
      
      <Navbar onPrint={handlePrint} onOpenSettings={handleOpenSettings} onBack={onBack} />

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* แผงสไลด์ด้านซ้ายที่ถูกแยกออกไป */}
        <EditorSidebar />

        {/* พื้นที่หลัก */}
        <main className="relative z-0 isolate flex flex-1 flex-col overflow-hidden bg-[#f0f4f8]">
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

      {isTouchPortrait && (
        <>
          <div className="fixed right-5 top-1/2 z-[900] flex -translate-y-1/2 flex-col items-end gap-3 print:hidden">
            <button
              type="button"
              onClick={togglePlay}
              className={`flex h-20 min-w-20 items-center justify-center rounded-full border-4 border-white px-5 text-lg font-black text-white shadow-2xl active:scale-95 ${isPlaying ? 'bg-rose-600' : 'bg-emerald-600'}`}
              aria-label={isPlaying ? 'หยุดเล่นเพลง' : 'เล่นเพลง'}
            >
              {isPlaying ? 'หยุด' : 'เล่น'}
            </button>
            <button
              type="button"
              onClick={() => { window.dispatchEvent(new Event('tme-open-keyboard')); window.dispatchEvent(new CustomEvent('tme-sheet-zoom', { detail: { value: 160 } })); }}
              className="flex h-20 min-w-20 items-center justify-center rounded-full border-4 border-white bg-indigo-600 px-5 text-lg font-black text-white shadow-2xl active:scale-95"
              aria-label="เปิดคีย์บอร์ดและขยายกระดาษ"
            >
              โน้ต
            </button>
            <button
              type="button"
              onClick={() => setIsTouchToolsOpen(true)}
              className="flex h-24 min-w-24 flex-col items-center justify-center rounded-full border-4 border-white bg-sky-600 px-4 text-lg font-black leading-tight text-white shadow-2xl active:scale-95"
              aria-label="เปิดศูนย์ควบคุมมือถือ"
            >
              <span>เมนูใหญ่</span>
              <span className="text-sm">เครื่องมือ</span>
            </button>
          </div>

          <TouchDesktopController
            isOpen={isTouchToolsOpen}
            onClose={() => setIsTouchToolsOpen(false)}
            onOpenSettings={handleOpenSettings}
            onPrint={handlePrint}
            onBack={onBack}
            onOpenEditorPanel={openEditorPanel}
          />
        </>
      )}
    </div>
  );
}

export default DesktopEditor;
