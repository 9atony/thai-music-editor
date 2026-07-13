import React, { useState, useEffect } from 'react'; // ⭐ เพิ่ม useEffect
import useDevice from './hooks/useDevice';
import DesktopEditor from './views/DesktopEditor';
import MobilePlayer from './views/MobilePlayer';
import Login from './pages/Login'; 

// ⭐ 1. นำเข้าคำสั่งของ Firebase
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase'; 

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // ⭐ 2. เพิ่ม State สำหรับจังหวะโหลดเช็กข้อมูล
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const { isMobile } = useDevice();

  // ⭐ 3. ใช้ useEffect ให้ Firebase ตรวจสอบว่าเคยล็อกอินไว้หรือไม่ ตอนเปิดเว็บครั้งแรก
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true); // ถ้ามีประวัติล็อกอิน ให้ผ่านเลย
      } else {
        setIsAuthenticated(false); // ถ้าไม่มี ค่อยให้ไปหน้า Login
      }
      setIsCheckingAuth(false); // ปิดหน้าต่างโหลด
    });

    return () => unsubscribe(); // ล้างคำสั่งเมื่อปิดหน้า
  }, []);

  // ⭐ 4. หน้าต่าง Loading... ป้องกันไม่ให้หน้า Login กระพริบขึ้นมาก่อน
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500 font-medium">
        กำลังตรวจสอบข้อมูล...
      </div>
    );
  }

  // ถ้ายังไม่ได้ล็อกอิน ให้โชว์หน้า Login
  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // ถ้าล็อกอินผ่านแล้ว ค่อยแสดงระบบสลับหน้าจอมือถือ/คอมฯ
  return (
    <>
      {isMobile ? <MobilePlayer /> : <DesktopEditor />}
    </>
  );
}

export default App;