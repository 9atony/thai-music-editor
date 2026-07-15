import React, { useState, useEffect } from 'react';
import useDevice from './hooks/useDevice';
import DesktopEditor from './views/DesktopEditor';
import MobilePlayer from './views/MobilePlayer';
import Login from './pages/Login'; 

// ⭐ นำเข้า Layout และ Home ที่เราเพิ่งสร้าง
import DesktopLayout from './components/layout/DesktopLayout';
import Home from './pages/Home';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase'; 

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // ⭐ เพิ่ม State สำหรับคุมหน้าจอ (เริ่มต้นที่หน้า home)
  const [currentView, setCurrentView] = useState('home'); 

  const { isMobile } = useDevice();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setIsAuthenticated(true);
      else setIsAuthenticated(false);
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  if (isCheckingAuth) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500 font-medium">กำลังตรวจสอบข้อมูล...</div>;
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // ⭐ ระบบแยกหน้าจอมือถือ/คอม
  if (isMobile) {
    return <MobilePlayer />;
  }

  // ⭐ ระบบสลับหน้าจอสำหรับ Desktop
  if (currentView === 'home') {
    return (
      <DesktopLayout>
        {/* ส่งฟังก์ชันเปลี่ยนหน้าไปให้ปุ่มใน Home */}
        <Home onNewProject={() => setCurrentView('editor')} />
      </DesktopLayout>
    );
  }

  if (currentView === 'editor') {
    // โชว์หน้าแต่งเพลง (เดี๋ยวเราค่อยไปทำปุ่ม 'กลับหน้าแรก' ในหน้า Editor ทีหลัง)
    return <DesktopEditor onBack={() => setCurrentView('home')} />;
  }

  return null;
}

export default App;