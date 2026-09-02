import React, { useContext, useEffect } from "react";

import TopBar from "./tool-workspace/TopBar";
import Toolbar from "./tool-workspace/Toolbar";
import TrackPanel from "./tool-workspace/TrackPanel";
import Timeline from "./tool-workspace/Timeline";
import MixerPanel from "./tool-workspace/MixerPanel";
import NotationInputPanel from "./tool-workspace/NotationInputPanel";

import { WorkspaceProvider } from "../../contexts/WorkspaceContext";
import { MusicContext } from "../../contexts/MusicContext";

export default function ToolWorkspace({ onBack }) {
  const music = useContext(MusicContext);

  // หยุดตัวเล่นของตัวโน้ต (Music Editor) ทิ้งทันทีที่เข้ามาหน้า Arranger
  // กันเสียงจากโปรเจกต์เก่าค้างเล่นอยู่เบื้องหลัง แล้วมาซ้อนกับเสียงของ Arranger
  useEffect(() => {
    music?.stopPlayback?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WorkspaceProvider>
      <div id="workspace-overlay" className="fixed inset-0 z-[999] w-full h-full bg-[#0b0e12] text-white flex flex-col overflow-hidden">
        <div className="flex h-full flex-col items-center justify-center px-6 text-center lg:hidden">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <path d="M8 21h8M12 18v3" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">เครื่องมือจัดวงดนตรีเหมาะกับหน้าจอขนาดใหญ่</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/55">
            กรุณาเปิดด้วยคอมพิวเตอร์หรือขยายหน้าต่างให้กว้างอย่างน้อย 1024 พิกเซล เพื่อให้เห็นแทร็กและไทม์ไลน์ครบถ้วน
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-7 rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
          >
            กลับหน้ารวมเครื่องมือ
          </button>
        </div>

        <div className="hidden h-full min-h-0 flex-col lg:flex">
          <TopBar onBack={onBack} />

          <div className="flex flex-1 min-h-0">
            <Toolbar />

            <div className="flex flex-1 min-w-0 min-h-0 flex-col">
              <div className="flex flex-1 min-w-0 min-h-0">
                <TrackPanel />
                <Timeline />
              </div>
              <NotationInputPanel />
              <MixerPanel />
            </div>
          </div>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
