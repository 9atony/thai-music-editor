import React, { useContext, useEffect } from "react";

import TopBar from "./tool-workspace/TopBar";
import Toolbar from "./tool-workspace/Toolbar";
import TrackPanel from "./tool-workspace/TrackPanel";
import Timeline from "./tool-workspace/Timeline";

import { WorkspaceProvider } from "../../contexts/WorkspaceContext";
import { MusicContext } from "../../contexts/MusicContext";

export default function ToolWorkspace() {
  const music = useContext(MusicContext);

  // หยุดตัวเล่นของตัวโน้ต (Music Editor) ทิ้งทันทีที่เข้ามาหน้า Arranger
  // กันเสียงจากโปรเจกต์เก่าค้างเล่นอยู่เบื้องหลัง แล้วมาซ้อนกับเสียงของ Arranger
  useEffect(() => {
    music?.stopPlayback?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WorkspaceProvider>
      {/* ⭐ เปลี่ยนเป็น fixed inset-0 z-[999] h-full เพื่อให้ลอยทับเต็มจอ 100% บังปุ่มกลับของระบบเดิมไปเลย */}
      <div className="fixed inset-0 z-[999] w-full h-full bg-[#0b0e12] text-white flex flex-col overflow-hidden">
        
        <TopBar />

        <div className="flex flex-1 min-h-0">
          <Toolbar />
          
          <div className="flex flex-1 min-w-0">
            <TrackPanel />
            <Timeline />
          </div>
        </div>

      </div>
    </WorkspaceProvider>
  );
}