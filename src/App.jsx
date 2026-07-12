import React, { useState } from 'react'; // ⭐ อย่าลืมเพิ่ม useState ตรงนี้ครับ
import useDevice from './hooks/useDevice';
import DesktopEditor from './views/DesktopEditor';
import MobilePlayer from './views/MobilePlayer';

// ⭐ 1. นำเข้าหน้า Login (เช็ก path ให้ตรงกับโฟลเดอร์ของคุณหนุ่มนะครับ ถ้าย้ายไฟล์อาจจะต้องเป็น ../pages/Login)
import Login from './pages/Login'; 

function App() {
  // ⭐ 2. สร้าง State กั้นประตูล็อกอิน
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // เรียกใช้ Hook สำหรับตรวจสอบขนาดหน้าจอ (อันเดิมของคุณหนุ่ม)
  const { isMobile } = useDevice();

  // ⭐ 3. ถ้ายังไม่ได้ล็อกอิน ให้โชว์หน้า Login
  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // ⭐ 4. ถ้าล็อกอินผ่านแล้ว ค่อยแสดงระบบสลับหน้าจอมือถือ/คอมฯ
  return (
    <>
      {isMobile ? <MobilePlayer /> : <DesktopEditor />}
    </>
  );
}

export default App;