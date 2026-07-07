import React from 'react';
import useDevice from './hooks/useDevice';
import DesktopEditor from './views/DesktopEditor';
import MobilePlayer from './views/MobilePlayer';

function App() {
  // เรียกใช้ Hook สำหรับตรวจสอบขนาดหน้าจอ
  const { isMobile } = useDevice();

  // ระบบสลับหน้าจออัตโนมัติ
  // ถ้าเป็นมือถือ (isMobile = true) จะแสดง MobilePlayer
  // ถ้าเป็นคอมพิวเตอร์ (isMobile = false) จะแสดง DesktopEditor
  return (
    <>
      {isMobile ? <MobilePlayer /> : <DesktopEditor />}
    </>
  );
}

export default App;