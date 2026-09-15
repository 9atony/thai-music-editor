import React, { useRef, useState, useEffect, useContext } from 'react';
import { useReactToPrint } from 'react-to-print';

// แก้ไข Path ให้ถอยหลัง 1 ชั้น (../) แล้วชี้ไปที่โฟลเดอร์ที่ถูกต้อง
import Navbar from '../components/layout/Navbar';
import SettingsModal from '../components/editor/SettingsModal'; 
import Keyboard from '../components/editor/Keyboard';
import Sheet from '../components/editor/Sheet';
import { MusicContext } from '../contexts/MusicContext'; 
import EditorSidebar from '../components/editor/sidebar/EditorSidebar';
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

  const touchTools = [
    { id: 'keyboard', label: 'คีย์บอร์ด', icon: '⌨️', action: () => { window.dispatchEvent(new Event('tme-open-keyboard')); setIsTouchToolsOpen(false); } },
    { id: 'settings', label: 'ตั้งค่าหลัก', icon: '⚙️', action: () => { setIsSettingsOpen(true); setIsTouchToolsOpen(false); } },
    { id: 'sequence', label: 'ลำดับเพลง', icon: '☷', action: () => openEditorPanel('sequence') },
    { id: 'labels', label: 'ป้ายกำกับ', icon: '🏷️', action: () => openEditorPanel('labels') },
    { id: 'table', label: 'ตั้งค่าตาราง', icon: '▦', action: () => openEditorPanel('table') },
    { id: 'velocity', label: 'น้ำหนักเสียง', icon: '🔊', action: () => openEditorPanel('velocity') },
    { id: 'sabat', label: 'ลูกสะบัด', icon: '⌁', action: () => openEditorPanel('sabat') },
    { id: 'kro', label: 'ลูกกรอ', icon: '↔', action: () => openEditorPanel('kro') },
  ];

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
          <button
            type="button"
            onClick={() => setIsTouchToolsOpen(true)}
            className="fixed bottom-28 right-5 z-[900] flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-full border-4 border-white bg-sky-600 text-lg font-black text-white shadow-2xl active:scale-95"
            aria-label="เปิดเครื่องมือสำหรับมือถือ"
          >
            <span className="text-3xl leading-none" aria-hidden="true">🛠️</span>
            เครื่องมือ
          </button>

          {isTouchToolsOpen && (
            <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/45 p-4" onClick={() => setIsTouchToolsOpen(false)}>
              <section className="w-[min(920px,calc(100vw-32px))] rounded-t-[36px] border border-slate-200 bg-white p-7 shadow-2xl" onClick={(event) => event.stopPropagation()} aria-label="เครื่องมือสำหรับมือถือ">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div><h2 className="text-3xl font-black text-slate-900">เรียกเครื่องมือ</h2><p className="mt-1 text-lg font-semibold text-slate-500">สำหรับมือถือแนวตั้งในโหมดเว็บไซต์เดสก์ท็อป</p></div>
                  <button type="button" onClick={() => setIsTouchToolsOpen(false)} className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl font-bold text-slate-500 active:bg-slate-200" aria-label="ปิดเมนู">×</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {touchTools.map((tool) => (
                    <button key={tool.id} type="button" onClick={tool.action} className="flex min-h-24 items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 px-6 text-left text-xl font-black text-slate-800 shadow-sm active:border-sky-400 active:bg-sky-50">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-3xl shadow-sm" aria-hidden="true">{tool.icon}</span>
                      {tool.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DesktopEditor;
